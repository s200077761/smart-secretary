import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal } from 'react-native';
import { getTokenPackages, TokenPackage } from '@/lib/iap-service';
import { PaymentMethodSelector } from './payment-method-selector';
import { useColors } from '@/hooks/use-colors';
import { cn } from '@/lib/utils';

interface TokenShopWithPaymentProps {
  onPurchaseSuccess?: () => void;
}

export function TokenShopWithPayment({ onPurchaseSuccess }: TokenShopWithPaymentProps) {
  const colors = useColors();
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<TokenPackage | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  React.useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      const pkgs = await getTokenPackages();
      setPackages(pkgs);
    } catch (error) {
      console.error('Failed to load packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseClick = (pkg: TokenPackage) => {
    setSelectedPackage(pkg);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = (transactionId: string) => {
    setShowPaymentModal(false);
    setSelectedPackage(null);
    onPurchaseSuccess?.();
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
        {/* Header */}
        <View className="gap-2">
          <Text className="text-2xl font-bold text-foreground">متجر الرموز</Text>
          <Text className="text-sm text-muted">
            اختر الباقة المناسبة لاحتياجاتك
          </Text>
        </View>

        {/* Packages */}
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
                {isPopular && (
                  <View className="bg-primary px-4 py-2">
                    <Text className="text-white text-xs font-bold text-center">
                      ⭐ الأكثر شهرة
                    </Text>
                  </View>
                )}

                <View className="p-6 gap-4">
                  <View className="gap-2">
                    <Text className="text-xl font-bold text-foreground">{pkg.name}</Text>
                    <View className="flex-row items-baseline gap-2">
                      <Text className="text-4xl font-bold text-primary">{pkg.tokens}</Text>
                      <Text className="text-muted">رمز</Text>
                    </View>
                  </View>

                  <Text className="text-sm text-muted">{pkg.description}</Text>

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

                  <Pressable
                    onPress={() => handlePurchaseClick(pkg)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
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
                      شراء الآن
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        {/* Benefits */}
        <View className="bg-primary/10 border border-primary/20 rounded-lg p-4 gap-3">
          <Text className="text-sm font-semibold text-primary">✨ فوائد الرموز</Text>
          <View className="gap-2">
            <Text className="text-xs text-muted">• كل رسالة دردشة = 10 رموز</Text>
            <Text className="text-xs text-muted">• توليد الأكواد = 50 رمز</Text>
            <Text className="text-xs text-muted">• البحث الذكي = 25 رمز</Text>
          </View>
        </View>
      </View>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {selectedPackage && (
            <PaymentMethodSelector
              packageId={selectedPackage.id}
              amount={selectedPackage.price}
              packageName={selectedPackage.name}
              onPaymentSuccess={handlePaymentSuccess}
              onPaymentError={() => setShowPaymentModal(false)}
            />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}
