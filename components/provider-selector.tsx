import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { getAvailableProviders, getProviderName, AIProvider } from '@/lib/multi-provider-ai';
import {
  getProviderSettings,
  setPrimaryProvider,
  setFallbackProvider,
  validateProviderConfig,
} from '@/lib/provider-settings';
import { useColors } from '@/hooks/use-colors';
import { cn } from '@/lib/utils';

interface ProviderSelectorProps {
  onProviderChange?: () => void;
}

export function ProviderSelector({ onProviderChange }: ProviderSelectorProps) {
  const colors = useColors();
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [primaryProvider, setPrimary] = useState<AIProvider>('gemini');
  const [fallbackProvider, setFallback] = useState<AIProvider>('z-ai');
  const [providerStatus, setProviderStatus] = useState<Record<AIProvider, boolean>>({
    gemini: false,
    glm: false,
    'z-ai': false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProviderSettings();
  }, []);

  const loadProviderSettings = async () => {
    try {
      const available = getAvailableProviders();
      setProviders(available);

      const settings = await getProviderSettings();
      setPrimary(settings.primaryProvider);
      setFallback(settings.fallbackProvider);

      // Check provider status
      const status: Record<AIProvider, boolean> = {
        gemini: false,
        glm: false,
        'z-ai': false,
      };

      for (const provider of available) {
        status[provider] = await validateProviderConfig(provider);
      }

      setProviderStatus(status);
    } catch (error) {
      console.error('Failed to load provider settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrimaryProviderChange = async (provider: AIProvider) => {
    try {
      await setPrimaryProvider(provider);
      setPrimary(provider);
      onProviderChange?.();
    } catch (error) {
      console.error('Failed to set primary provider:', error);
    }
  };

  const handleFallbackProviderChange = async (provider: AIProvider) => {
    try {
      await setFallbackProvider(provider);
      setFallback(provider);
      onProviderChange?.();
    } catch (error) {
      console.error('Failed to set fallback provider:', error);
    }
  };

  if (loading) {
    return (
      <View className="p-4">
        <Text className="text-muted">جاري التحميل...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1">
      <View className="p-4 gap-6">
        {/* Primary Provider Section */}
        <View className="gap-3">
          <Text className="text-lg font-semibold text-foreground">المزود الأساسي</Text>
          <Text className="text-sm text-muted">اختر المزود الذي سيتم استخدامه بشكل افتراضي</Text>

          <View className="gap-2">
            {providers.map((provider) => {
              const isSelected = primaryProvider === provider;
              const isAvailable = providerStatus[provider];

              return (
                <Pressable
                  key={provider}
                  onPress={() => handlePrimaryProviderChange(provider)}
                  style={({ pressed }) => [
                    {
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View
                    className={cn(
                      'flex-row items-center justify-between p-4 rounded-lg border',
                      isSelected
                        ? 'bg-primary/10 border-primary'
                        : 'bg-surface border-border'
                    )}
                  >
                    <View className="flex-1">
                      <Text
                        className={cn(
                          'font-semibold',
                          isSelected ? 'text-primary' : 'text-foreground'
                        )}
                      >
                        {getProviderName(provider)}
                      </Text>
                      <Text className="text-xs text-muted mt-1">
                        {isAvailable ? '✓ متاح' : '✗ غير متاح'}
                      </Text>
                    </View>

                    <View
                      className={cn(
                        'w-6 h-6 rounded-full border-2 items-center justify-center',
                        isSelected ? 'border-primary bg-primary' : 'border-border'
                      )}
                    >
                      {isSelected && <Text className="text-white text-xs">✓</Text>}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Fallback Provider Section */}
        <View className="gap-3 border-t border-border pt-6">
          <Text className="text-lg font-semibold text-foreground">المزود البديل</Text>
          <Text className="text-sm text-muted">
            سيتم استخدام هذا المزود إذا فشل المزود الأساسي
          </Text>

          <View className="gap-2">
            {providers
              .filter((p) => p !== primaryProvider)
              .map((provider) => {
                const isSelected = fallbackProvider === provider;
                const isAvailable = providerStatus[provider];

                return (
                  <Pressable
                    key={provider}
                    onPress={() => handleFallbackProviderChange(provider)}
                    style={({ pressed }) => [
                      {
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View
                      className={cn(
                        'flex-row items-center justify-between p-4 rounded-lg border',
                        isSelected
                          ? 'bg-primary/10 border-primary'
                          : 'bg-surface border-border'
                      )}
                    >
                      <View className="flex-1">
                        <Text
                          className={cn(
                            'font-semibold',
                            isSelected ? 'text-primary' : 'text-foreground'
                          )}
                        >
                          {getProviderName(provider)}
                        </Text>
                        <Text className="text-xs text-muted mt-1">
                          {isAvailable ? '✓ متاح' : '✗ غير متاح'}
                        </Text>
                      </View>

                      <View
                        className={cn(
                          'w-6 h-6 rounded-full border-2 items-center justify-center',
                          isSelected ? 'border-primary bg-primary' : 'border-border'
                        )}
                      >
                        {isSelected && <Text className="text-white text-xs">✓</Text>}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
          </View>
        </View>

        {/* Info Section */}
        <View className="bg-primary/5 border border-primary/20 rounded-lg p-4 gap-2">
          <Text className="text-sm font-semibold text-primary">ℹ️ معلومات</Text>
          <Text className="text-xs text-muted leading-relaxed">
            كل استدعاء API سيستهلك رموز من رصيدك. يمكنك شراء المزيد من الرموز من متجر الرموز.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
