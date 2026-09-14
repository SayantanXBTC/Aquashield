from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Backend configuration, read from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "aquashield-backend"
    host: str = "127.0.0.1"
    port: int = 8000

    # Local development origins only. Production CORS must be restricted
    # to the deployed frontend origin(s) — see docs/development/setup.md.
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # --- Database (PostgreSQL/PostGIS) ---
    # Either set DATABASE_URL directly, or leave it unset and the
    # postgres_* fields below build one for local development.
    database_url_override: str | None = Field(default=None, validation_alias="DATABASE_URL")
    postgres_user: str = "aquashield"
    postgres_password: str = "aquashield"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "aquashield"

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return self.database_url_override
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # --- Auth (Firebase Authentication) ---
    # The Firebase project whose ID tokens this API accepts. Verification is
    # RS256 against Google's published certs (app/core/auth.py); no service
    # account is needed. Unset => every protected route answers 503 with an
    # explicit "auth not configured" message rather than silently allowing
    # anonymous access.
    firebase_project_id: str | None = Field(default=None, validation_alias="FIREBASE_PROJECT_ID")
    # LOCAL DEVELOPMENT ONLY. When set, a request WITHOUT a bearer token is
    # treated as this uid so the console can be exercised before a Firebase
    # project exists. Requests that do carry a token are still verified.
    # Never set this in any deployed environment.
    auth_dev_bypass_uid: str | None = Field(default=None, validation_alias="AUTH_DEV_BYPASS_UID")

    # --- AI layer (agents/) ---
    # "local" runs the full LangGraph with the deterministic rule provider —
    # no network, no credits. "anthropic" uses the Claude API through the
    # official SDK; the key is read from ANTHROPIC_API_KEY (or an `ant auth`
    # profile) and is never persisted or logged.
    ai_provider: str = Field(default="local", validation_alias="AI_PROVIDER")
    ai_model: str = Field(default="claude-opus-5", validation_alias="AI_MODEL")
    anthropic_api_key: str | None = Field(default=None, validation_alias="ANTHROPIC_API_KEY")

    # --- Simulation artifacts ---
    # Where SimulationService writes prototype JSON timeline artifacts.
    # Defaults to the gitignored simulation/outputs/ directory (architecture.md
    # §24: PostgreSQL stores metadata + a reference, never the timeseries
    # itself) — override only if that directory shouldn't be used.
    simulation_output_dir_override: str | None = Field(
        default=None, validation_alias="SIMULATION_OUTPUT_DIR"
    )

    @property
    def simulation_output_dir(self) -> str:
        if self.simulation_output_dir_override:
            return self.simulation_output_dir_override
        repo_root = Path(__file__).resolve().parents[3]
        return str(repo_root / "simulation" / "outputs")

    # --- RAG (rag/) ---
    # "none" (default) keeps the pre-RAG posture: EvidenceRetriever returns
    # NOT_CONFIGURED and the Command Brief records that as a data limitation
    # — the same behaviour as before this layer existed. "chroma" wires the
    # real hybrid retriever in; it needs sources actually ingested
    # (`python -m rag ingest`) to return anything but INSUFFICIENT_EVIDENCE.
    rag_provider: str = Field(default="none", validation_alias="RAG_PROVIDER")
    rag_embedding_provider: str = Field(default="local", validation_alias="RAG_EMBEDDING_PROVIDER")
    rag_relevance_threshold: float = Field(default=0.15, validation_alias="RAG_RELEVANCE_THRESHOLD")
    # Defaults to the gitignored rag/vectorstore/data/ directory (see
    # rag/vectorstore/README.md) — override only for a non-default location.
    rag_vectorstore_dir_override: str | None = Field(default=None, validation_alias="RAG_VECTORSTORE_DIR")

    @property
    def rag_vectorstore_dir(self) -> str | None:
        return self.rag_vectorstore_dir_override


settings = Settings()
