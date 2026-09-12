"""Join node — Synthesis & Safety Validator.

Takes Agent 2's analysis and Agent 3's plan and lets through ONLY what is
tied to evidence the Context Collector produced:

  * every cited evidence id must exist;
  * every number in a statement must appear in the cited evidence (values or
    summary) — an LLM cannot state a water level the simulation didn't;
  * forbidden certainty words (destroyed, casualties, …) strip the claim;
  * every action is human-gated and its resources are RESOURCE_DATA_UNAVAILABLE.

What was stripped is recorded in `validation_notes` (audit visibility, not
chain-of-thought). The narrative is generated last, over the validated
findings, and re-checked against the full evidence set; if it fails, the
deterministic local narrative replaces it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable

from agents.llm import local_rules
from agents.llm.provider import LLMProvider, LLMProviderError
from agents.prompts.versions import SYNTHESIS_SYSTEM
from agents.schemas.brief import AgentRun, CommandBrief
from agents.schemas.context import ContextPayload
from agents.schemas.evidence import RESOURCE_DATA_UNAVAILABLE, DataLimitation, EvidenceRef
from agents.schemas.outputs import (
    DamageAssessment,
    ExposureFinding,
    GroundedStatement,
    HazardAssessment,
    ImpactAnalysis,
    PrecautionSet,
    Priority,
    RecommendedAction,
    ResponsePlan,
    RiskAssessment,
    SituationNarrative,
    TacticalPlan,
)
from agents.tools.retrieval.evidence_retriever import ClaimMapping, EvidenceItem, EvidencePack

AGENT_NAME = "synthesis_safety"
TASK = "situation_narrative"

FORBIDDEN_TERMS = re.compile(r"\b(destroyed|destruction|casualt(y|ies)|fatalit(y|ies)|deaths?|killed|collapsed|wiped out|obliterated)\b", re.IGNORECASE)
_NUMBER_RE = re.compile(r"(?<![A-Za-z_])-?\d+(?:\.\d+)?")
_ID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def _numbers_in(text: str) -> list[str]:
    scrubbed = _ID_RE.sub(" ", text)
    return _NUMBER_RE.findall(scrubbed)


def _evidence_number_tokens(evidence: Iterable[EvidenceRef]) -> tuple[set[str], list[float]]:
    tokens: set[str] = set()
    numeric: list[float] = []
    for e in evidence:
        tokens.update(_numbers_in(e.summary))
        for v in e.values.values():
            if isinstance(v, bool):
                continue
            if isinstance(v, (int, float)):
                numeric.append(float(v))
                tokens.add(f"{v:g}" if isinstance(v, float) else str(v))
            elif isinstance(v, str):
                tokens.update(_numbers_in(v))
        if e.frame_index is not None:
            tokens.add(str(e.frame_index))
    return tokens, numeric


def _number_grounded(token: str, tokens: set[str], numeric: list[float]) -> bool:
    if token in tokens:
        return True
    try:
        n = float(token)
    except ValueError:
        return False
    decimals = len(token.split(".")[1]) if "." in token else 0
    for v in numeric:
        if abs(v - n) < 1e-6 or round(v, decimals) == n:
            return True
    return False


class SafetyValidator:
    def __init__(self, context: ContextPayload) -> None:
        self.context = context
        self.known = {e.id: e for e in context.evidence}
        self.notes: list[str] = []
        self._all_tokens, self._all_numeric = _evidence_number_tokens(context.evidence)
        # Every EvidenceItem actually resolved from a citation somewhere in
        # this brief — deduped by id, in first-seen order.
        self.resolved_citations: dict[str, EvidenceItem] = {}

    def validate_citations(self, citation_ids: list[str], pack: EvidencePack | None, *, label: str) -> list[str]:
        """Keeps only ids that literally exist in `pack.items` — an agent
        (local or hosted) can claim any string; only what the retriever
        actually returned can become a citation. Anything else is dropped
        and recorded, exactly like an unknown simulation evidence id."""

        if not citation_ids:
            return []
        by_id = {item.evidence_id: item for item in (pack.items if pack else [])}
        kept: list[str] = []
        for cid in citation_ids:
            item = by_id.get(cid)
            if item is None:
                self.notes.append(f"stripped citation on {label}: {cid!r} is not in the retrieved evidence pack")
                continue
            kept.append(cid)
            self.resolved_citations.setdefault(cid, item)
        return kept

    def _cited(self, ids: list[str]) -> list[EvidenceRef] | None:
        if not ids:
            return None
        refs = []
        for i in ids:
            if i not in self.known:
                return None
            refs.append(self.known[i])
        return refs

    def check_text(self, text: str, evidence_ids: list[str], *, label: str) -> bool:
        refs = self._cited(evidence_ids)
        if refs is None:
            self.notes.append(f"stripped {label}: cites unknown or no evidence ({evidence_ids})")
            return False
        if FORBIDDEN_TERMS.search(text):
            self.notes.append(f"stripped {label}: asserts destruction/casualties, which the simulation cannot support")
            return False
        tokens, numeric = _evidence_number_tokens(refs)
        for token in _numbers_in(text):
            if not _number_grounded(token, tokens, numeric):
                self.notes.append(f"stripped {label}: number {token} not present in cited evidence")
                return False
        return True

    def narrative_grounded(self, text: str) -> bool:
        if FORBIDDEN_TERMS.search(text):
            return False
        return all(_number_grounded(t, self._all_tokens, self._all_numeric) for t in _numbers_in(text))

    def validate_impact(self, analysis: ImpactAnalysis | None) -> tuple[list[GroundedStatement], list[ExposureFinding], str]:
        if analysis is None:
            self.notes.append("impact analysis unavailable (agent did not complete)")
            return [], [], "unknown"
        statements = [s for s in analysis.hazard_progression.statements if self.check_text(s.statement, s.evidence_ids, label="progression statement")]
        exposures = [x for x in analysis.exposures if self.check_text(x.statement, x.evidence_ids, label=f"exposure finding '{x.subject}'")]
        return statements, exposures, analysis.hazard_progression.trend

    def validate_actions(self, actions: list[RecommendedAction], *, kind: str, pack: EvidencePack | None = None) -> list[RecommendedAction]:
        """Same gate as validate_plan's action pass, for the Prompt 15
        Precaution and Response agents' separate lists. `citations` are
        validated independently of `evidence_ids`: a precaution can have
        neither, either, or both, but a citation naming an id outside
        `pack.items` is dropped, never rendered."""

        kept: list[RecommendedAction] = []
        for a in actions:
            label = f"{kind} '{a.action[:40]}'"
            if not self.check_text(" ".join([a.action, *a.prerequisites, *a.risks]), a.evidence_ids, label=label):
                continue
            citations = self.validate_citations(a.citations, pack, label=label)
            kept.append(a.model_copy(update={"requires_human_approval": True, "resources": RESOURCE_DATA_UNAVAILABLE, "citations": citations}))
        return kept

    def validate_priorities(self, priorities: list[Priority]) -> list[Priority]:
        return [p for p in priorities if self.check_text(p.rationale, p.evidence_ids, label=f"priority '{p.subject}'")]

    def validate_plan(self, plan: TacticalPlan | None) -> tuple[list[Priority], list[RecommendedAction]]:
        if plan is None:
            self.notes.append("tactical plan unavailable (agent did not complete)")
            return [], []
        priorities = [p for p in plan.priorities if self.check_text(p.rationale, p.evidence_ids, label=f"priority '{p.subject}'")]
        actions: list[RecommendedAction] = []
        for a in plan.actions:
            if not self.check_text(" ".join([a.action, *a.prerequisites, *a.risks]), a.evidence_ids, label=f"action '{a.action[:40]}'"):
                continue
            actions.append(a.model_copy(update={"requires_human_approval": True, "resources": RESOURCE_DATA_UNAVAILABLE}))
        return priorities, actions




# --- Prompt 15: the Safety Validator and the Command Synthesizer are two
# separate graph nodes. `validate_findings` is the validator; `build_command_
# brief` is the synthesizer. The single-call `synthesize()` the pre-Prompt-15
# two-agent graph used has no callers left (agents/graph/workflow/graph.py
# calls the two split functions) and was removed rather than kept alongside
# a second, unmaintained EvidenceRetriever call site.

VALIDATOR_AGENT_NAME = "safety_validator"
SYNTHESIZER_AGENT_NAME = "command_synthesizer"


@dataclass
class ValidatedFindings:
    """Only what survived the Safety Validator. Nothing else reaches the brief."""

    trend: str = "unknown"
    progression: list[GroundedStatement] = field(default_factory=list)
    exposures: list[ExposureFinding] = field(default_factory=list)
    priorities: list[Priority] = field(default_factory=list)
    precautions: list[RecommendedAction] = field(default_factory=list)
    actions: list[RecommendedAction] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    uncertainties: list[str] = field(default_factory=list)
    limitations: list[DataLimitation] = field(default_factory=list)
    evidence_citations: list[EvidenceItem] = field(default_factory=list)
    claim_mappings: list[ClaimMapping] = field(default_factory=list)


def _claim(text: str, claim_type: str, evidence_ids: list[str], citations: list[str]) -> ClaimMapping:
    supported = [*evidence_ids, *citations]
    status = "SUPPORTED" if supported else "UNSUPPORTED"
    return ClaimMapping(claim_text=text[:600], claim_type=claim_type, supported_by=supported, validation_status=status)  # type: ignore[arg-type]


def validate_findings(
    context: ContextPayload,
    *,
    hazard: HazardAssessment | None,
    damage: DamageAssessment | None,
    risk: RiskAssessment | None,
    precautions: PrecautionSet | None,
    response: ResponsePlan | None,
    evidence_packs: dict[str, EvidencePack] | None = None,
) -> ValidatedFindings:
    """Runs every Tier 1/Tier 2 output through the same evidence gate: unknown
    evidence ids, ungrounded numbers and destruction/casualty wording are
    stripped and recorded. A missing (FAILED) agent costs only its own
    section — the brief still builds (fail-safe partial run)."""

    validator = SafetyValidator(context)
    trend = "unknown"
    progression: list[GroundedStatement] = []
    if hazard is None:
        validator.notes.append("hazard assessment unavailable (agent did not complete)")
    else:
        trend = hazard.hazard_progression.trend
        progression = [s for s in hazard.hazard_progression.statements if validator.check_text(s.statement, s.evidence_ids, label="progression statement")]

    exposures: list[ExposureFinding] = []
    if damage is None:
        validator.notes.append("damage assessment unavailable (agent did not complete)")
    else:
        exposures = [x for x in damage.exposures if validator.check_text(x.statement, x.evidence_ids, label=f"exposure finding '{x.subject}'")]

    ranked: list[Priority] = []
    if risk is None:
        validator.notes.append("risk assessment unavailable (agent did not complete)")
    else:
        ranked = validator.validate_priorities(risk.priorities)

    packs = evidence_packs or {}
    precaution_pack = packs.get("precaution")
    response_pack = packs.get("response")

    kept_precautions: list[RecommendedAction] = []
    if precautions is None:
        validator.notes.append("precautions unavailable (agent did not complete)")
    else:
        kept_precautions = validator.validate_actions(precautions.precautions, kind="precaution", pack=precaution_pack)

    kept_actions: list[RecommendedAction] = []
    if response is None:
        validator.notes.append("response plan unavailable (agent did not complete)")
    else:
        kept_actions = validator.validate_actions(response.actions, kind="action", pack=response_pack)

    # A pack that wasn't SUPPORTED becomes an explicit limitation, exactly
    # like the pre-RAG NOT_CONFIGURED retriever result did — never silently
    # absent, so an operator can tell "no guidance found" from "not asked".
    limitations: list[DataLimitation] = []
    for role, pack in packs.items():
        if pack.evidence_status != "SUPPORTED":
            limitations.append(DataLimitation(code=pack.limitation_code or pack.evidence_status, subject=f"regulatory_evidence:{role}", detail=pack.note or f"No authoritative evidence for the {role} role."))

    uncertainties = list(
        dict.fromkeys(
            [
                *(hazard.uncertainties if hazard else []),
                *(damage.uncertainties if damage else []),
                *(risk.uncertainties if risk else []),
                *(precautions.uncertainties if precautions else []),
                *(response.uncertainties if response else []),
            ]
        )
    )

    claim_mappings = [
        *(_claim(s.statement, "OBSERVED", s.evidence_ids, []) for s in progression),
        *(_claim(x.statement, "CALCULATED", x.evidence_ids, []) for x in exposures),
        *(_claim(a.action, "EVIDENCE_GROUNDED" if a.citations else "RECOMMENDED", a.evidence_ids, a.citations) for a in [*kept_precautions, *kept_actions]),
    ]

    return ValidatedFindings(
        trend=trend,
        progression=progression,
        exposures=exposures,
        priorities=ranked,
        precautions=kept_precautions,
        actions=kept_actions,
        notes=validator.notes,
        uncertainties=uncertainties,
        limitations=limitations,
        evidence_citations=list(validator.resolved_citations.values()),
        claim_mappings=claim_mappings,
    )


def build_command_brief(
    *,
    provider: LLMProvider,
    context: ContextPayload,
    findings: ValidatedFindings,
    agent_runs: list[AgentRun],
    extra_uncertainties: list[str],
    extra_limitations: list[DataLimitation],
) -> CommandBrief:
    """Command Synthesizer — writes the narrative over ALREADY-VALIDATED
    findings and assembles the brief. The narrative is re-checked against the
    full evidence set; if it fails, the deterministic narrative replaces it.

    Regulatory/authoritative retrieval already happened earlier in the graph
    (the evidence_retrieval node, role-scoped for Precaution/Response) —
    `findings.limitations` already carries a DataLimitation for any pack
    that wasn't SUPPORTED, so this node does not call the retriever again."""

    notes = list(findings.notes)
    limitations = list(context.limitations) + list(extra_limitations) + list(findings.limitations)

    validator = SafetyValidator(context)
    validated: dict[str, Any] = {
        "trend": findings.trend,
        "hazard_progression": [s.model_dump() for s in findings.progression],
        "key_exposures": [x.model_dump() for x in findings.exposures],
        "priorities": [p.model_dump() for p in findings.priorities],
        "precautions": [a.model_dump() for a in findings.precautions],
        "actions": [a.model_dump() for a in findings.actions],
    }
    narrative_payload = {"context": context.model_dump(mode="json"), "validated": validated}
    try:
        narrative = provider.generate(task=TASK, system=SYNTHESIS_SYSTEM, payload=narrative_payload, output_model=SituationNarrative)
        if not (validator.narrative_grounded(narrative.situation) and validator.narrative_grounded(narrative.current_hazard)):
            notes.append("narrative from provider contained ungrounded numbers or forbidden certainty; replaced with deterministic narrative")
            narrative = SituationNarrative.model_validate(local_rules.situation_narrative(narrative_payload))
    except LLMProviderError as exc:
        notes.append(f"narrative provider failed ({exc}); deterministic narrative used")
        narrative = SituationNarrative.model_validate(local_rules.situation_narrative(narrative_payload))

    return CommandBrief(
        scenario_id=context.scenario_id,
        simulation_run_id=context.simulation_run_id,
        frame_index=context.frame_index,
        generated_at=datetime.now(timezone.utc),
        situation=narrative.situation,
        current_hazard=narrative.current_hazard,
        hazard_progression=findings.progression,
        key_exposures=findings.exposures,
        priorities=findings.priorities,
        precautions=findings.precautions,
        recommended_actions=findings.actions,
        resource_status=RESOURCE_DATA_UNAVAILABLE,
        agent_runs=agent_runs,
        evidence_references=list(context.evidence),
        evidence_citations=findings.evidence_citations,
        claim_mappings=findings.claim_mappings,
        data_limitations=limitations,
        uncertainties=list(dict.fromkeys([*findings.uncertainties, *extra_uncertainties])),
        validation_notes=notes,
    )
