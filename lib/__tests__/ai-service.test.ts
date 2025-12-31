import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import { sendChatMessage, executeAgentTask, processCode, SECRETARY_SYSTEM_PROMPT } from "../ai-service";
import { ChatMessage } from "../types";

describe("AI Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("SECRETARY_SYSTEM_PROMPT", () => {
    it("should contain Arabic instructions", () => {
      expect(SECRETARY_SYSTEM_PROMPT).toContain("السكرتير الذكي");
      expect(SECRETARY_SYSTEM_PROMPT).toContain("مساعد ذكي");
    });

    it("should contain English fallback instructions", () => {
      expect(SECRETARY_SYSTEM_PROMPT).toContain("Smart Secretary");
      expect(SECRETARY_SYSTEM_PROMPT).toContain("intelligent");
    });
  });

  describe("sendChatMessage", () => {
    it("should format messages correctly for Gemini API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "مرحباً! كيف يمكنني مساعدتك؟" }],
              },
            },
          ],
        }),
      });

      const messages: ChatMessage[] = [
        {
          id: "1",
          role: "user",
          content: "مرحباً",
          timestamp: new Date(),
        },
      ];

      const result = await sendChatMessage(messages);

      expect(result.content).toBe("مرحباً! كيف يمكنني مساعدتك؟");
      expect(result.error).toBeUndefined();
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: "Invalid API key" },
        }),
      });

      const messages: ChatMessage[] = [
        {
          id: "1",
          role: "user",
          content: "test",
          timestamp: new Date(),
        },
      ];

      const result = await sendChatMessage(messages);

      expect(result.content).toBe("");
      expect(result.error).toBe("Invalid API key");
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const messages: ChatMessage[] = [
        {
          id: "1",
          role: "user",
          content: "test",
          timestamp: new Date(),
        },
      ];

      const result = await sendChatMessage(messages);

      expect(result.content).toBe("");
      expect(result.error).toBe("Network error");
    });
  });

  describe("executeAgentTask", () => {
    it("should execute agent task with system prompt", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "Task completed successfully" }],
              },
            },
          ],
        }),
      });

      const result = await executeAgentTask(
        "You are an email assistant",
        "Write a professional email"
      );

      expect(result.content).toBe("Task completed successfully");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("processCode", () => {
    it("should generate code correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "function sum(arr) { return arr.reduce((a, b) => a + b, 0); }" }],
              },
            },
          ],
        }),
      });

      const result = await processCode(
        "generate",
        "Write a function to sum array elements",
        "javascript"
      );

      expect(result.content).toContain("function");
      expect(result.error).toBeUndefined();
    });

    it("should review code correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "Code review: The code looks good but could use error handling." }],
              },
            },
          ],
        }),
      });

      const result = await processCode(
        "review",
        "function add(a, b) { return a + b; }",
        "javascript"
      );

      expect(result.content).toContain("review");
    });

    it("should explain code correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "This function adds two numbers together." }],
              },
            },
          ],
        }),
      });

      const result = await processCode(
        "explain",
        "function add(a, b) { return a + b; }",
        "javascript"
      );

      expect(result.content).toContain("function");
    });
  });
});
