import os
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)

class Settings:
    @property
    def APP_ENV(self) -> str:
        return os.getenv("APP_ENV", "development")

    @property
    def DATABASE_URL(self) -> str:
        return os.getenv("DATABASE_URL", "sqlite:///./app.db")

    @property
    def LLM_PROVIDER(self) -> str:
        return os.getenv("LLM_PROVIDER", "openrouter")

    @property
    def LLM_API_KEY(self) -> str:
        return os.getenv("LLM_API_KEY", "")

    @property
    def LLM_MODEL(self) -> str:
        return os.getenv("LLM_MODEL", "google/gemini-2.5-flash")

    @property
    def SMTP_HOST(self) -> str:
        load_dotenv(env_path, override=True)
        return os.getenv("SMTP_HOST", "smtp.gmail.com")

    @property
    def SMTP_PORT(self) -> int:
        load_dotenv(env_path, override=True)
        try:
            return int(os.getenv("SMTP_PORT", "587"))
        except (ValueError, TypeError):
            return 587

    @property
    def SMTP_USER(self) -> str:
        load_dotenv(env_path, override=True)
        return os.getenv("SMTP_USER", "").strip()

    @property
    def SMTP_PASS(self) -> str:
        load_dotenv(env_path, override=True)
        # Strip all whitespace from app passwords (e.g. 'abcd efgh ijkl mnop' -> 'abcdefghijklmnop')
        return os.getenv("SMTP_PASS", "").replace(" ", "").strip()

    @property
    def SMTP_SECURE(self) -> bool:
        load_dotenv(env_path, override=True)
        return os.getenv("SMTP_SECURE", "false").lower() in ("true", "1", "yes")

    @property
    def EMAIL_FROM(self) -> str:
        load_dotenv(env_path, override=True)
        return os.getenv("EMAIL_FROM", "").strip()

    @property
    def FRONTEND_URL(self) -> str:
        load_dotenv(env_path, override=True)
        return os.getenv("FRONTEND_URL", "http://localhost:8000")

    @property
    def DEFAULT_TIMEZONE(self) -> str:
        return os.getenv("DEFAULT_TIMEZONE", "Asia/Kolkata")

    @property
    def JWT_SECRET(self) -> str:
        return os.getenv("JWT_SECRET", "secret-key-ai-project-review-tool-2026")

    @property
    def UPLOAD_DIR(self) -> str:
        return os.getenv("UPLOAD_DIR", "./uploads")

settings = Settings()
