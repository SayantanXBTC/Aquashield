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


settings = Settings()
