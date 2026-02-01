import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { getAvailablePaymentMethods, processPayment, PaymentOption } from '@/lib/payment-service';
import { useColors } from '@/hooks/use-colors';
import { cn } from '@/lib/utils';

interface PaymentMethodSelectorProps {
  packageId: string;
  amount: number;
  packageName: string;
  onPaymentSuccess?: (transactionId: string) => void;
  onPaymentError?: (error: string) => void;
}

export function PaymentMethodSelector({
  packageId,
  amount,
  packageName,
  onPaymentSuccess,
  onPaymentError,
}: PaymentMethodSelectorProps) {
  const colors = useColors();
  const [methods, setMethods] = useState<PaymentOption[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = () => {
    try {
      const availableMethods = getAvailablePaymentMethods();
      setMethods(availableMethods);
      
      // Select first available method by default
      const firstAvailable = availableMethods.find((m) => m.available);
      if (firstAvailable) {
        setSelectedMethod(firstAvailable.id);
      }
    } catch (error) {
      console.error('Failed to load payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedMethod) {
      Alert.alert('خطأ', 'يرجى اختيار طريقة دفع');
      return;
    }

    try {
      setProcessing(true);

      const method = methods.find((m) => m.id === selectedMethod);
      if (!method) return;

      const result = await processPayment(method.method, packageId, amount);

      if (result.success) {
        Alert.alert(
          'نجاح',
          `تم الدفع بنجاح! تم إضافة ${packageName} إلى حسابك.`
        );
        onPaymentSuccess?.(result.transactionId || '');
      } else {
        Alert.alert('خطأ', result.error || 'فشل الدفع');
        onPaymentError?.(result.error || 'Unknown error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
      Alert.alert('خطأ', errorMessage);
      onPaymentError?.(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <View className="p-4">
        <Text className="text-muted">جاري التحميل...</Text>
      </View>
    );
  }

  const availableMethods = methods.filter((m) => m.available);

  if (availableMethods.length === 0) {
    return (
      <View className="p-4 gap-4">
        <Text className="text-error font-semibold">لا توجد طرق دفع متاحة</Text>
        <Text className="text-muted text-sm">
          يرجى التأكد من تثبيت مفاتيح API المطلوبة
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1">
      <View className="p-4 gap-6">
        {/* Order Summary */}
        <View className="bg-surface rounded-lg p-4 border border-border gap-3">
          <Text className="text-sm text-muted">ملخص الطلب</Text>
          <View className="flex-row justify-between items-center">
            <Text className="text-foreground font-medium">{packageName}</Text>
            <Text className="text-2xl font-bold text-primary">${amount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment Methods */}
        <View className="gap-3">
          <Text className="text-lg font-semibold text-foreground">طريقة الدفع</Text>

          <View className="gap-2">
            {availableMethods.map((method) => (
              <Pressable
                key={method.id}
                onPress={() => setSelectedMethod(method.id)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View
                  className={cn(
                    'flex-row items-center gap-4 p-4 rounded-lg border-2',
                    selectedMethod === method.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-surface'
                  )}
                >
                  <View
                    className={cn(
                      'w-6 h-6 rounded-full border-2 items-center justify-center',
                      selectedMethod === method.id
                        ? 'border-primary bg-primary'
                        : 'border-border'
                    )}
                  >
                    {selectedMethod === method.id && (
                      <Text className="text-white text-xs font-bold">✓</Text>
                    )}
                  </View>

                  <View className="flex-1">
                    <Text
                      className={cn(
                        'font-semibold',
                        selectedMethod === method.id
                          ? 'text-primary'
                          : 'text-foreground'
                      )}
                    >
                      {method.icon} {method.name}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Payment Info */}
        <View className="bg-primary/10 border border-primary/20 rounded-lg p-4 gap-2">
          <Text className="text-sm font-semibold text-primary">🔒 آمن وموثوق</Text>
          <Text className="text-xs text-muted leading-relaxed">
            جميع المعاملات محمية بالتشفير من الدرجة الأولى. بيانات بطاقتك آمنة تماماً.
          </Text>
        </View>

        {/* Pay Button */}
        <Pressable
          onPress={handlePayment}
          disabled={processing || !selectedMethod}
          style={({ pressed }) => [
            {
              opacity: pressed || processing ? 0.7 : 1,
            },
          ]}
          className="bg-primary py-4 px-6 rounded-lg items-center justify-center"
        >
          <Text className="text-white font-bold text-center">
            {processing ? 'جاري المعالجة...' : `ادفع الآن ${amount.toFixed(2)}$`}
          </Text>
        </Pressable>

        {/* Refund Policy */}
        <View className="gap-2">
          <Text className="text-xs text-muted text-center">
            يمكنك طلب استرجاع خلال 30 يوم من الشراء
          </Text>
          <Text className="text-xs text-muted text-center">
            للمزيد من المعلومات، راجع سياسة الاسترجاع الخاصة بنا
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
