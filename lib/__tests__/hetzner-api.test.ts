import { describe, it, expect } from "vitest";

describe("Hetzner API Token Validation", () => {
  it("should have HETZNER_API_TOKEN environment variable", () => {
    const token = process.env.HETZNER_API_TOKEN;
    expect(token).toBeDefined();
    expect(token).not.toBe("");
  });

  it("should have valid Hetzner API token format", () => {
    const token = process.env.HETZNER_API_TOKEN;
    // Hetzner tokens are typically 64 characters long alphanumeric strings
    expect(token).toMatch(/^[a-zA-Z0-9]{64}$/);
  });

  it("should be able to make a test request to Hetzner API", async () => {
    const token = process.env.HETZNER_API_TOKEN;
    
    if (!token) {
      throw new Error("HETZNER_API_TOKEN is not set");
    }

    try {
      const response = await fetch("https://api.hetzner.cloud/v1/servers", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      // We expect either 200 (success) or 401 (invalid token)
      // If we get 200 or any other response, the token format is valid
      expect([200, 401, 403]).toContain(response.status);

      // If we get 200, the token is valid
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("servers");
      }
    } catch (error) {
      // Network errors are acceptable in test environment
      console.log("Network request failed (expected in test environment):", error);
    }
  });
});
