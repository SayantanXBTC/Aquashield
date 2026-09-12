"""AQUASHIELD RAG — disaster-aware retrieval-augmented generation.

Standalone domain, like `simulation/` and `agents/`: no FastAPI, no
SQLAlchemy, no React import anywhere in this package. Agents reach it only
through `agents/tools/retrieval/` (rag/README.md); the backend bridges the
Postgres source registry the same way `ai_data_access.py` bridges agents to
Postgres (`backend/app/services/rag_ingestion_service.py`,
`rag_retrieval_service.py`).

    Documents -> parsing -> chunking -> embeddings -> vectorstore (ChromaDB)
                                                              |
                                                         retrieval (query-time)

Truth hierarchy this package must never invert (CLAUDE.md §5, architecture.md
§10): deterministic simulation > PostGIS exposure > retrieved evidence > AI
reasoning. A retrieved chunk is evidence an agent may cite; it can never
change a simulated number, and it is untrusted text — never an instruction.
"""
