from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "ICS Detection API"
    app_env: str = "development"
    app_debug: bool = True
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:8080,http://localhost:5173"

    database_url: str
    redis_url: str
    ml_service_url: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    password_reset_token_expire_minutes: int = 30
    email_verification_token_expire_hours: int = 24
    email_verification_required: bool = False
    expose_auth_tokens: bool = False

    bootstrap_admin_enabled: bool = False
    bootstrap_admin_email: str = ""
    bootstrap_admin_password: str = ""
    bootstrap_admin_name: str = ""

    email_enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    smtp_timeout_seconds: int = 15
    smtp_from_email: str = ""
    smtp_from_name: str = "ICS Guard"
    frontend_base_url: str = ""
    email_verification_path: str = "/verify-email"
    password_reset_path: str = "/reset-password"

    rate_limit_per_minute: int = 120

    packet_capture_dir: str = "./captures"

    @property
    def cors_origins_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    class Config:
        env_file = (".env", ".env.example")
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
