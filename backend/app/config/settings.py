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


settings = Settings()
