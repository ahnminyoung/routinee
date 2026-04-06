// Supabase Edge Function 로직: supabase/functions/create-stripe-portal-session/index.ts
import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const appReturnUrl = Deno.env.get('APP_RETURN_URL') ?? 'routinee://billing/return?status=portal';

  if (!supabaseUrl || !supabaseAnonKey || !stripeSecretKey) {
    return jsonResponse({ error: 'Missing required environment variables' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const user = authData.user;

  const { data: subscription, error: subError } = await supabase
    .from('user_subscriptions')
    .select('provider,provider_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (subError) {
    return jsonResponse({ error: subError.message }, 400);
  }

  if (!subscription?.provider_customer_id || subscription.provider !== 'stripe') {
    return jsonResponse({
      error: 'Stripe customer not found. 결제 완료 후 잠시 뒤 다시 시도해주세요.',
    }, 400);
  }

  const stripe = new Stripe(stripeSecretKey, { httpClient: Stripe.createFetchHttpClient() });

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.provider_customer_id,
      return_url: appReturnUrl,
    });
    return jsonResponse({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
