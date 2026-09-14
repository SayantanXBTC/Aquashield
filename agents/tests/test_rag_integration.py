"""RAG integration at the graph level: role-scoped retrieval, citation
validation (only ids the retriever actually returned survive), fail-safe
behaviour when a pack isn't SUPPORTED, and one real end-to-end run against
the actual ChromaDB-backed retriever over the TEST_FIXTURE sources."""

from __future__ import annotations

from dataclasses import dataclass, field

from agents.graph.workflow.graph import AnalysisRequest, GraphDeps, run_analysis
from agents.llm.provider import LocalDeterministicProvider
from agents.schemas.evidence import NOT_CONFIGURED
from agents.tests.conftest import FakeDataAccess
from agents.tools.retrieval.evidence_retriever import EvidencePack, NotConfiguredEvidenceRetriever, build_evidence_retriever
from rag.schemas.models import EvidenceItem, RetrievalQuery


def _run(data, retriever=None, provider=None, **kw):
    deps = GraphDeps(data=data, provider=provider or LocalDeterministicProvider(), retriever=retriever or NotConfiguredEvidenceRetriever())
    return run_analysis(deps, AnalysisRequest(request_id="r", scenario_id="scn", simulation_run_id="run", frame_index=kw.pop("frame_index", 4), **kw))


@dataclass
class FakeRoleRetriever:
    """Returns a canned EvidencePack per role — SUPPORTED for the roles
    listed in `supported`, UNAVAILABLE otherwise. Records every query it
    was asked, so a test can assert the role-scoping actually happened."""

    supported: tuple[str, ...] = ("precaution", "response")
    queries: list[RetrievalQuery] = field(default_factory=list)

    def retrieve(self, query: RetrievalQuery) -> EvidencePack:
        self.queries.append(query)
        if query.role not in self.supported:
            return EvidencePack(query=query.role, role=query.role, disaster_type=query.disaster_type, evidence_status="INSUFFICIENT_EVIDENCE", retriever_version="fake", limitation_code="INSUFFICIENT_EVIDENCE", note="no match")
        item = EvidenceItem(
            evidence_id=f"RAG-fake-{query.role}-0",
            source_id="fake-source",
            authority="TEST",
            title="Fake Guidance",
            trust_level="TIER_1",
            section="Section",
            page=1,
            relevance_score=0.9,
            text_snippet=f"Guidance for the {query.role} role.",
        )
        return EvidencePack(query=query.role, role=query.role, disaster_type=query.disaster_type, evidence_status="SUPPORTED", items=[item], retriever_version="fake")


def test_evidence_retrieval_runs_once_per_tier2_role(fake_data):
    retriever = FakeRoleRetriever()
    result = _run(fake_data, retriever=retriever)
    roles = [q.role for q in retriever.queries]
    assert sorted(roles) == ["precaution", "response"]
    assert all(q.disaster_type == "tsunami" for q in retriever.queries)
    # evidence_retrieval reported its own execution record for the HUD.
    ran = {r.agent for r in result.state.command_brief.agent_runs}
    assert "evidence_retrieval" in ran


def test_local_provider_cites_only_ids_the_retriever_actually_returned(fake_data):
    retriever = FakeRoleRetriever()
    brief = _run(fake_data, retriever=retriever).state.command_brief
    cited = [a for a in [*brief.precautions, *brief.recommended_actions] if a.citations]
    assert cited
    for action in cited:
        assert all(c.startswith("RAG-fake-") for c in action.citations)
    known_ids = {item.evidence_id for item in brief.evidence_citations}
    assert known_ids and known_ids <= {"RAG-fake-precaution-0", "RAG-fake-response-0"}
    # A claim mapping was built for the cited action, marked EVIDENCE_GROUNDED.
    grounded = [c for c in brief.claim_mappings if c.claim_type == "EVIDENCE_GROUNDED"]
    assert grounded and all(c.validation_status == "SUPPORTED" for c in grounded)


