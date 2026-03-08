"""Chat API routes — HTTP + WebSocket streaming."""

import uuid
import json
from typing import Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from langchain.schema import HumanMessage, SystemMessage
from pydantic import BaseModel

from app.llm import get_llm
from app.models.schemas import ChatRequest, ChatResponse, AGENT_PROMPTS

router = APIRouter(prefix="/chat", tags=["chat"])

_BASE_SYSTEM = """أنت السكرتير الذكي، مساعد شخصي ذكي ومفيد. يجب أن تردّ دائماً باللغة العربية مهما كانت لغة السؤال.
- تتحدث العربية حصراً في جميع ردودك
- تكون دقيقاً وواضحاً في إجاباتك
- تساعد في المهام اليومية والمهنية بكفاءة
- تكون ودوداً ومحترفاً في كل الأوقات
- لا تستخدم الإنجليزية إلا إذا طُلب منك ذلك صراحةً"""


class KeyedChatRequest(BaseModel):
    message: str
    gemini_key: str
    system_prompt: Optional[str] = None
    session_id: Optional[str] = None


@router.post("/gemini", response_model=ChatResponse)
async def chat_with_gemini_key(req: KeyedChatRequest) -> ChatResponse:
    """Proxy: call Google Gemini with a user-supplied API key."""
    if not req.gemini_key:
        raise HTTPException(status_code=400, detail="gemini_key is required")
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=req.gemini_key,
            temperature=0.7,
            max_output_tokens=2048,
        )
        system = req.system_prompt or _BASE_SYSTEM
        messages = [SystemMessage(content=system), HumanMessage(content=req.message)]
        response = await llm.ainvoke(messages)
        return ChatResponse(
            content=str(response.content),
            session_id=req.session_id or str(uuid.uuid4()),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    """Single-turn chat with optional agent system prompt."""
    system = req.agent_system_prompt or _BASE_SYSTEM
    if req.agent_system_prompt is None and req.agent_system_prompt:
        system = AGENT_PROMPTS.get(req.agent_system_prompt, _BASE_SYSTEM)

    try:
        llm = get_llm()
        messages = [SystemMessage(content=system), HumanMessage(content=req.message)]
        response = await llm.ainvoke(messages)
        return ChatResponse(
            content=str(response.content),
            session_id=req.session_id or str(uuid.uuid4()),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/agent/{agent_id}", response_model=ChatResponse)
async def chat_with_agent(agent_id: str, req: ChatRequest) -> ChatResponse:
    """Chat using a specialized agent system prompt."""
    system = AGENT_PROMPTS.get(agent_id, _BASE_SYSTEM)
    try:
        llm = get_llm(temperature=0.5)
        messages = [SystemMessage(content=system), HumanMessage(content=req.message)]
        response = await llm.ainvoke(messages)
        return ChatResponse(
            content=str(response.content),
            session_id=req.session_id or str(uuid.uuid4()),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.websocket("/ws")
async def chat_ws(websocket: WebSocket) -> None:
    """Streaming WebSocket chat endpoint.

    Client sends: {"message": "...", "session_id": "...", "agent_id": "..."}
    Server streams: {"chunk": "...", "done": false} … {"chunk": "", "done": true}
    """
    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()
            payload: dict = json.loads(raw)

            agent_id = payload.get("agent_id")
            system = AGENT_PROMPTS.get(agent_id, _BASE_SYSTEM) if agent_id else _BASE_SYSTEM
            user_text = payload.get("message", "")

            llm = get_llm(temperature=0.7)
            messages = [SystemMessage(content=system), HumanMessage(content=user_text)]

            async for chunk in llm.astream(messages):
                if chunk.content:
                    await websocket.send_json({"chunk": chunk.content, "done": False})

            await websocket.send_json({"chunk": "", "done": True})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"error": str(exc), "done": True})
        except Exception:
            pass
