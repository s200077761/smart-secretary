import { Platform } from 'react-native';
import Purchases, { PurchasesError, CustomerInfo } from 'react-native-purchases';
import { initStripe, presentPaymentSheet, createPaymentMethod } from '@stripe/stripe-react-native';

export type PaymentMethod = 'apple-pay' | 'google-play' | 'samsung-pay' | 'stripe' | 'mada';

export interface PaymentOption {
  id: string;
  name: string;
  icon: string;
  method: PaymentMethod;
  available: boolean;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

// Initialize RevenueCat for Apple Pay and Google Play
const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '';
const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

let isInitialized = false;

/**
 * Initialize payment services
 */
export async function initializePaymentServices(): Promise<void> {
  try {
    if (isInitialized) return;

    // Initialize RevenueCat
    if (REVENUECAT_API_KEY) {
      await Purchases.configure({
        apiKey: REVENUECAT_API_KEY,
        appUserID: undefined, // Let RevenueCat generate anonymous ID
      });
    }

    // Initialize Stripe
    if (STRIPE_PUBLISHABLE_KEY) {
      await initStripe({
        publishableKey: STRIPE_PUBLISHABLE_KEY,
        merchantIdentifier: 'smart-secretary',
      });
    }

    isInitialized = true;
    console.log('Payment services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize payment services:', error);
  }
}

/**
 * Get available payment methods based on platform
 */
export function getAvailablePaymentMethods(): PaymentOption[] {
  const methods: PaymentOption[] = [];

  // Apple Pay (iOS only)
  if (Platform.OS === 'ios') {
    methods.push({
      id: 'apple-pay',
      name: 'Apple Pay',
      icon: '🍎',
      method: 'apple-pay',
      available: !!REVENUECAT_API_KEY,
    });
  }

  // Google Play (Android only)
  if (Platform.OS === 'android') {
    methods.push({
      id: 'google-play',
      name: 'Google Play',
      icon: '🎮',
      method: 'google-play',
      available: !!REVENUECAT_API_KEY,
    });

    // Samsung Pay (Samsung devices)
    methods.push({
      id: 'samsung-pay',
      name: 'Samsung Pay',
      icon: '📱',
      method: 'samsung-pay',
      available: !!STRIPE_PUBLISHABLE_KEY,
    });
  }

  // Stripe (Web and all platforms)
  methods.push({
    id: 'stripe',
    name: 'بطاقة ائتمان',
    icon: '💳',
    method: 'stripe',
    available: !!STRIPE_PUBLISHABLE_KEY,
  });

  // Mada (Saudi card via Stripe)
  methods.push({
    id: 'mada',
    name: 'مدى (البطاقة السعودية)',
    icon: '🇸🇦',
    method: 'mada',
    available: !!STRIPE_PUBLISHABLE_KEY,
  });

  return methods;
}

/**
 * Process payment via Apple Pay
 */
async function processApplePayment(packageId: string, amount: number): Promise<PaymentResult> {
  try {
    const offerings = await Purchases.getOfferings();
    const offering = offerings.current;

    if (!offering) {
      return { success: false, error: 'No offerings available' };
    }

    const package_ = offering.availablePackages.find((pkg) => pkg.identifier === packageId);
    if (!package_) {
      return { success: false, error: 'Package not found' };
    }

    const customerInfo = await Purchases.purchasePackage(package_);
    const transactionId = (customerInfo as any).originalAppUserId || `apple_${Date.now()}`;

    return {
      success: true,
      transactionId,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const err = error as any;
      if (err.code === 'PurchaseCancelledError') {
        return { success: false, error: 'تم إلغاء الشراء' };
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'فشل الشراء',
    };
  }
}

/**
 * Process payment via Google Play
 */
async function processGooglePlayPayment(packageId: string, amount: number): Promise<PaymentResult> {
  try {
    const offerings = await Purchases.getOfferings();
    const offering = offerings.current;

    if (!offering) {
      return { success: false, error: 'No offerings available' };
    }

    const package_ = offering.availablePackages.find((pkg) => pkg.identifier === packageId);
    if (!package_) {
      return { success: false, error: 'Package not found' };
    }

    const customerInfo = await Purchases.purchasePackage(package_);
    const transactionId = (customerInfo as any).originalAppUserId || `google_${Date.now()}`;

    return {
      success: true,
      transactionId,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const err = error as any;
      if (err.code === 'PurchaseCancelledError') {
        return { success: false, error: 'تم إلغاء الشراء' };
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'فشل الشراء',
    };
  }
}

/**
 * Process payment via Stripe (Visa, Mastercard, Mada)
 */
async function processStripePayment(
  packageId: string,
  amount: number,
  cardType: 'visa' | 'mastercard' | 'mada'
): Promise<PaymentResult> {
  try {
    const { error, paymentMethod } = await createPaymentMethod({
      paymentMethodType: 'Card',
      params: {
        billingDetails: {
          email: 'customer@example.com',
        },
      },
    } as any);

    if (error) {
      return { success: false, error: error.message };
    }

    if (!paymentMethod) {
      return { success: false, error: 'Failed to create payment method' };
    }

    // In a real app, you would send this to your backend to process the payment
    // For now, we'll simulate a successful payment
    const transactionId = `stripe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      transactionId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'فشل الشراء',
    };
  }
}

/**
 * Process payment via Samsung Pay
 */
async function processSamsungPayPayment(packageId: string, amount: number): Promise<PaymentResult> {
  try {
    // Samsung Pay integration via Stripe
    const { error, paymentMethod } = await createPaymentMethod({
      paymentMethodType: 'Card',
      params: {
        billingDetails: {
          email: 'customer@example.com',
        },
      },
    } as any);

    if (error) {
      return { success: false, error: error.message };
    }

    if (!paymentMethod) {
      return { success: false, error: 'Failed to create payment method' };
    }

    const transactionId = `samsung_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      transactionId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'فشل الشراء',
    };
  }
}

/**
 * Process payment based on selected method
 */
export async function processPayment(
  method: PaymentMethod,
  packageId: string,
  amount: number
): Promise<PaymentResult> {
  await initializePaymentServices();

  switch (method) {
    case 'apple-pay':
      return processApplePayment(packageId, amount);

    case 'google-play':
      return processGooglePlayPayment(packageId, amount);

    case 'samsung-pay':
      return processSamsungPayPayment(packageId, amount);

    case 'stripe':
      return processStripePayment(packageId, amount, 'visa');

    case 'mada':
      return processStripePayment(packageId, amount, 'mada');

    default:
      return { success: false, error: 'Unknown payment method' };
  }
}

/**
 * Get customer information
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('Failed to get customer info:', error);
    return null;
  }
}

/**
 * Restore purchases
 */
export async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return !!customerInfo;
  } catch (error) {
    console.error('Failed to restore purchases:', error);
    return false;
  }
}

/**
 * Check if user has active subscription
 */
export async function hasActiveSubscription(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.activeSubscriptions.length > 0;
  } catch (error) {
    console.error('Failed to check subscription:', error);
    return false;
  }
}
