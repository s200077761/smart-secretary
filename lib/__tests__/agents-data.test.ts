import { describe, it, expect } from "vitest";
import { AGENTS, getAgentById } from "../agents-data";

describe("Agents Data", () => {
  describe("AGENTS", () => {
    it("should have 7 agents defined", () => {
      expect(AGENTS).toHaveLength(7);
    });

    it("should have all required agent properties", () => {
      AGENTS.forEach((agent) => {
        expect(agent.id).toBeDefined();
        expect(agent.name).toBeDefined();
        expect(agent.nameAr).toBeDefined();
        expect(agent.description).toBeDefined();
        expect(agent.descriptionAr).toBeDefined();
        expect(agent.icon).toBeDefined();
        expect(agent.color).toBeDefined();
        expect(agent.systemPrompt).toBeDefined();
      });
    });

    it("should have unique agent IDs", () => {
      const ids = AGENTS.map((agent) => agent.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have valid color hex codes", () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      AGENTS.forEach((agent) => {
        expect(agent.color).toMatch(hexColorRegex);
      });
    });

    it("should include email agent", () => {
      const emailAgent = AGENTS.find((a) => a.id === "email");
      expect(emailAgent).toBeDefined();
      expect(emailAgent?.nameAr).toBe("مساعد البريد");
    });

    it("should include calendar agent", () => {
      const calendarAgent = AGENTS.find((a) => a.id === "calendar");
      expect(calendarAgent).toBeDefined();
      expect(calendarAgent?.nameAr).toBe("منظم المواعيد");
    });

    it("should include research agent", () => {
      const researchAgent = AGENTS.find((a) => a.id === "research");
      expect(researchAgent).toBeDefined();
      expect(researchAgent?.nameAr).toBe("باحث المعلومات");
    });

    it("should include manus agent", () => {
      const manusAgent = AGENTS.find((a) => a.id === "manus");
      expect(manusAgent).toBeDefined();
      expect(manusAgent?.nameAr).toBe("وكيل مانوس");
    });
  });

  describe("getAgentById", () => {
    it("should return agent by valid ID", () => {
      const agent = getAgentById("email");
      expect(agent).toBeDefined();
      expect(agent?.id).toBe("email");
    });

    it("should return undefined for invalid ID", () => {
      const agent = getAgentById("nonexistent");
      expect(agent).toBeUndefined();
    });

    it("should return correct agent for each ID", () => {
      const agentIds = ["email", "calendar", "notes", "research", "data", "custom", "manus"];
      
      agentIds.forEach((id) => {
        const agent = getAgentById(id);
        expect(agent).toBeDefined();
        expect(agent?.id).toBe(id);
      });
    });
  });
});
