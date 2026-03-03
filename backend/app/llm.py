"""Multi-provider LLM factory — supports HuggingFace, OpenAI, Anthropic, and Google Gemini."""

import logging
from typing import Literal

from langchain_openai import ChatOpenAI
from app.config import settings

logger = logging.getLogger(__name__)

AIProvider = Literal["huggingface", "openai", "anthropic", "gemini"]

HF_BASE_URL = "https://router.huggingface.co/v1/"

_hf_chat_llm: ChatOpenAI | None = None
_vision_llm: ChatOpenAI | None = None


def get_llm(temperature: float = 0.7) -> ChatOpenAI:
    """Return the default provider LLM (respects DEFAULT_AI_PROVIDER setting)."""
    return get_provider_llm(settings.DEFAULT_AI_PROVIDER, temperature=temperature)


def get_vision_llm(temperature: float = 0.3) -> ChatOpenAI:
    """Return the vision-capable LLM (always uses HuggingFace vision model)."""
    global _vision_llm
    if _vision_llm is None:
        _vision_llm = ChatOpenAI(
            model=settings.VISION_MODEL,
            api_key=settings.HF_TOKEN,
            base_url=HF_BASE_URL,
            temperature=temperature,
            max_tokens=1500,
            timeout=120,
        )
    return _vision_llm


def get_provider_llm(provider: AIProvider | None = None, temperature: float = 0.7):
    """
    Return a LangChain chat LLM for the given provider.

    Supported providers:
        - "huggingface"  → HuggingFace Inference API (default)
        - "openai"       → OpenAI GPT models
        - "anthropic"    → Anthropic Claude (requires langchain-anthropic)
        - "gemini"       → Google Gemini (requires langchain-google-genai)
    """
    resolved = provider or settings.DEFAULT_AI_PROVIDER

    if resolved == "openai":
        return _get_openai_llm(temperature)
    elif resolved == "anthropic":
        return _get_anthropic_llm(temperature)
    elif resolved == "gemini":
        return _get_gemini_llm(temperature)
    else:
        return _get_huggingface_llm(temperature)


def _get_huggingface_llm(temperature: float = 0.7) -> ChatOpenAI:
    """HuggingFace Inference API via OpenAI-compatible endpoint."""
    global _hf_chat_llm
    if _hf_chat_llm is None:
        _hf_chat_llm = ChatOpenAI(
            model=settings.HF_MODEL,
            api_key=settings.HF_TOKEN,
            base_url=HF_BASE_URL,
            temperature=temperature,
            max_tokens=2048,
        )
    return _hf_chat_llm


def _get_openai_llm(temperature: float = 0.7) -> ChatOpenAI:
    """OpenAI GPT via official API."""
    if not settings.OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set — falling back to HuggingFace.")
        return _get_huggingface_llm(temperature)
    return ChatOpenAI(
        model=settings.OPENAI_MODEL,
        api_key=settings.OPENAI_API_KEY,
        temperature=temperature,
        max_tokens=2048,
    )


def _get_anthropic_llm(temperature: float = 0.7):
    """Anthropic Claude via langchain-anthropic."""
    if not settings.ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set — falling back to HuggingFace.")
        return _get_huggingface_llm(temperature)
    try:
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=settings.ANTHROPIC_MODEL,
            api_key=settings.ANTHROPIC_API_KEY,
            temperature=temperature,
            max_tokens=2048,
        )
    except ImportError:
        logger.error("langchain-anthropic not installed. Run: pip install langchain-anthropic")
        return _get_huggingface_llm(temperature)


def _get_gemini_llm(temperature: float = 0.7):
    """Google Gemini via langchain-google-genai."""
    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set — falling back to HuggingFace.")
        return _get_huggingface_llm(temperature)
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=temperature,
            max_output_tokens=2048,
        )
    except ImportError:
        logger.error("langchain-google-genai not installed. Run: pip install langchain-google-genai")
        return _get_huggingface_llm(temperature)
