import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TokenPackage {
  id: string;
  name: string;
  tokens: number;
  price: number;
  currency: string;
  description: string;
  discount?: number; // percentage
}

export interface UserTokens {
  balance: number;
  spent: number;
  purchased: number;
  lastUpdated: number;
}

export interface Transaction {
  id: string;
  type: 'purchase' | 'usage' | 'refund';
  tokens: number;
  amount?: number;
  description: string;
  timestamp: number;
  provider?: string; // 'gemini', 'glm', 'z-ai'
}

const USER_TOKENS_KEY = 'user_tokens';
const TRANSACTIONS_KEY = 'transactions';
const TOKEN_PACKAGES_KEY = 'token_packages';

// Default token packages
const DEFAULT_PACKAGES: TokenPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    tokens: 1000,
    price: 0.99,
    currency: 'USD',
    description: 'للبدء مع التطبيق',
  },
  {
    id: 'pro',
    name: 'Pro',
    tokens: 5000,
    price: 3.99,
    currency: 'USD',
    description: 'للمستخدمين المتقدمين',
    discount: 10,
  },
  {
    id: 'elite',
    name: 'Elite',
    tokens: 15000,
    price: 9.99,
    currency: 'USD',
    description: 'للمستخدمين المحترفين',
    discount: 20,
  },
];

// Token costs per API call
const TOKEN_COSTS = {
  'chat-message': 10,
  'code-generation': 50,
  'code-review': 30,
  'code-explanation': 20,
  'web-search': 25,
  'agent-task': 40,
  'voice-input': 5,
  'tts-output': 8,
};

/**
 * Initialize user tokens
 */
export async function initializeUserTokens(): Promise<UserTokens> {
  try {
    const existing = await AsyncStorage.getItem(USER_TOKENS_KEY);
    if (existing) {
      return JSON.parse(existing);
    }

    const tokens: UserTokens = {
      balance: 100, // Free trial tokens
      spent: 0,
      purchased: 0,
      lastUpdated: Date.now(),
    };

    await AsyncStorage.setItem(USER_TOKENS_KEY, JSON.stringify(tokens));
    return tokens;
  } catch (error) {
    console.error('Failed to initialize user tokens:', error);
    throw error;
  }
}

/**
 * Get user token balance
 */
export async function getUserTokens(): Promise<UserTokens> {
  try {
    const data = await AsyncStorage.getItem(USER_TOKENS_KEY);
    if (!data) {
      return initializeUserTokens();
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to get user tokens:', error);
    throw error;
  }
}

/**
 * Add tokens to user account (simulated purchase)
 */
export async function purchaseTokens(
  packageId: string,
  amount: number
): Promise<UserTokens> {
  try {
    const tokens = await getUserTokens();
    const pkg = DEFAULT_PACKAGES.find((p) => p.id === packageId);

    if (!pkg) {
      throw new Error('Package not found');
    }

    tokens.balance += pkg.tokens;
    tokens.purchased += pkg.tokens;
    tokens.lastUpdated = Date.now();

    await AsyncStorage.setItem(USER_TOKENS_KEY, JSON.stringify(tokens));

    // Record transaction
    const transaction: Transaction = {
      id: Date.now().toString(),
      type: 'purchase',
      tokens: pkg.tokens,
      amount: pkg.price,
      description: `Purchased ${pkg.name} package`,
      timestamp: Date.now(),
    };

    await addTransaction(transaction);

    return tokens;
  } catch (error) {
    console.error('Failed to purchase tokens:', error);
    throw error;
  }
}

/**
 * Consume tokens for API usage
 */
export async function consumeTokens(
  action: keyof typeof TOKEN_COSTS,
  quantity: number = 1
): Promise<boolean> {
  try {
    const cost = TOKEN_COSTS[action] * quantity;
    const tokens = await getUserTokens();

    if (tokens.balance < cost) {
      return false; // Insufficient tokens
    }

    tokens.balance -= cost;
    tokens.spent += cost;
    tokens.lastUpdated = Date.now();

    await AsyncStorage.setItem(USER_TOKENS_KEY, JSON.stringify(tokens));

    // Record transaction
    const transaction: Transaction = {
      id: Date.now().toString(),
      type: 'usage',
      tokens: -cost,
      description: `Used for ${action}`,
      timestamp: Date.now(),
    };

    await addTransaction(transaction);

    return true;
  } catch (error) {
    console.error('Failed to consume tokens:', error);
    return false;
  }
}

/**
 * Get token packages
 */
export async function getTokenPackages(): Promise<TokenPackage[]> {
  try {
    const data = await AsyncStorage.getItem(TOKEN_PACKAGES_KEY);
    if (!data) {
      await AsyncStorage.setItem(TOKEN_PACKAGES_KEY, JSON.stringify(DEFAULT_PACKAGES));
      return DEFAULT_PACKAGES;
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to get token packages:', error);
    return DEFAULT_PACKAGES;
  }
}

/**
 * Get token cost for an action
 */
export function getTokenCost(action: keyof typeof TOKEN_COSTS, quantity: number = 1): number {
  return (TOKEN_COSTS[action] || 0) * quantity;
}

/**
 * Add transaction to history
 */
async function addTransaction(transaction: Transaction): Promise<void> {
  try {
    const transactions = await AsyncStorage.getItem(TRANSACTIONS_KEY);
    const list: Transaction[] = transactions ? JSON.parse(transactions) : [];
    list.push(transaction);
    await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(list));
  } catch (error) {
    console.error('Failed to add transaction:', error);
  }
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(limit: number = 50): Promise<Transaction[]> {
  try {
    const data = await AsyncStorage.getItem(TRANSACTIONS_KEY);
    const transactions: Transaction[] = data ? JSON.parse(data) : [];
    return transactions.slice(-limit).reverse();
  } catch (error) {
    console.error('Failed to get transaction history:', error);
    return [];
  }
}

/**
 * Clear all tokens and transactions (for testing)
 */
export async function clearAllTokenData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(USER_TOKENS_KEY);
    await AsyncStorage.removeItem(TRANSACTIONS_KEY);
  } catch (error) {
    console.error('Failed to clear token data:', error);
  }
}