def test_safety_validator_drops_a_citation_the_pack_never_returned(fake_data):
    class FabricatingProvider(LocalDeterministicProvider):
        def generate(self, *, task, system, payload, output_model):
            result = super().generate(task=task, system=system, payload=payload, output_model=output_model)
            if task in ("precaution_set", "response_plan"):
                items = result.precautions if task == "precaution_set" else result.actions
                for item in items:
                    item.citations = ["RAG-totally-invented-id"]
            return result

    retriever = FakeRoleRetriever()
    brief = _run(fake_data, retriever=retriever, provider=FabricatingProvider()).state.command_brief
    everything = [*brief.precautions, *brief.recommended_actions]
    assert everything  # the fixture always produces at least one action
    assert all("RAG-totally-invented-id" not in a.citations for a in everything)
    assert any("stripped citation" in note and "RAG-totally-invented-id" in note for note in brief.validation_notes)
    assert not brief.evidence_citations


def test_role_scoped_evidence_status_becomes_a_named_limitation(fake_data):
    retriever = FakeRoleRetriever(supported=("precaution",))  # response gets nothing
    brief = _run(fake_data, retriever=retriever).state.command_brief
    codes = {(l.code, l.subject) for l in brief.data_limitations}
    assert ("INSUFFICIENT_EVIDENCE", "regulatory_evidence:response") in codes
    assert not any(subject == "regulatory_evidence:precaution" for _, subject in codes)


def test_not_configured_retriever_never_produces_a_citation(fake_data):
    brief = _run(fake_data).state.command_brief  # default retriever: NotConfiguredEvidenceRetriever
    assert brief.evidence_citations == []
    assert all(not a.citations for a in [*brief.precautions, *brief.recommended_actions])
    codes = {(l.code, l.subject) for l in brief.data_limitations}
    assert (NOT_CONFIGURED, "regulatory_evidence:precaution") in codes
    assert (NOT_CONFIGURED, "regulatory_evidence:response") in codes


def test_no_frame_skips_retrieval_entirely():
    retriever = FakeRoleRetriever()
    _run(FakeDataAccess(run_status="pending", frame_count=None), retriever=retriever)
    assert retriever.queries == []


def test_evidence_retrieval_failure_is_fail_safe_not_a_crash(fake_data):
    class BrokenRetriever:
        def retrieve(self, query):
            raise RuntimeError("vector store outage")

    # evidence_retrieval is not wrapped by the generic _analysis_node try/except
    # (it never calls the LLM provider) — this asserts the graph as a whole
    # still degrades to a FAILED run with the error recorded rather than an
    # unhandled exception reaching the caller.
    result = _run(fake_data, retriever=BrokenRetriever())
    assert result.state.status == "FAILED"
    assert result.state.errors


def test_real_chroma_retriever_end_to_end(fake_data, tmp_path):
    """The actual pipeline: TEST_FIXTURE sources ingested into a real
    (tmp_path-scoped) Chroma collection, retrieved through the real
    HybridRetriever, cited by the local deterministic provider, and kept by
    the Safety Validator because the id genuinely exists in the pack."""

    from pathlib import Path

    from rag.embeddings.provider import DeterministicHashEmbedding
    from rag.pipelines.full_ingestion import ingest_all
    from rag.vectorstore.chroma_store import ChromaVectorStore

    repo_root = Path(__file__).resolve().parents[2]
    fixtures_dir = repo_root / "rag" / "tests" / "fixtures"
    vector_store = ChromaVectorStore(persist_directory=tmp_path / "chroma")
    embedding_provider = DeterministicHashEmbedding()
    outcomes = ingest_all(fixtures_dir, repo_root=repo_root, vector_store=vector_store, embedding_provider=embedding_provider, is_test_fixture=True)
    assert all(o.error is None for o in outcomes)

    retriever = build_evidence_retriever("chroma", persist_directory=str(tmp_path / "chroma"), embedding_provider_name="local")
    brief = _run(fake_data, retriever=retriever).state.command_brief

    assert brief.evidence_citations
    assert all(item.source_id == "test-fixture-tsunami-preparedness" or item.source_id == "test-fixture-general-coordination" for item in brief.evidence_citations)
    cited_actions = [a for a in [*brief.precautions, *brief.recommended_actions] if a.citations]
    assert cited_actions
    grounded_claims = [c for c in brief.claim_mappings if c.claim_type == "EVIDENCE_GROUNDED"]
    assert grounded_claims
