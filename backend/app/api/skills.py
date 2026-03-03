"""
Skills API — OpenClaw-style skill/integration catalog.

Lists available integrations and their status, inspired by OpenClaw's 50+ skill system.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.config import settings

router = APIRouter(prefix="/skills", tags=["skills"])


class Skill(BaseModel):
    id: str
    name: str
    name_ar: str
    description: str
    description_ar: str
    category: str
    category_ar: str
    icon: str
    enabled: bool
    requires_config: bool
    config_hint: Optional[str] = None


SKILLS_CATALOG: list[Skill] = [
    # ── Messaging Platforms ───────────────────────────────────────────────────
    Skill(
        id="telegram",
        name="Telegram",
        name_ar="تيليجرام",
        description="Chat with your secretary via Telegram bot",
        description_ar="تحدث مع مساعدك عبر بوت تيليجرام",
        category="messaging",
        category_ar="المراسلة",
        icon="paperplane",
        enabled=bool(settings.TELEGRAM_TOKEN),
        requires_config=True,
        config_hint="Set TELEGRAM_TOKEN in environment variables",
    ),
    Skill(
        id="whatsapp",
        name="WhatsApp",
        name_ar="واتساب",
        description="Chat with your secretary via WhatsApp Business API",
        description_ar="تحدث مع مساعدك عبر واتساب",
        category="messaging",
        category_ar="المراسلة",
        icon="phone",
        enabled=bool(settings.WHATSAPP_TOKEN),
        requires_config=True,
        config_hint="Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID",
    ),
    Skill(
        id="discord",
        name="Discord",
        name_ar="ديسكورد",
        description="Chat with your secretary via Discord slash commands",
        description_ar="تحدث مع مساعدك عبر أوامر Discord",
        category="messaging",
        category_ar="المراسلة",
        icon="bubble.left.and.bubble.right",
        enabled=bool(settings.DISCORD_BOT_TOKEN),
        requires_config=True,
        config_hint="Set DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID, and DISCORD_PUBLIC_KEY",
    ),
    # ── AI Providers ──────────────────────────────────────────────────────────
    Skill(
        id="ai_huggingface",
        name="HuggingFace",
        name_ar="HuggingFace",
        description="Use HuggingFace open-source models",
        description_ar="استخدام نماذج مفتوحة المصدر من HuggingFace",
        category="ai_provider",
        category_ar="مزود الذكاء الاصطناعي",
        icon="cpu",
        enabled=bool(settings.HF_TOKEN),
        requires_config=True,
        config_hint="Set HF_TOKEN in environment variables",
    ),
    Skill(
        id="ai_openai",
        name="OpenAI GPT",
        name_ar="OpenAI GPT",
        description="Use OpenAI GPT-4o and other models",
        description_ar="استخدام نماذج OpenAI مثل GPT-4o",
        category="ai_provider",
        category_ar="مزود الذكاء الاصطناعي",
        icon="sparkles",
        enabled=bool(settings.OPENAI_API_KEY),
        requires_config=True,
        config_hint="Set OPENAI_API_KEY in environment variables",
    ),
    Skill(
        id="ai_anthropic",
        name="Anthropic Claude",
        name_ar="Anthropic Claude",
        description="Use Anthropic Claude models",
        description_ar="استخدام نماذج Claude من Anthropic",
        category="ai_provider",
        category_ar="مزود الذكاء الاصطناعي",
        icon="brain",
        enabled=bool(settings.ANTHROPIC_API_KEY),
        requires_config=True,
        config_hint="Set ANTHROPIC_API_KEY in environment variables",
    ),
    Skill(
        id="ai_gemini",
        name="Google Gemini",
        name_ar="Google Gemini",
        description="Use Google Gemini AI models",
        description_ar="استخدام نماذج Google Gemini",
        category="ai_provider",
        category_ar="مزود الذكاء الاصطناعي",
        icon="globe",
        enabled=bool(settings.GEMINI_API_KEY),
        requires_config=True,
        config_hint="Set GEMINI_API_KEY in environment variables",
    ),
    # ── Agent Capabilities ────────────────────────────────────────────────────
    Skill(
        id="manus_agent",
        name="Manus Agent",
        name_ar="وكيل مانوس",
        description="Autonomous multi-step task execution",
        description_ar="تنفيذ المهام المعقدة خطوة بخطوة بشكل تلقائي",
        category="agent",
        category_ar="الوكلاء",
        icon="gear",
        enabled=True,
        requires_config=False,
    ),
    Skill(
        id="vision_analysis",
        name="Vision Analysis",
        name_ar="التحليل البصري",
        description="Analyze images: iris, palm, and face health mapping",
        description_ar="تحليل الصور: القزحية والكف وخرائط الوجه الصحية",
        category="agent",
        category_ar="الوكلاء",
        icon="eye",
        enabled=bool(settings.HF_TOKEN),
        requires_config=True,
        config_hint="Requires HF_TOKEN with vision model access",
    ),
]


@router.get("/", response_model=list[Skill])
async def list_skills() -> list[Skill]:
    """Return all available skills with their enabled status."""
    return SKILLS_CATALOG


@router.get("/enabled", response_model=list[Skill])
async def list_enabled_skills() -> list[Skill]:
    """Return only skills that are currently enabled (configured)."""
    return [s for s in SKILLS_CATALOG if s.enabled]


@router.get("/summary")
async def skills_summary() -> dict:
    """Return a summary of enabled skills grouped by category."""
    enabled = [s for s in SKILLS_CATALOG if s.enabled]
    total = len(SKILLS_CATALOG)
    by_category: dict[str, int] = {}
    for skill in enabled:
        by_category[skill.category] = by_category.get(skill.category, 0) + 1

    return {
        "total": total,
        "enabled": len(enabled),
        "by_category": by_category,
        "active_provider": settings.DEFAULT_AI_PROVIDER,
        "messaging_platforms": [
            s.id for s in enabled if s.category == "messaging"
        ],
    }
