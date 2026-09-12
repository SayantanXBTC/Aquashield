# RAG Pipeline (Prompt 16)

Disaster-aware retrieval-augmented generation, grounding the Precaution and Response agents' advice in
authoritative-source excerpts. `rag/` is standalone — no FastAPI, SQLAlchemy or React import anywhere in the
package (architecture.md ADR-008). Full architecture: architecture.md §10, §30b. Rules: CLAUDE.md §26b.

## Pipeline

```
rag/sources/<category>/*.{md,txt,pdf}   (real authoritative sources only)
rag/tests/fixtures/*.md                 (TEST_FIXTURE material for CI, never mixed with the above)
        │
        ▼  rag/parsing/parsers.py
   ParsedDocument (metadata + raw text, \f-separated by page)
        │
        ▼  rag/chunking/chunker.py
   list[ChunkDraft]  (500-1000 "tokens", never spans a section/page change)
        │
        ▼  rag/embeddings/provider.py
   list[vector]      (DeterministicHashEmbedding by default — no network, no credits)
        │
        ▼  rag/vectorstore/chroma_store.py
   ChromaDB `aquashield_evidence` collection (cosine distance)
        │
        ▼  rag/retrieval/retriever.py (HybridRetriever)
   EvidencePack        (role-scoped, disaster-type filtered, threshold-rejected)
```

`rag/ingestion/pipeline.py` composes parse → chunk → embed → upsert for one file, framework-free. The
idempotent "skip if checksum unchanged" decision needs a durable registry, so it lives in
`backend/app/services/rag_ingestion_service.py` — the same bridging pattern `ai_data_access.py` and
`simulation_service.py` already establish for agents and the simulation engine respectively.

### Source metadata

A `.md` source carries its metadata as YAML-lite frontmatter (`---` delimited, flat `key: value`, `[a, b]`
lists — no external YAML dependency). `.txt`/`.pdf` sources need a sibling `<file>.meta.json` with the same
fields. Required: `source_id`, `title`, `publisher`, `authority`, `trust_level` (`TIER_1`…`TIER_4`),
`disaster_types` (one or more of `flood | cyclone | tsunami | oil_spill | pollution | search_rescue |
environmental | general`). Optional: `url`, `publication_date`.

**Never add a document to `rag/sources/` unless it is a real, identified authoritative source**
(rag/sources/README.md) — placeholder or synthetic content belongs only under `rag/tests/fixtures/`, always
ingested with `is_test_fixture=True` and `authority: TEST_FIXTURE`.

## Retrieval

`RetrievalQuery` (`role`, `disaster_type`, `hazard_summary`, `impacted_asset_types`, `operator_question`,
`limit`) is built by the graph's `evidence_retrieval` node from the Context Collector's payload and Tier 1's
findings. `rag/retrieval/query_builder.py` phrases the query text per role — the same hazard state produces
different vocabulary for the Hazard Analyst (thresholds, dynamics) than for the Precaution Agent (life
safety, evacuation), which retrieves different sections of the same document.

`HybridRetriever` embeds the query, filters Chroma by `disaster_types ∈ {this type, "general"}`, ranks by
cosine similarity, and keeps only items at or above `RAG_RELEVANCE_THRESHOLD` (default 0.15) — a
`DeterministicHashEmbedding`-scaled default; retune if a real embedding model with different score ranges is
wired in. Kept items are sorted by trust level first, relevance second, so an official source outranks a
secondary summary of the same guidance.

