import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type UpsertInput = {
  userId: string;
  plan: 'free' | 'pro';
  status: 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing';
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  metadata?: Record<string, unknown>;
};

function toIso(seconds?: number | null): string | null {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

function statusToPlan(status: UpsertInput['status']): 'free' | 'pro' {
  if (status === 'active' || status === 'trialing' || status === 'past_due') return 'pro';
  return 'free';
}

async function resolveUserIdBySubscriptionId(admin: ReturnType<typeof createClient>, subscriptionId: string) {
  const { data } = await admin
    .from('user_subscriptions')
    .select('user_id')
    .eq('provider_subscription_id', subscriptionId)
    .maybeSingle();
  return data?.user_id ?? null;
}

async function upsertSubscription(
  admin: ReturnType<typeof createClient>,
  input: UpsertInput
) {
  const { error } = await admin.from('user_subscriptions').upsert({
    user_id: input.userId,
    plan: input.plan,
    status: input.status,
    provider: 'stripe',
    provider_customer_id: input.providerCustomerId ?? null,
    provider_subscription_id: input.providerSubscriptionId ?? null,
    current_period_start: input.currentPeriodStart ?? null,
    current_period_end: input.currentPeriodEnd ?? null,
    cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
    metadata: input.metadata ?? {},
  }, {
    onConflict: 'user_id',
  });

  if (error) throw error;
}

async function syncFromSubscription(
  stripe: Stripe,
  admin: ReturnType<typeof createClient>,
  subscriptionId: string,
  fallbackUserId?: string | null
) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = sub.metadata?.user_id
    || fallbackUserId
    || await resolveUserIdBySubscriptionId(admin, sub.id);

  if (!userId) return;

  const status = (sub.status === 'active'
    || sub.status === 'trialing'
    || sub.status === 'past_due'
    || sub.status === 'canceled'
    || sub.status === 'incomplete'
    || sub.status === 'incomplete_expired'
    || sub.status === 'unpaid')
    ? (sub.status === 'incomplete' || sub.status === 'incomplete_expired' || sub.status === 'unpaid'
      ? 'inactive'
      : sub.status) as UpsertInput['status']
    : 'inactive';

  await upsertSubscription(admin, {
    userId,
    plan: statusToPlan(status),
    status,
    providerCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null,
    providerSubscriptionId: sub.id,
    currentPeriodStart: toIso(sub.current_period_start),
    currentPeriodEnd: toIso(sub.current_period_end),
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    metadata: {
      source: 'stripe_webhook',
      latest_event: 'customer.subscription.sync',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey || !stripeWebhookSecret) {
    return jsonResponse({ error: 'Missing required environment variables' }, 500);
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return jsonResponse({ error: 'Missing stripe-signature header' }, 400);
  }

  const rawBody = await req.text();
  const stripe = new Stripe(stripeSecretKey, { httpClient: Stripe.createFetchHttpClient() });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, stripeWebhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook signature';
    return jsonResponse({ error: message }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;

        const userId = session.metadata?.user_id || session.client_reference_id;
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;

        if (!userId) break;

        if (subscriptionId) {
          await syncFromSubscription(stripe, admin, subscriptionId, userId);
        } else {
          await upsertSubscription(admin, {
            userId,
            plan: 'pro',
            status: 'active',
            providerCustomerId: typeof session.customer === 'string' ? session.customer : null,
            metadata: {
              source: 'stripe_webhook',
              checkout_session_id: session.id,
            },
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await syncFromSubscription(stripe, admin, sub.id, sub.metadata?.user_id ?? null);
        break;
      }

      case 'invoice.payment_failed':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id;
        if (!subscriptionId) break;
        await syncFromSubscription(stripe, admin, subscriptionId);
        break;
      }

      default:
        break;
    }

    return jsonResponse({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handling failed';
    return jsonResponse({ error: message }, 500);
  }
});
