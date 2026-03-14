import AsyncStorage from '@react-native-async-storage/async-storage';
import { AIProvider } from './multi-provider-ai';

export interface ProviderSettings {
  primaryProvider: AIProvider;
  fallbackProvider: AIProvider;
  geminiKey: string;
  zaiKey: string;
  glmKey?: string;
  enableFallback: boolean;
}

const PROVIDER_SETTINGS_KEY = 'provider_settings';

const DEFAULT_SETTINGS: ProviderSettings = {
  primaryProvider: 'gemini',
  fallbackProvider: 'z-ai',
  geminiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
  zaiKey: process.env.EXPO_PUBLIC_ZAI_API_KEY || '',
  glmKey: process.env.EXPO_PUBLIC_GLM_API_KEY || '',
  enableFallback: true,
};

// In-memory cache — invalidated on every write so callers always see fresh
// data while avoiding redundant AsyncStorage reads within the same request.
let settingsCache: ProviderSettings | null = null;

/**
 * Get provider settings
 */
export async function getProviderSettings(): Promise<ProviderSettings> {
  if (settingsCache !== null) return settingsCache;
  try {
    const data = await AsyncStorage.getItem(PROVIDER_SETTINGS_KEY);
    if (!data) {
      await saveProviderSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    const parsed: ProviderSettings = JSON.parse(data);
    settingsCache = parsed;
    return parsed;
  } catch (error) {
    console.error('Failed to get provider settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save provider settings
 */
export async function saveProviderSettings(settings: ProviderSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(PROVIDER_SETTINGS_KEY, JSON.stringify(settings));
    settingsCache = settings;
  } catch (error) {
    console.error('Failed to save provider settings:', error);
  }
}

/**
 * Set primary provider
 */
export async function setPrimaryProvider(provider: AIProvider): Promise<void> {
  try {
    const settings = await getProviderSettings();
    settings.primaryProvider = provider;
    await saveProviderSettings(settings);
  } catch (error) {
    console.error('Failed to set primary provider:', error);
  }
}

/**
 * Set fallback provider
 */
export async function setFallbackProvider(provider: AIProvider): Promise<void> {
  try {
    const settings = await getProviderSettings();
    settings.fallbackProvider = provider;
    await saveProviderSettings(settings);
  } catch (error) {
    console.error('Failed to set fallback provider:', error);
  }
}

/**
 * Enable/disable fallback
 */
export async function setEnableFallback(enable: boolean): Promise<void> {
  try {
    const settings = await getProviderSettings();
    settings.enableFallback = enable;
    await saveProviderSettings(settings);
  } catch (error) {
    console.error('Failed to set fallback enabled:', error);
  }
}

/**
 * Get API key for provider
 */
export async function getProviderApiKey(provider: AIProvider): Promise<string> {
  const settings = await getProviderSettings();
  
  switch (provider) {
    case 'gemini':
      return settings.geminiKey;
    case 'z-ai':
      return settings.zaiKey;
    case 'glm':
      return settings.glmKey || '';
    default:
      return '';
  }
}

/**
 * Validate provider configuration
 */
export async function validateProviderConfig(provider: AIProvider): Promise<boolean> {
  const apiKey = await getProviderApiKey(provider);
  return apiKey.length > 0;
}

/**
 * Get primary provider with validation
 */
export async function getPrimaryProviderWithValidation(): Promise<AIProvider> {
  const settings = await getProviderSettings();
  const isValid = await validateProviderConfig(settings.primaryProvider);
  
  if (isValid) {
    return settings.primaryProvider;
  }

  // Try fallback
  if (settings.enableFallback) {
    const fallbackValid = await validateProviderConfig(settings.fallbackProvider);
    if (fallbackValid) {
      console.log(`Primary provider invalid, using fallback: ${settings.fallbackProvider}`);
      return settings.fallbackProvider;
    }
  }

  // Default to gemini
  console.warn('No valid provider found, defaulting to gemini');
  return 'gemini';
}