`EvidencePack.evidence_status`: `SUPPORTED` (something relevant found), `INSUFFICIENT_EVIDENCE` (retrieval
ran but nothing cleared the threshold, or no source is ingested for that category), `UNAVAILABLE` (the
retriever isn't configured, or the vector store errored — never surfaced as a 500).

## Graph wiring

```
… hazard_agent ‖ damage_agent ‖ risk_agent (Tier 1)
              │
              ▼
      evidence_retrieval        ── one EvidencePack per role: "precaution", "response"
              │
   precaution_agent ‖ response_agent (Tier 2)
```

Conditional routing skips `evidence_retrieval` along with the rest of the analysis tiers when the Context
Collector finds no analysable frame — no retrieval, no LLM call, for an empty frame.

**Citations are verified, never trusted.** A Precaution/Response action may put a retrieved
`EvidenceItem.evidence_id` in its `citations`. `SafetyValidator.validate_citations`
(agents/agents/command/synthesis.py) keeps only ids that literally exist in the `EvidencePack` that node was
actually given; anything else — hallucinated, or an attempt to reuse a simulation `E`-id as a RAG citation —
is dropped and recorded in `validation_notes`. Retrieved `text_snippet` text is quoted data throughout
(`RAG_GUARDRAILS`, agents/prompts/versions.py) — an authoritative document's text can never become an
instruction to the agent reading it, the same discipline the sanitized `operator_question` already follows.

A non-`SUPPORTED` pack becomes a `DataLimitation` on the brief with `subject="regulatory_evidence:<role>"` —
never silently absent, so an operator can tell "no guidance found" from "not asked".

The local deterministic provider (`agents/llm/local_rules.py`) also cites: when a role's pack is `SUPPORTED`,
it cites the single most relevant item on the actions it produces — deterministic, offline-testable, and
re-checked by the same validator a hosted provider's citations go through.

## Providers

| Domain | Default | Alternative |
|---|---|---|
| Embeddings | `local` (`DeterministicHashEmbedding`, no network) | none yet — a hosted embeddings API is a documented gap, not implemented (Anthropic has no embeddings endpoint) |
| Retriever | `none` (`NotConfiguredEvidenceRetriever` → `NOT_CONFIGURED`) | `chroma` (`HybridRetriever` over the real collection) |

Both are set via `RAG_PROVIDER` / `RAG_EMBEDDING_PROVIDER` (backend/.env.example). `RAG_PROVIDER=none` is
the production default until an operator has actually ingested real sources — flipping it on with an empty
collection is safe (every retrieval reads `INSUFFICIENT_EVIDENCE`), just not useful yet.

## Postgres registry

`rag_sources` (one row per ingested document: checksum, trust level, disaster categories, chunk count) and
`rag_ingestion_log` (append-only: every ingestion attempt, including `skipped` and `failed`) — migration
`1bc3c8e45abe`. Chunks and embeddings live only in ChromaDB, never in Postgres (CLAUDE.md §24, mirroring
`SimulationArtifact`).

## API

- `POST /rag/retrieve` (auth required) — exercises the retriever directly, the same call
  `evidence_retrieval` makes, outside a full analysis run.
- `GET /rag/sources`, `GET /rag/sources/{source_id}` (unauthenticated, like `/disaster-types` — the registry
  is shared knowledge, not user data).
- `GET /rag/health` — provider, whether it's configured, source and chunk counts.

`RAG_RETRIEVAL_STARTED`, `RAG_RETRIEVAL_COMPLETED`, `AGENT_EVIDENCE_ATTACHED` ride the existing `/ws/ai`
event bus (docs/agents/ai-layer.md) — no second socket.

## CLI

```
python -m rag ingest [--source <path-or-source_id>] [--root <dir>] [--fixtures] [--force]
python -m rag validate [--root <dir>] [--fixtures]
python -m rag list-sources [--disaster-type <type>]
```

Requested as `python -m rag.ingest` / `rag.validate` / `rag.list-sources` — `-m` needs a valid module path,
and `list-sources` isn't a valid Python identifier (the hyphen), so this ships as one `rag/__main__.py` with
argparse subcommands instead. It is the only file in `rag/` allowed to import `backend.app` (to reach the
Postgres registry), bootstrapping both onto `sys.path` the way `backend/app/main.py` bootstraps the reverse
direction for `simulation.*`.

Example, ingesting the TEST_FIXTURE sources against the local dev database:

```
DATABASE_URL=postgresql+psycopg://aquashield:@localhost:5433/aquashield \
  RAG_VECTORSTORE_DIR=/tmp/rag-demo \
  .venv/bin/python -m rag ingest --fixtures
```

## Tests

- `rag/tests/` (25) — parsing, chunking (including the page-break/heading-flush edge cases), embeddings,
  ingestion idempotency, hybrid retrieval (threshold rejection, disaster-type boundaries, general-guidance
  bleed-through, vector-store-outage fail-safety) — all offline, no Postgres, no network.
- `agents/tests/test_rag_integration.py` (8) — role-scoped retrieval at the graph level, citation validation
  (an invented id is dropped, a real one survives), fail-safe behaviour when a pack isn't `SUPPORTED`, and
  one real end-to-end run through `ChromaVectorStore` + `HybridRetriever` against the TEST_FIXTURE sources.
- `backend/tests/test_rag_ingestion_service.py` (7), `backend/tests/api/test_rag.py` (11) — the Postgres
  bridge and the `/rag/*` endpoints, `RAG_PROVIDER=chroma` end-to-end.
- `backend/tests/api/test_ai_analysis.py::test_analyze_frame_carries_real_rag_citations_end_to_end` — the
  full path from `/ai/analyze-frame` through to a persisted `CommandBrief.evidence_citations` with real
  citations, run against a real (tmp_path-scoped) Chroma collection.

## Known limitations

- `DeterministicHashEmbedding` is a bag-of-hashed-words vector, not a semantic embedding model — good enough
  for deterministic, offline-testable ranking and threshold rejection; retrieval quality against real
  authoritative documents will improve once a hosted embeddings provider is wired in (a documented gap, see
  ADR-008).
- PDF parsing (`pypdf`) extracts text layers only — a scanned/image-only PDF raises `ParseError` rather than
  silently returning nothing; OCR is out of scope.
- The disaster-type metadata filter matches by scanning every distinct stored `disaster_types` combination
  (`ChromaVectorStore._candidate_disaster_keys`) rather than a native list-membership query — Chroma's
  metadata filtering doesn't support "is X in this field's list" directly. Cheap at the scale a curated
  authoritative-source library actually reaches; revisit if the source count grows into the thousands.
