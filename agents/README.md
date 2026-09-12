# Agents — AQUASHIELD

LangGraph multi-agent AI system. Reads structured simulation state (from simulation/ via backend/) and retrieved knowledge (from rag/); it interprets, it does not invent physical outcomes (see CLAUDE.md §5).

Implemented (Prompt 14 — docs/agents/ai-layer.md): `schemas/` (state, evidence, outputs, brief),
`tools/` (read-only data-access Protocol, tool runner, sanitizer, RAG stub), `llm/` (provider abstraction +
deterministic local rules), `prompts/versions.py`, `agents/{state_evaluator,vulnerability,tactical,command}`
(the four nodes), `graph/workflow/graph.py` (StateGraph + runner), `tests/`.
