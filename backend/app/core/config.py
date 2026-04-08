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

    rate_limit_per_minute: int = 120

    @property
    def cors_origins_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    class Config:
        env_file = ".env.example"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
