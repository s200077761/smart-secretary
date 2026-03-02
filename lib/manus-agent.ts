/**
 * Manus Agent - Autonomous multi-step task execution via backend API
 *
 * Uses the backend SSE stream endpoint for live step-by-step updates.
 */

import { ManusStep, ManusTaskState, ManusToolType } from "./types";

const BACKEND_URL = "https://s200077761-smart-secretary-api.hf.space";

type StateUpdater = (state: ManusTaskState) => void;

/**
 * Run the full Manus-style autonomous agent pipeline via the backend API.
 * Streams live state updates via Server-Sent Events (SSE).
 *
 * @param userTask   The high-level task from the user.
 * @param onUpdate   Callback invoked after every state change.
 * @returns          The final ManusTaskState when execution completes.
 */
export async function runManusAgent(
  userTask: string,
  onUpdate: StateUpdater,
): Promise<ManusTaskState> {
  let lastState: ManusTaskState = {
    status: "planning",
    steps: [],
    currentStepIndex: 0,
  };
  onUpdate({ ...lastState });

  try {
    const response = await fetch(`${BACKEND_URL}/api/agents/run/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: userTask }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `API error ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error("No response body");

    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        try {
          const state = JSON.parse(jsonStr) as ManusTaskState;
          // Map snake_case from Python backend to camelCase
          lastState = {
            status: state.status,
            steps: (state.steps || []).map((s: any) => ({
              id: s.id,
              title: s.title,
              description: s.description,
              status: s.status,
              tool: s.tool as ManusToolType,
              thought: s.thought,
              result: s.result,
              actions: s.actions,
            })),
            currentStepIndex: (state as any).current_step_index ?? (state as any).currentStepIndex ?? 0,
            currentThought: (state as any).current_thought ?? (state as any).currentThought,
            finalResult: (state as any).final_result ?? (state as any).finalResult,
            reflectionNote: (state as any).reflection_note ?? (state as any).reflectionNote,
            error: state.error,
          };
          onUpdate({ ...lastState });
        } catch {
          // skip malformed chunk
        }
      }
    }

    return lastState;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
    const failed: ManusTaskState = { ...lastState, status: "failed", error: errorMsg };
    onUpdate({ ...failed });
    return failed;
  }
}
