import { describe, it, expect } from 'vitest';
import {
  getProviderSettings,
  getPrimaryProviderWithValidation,
  validateProviderConfig,
} from '../provider-settings';
import { getAvailableProviders, getProviderName } from '../multi-provider-ai';

describe('Provider Settings', () => {
  it('should get default provider settings', async () => {
    const settings = await getProviderSettings();
    expect(settings).toBeDefined();
    expect(settings.primaryProvider).toBe('gemini');
    expect(settings.fallbackProvider).toBe('z-ai');
    expect(settings.enableFallback).toBe(true);
  });

  it('should validate provider configuration', async () => {
    const isValid = await validateProviderConfig('gemini');
    // Should be valid if API key is set
    expect(typeof isValid).toBe('boolean');
  });

  it('should get primary provider with validation', async () => {
    const provider = await getPrimaryProviderWithValidation();
    expect(provider).toBeDefined();
    expect(['gemini', 'glm', 'z-ai']).toContain(provider);
  });
});

describe('Multi-Provider Support', () => {
  it('should have all providers available', () => {
    const providers = getAvailableProviders();
    expect(providers).toContain('gemini');
    expect(providers).toContain('glm');
    expect(providers).toContain('z-ai');
  });

  it('should get correct provider names', () => {
    expect(getProviderName('gemini')).toBe('Google Gemini');
    expect(getProviderName('glm')).toBe('GLM-4.7 (Z.ai)');
    expect(getProviderName('z-ai')).toBe('Z.ai');
  });

  it('should have Z.ai API key configured', () => {
    const zaiKey = process.env.EXPO_PUBLIC_ZAI_API_KEY;
    expect(zaiKey).toBeDefined();
    expect(zaiKey?.length).toBeGreaterThan(0);
  });

  it('should have Gemini API key configured', () => {
    const geminiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    expect(geminiKey).toBeDefined();
    expect(geminiKey?.length).toBeGreaterThan(0);
  });
});
