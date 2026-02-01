import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { getUserTokens, getTransactionHistory, Transaction } from '@/lib/iap-service';
import { useColors } from '@/hooks/use-colors';
import { cn } from '@/lib/utils';

interface TokenBalanceProps {
  onRefresh?: () => void;
}

export function TokenBalance({ onRefresh }: TokenBalanceProps) {
  const colors = useColors();
  const [tokens, setTokens] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTokenData();
  }, []);

  const loadTokenData = async () => {
    try {
      const tokenData = await getUserTokens();
      setTokens(tokenData);

      const txHistory = await getTransactionHistory(10);
      setTransactions(txHistory);
    } catch (error) {
      console.error('Failed to load token data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await loadTokenData();
    onRefresh?.();
  };

  if (loading || !tokens) {
    return (
      <View className="p-4">
        <Text className="text-muted">جاري التحميل...</Text>
      </View>
    );
  }

  const usagePercentage = Math.min(
    (tokens.spent / (tokens.spent + tokens.balance)) * 100,
    100
  );

  return (
    <ScrollView className="flex-1">
      <View className="p-4 gap-6">
        {/* Main Balance Card */}
        <View
          className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 gap-4"
          style={{
            backgroundColor: colors.primary,
          }}
        >
          <Text className="text-white/80 text-sm font-medium">الرصيد الحالي</Text>
          <View className="gap-2">
            <Text className="text-5xl font-bold text-white">{tokens.balance}</Text>
            <Text className="text-white/60 text-sm">رمز متاح للاستخدام</Text>
          </View>

          <Pressable
            onPress={handleRefresh}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            className="bg-white/20 rounded-lg px-4 py-2 self-start"
          >
            <Text className="text-white text-sm font-semibold">تحديث</Text>
          </Pressable>
        </View>

        {/* Stats Grid */}
        <View className="gap-3">
          <View className="flex-row gap-3">
            {/* Purchased */}
            <View className="flex-1 bg-surface rounded-lg p-4 border border-border">
              <Text className="text-muted text-xs mb-2">مشترى</Text>
              <Text className="text-2xl font-bold text-foreground">{tokens.purchased}</Text>
              <Text className="text-muted text-xs mt-2">إجمالي الرموز المشتراة</Text>
            </View>

            {/* Used */}
            <View className="flex-1 bg-surface rounded-lg p-4 border border-border">
              <Text className="text-muted text-xs mb-2">مستخدم</Text>
              <Text className="text-2xl font-bold text-error">{tokens.spent}</Text>
              <Text className="text-muted text-xs mt-2">إجمالي الرموز المستخدمة</Text>
            </View>
          </View>
        </View>

        {/* Usage Progress */}
        <View className="gap-3">
          <View className="flex-row justify-between items-center">
            <Text className="text-sm font-semibold text-foreground">نسبة الاستخدام</Text>
            <Text className="text-xs text-muted">
              {usagePercentage.toFixed(1)}%
            </Text>
          </View>

          <View className="h-2 bg-border rounded-full overflow-hidden">
            <View
              className="h-full bg-primary rounded-full"
              style={{
                width: `${usagePercentage}%`,
              }}
            />
          </View>
        </View>

        {/* Last Updated */}
        <View className="bg-surface rounded-lg p-4 border border-border">
          <Text className="text-xs text-muted">آخر تحديث</Text>
          <Text className="text-sm text-foreground mt-1">
            {new Date(tokens.lastUpdated).toLocaleString('ar-SA')}
          </Text>
        </View>

        {/* Transaction History */}
        {transactions.length > 0 && (
          <View className="gap-3 border-t border-border pt-6">
            <Text className="text-lg font-semibold text-foreground">سجل المعاملات</Text>

            <View className="gap-2">
              {transactions.map((tx) => (
                <View
                  key={tx.id}
                  className="flex-row items-center justify-between p-4 bg-surface rounded-lg border border-border"
                >
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">
                      {tx.description}
                    </Text>
                    <Text className="text-xs text-muted mt-1">
                      {new Date(tx.timestamp).toLocaleString('ar-SA')}
                    </Text>
                  </View>

                  <View className="items-end">
                    <Text
                      className={cn(
                        'text-sm font-bold',
                        tx.type === 'purchase'
                          ? 'text-success'
                          : tx.type === 'usage'
                            ? 'text-error'
                            : 'text-warning'
                      )}
                    >
                      {tx.type === 'purchase' ? '+' : '-'}
                      {Math.abs(tx.tokens)}
                    </Text>
                    {tx.amount && (
                      <Text className="text-xs text-muted mt-1">
                        ${tx.amount.toFixed(2)}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Info Section */}
        <View className="bg-warning/10 border border-warning/20 rounded-lg p-4 gap-2">
          <Text className="text-sm font-semibold text-warning">⚠️ تنبيه</Text>
          <Text className="text-xs text-muted leading-relaxed">
            عندما ينخفض رصيدك، قد لا تتمكن من استخدام الخدمات. يرجى شراء المزيد من الرموز
            للاستمرار في الاستخدام.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
