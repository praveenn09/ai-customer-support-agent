from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV = Path(__file__).resolve().parent.parent.parent / ".env"
BACKEND_ENV = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "SupportDesk"
    environment: str = "development"
    log_level: str = "INFO"

    jwt_secret_key: str = "dev-only-insecure-secret-change-in-env"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    database_url: str = "postgresql+psycopg2://supportdesk:supportdesk_local_pass@localhost:5433/supportdesk"
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:8080"

    llm_provider: str = "local"
    groq_api_key: str = ""
    llm_api_key: str = ""
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_model: str = "openai/gpt-oss-20b"

    auto_refund_limit_inr: float = 5000.0

    model_config = SettingsConfigDict(
        env_file=(str(ROOT_ENV), str(BACKEND_ENV)),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def effective_llm_api_key(self) -> str:
        return (self.groq_api_key or self.llm_api_key).strip()

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
