"""Shared LLM factory — HuggingFace Inference API (OpenAI-compatible)."""

from langchain_openai import ChatOpenAI
from app.config import settings

HF_BASE_URL = "https://router.huggingface.co/v1/"

_chat_llm: ChatOpenAI | None = None
_vision_llm: ChatOpenAI | None = None


def get_llm(temperature: float = 0.7) -> ChatOpenAI:
    global _chat_llm
    if _chat_llm is None:
        _chat_llm = ChatOpenAI(
            model=settings.HF_MODEL,
            api_key=settings.HF_TOKEN,
            base_url=HF_BASE_URL,
            temperature=temperature,
            max_tokens=2048,
        )
    return _chat_llm


def get_vision_llm(temperature: float = 0.3) -> ChatOpenAI:
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
