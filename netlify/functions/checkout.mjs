// POST /api/checkout (plan=agent|agency|portal|single, interval=month|year) -> Stripe Checkout
import { createCheckout, stripeKey, isPrimary, baseUrl, PRIMARY } from '../../lib/billing.mjs';
import { record } from '../../lib/analytics.mjs';

const go = (to, status = 303) => new Response(null, { status, headers: { Location: to, 'Cache-Control': 'no-store' } });

export default async (req, context) => {
  const u = new URL(req.url);
  if (!isPrimary(req, context)) return go(PRIMARY + u.pathname + u.search, 307); // mirror: pay on the main site
  const q = Object.fromEntries(u.searchParams);
  if (req.method === 'POST') {
    const text = await req.text();
    Object.assign(q, (req.headers.get('content-type') || '').includes('json') ? JSON.parse(text || '{}') : Object.fromEntries(new URLSearchParams(text)));
  }
  const back = q.plan === 'single' ? '/report/?' + new URLSearchParams(Object.entries(q).filter(([k]) => ['lat', 'lon', 'floor', 'floors', 'h', 'name', 'agency', 'logo', 'agent'].includes(k))) : '/listings/?checkout=';
  if (!stripeKey()) return go(q.plan === 'single' ? back + '&checkout=soon' : '/listings/?checkout=soon#signup');
  try {
    const s = await createCheckout(baseUrl(req), q);
    await record('ev', { n: 'checkout_start', x: q.plan + (q.interval ? '_' + q.interval : ''), p: '/api/checkout' }, 500);
    return go(s.url);
  } catch (e) {
    console.log('checkout failed', e.code || e.status || '', e.message);
    return go(q.plan === 'single' ? back + '&checkout=error' : '/listings/?checkout=error#pricing');
  }
};

export const config = { path: '/api/checkout' };
