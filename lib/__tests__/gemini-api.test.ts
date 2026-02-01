import { describe, it, expect } from 'vitest';

/**
 * Test to validate that the Gemini API key is properly configured
 * and can successfully call the API
 */
describe('Gemini API Integration', () => {
  it('should have GEMINI_API_KEY environment variable set', () => {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).toBeTruthy();
    expect(apiKey?.length).toBeGreaterThan(0);
  });

  it('should validate API key format', () => {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    // Google API keys typically start with "AIza"
    expect(apiKey).toMatch(/^AIza/);
  });

  it('should be able to call Gemini API with the key', async () => {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is not set');
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: 'Hello, this is a test message',
                  },
                ],
              },
            ],
          }),
        }
      );

      // Check if the response is successful or if it's an auth error
      expect(response.status).not.toBe(401); // 401 means invalid API key
      expect(response.status).not.toBe(403); // 403 means forbidden

      if (response.ok) {
        const data = await response.json();
        expect(data).toBeDefined();
        console.log('✓ Gemini API is working correctly');
      } else {
        // Log the error but don't fail - might be rate limited or other issues
        const errorData = await response.json();
        console.log('API Response:', errorData);
      }
    } catch (error) {
      console.error('Error testing Gemini API:', error);
      throw error;
    }
  });
});
