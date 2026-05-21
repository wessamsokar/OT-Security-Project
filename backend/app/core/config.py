from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings

from app.core.insecure_defaults import (
    BOOTSTRAP_ALLOWED_ENVS,
    INSECURE_SECRET_MARKERS,
    validate_bootstrap_password,
)


class Settings(BaseSettings):
    app_name: str = "ICS Detection API"
    app_env: str = "development"
    app_debug: bool = False
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:8080,http://localhost:5173"

    database_url: str
    redis_url: str
    ml_service_url: str
    ml_service_api_key: str = ""
    ml_infer_timeout_seconds: float = 60.0
    ml_retrain_timeout_seconds: float = 120.0

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    auth_cookie_name: str = "ics_access_token"
    auth_cookie_path: str = "/"
    auth_cookie_secure: bool = False
    auth_cookie_samesite: str = "lax"

    csrf_protection_enabled: bool = True
    csrf_cookie_name: str = "ics_csrf_token"
    csrf_header_name: str = "X-CSRF-Token"
    csrf_token_expire_hours: int = 12
    password_reset_token_expire_minutes: int = 30
    email_verification_token_expire_hours: int = 24
    email_verification_required: bool = False
    expose_auth_tokens: bool = False

    bootstrap_admin_enabled: bool = False
    bootstrap_admin_email: str = ""
    bootstrap_admin_password: str = ""
    bootstrap_admin_name: str = ""
    hidden_admin_emails: str = ""

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
    metrics_public: bool = False
    public_live_snapshot_enabled: bool = False
    csp_report_max_bytes: int = 8192
    sse_interval_seconds: float = 5.0
    sse_max_connections: int = 50
    sse_max_connection_seconds: int = 1800

    packet_capture_dir: str = "./captures"

    device_offline_after_minutes: int = 60
    device_recovery_timeout_minutes: int = 15

    @field_validator("smtp_username", "smtp_from_email", "smtp_host", mode="before")
    @classmethod
    def strip_optional_smtp_strings(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("smtp_password", mode="before")
    @classmethod
    def normalize_smtp_app_password(cls, v: object) -> object:
        if isinstance(v, str):
            return "".join(v.split())
        return v

    @field_validator("auth_cookie_samesite", mode="before")
    @classmethod
    def normalize_samesite(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip().lower()
        return v

    @model_validator(mode="after")
    def validate_security_defaults(self) -> "Settings":
        env = self.app_env.lower()
        jwt_lower = self.jwt_secret_key.lower()

        if env in ("production", "prod", "staging"):
            if len(self.jwt_secret_key) < 32:
                raise ValueError("JWT_SECRET_KEY must be at least 32 characters in production/staging")
            if any(marker in jwt_lower for marker in INSECURE_SECRET_MARKERS):
                raise ValueError("JWT_SECRET_KEY must not use example/placeholder values in production/staging")
            if not self.auth_cookie_secure:
                raise ValueError("AUTH_COOKIE_SECURE must be true in production/staging")
            if self.bootstrap_admin_enabled:
                raise ValueError("BOOTSTRAP_ADMIN_ENABLED must be false in production/staging")
            if self.expose_auth_tokens:
                raise ValueError("EXPOSE_AUTH_TOKENS must be false in production/staging")
            if not self.ml_service_api_key or len(self.ml_service_api_key) < 16:
                raise ValueError("ML_SERVICE_API_KEY must be set (min 16 chars) in production/staging")
            if self.hidden_admin_emails_list:
                raise ValueError("HIDDEN_ADMIN_EMAILS must be empty in production/staging")
            if self.public_live_snapshot_enabled:
                raise ValueError("PUBLIC_LIVE_SNAPSHOT_ENABLED must be false in production/staging")

        if self.bootstrap_admin_enabled:
            if env not in BOOTSTRAP_ALLOWED_ENVS:
                raise ValueError(
                    "BOOTSTRAP_ADMIN_ENABLED is only allowed when APP_ENV is "
                    "development, dev, local, or test"
                )
            if not self.bootstrap_admin_email or not self.bootstrap_admin_password:
                raise ValueError("Bootstrap admin requires BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD")
            validate_bootstrap_password(self.bootstrap_admin_password)

        return self

    def allows_bootstrap_admin(self) -> bool:
        env = self.app_env.lower()
        return self.bootstrap_admin_enabled and env in BOOTSTRAP_ALLOWED_ENVS

    @property
    def cors_origins_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def hidden_admin_emails_list(self) -> list[str]:
        return [item.strip().lower() for item in self.hidden_admin_emails.split(",") if item.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in ("production", "prod", "staging")

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
