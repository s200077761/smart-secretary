"""Agent API routes — runs the Manus autonomous pipeline."""

import json
import uuid
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.agents.manus_agent import run_manus_agent
from app.models.schemas import (
    AgentTaskRequest,
    AgentTaskResponse,
    ManusTaskState,
)

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/run", response_model=AgentTaskResponse)
async def run_agent(req: AgentTaskRequest) -> AgentTaskResponse:
    """Run the Manus agent and wait for full completion."""
    final_state: ManusTaskState | None = None

    def on_update(state: ManusTaskState) -> None:
        nonlocal final_state
        final_state = state

    try:
        state = await run_manus_agent(req.task, on_update)
        if state.status == "failed":
            raise HTTPException(status_code=500, detail=state.error)

        return AgentTaskResponse(
            final_result=state.final_result or "",
            steps=state.steps,
            reflection_note=state.reflection_note,
            session_id=req.session_id or str(uuid.uuid4()),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/run/stream")
async def run_agent_stream(req: AgentTaskRequest) -> StreamingResponse:
    """Run the Manus agent with Server-Sent Events (SSE) for live updates.

    Each SSE event is a JSON-encoded ManusTaskState snapshot.
    Flutter / web clients can listen with EventSource or http.Client streaming.
    """

    async def event_stream() -> AsyncGenerator[str, None]:
        async def on_update(state: ManusTaskState) -> None:
            data = state.model_dump_json()
            yield f"data: {data}\n\n"

        # We need to bridge async generator into the callback —
        # collect updates through a queue approach.
        import asyncio
        queue: asyncio.Queue[ManusTaskState | None] = asyncio.Queue()

        async def enqueue(state: ManusTaskState) -> None:
            await queue.put(state)

        async def run() -> None:
            await run_manus_agent(req.task, enqueue)
            await queue.put(None)  # sentinel

        task = asyncio.create_task(run())

        while True:
            state = await queue.get()
            if state is None:
                break
            data = state.model_dump_json()
            yield f"data: {data}\n\n"

        await task

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
