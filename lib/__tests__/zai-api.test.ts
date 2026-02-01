import { describe, it, expect } from 'vitest';

/**
 * Test to validate that the Z.ai API key is properly configured
 */
describe('Z.ai API Integration', () => {
  it('should have Z.ai API key set', () => {
    const apiKey = process.env.EXPO_PUBLIC_ZAI_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).toBeTruthy();
    expect(apiKey?.length).toBeGreaterThan(0);
  });

  it('should validate Z.ai API key format', () => {
    const apiKey = process.env.EXPO_PUBLIC_ZAI_API_KEY;
    // Z.ai keys typically have format: hash.token
    expect(apiKey).toMatch(/^[a-f0-9]{32}\.[a-zA-Z0-9]+$/);
  });

  it('should be able to call Z.ai API with the key', async () => {
    const apiKey = process.env.EXPO_PUBLIC_ZAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('EXPO_PUBLIC_ZAI_API_KEY is not set');
    }

    try {
      const response = await fetch('https://chat.z.ai/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'Hello, this is a test message',
            },
          ],
          temperature: 0.7,
          max_tokens: 100,
        }),
      });

      // Check if the response is successful or if it's an auth error
      expect(response.status).not.toBe(401); // 401 means invalid API key
      expect(response.status).not.toBe(403); // 403 means forbidden

      if (response.ok) {
        const data = await response.json();
        expect(data).toBeDefined();
        console.log('✓ Z.ai API is working correctly');
      } else {
        const errorData = await response.json();
        console.log('Z.ai API Response:', errorData);
      }
    } catch (error) {
      console.error('Error testing Z.ai API:', error);
      throw error;
    }
  });
});
