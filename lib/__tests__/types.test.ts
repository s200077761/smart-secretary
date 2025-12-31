import { describe, it, expect } from "vitest";
import type {
  ChatMessage,
  ChatState,
  Agent,
  AgentTask,
  SearchResult,
  SearchState,
  CodeMode,
  CodeState,
  AppSettings,
  AIResponse,
} from "../types";

describe("Types", () => {
  describe("ChatMessage", () => {
    it("should create a valid user message", () => {
      const message: ChatMessage = {
        id: "msg_1",
        role: "user",
        content: "مرحباً",
        timestamp: new Date(),
      };

      expect(message.role).toBe("user");
      expect(message.content).toBe("مرحباً");
      expect(message.isLoading).toBeUndefined();
    });

    it("should create a valid assistant message with loading state", () => {
      const message: ChatMessage = {
        id: "msg_2",
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isLoading: true,
      };

      expect(message.role).toBe("assistant");
      expect(message.isLoading).toBe(true);
    });
  });

  describe("ChatState", () => {
    it("should have correct initial state structure", () => {
      const state: ChatState = {
        messages: [],
        isLoading: false,
      };

      expect(state.messages).toHaveLength(0);
      expect(state.isLoading).toBe(false);
    });
  });

  describe("Agent", () => {
    it("should create a valid agent", () => {
      const agent: Agent = {
        id: "email",
        name: "Email Assistant",
        nameAr: "مساعد البريد",
        description: "Draft professional emails",
        descriptionAr: "كتابة رسائل بريد إلكتروني احترافية",
        icon: "envelope",
        color: "#3B82F6",
        systemPrompt: "You are an email assistant.",
      };

      expect(agent.id).toBe("email");
      expect(agent.nameAr).toBe("مساعد البريد");
    });
  });

  describe("AgentTask", () => {
    it("should create a valid agent task", () => {
      const task: AgentTask = {
        id: "task_1",
        agentId: "email",
        status: "running",
        progress: 50,
        input: "Write an email",
        createdAt: new Date(),
      };

      expect(task.status).toBe("running");
      expect(task.progress).toBe(50);
      expect(task.output).toBeUndefined();
    });

    it("should support completed task with output", () => {
      const task: AgentTask = {
        id: "task_2",
        agentId: "email",
        status: "completed",
        progress: 100,
        input: "Write an email",
        output: "Dear Sir/Madam...",
        createdAt: new Date(),
        completedAt: new Date(),
      };

      expect(task.status).toBe("completed");
      expect(task.output).toBeDefined();
      expect(task.completedAt).toBeDefined();
    });
  });

  describe("SearchResult", () => {
    it("should create a valid search result", () => {
      const result: SearchResult = {
        id: "result_1",
        title: "Test Result",
        snippet: "This is a test snippet",
        url: "https://example.com",
        source: "example.com",
      };

      expect(result.title).toBe("Test Result");
      expect(result.aiSummary).toBeUndefined();
    });

    it("should support AI summary", () => {
      const result: SearchResult = {
        id: "result_2",
        title: "Test Result",
        snippet: "This is a test snippet",
        url: "https://example.com",
        source: "example.com",
        aiSummary: "AI generated summary of the result",
      };

      expect(result.aiSummary).toBeDefined();
    });
  });

  describe("CodeMode", () => {
    it("should accept valid code modes", () => {
      const modes: CodeMode[] = ["generate", "review", "explain"];
      
      expect(modes).toContain("generate");
      expect(modes).toContain("review");
      expect(modes).toContain("explain");
    });
  });

  describe("AppSettings", () => {
    it("should create valid app settings", () => {
      const settings: AppSettings = {
        theme: "dark",
        language: "ar",
        responseStyle: "detailed",
        enableHaptics: true,
      };

      expect(settings.theme).toBe("dark");
      expect(settings.language).toBe("ar");
    });
  });

  describe("AIResponse", () => {
    it("should create successful response", () => {
      const response: AIResponse = {
        content: "Hello, how can I help?",
      };

      expect(response.content).toBe("Hello, how can I help?");
      expect(response.error).toBeUndefined();
    });

    it("should create error response", () => {
      const response: AIResponse = {
        content: "",
        error: "API key invalid",
      };

      expect(response.content).toBe("");
      expect(response.error).toBe("API key invalid");
    });
  });
});
