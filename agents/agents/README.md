# agents/ (agent implementations)

One subfolder per agent (see architecture.md §9/§10).

- state_evaluator/ — determines active disaster, available state, required analysis
- vulnerability/ — population/infrastructure/ecosystem exposure analysis
- tactical/ — disaster-specific response reasoning
- regulatory/ — RAG-backed authoritative knowledge retrieval
- command/ — synthesizes everything into an Incident Action Plan
