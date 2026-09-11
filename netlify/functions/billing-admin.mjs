// POST /api/admin/billing  header x-admin-key: STATS_KEY   {action: status|setup|accounts|rotate, customer?}
import { ensureSetup, getCfg, stripeKey, mode, issueKeys, bstore, bget, count, month, env, baseUrl } from '../../lib/billing.mjs';

const out = (code, body) => new Response(JSON.stringify(body, null, 1), { status: code, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const summary = c => c && { ok: !!c.ok, mode: c.mode, base: c.base, prices: c.prices, meter: c.meter, portal_config: c.portal_config, webhook: c.webhook && { id: c.webhook.id, url: c.webhook.url }, at: new Date(c.at).toISOString() };

export default async req => {
  const want = env('STATS_KEY');
  if (!want || req.headers.get('x-admin-key') !== want) return out(401, { error: 'unauthorised' });
  if (req.method !== 'POST') return out(405, { error: 'method_not_allowed' });
  const body = await req.json().catch(() => ({}));
  if (!stripeKey()) return out(200, { configured: false, message: 'Add STRIPE_SECRET_KEY in Netlify environment variables, then redeploy.' });
  try {
    if (body.action === 'setup') return out(200, { configured: true, setup: summary(await ensureSetup(baseUrl(req), true)) });
    if (body.action === 'rotate' && /^cus_\w+$/.test(body.customer || '')) return out(200, { customer: body.customer, secret_key: await issueKeys(body.customer, { rotate: true }) });
    if (body.action === 'accounts') {
      const { blobs } = await bstore().list({ prefix: 'acct/' }), rows = [];
      for (const b of blobs.slice(0, 300)) {
        const a = await bget(b.key);
        if (a) rows.push({ customer: a.customer, email: a.email, plan: a.plan, interval: a.interval, status: a.status, mode: a.mode, calls_this_month: await count(`use/${a.customer}/${month()}`), has_key: !!a.sk_hash });
      }
      return out(200, { mode: mode(), accounts: rows });
    }
    return out(200, { configured: true, mode: mode(), setup: summary(await getCfg()) });
  } catch (e) {
    return out(500, { error: e.message, stripe_code: e.stripe?.code || null, param: e.stripe?.param || null });
  }
};

export const config = { path: '/api/admin/billing' };
