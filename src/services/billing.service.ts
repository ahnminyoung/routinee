import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase, isSupabaseConfigured, supabaseConfigErrorMessage } from './supabase';

type BillingFunctionResponse = {
  url?: string;
};

type BillingSessionResult = {
  type: 'success' | 'cancel' | 'dismiss';
  status?: string | null;
  url?: string;
};

const ensureSupabaseConfigured = () => {
  if (!isSupabaseConfigured) {
    throw new Error(supabaseConfigErrorMessage);
  }
};

function parseReturnStatus(url?: string | null): string | null {
  if (!url) return null;
  const parsed = Linking.parse(url);
  const status = parsed.queryParams?.status;
  if (typeof status === 'string') return status;
  return null;
}

async function openBillingFlow(url: string): Promise<BillingSessionResult> {
  const returnUrl = Linking.createURL('/billing/return');
  const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);

  if (result.type === 'success') {
    return {
      type: 'success',
      status: parseReturnStatus(result.url),
      url: result.url,
    };
  }
  if (result.type === 'cancel') {
    return { type: 'cancel' };
  }
  return { type: 'dismiss' };
}

async function invokeBillingFunction(functionName: string, body: Record<string, unknown> = {}) {
  ensureSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke<BillingFunctionResponse>(functionName, { body });
  if (error) throw new Error(error.message || '결제 함수 호출에 실패했습니다.');
  if (!data?.url) throw new Error('결제 URL을 생성하지 못했습니다.');
  return data.url;
}

export const billingService = {
  startStripeCheckout: async (): Promise<BillingSessionResult> => {
    const url = await invokeBillingFunction('create-stripe-checkout-session');
    return openBillingFlow(url);
  },

  openStripePortal: async (): Promise<BillingSessionResult> => {
    const url = await invokeBillingFunction('create-stripe-portal-session');
    return openBillingFlow(url);
  },
};
