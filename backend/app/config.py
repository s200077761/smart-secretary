"""
Application configuration using pydantic-settings.
All values are read from environment variables or .env file.
"""

from pydantic_settings import BaseSettings
from typing import Literal, Optional


class Settings(BaseSettings):
    # ── AI — HuggingFace Inference API (OpenAI-compatible) ───────────────────
    HF_TOKEN: str = ""
    HF_MODEL: str = "Qwen/Qwen2.5-7B-Instruct"
    VISION_MODEL: str = "Qwen/Qwen2.5-VL-7B-Instruct"

    # ── AI — OpenAI ──────────────────────────────────────────────────────────
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    # ── AI — Anthropic Claude ────────────────────────────────────────────────
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-haiku-4-5-20251001"

    # ── AI — Google Gemini ───────────────────────────────────────────────────
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # ── AI — Provider Selection ──────────────────────────────────────────────
    # Options: "huggingface" | "openai" | "anthropic" | "gemini"
    DEFAULT_AI_PROVIDER: Literal["huggingface", "openai", "anthropic", "gemini"] = "huggingface"

    # ── Firebase ─────────────────────────────────────────────────────────────
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None
    FIREBASE_PROJECT_ID: Optional[str] = None

    # ── Telegram ─────────────────────────────────────────────────────────────
    TELEGRAM_TOKEN: Optional[str] = None
    # Full public URL of this server, e.g. https://myapp.onrender.com
    SERVER_URL: Optional[str] = None
    # Admin chat ID — set to your Telegram chat ID to receive all conversations
    ADMIN_CHAT_ID: Optional[int] = None

    # ── WhatsApp (Meta Business API) ─────────────────────────────────────────
    WHATSAPP_TOKEN: Optional[str] = None
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    WHATSAPP_VERIFY_TOKEN: str = "smart_secretary_verify_2026"

    # ── Twilio (alternative WhatsApp) ────────────────────────────────────────
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_WHATSAPP_NUMBER: Optional[str] = None

    # ── Discord (OpenClaw-style messaging platform) ──────────────────────────
    DISCORD_BOT_TOKEN: Optional[str] = None
    DISCORD_APPLICATION_ID: Optional[str] = None
    # Ed25519 public key for verifying Discord interaction webhooks
    DISCORD_PUBLIC_KEY: Optional[str] = None

    # ── Server ───────────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ALLOWED_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
