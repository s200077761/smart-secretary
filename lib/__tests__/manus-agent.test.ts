import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted runs before module imports in Vitest - use it to set env vars
// that are evaluated at module load time as constants
vi.hoisted(() => {
  process.env.EXPO_PUBLIC_GEMINI_API_KEY = "test-key";
});

// Mock fetch globally before module import
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { runManusAgent } from "../manus-agent";
import { ManusTaskState } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlanResponse(steps: object[]) {
  return {
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ steps }) }],
          },
        },
      ],
    }),
  };
}

function makeTextResponse(text: string) {
  return {
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [{ text }],
          },
        },
      ],
    }),
  };
}

function makeStepExecutionResponse(result: string, actions: string[]) {
  return makeTextResponse(JSON.stringify({ result, actions }));
}

const VALID_STEPS = [
  { id: 1, title: "خطوة أولى", description: "وصف الخطوة الأولى" },
  { id: 2, title: "خطوة ثانية", description: "وصف الخطوة الثانية" },
  { id: 3, title: "خطوة ثالثة", description: "وصف الخطوة الثالثة" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runManusAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful full pipeline", () => {
    it("should transition through planning → executing → reflecting → completed", async () => {
      const states: ManusTaskState["status"][] = [];

      // Plan (1 call) + think×3 + execute×3 + reflect (1 call) + synthesise (1 call) = 9 calls
      mockFetch
        .mockResolvedValueOnce(makePlanResponse(VALID_STEPS))           // plan
        .mockResolvedValueOnce(makeTextResponse("أفكر في الخطوة الأولى"))  // think 1
        .mockResolvedValueOnce(makeStepExecutionResponse("نتيجة 1", ["إجراء أ"])) // exec 1
        .mockResolvedValueOnce(makeTextResponse("أفكر في الخطوة الثانية")) // think 2
        .mockResolvedValueOnce(makeStepExecutionResponse("نتيجة 2", ["إجراء ب"])) // exec 2
        .mockResolvedValueOnce(makeTextResponse("أفكر في الخطوة الثالثة")) // think 3
        .mockResolvedValueOnce(makeStepExecutionResponse("نتيجة 3", ["إجراء ج"])) // exec 3
        .mockResolvedValueOnce(makeTextResponse("تقييم ممتاز"))           // reflect
        .mockResolvedValueOnce(makeTextResponse("الملخص النهائي الشامل")); // synthesise

      const finalState = await runManusAgent("مهمة اختبار", (s) => {
        states.push(s.status);
      });

      expect(finalState.status).toBe("completed");
      expect(finalState.finalResult).toBe("الملخص النهائي الشامل");
      expect(finalState.reflectionNote).toBe("تقييم ممتاز");
      expect(finalState.steps).toHaveLength(3);
      expect(states).toContain("planning");
      expect(states).toContain("executing");
      expect(states).toContain("reflecting");
      expect(states).toContain("completed");
    });

    it("should mark all steps as completed on success", async () => {
      mockFetch
        .mockResolvedValueOnce(makePlanResponse(VALID_STEPS))
        .mockResolvedValueOnce(makeTextResponse("فكرة"))
        .mockResolvedValueOnce(makeStepExecutionResponse("نتيجة 1", []))
        .mockResolvedValueOnce(makeTextResponse("فكرة"))
        .mockResolvedValueOnce(makeStepExecutionResponse("نتيجة 2", []))
        .mockResolvedValueOnce(makeTextResponse("فكرة"))
        .mockResolvedValueOnce(makeStepExecutionResponse("نتيجة 3", []))
        .mockResolvedValueOnce(makeTextResponse("تقييم"))
        .mockResolvedValueOnce(makeTextResponse("ملخص"));

      const finalState = await runManusAgent("مهمة", () => {});
      expect(finalState.steps.every((s) => s.status === "completed")).toBe(true);
    });
  });

  describe("planning phase validation", () => {
    it("should fail gracefully when response contains no JSON", async () => {
      mockFetch.mockResolvedValueOnce(makeTextResponse("لا يوجد JSON هنا"));

      const finalState = await runManusAgent("مهمة", () => {});
      expect(finalState.status).toBe("failed");
      expect(finalState.error).toContain("فشل في تحليل خطة المهمة");
    });

    it("should fail gracefully when steps is not an array", async () => {
      mockFetch.mockResolvedValueOnce(
        makeTextResponse(JSON.stringify({ steps: "not-an-array" }))
      );

      const finalState = await runManusAgent("مهمة", () => {});
      expect(finalState.status).toBe("failed");
      expect(finalState.error).toContain("صيغة الخطة غير صحيحة");
    });

    it("should fail gracefully when fewer than 3 steps are returned", async () => {
      mockFetch.mockResolvedValueOnce(
        makePlanResponse([{ id: 1, title: "خطوة", description: "وصف" }])
      );

      const finalState = await runManusAgent("مهمة", () => {});
      expect(finalState.status).toBe("failed");
      expect(finalState.error).toContain("3 إلى 6 خطوات");
    });

    it("should fail gracefully when more than 6 steps are returned", async () => {
      const tooManySteps = Array.from({ length: 7 }, (_, i) => ({
        id: i + 1,
        title: `خطوة ${i + 1}`,
        description: `وصف ${i + 1}`,
      }));
      mockFetch.mockResolvedValueOnce(makePlanResponse(tooManySteps));

      const finalState = await runManusAgent("مهمة", () => {});
      expect(finalState.status).toBe("failed");
      expect(finalState.error).toContain("3 إلى 6 خطوات");
    });

    it("should fail gracefully when a step is missing required fields", async () => {
      mockFetch.mockResolvedValueOnce(
        makePlanResponse([
          { id: 1, title: "خطوة أولى" }, // missing description
          { id: 2, title: "خطوة ثانية", description: "وصف" },
          { id: 3, title: "خطوة ثالثة", description: "وصف" },
        ])
      );

      const finalState = await runManusAgent("مهمة", () => {});
      expect(finalState.status).toBe("failed");
      expect(finalState.error).toContain("هيكل الخطوات غير صالح");
    });
  });

  describe("step execution failure recovery", () => {
    it("should continue execution when a single step fails", async () => {
      mockFetch
        .mockResolvedValueOnce(makePlanResponse(VALID_STEPS))
        .mockResolvedValueOnce(makeTextResponse("فكرة"))
        .mockResolvedValueOnce(makeStepExecutionResponse("نتيجة 1", []))
        .mockResolvedValueOnce(makeTextResponse("فكرة"))
        .mockRejectedValueOnce(new Error("خطأ في الشبكة")) // step 2 fails
        .mockResolvedValueOnce(makeTextResponse("فكرة"))
        .mockResolvedValueOnce(makeStepExecutionResponse("نتيجة 3", []))
        .mockResolvedValueOnce(makeTextResponse("تقييم"))
        .mockResolvedValueOnce(makeTextResponse("ملخص"));

      const finalState = await runManusAgent("مهمة", () => {});
      expect(finalState.status).toBe("completed");
      expect(finalState.steps[1].status).toBe("failed");
      expect(finalState.steps[0].status).toBe("completed");
      expect(finalState.steps[2].status).toBe("completed");
    });
  });

  describe("API error handling", () => {
    it("should handle non-2xx API response with JSON error body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "Invalid API key" } }),
        text: async () => "",
      });

      const finalState = await runManusAgent("مهمة", () => {});
      expect(finalState.status).toBe("failed");
      expect(finalState.error).toBe("Invalid API key");
    });

    it("should handle non-2xx API response with plain text body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => { throw new Error("not json"); },
        text: async () => "Service Unavailable",
      });

      const finalState = await runManusAgent("مهمة", () => {});
      expect(finalState.status).toBe("failed");
      expect(finalState.error).toBe("Service Unavailable");
    });

    it("should handle non-2xx API response with no parseable body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error("not json"); },
        text: async () => { throw new Error("not text"); },
      });

      const finalState = await runManusAgent("مهمة", () => {});
      expect(finalState.status).toBe("failed");
      expect(finalState.error).toContain("500");
    });

    it("should handle network-level fetch failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const finalState = await runManusAgent("مهمة", () => {});
      expect(finalState.status).toBe("failed");
      expect(finalState.error).toBe("Network error");
    });
  });

  describe("state updates via callback", () => {
    it("should call onUpdate with each state change", async () => {
      mockFetch
        .mockResolvedValueOnce(makePlanResponse(VALID_STEPS))
        .mockResolvedValueOnce(makeTextResponse("فكرة"))
        .mockResolvedValueOnce(makeStepExecutionResponse("نتيجة", []))
        .mockResolvedValueOnce(makeTextResponse("فكرة"))
        .mockResolvedValueOnce(makeStepExecutionResponse("نتيجة", []))
        .mockResolvedValueOnce(makeTextResponse("فكرة"))
        .mockResolvedValueOnce(makeStepExecutionResponse("نتيجة", []))
        .mockResolvedValueOnce(makeTextResponse("تقييم"))
        .mockResolvedValueOnce(makeTextResponse("ملخص"));

      const onUpdate = vi.fn();
      await runManusAgent("مهمة", onUpdate);

      // Should be called multiple times (at least: planning, after plan, per step think/exec, reflect, complete)
      expect(onUpdate.mock.calls.length).toBeGreaterThan(5);

      // The last call should be the completed state
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0] as ManusTaskState;
      expect(lastCall.status).toBe("completed");
    });
  });
});
