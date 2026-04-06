// Supabase Edge Function 로직: supabase/functions/create-stripe-checkout-session/index.ts
import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

function appendQuery(url: string, params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return `${url}${url.includes('?') ? '&' : '?'}${query}`;
}

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
  const stripePriceId = Deno.env.get('STRIPE_PRICE_ID_MONTHLY');
  const appReturnUrl = Deno.env.get('APP_RETURN_URL') ?? 'routinee://billing/return';

  if (!supabaseUrl || !supabaseAnonKey || !stripeSecretKey || !stripePriceId) {
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
  const stripe = new Stripe(stripeSecretKey, { httpClient: Stripe.createFetchHttpClient() });

  const successUrl = appendQuery(appReturnUrl, {
    status: 'success',
    session_id: '{CHECKOUT_SESSION_ID}',
  });
  const cancelUrl = appendQuery(appReturnUrl, { status: 'canceled' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      metadata: {
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
        },
      },
    });

    if (!session.url) {
      return jsonResponse({ error: 'Failed to create checkout URL' }, 500);
    }

    return jsonResponse({
      url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
