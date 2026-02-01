import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { getTokenPackages, purchaseTokens, getUserTokens, TokenPackage } from '@/lib/iap-service';
import { useColors } from '@/hooks/use-colors';
import { cn } from '@/lib/utils';

interface TokenShopProps {
  onPurchaseSuccess?: () => void;
}

export function TokenShop({ onPurchaseSuccess }: TokenShopProps) {
  const colors = useColors();
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [currentBalance, setCurrentBalance] = useState(0);

  useEffect(() => {
    loadShopData();
  }, []);

  const loadShopData = async () => {
    try {
      const pkgs = await getTokenPackages();
      setPackages(pkgs);

      const tokens = await getUserTokens();
      setCurrentBalance(tokens.balance);
    } catch (error) {
      console.error('Failed to load shop data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packageId: string) => {
    try {
      setPurchasing(packageId);

      const pkg = packages.find((p) => p.id === packageId);
      if (!pkg) return;

      // Simulate purchase (in real app, this would integrate with payment gateway)
      await purchaseTokens(packageId, pkg.price);

      // Update balance
      const tokens = await getUserTokens();
      setCurrentBalance(tokens.balance);

      Alert.alert('نجاح', `تم شراء ${pkg.name} بنجاح! تم إضافة ${pkg.tokens} رمز إلى حسابك.`);
      onPurchaseSuccess?.();
    } catch (error) {
      Alert.alert('خطأ', 'فشل الشراء. يرجى المحاولة مرة أخرى.');
      console.error('Purchase failed:', error);
    } finally {
      setPurchasing(null);
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
        {/* Header with Current Balance */}
        <View className="gap-2">
          <Text className="text-2xl font-bold text-foreground">متجر الرموز</Text>
          <View className="flex-row items-center gap-2 mt-2">
            <Text className="text-muted">الرصيد الحالي:</Text>
            <Text className="text-2xl font-bold text-primary">{currentBalance}</Text>
            <Text className="text-muted">رمز</Text>
          </View>
        </View>

        {/* Packages Grid */}
        <View className="gap-4">
          {packages.map((pkg) => {
            const isPopular = pkg.discount && pkg.discount > 15;
            const pricePerToken = (pkg.price / pkg.tokens * 1000).toFixed(2);

            return (
              <View
                key={pkg.id}
                className={cn(
                  'rounded-2xl border-2 overflow-hidden',
                  isPopular ? 'border-primary bg-primary/5' : 'border-border bg-surface'
                )}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <View className="bg-primary px-4 py-2">
                    <Text className="text-white text-xs font-bold text-center">
                      ⭐ الأكثر شهرة
                    </Text>
                  </View>
                )}

                <View className="p-6 gap-4">
                  {/* Package Name and Tokens */}
                  <View className="gap-2">
                    <Text className="text-xl font-bold text-foreground">{pkg.name}</Text>
                    <View className="flex-row items-baseline gap-2">
                      <Text className="text-4xl font-bold text-primary">{pkg.tokens}</Text>
                      <Text className="text-muted">رمز</Text>
                    </View>
                  </View>

                  {/* Description */}
                  <Text className="text-sm text-muted">{pkg.description}</Text>

                  {/* Pricing Info */}
                  <View className="bg-background rounded-lg p-3 gap-2">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-muted text-sm">السعر</Text>
                      <Text className="text-foreground font-semibold">
                        ${pkg.price.toFixed(2)}
                      </Text>
                    </View>

                    {pkg.discount && (
                      <View className="flex-row justify-between items-center">
                        <Text className="text-muted text-sm">الخصم</Text>
                        <Text className="text-success font-semibold">{pkg.discount}%</Text>
                      </View>
                    )}

                    <View className="flex-row justify-between items-center border-t border-border pt-2">
                      <Text className="text-muted text-xs">السعر لكل 1000 رمز</Text>
                      <Text className="text-foreground font-semibold">${pricePerToken}</Text>
                    </View>
                  </View>

                  {/* Purchase Button */}
                  <Pressable
                    onPress={() => handlePurchase(pkg.id)}
                    disabled={purchasing === pkg.id}
                    style={({ pressed }) => [
                      {
                        opacity: pressed || purchasing === pkg.id ? 0.7 : 1,
                      },
                    ]}
                    className={cn(
                      'py-3 px-4 rounded-lg items-center justify-center',
                      isPopular ? 'bg-primary' : 'bg-primary/20'
                    )}
                  >
                    <Text
                      className={cn(
                        'font-bold text-center',
                        isPopular ? 'text-white' : 'text-primary'
                      )}
                    >
                      {purchasing === pkg.id ? 'جاري الشراء...' : 'شراء الآن'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        {/* Benefits Section */}
        <View className="bg-primary/10 border border-primary/20 rounded-lg p-4 gap-3">
          <Text className="text-sm font-semibold text-primary">✨ فوائد الرموز</Text>
          <View className="gap-2">
            <Text className="text-xs text-muted">
              • كل رسالة دردشة تستهلك 10 رموز
            </Text>
            <Text className="text-xs text-muted">
              • توليد الأكواد يستهلك 50 رمز
            </Text>
            <Text className="text-xs text-muted">
              • البحث الذكي يستهلك 25 رمز
            </Text>
            <Text className="text-xs text-muted">
              • المزيد من الرموز = المزيد من الاستخدام
            </Text>
          </View>
        </View>

        {/* FAQ Section */}
        <View className="gap-3 border-t border-border pt-6">
          <Text className="text-lg font-semibold text-foreground">الأسئلة الشائعة</Text>

          <View className="gap-3">
            <View className="gap-1">
              <Text className="text-sm font-semibold text-foreground">
                هل الرموز تنتهي الصلاحية؟
              </Text>
              <Text className="text-xs text-muted">
                لا، الرموز لا تنتهي صلاحيتها ويمكنك استخدامها في أي وقت.
              </Text>
            </View>

            <View className="gap-1">
              <Text className="text-sm font-semibold text-foreground">
                هل يمكن استرجاع الأموال؟
              </Text>
              <Text className="text-xs text-muted">
                نعم، يمكنك طلب استرجاع خلال 30 يوم من الشراء.
              </Text>
            </View>

            <View className="gap-1">
              <Text className="text-sm font-semibold text-foreground">
                كيف أتصل بالدعم؟
              </Text>
              <Text className="text-xs text-muted">
                يمكنك التواصل معنا عبر البريد الإلكتروني أو من خلال تطبيق الدعم.
              </Text>
            </View>
          </View>
        </View>

        {/* Info Section */}
        <View className="bg-warning/10 border border-warning/20 rounded-lg p-4 gap-2 mb-4">
          <Text className="text-sm font-semibold text-warning">ℹ️ ملاحظة</Text>
          <Text className="text-xs text-muted leading-relaxed">
            الشراء يتم بشكل آمن عبر منصات الدفع الموثوقة. جميع المعاملات محمية بالتشفير.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
