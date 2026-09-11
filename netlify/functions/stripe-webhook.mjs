// Stripe webhook: provisions purchases and keeps subscription status in sync. Signature checked on every call.
import { verifyWebhook, getCfg, env, provisionSession, applySubscription, stripe } from '../../lib/billing.mjs';
import { record } from '../../lib/analytics.mjs';

export default async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const payload = await req.text();
  const cfg = await getCfg().catch(() => null);
  const secrets = [env('STRIPE_WEBHOOK_SECRET'), cfg?.webhook?.secret].filter(Boolean);
  if (!secrets.length) return new Response('Webhook not configured', { status: 503 });
  let event = null;
  for (const s of secrets) { try { event = verifyWebhook(payload, req.headers.get('stripe-signature'), s); break; } catch (e) { } }
  if (!event) return new Response('Invalid signature', { status: 400 });
  const o = event.data?.object || {};
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const rec = await provisionSession(o);
      if (event.type === 'checkout.session.completed') await record('ev', { n: 'paid', x: o.metadata?.plan || rec?.kind || '', p: '/api/stripe/webhook' }, 500);
    } else if (event.type.startsWith('customer.subscription.')) {
      let sub = o;
      try { sub = await stripe('GET', `subscriptions/${o.id}`); } catch (e) { } // newest state, events can arrive out of order
      await applySubscription(sub);
    }
  } catch (e) {
    console.log('webhook handler failed', event.type, e.message);
    return new Response('Handler error, Stripe will retry', { status: 500 });
  }
  return Response.json({ received: true });
};

export const config = { path: '/api/stripe/webhook' };
