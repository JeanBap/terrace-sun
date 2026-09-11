// Billing for the Terrace Sun API: Stripe (plain REST, no SDK), API keys, quotas.
// Secret API keys are never stored in clear, only their SHA-256 hash. Stripe is the source of truth for money;
// Netlify Blobs (strong consistency) keeps plan status, key hashes and usage counters.
import crypto from 'node:crypto';
import { getStore, getDeployStore } from '@netlify/blobs';

export const PRIMARY = 'https://terrace-sun.netlify.app';
export const DAY = 864e5;
export const env = k => String(globalThis.Netlify?.env?.get(k) ?? process.env[k] ?? '').trim();
export const METER_EVENT = 'terrace_sun_api_call';

// ---------- plans (must match /listings/#pricing)
export const PLANS = {
  agent: { name: 'Agent', included: 1000, cap: 1000 },
  agency: { name: 'Agency', included: 3000, cap: 3000 },
  portal: { name: 'Portal API', included: 25000, cap: 250000, metered: true }
};
export const FREE_MONTHLY = 100;   // per caller IP, no key or key=demo
export const PK_DAILY = 2000;      // badge calls per publishable key per day (not billed)
export const ACTIVE = new Set(['active', 'trialing', 'past_due']);
const LOOKUP = {
  ts_agent_month: 'agent', ts_agent_year: 'agent', ts_agency_month: 'agency', ts_agency_year: 'agency',
  ts_portal_base: 'portal', ts_portal_metered: 'portal'
};
const PRODUCTS = {
  ts_agent: ['Terrace Sun Agent', 'Branded sun-exposure reports and badge on all listings. 1,000 API calls a month.'],
  ts_agency: ['Terrace Sun Agency', 'Up to 10 agents, agency branding, 3,000 API calls a month.'],
  ts_portal: ['Terrace Sun Portal API', '25,000 API calls a month included, then EUR 0.02 per call.'],
  ts_single: ['Terrace Sun single report', 'One sun-exposure report for one address, with your branding instead of ours.']
};
const PRICES = {
  ts_agent_month: { product: 'ts_agent', unit_amount: 1900, recurring: { interval: 'month' } },
  ts_agent_year: { product: 'ts_agent', unit_amount: 19000, recurring: { interval: 'year' } },
  ts_agency_month: { product: 'ts_agency', unit_amount: 7900, recurring: { interval: 'month' } },
  ts_agency_year: { product: 'ts_agency', unit_amount: 79000, recurring: { interval: 'year' } },
  ts_portal_base: { product: 'ts_portal', unit_amount: 39000, recurring: { interval: 'month' } },
  ts_portal_metered: { product: 'ts_portal', recurring: { interval: 'month', usage_type: 'metered' }, billing_scheme: 'tiered', tiers_mode: 'graduated', tiers: [{ up_to: 25000, unit_amount: 0 }, { up_to: 'inf', unit_amount: 2 }] },
  ts_single: { product: 'ts_single', unit_amount: 900 }
};
const WEBHOOK_EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'];

// ---------- Stripe REST
export const stripeKey = () => env('STRIPE_SECRET_KEY');
export const mode = () => /_live_/.test(stripeKey()) ? 'live' : 'test';
function form(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out); else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out;
}
export async function stripe(method, path, params, idem) {
  const key = stripeKey();
  if (!key) throw Object.assign(new Error('Stripe is not configured'), { code: 'not_configured' });
  const qs = params ? form(params).join('&') : '';
  const get = method === 'GET' || method === 'DELETE';
  const headers = { Authorization: 'Bearer ' + key };
  if (!get) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idem) headers['Idempotency-Key'] = idem;
  const r = await fetch('https://api.stripe.com/v1/' + path + (get && qs ? '?' + qs : ''), { method, headers, body: get ? undefined : qs });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error?.message || 'Stripe error ' + r.status), { status: r.status, stripe: j.error });
  return j;
}
// Stripe-Signature: t=..,v1=..  HMAC-SHA256 of `${t}.${payload}` with the whole whsec_ secret
export function verifyWebhook(payload, header, secret, toleranceSec = 300, now = Date.now()) {
  const parts = String(header || '').split(',').map(s => s.trim());
  const t = parts.find(s => s.startsWith('t='))?.slice(2);
  const sigs = parts.filter(s => s.startsWith('v1=')).map(s => s.slice(3));
  if (!t || !sigs.length) throw new Error('no signature');
  if (Math.abs(now / 1000 - Number(t)) > toleranceSec) throw new Error('timestamp outside tolerance');
  const want = Buffer.from(crypto.createHmac('sha256', secret).update(`${t}.${payload}`, 'utf8').digest('hex'));
  if (!sigs.some(s => s.length === want.length && crypto.timingSafeEqual(Buffer.from(s), want))) throw new Error('signature mismatch');
  return JSON.parse(payload);
}

// ---------- storage
let testStore = null;
export const setBillingStoreForTests = s => { testStore = s; };
export function bstore() {
  if (testStore) return testStore;
  const prod = globalThis.Netlify?.context?.deploy?.context === 'production';
  return prod ? getStore('billing', { consistency: 'strong' }) : getDeployStore('billing', { consistency: 'strong' });
}
export const bget = k => bstore().get(k, { type: 'json' });
export const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const rand = n => crypto.randomBytes(n).toString('base64url');
export const month = (t = Date.now()) => new Date(t).toISOString().slice(0, 7);
export const today = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

// optimistic read-modify-write; fn returns the new value or null for "no change"
export async function update(key, fn) {
  const s = bstore();
  for (let i = 0; i < 6; i++) {
    const cur = await s.getWithMetadata(key, { type: 'json' });
    const next = fn(cur ? structuredClone(cur.data) : null);
    if (!next) return cur ? cur.data : null;
    const w = cur ? await s.setJSON(key, next, { onlyIfMatch: cur.etag }) : await s.setJSON(key, next, { onlyIfNew: true });
    if (w.modified) return next;
  }
  throw new Error('write conflict on ' + key);
}
export async function bump(key) { return update(key, c => ({ n: (c?.n || 0) + 1, t: Date.now() })).catch(e => console.log('usage write failed', e.message)); }
export const count = async key => (await bget(key))?.n || 0;

// ---------- accounts
const updateAcct = (customer, fn) => update(`acct/${customer}`, a => { const n = fn(a); if (n) n.updated = Date.now(); return n; });
export const getAcct = customer => bget(`acct/${customer}`);
export async function acctForSecret(sk) {
  const h = hash(sk), idx = await bget(`sk/${h}`);
  if (!idx) return null;
  const a = await getAcct(idx.customer);
  return a && a.sk_hash === h ? a : null;
}
export async function acctForPk(pk) {
  const idx = await bget(`pk/${pk}`);
  if (!idx) return null;
  const a = await getAcct(idx.customer);
  return a && a.pk === pk ? a : null;
}
export function subInfo(sub) {
  const items = sub.items?.data || [];
  const plan = items.map(i => LOOKUP[i.price?.lookup_key]).find(Boolean) || sub.metadata?.plan || null;
  const base = items.find(i => i.price?.recurring?.usage_type !== 'metered') || items[0];
  return {
    subscription: sub.id, status: sub.status, plan, interval: base?.price?.recurring?.interval || null,
    period_end: sub.current_period_end || base?.current_period_end || null,
    cancel_at_period_end: !!sub.cancel_at_period_end, cancel_at: sub.cancel_at || null
  };
}
export async function applySubscription(sub) {
  const info = subInfo(sub), customer = typeof sub.customer === 'object' ? sub.customer.id : sub.customer;
  return updateAcct(customer, a => ({ ...(a || { customer, created: Date.now(), mode: sub.livemode ? 'live' : 'test' }), ...info, synced: Date.now() }));
}
export async function syncAcct(a) {
  if (!a?.subscription) return a;
  return applySubscription(await stripe('GET', `subscriptions/${a.subscription}`));
}
// Idempotent: called by the webhook and by the account page (whichever comes first)
export async function provisionSession(session) {
  const s = bstore(), sid = session.id, customer = typeof session.customer === 'object' ? session.customer?.id : session.customer;
  const existing = await bget(`sess/${sid}`);
  if (existing) {
    if (existing.kind === 'single' && session.payment_status === 'paid') await update(`single/${existing.token}`, r => r && !r.paid ? { ...r, paid: true } : null);
    return existing;
  }
  if (session.mode === 'payment') {
    const m = session.metadata || {}, token = rand(18);
    await s.setJSON(`single/${token}`, {
      token, session: sid, customer, paid: session.payment_status === 'paid', created: Date.now(),
      lat: Number(m.lat), lon: Number(m.lon), floor: Number(m.floor) || 0, floors: m.floors ? Number(m.floors) : null,
      name: m.name || '', agency: m.agency || '', logo: m.logo || '', agent: m.agent || '', email: session.customer_details?.email || ''
    });
    const rec = { kind: 'single', token, customer, created: Date.now() };
    const w = await s.setJSON(`sess/${sid}`, rec, { onlyIfNew: true });
    if (w.modified) return rec;
    await s.delete(`single/${token}`);
    return bget(`sess/${sid}`);
  }
  let info = {};
  if (session.subscription) {
    const sub = typeof session.subscription === 'object' ? session.subscription : await stripe('GET', `subscriptions/${session.subscription}`);
    info = subInfo(sub);
  }
  await updateAcct(customer, a => ({
    ...(a || { customer, created: Date.now(), mode: session.livemode ? 'live' : 'test' }),
    ...info, plan: info.plan || a?.plan || session.metadata?.plan || null,
    email: session.customer_details?.email || a?.email || '', synced: Date.now()
  }));
  const rec = { kind: 'plan', customer, created: Date.now() };
  const w = await s.setJSON(`sess/${sid}`, rec, { onlyIfNew: true });
  return w.modified ? rec : bget(`sess/${sid}`);
}
// Keys: secret (server side, shown once) and publishable (badge and report links, safe in public HTML)
export async function issueKeys(customer, { rotate = false } = {}) {
  const s = bstore(), raw = `ts_sk_${mode()}_${rand(24)}`, h = hash(raw);
  let pkNew = null, old = null, done = false;
  await s.setJSON(`sk/${h}`, { customer });
  await updateAcct(customer, a => {
    done = false; old = null; pkNew = null;
    if (!a) throw new Error('no account');
    if (a.sk_hash && !rotate) return null;
    old = a.sk_hash || null; done = true;
    const pk = a.pk || (pkNew = `ts_pk_${mode()}_${rand(12)}`);
    return { ...a, sk_hash: h, sk_last4: raw.slice(-4), pk, keys_at: Date.now() };
  });
  if (!done) { await s.delete(`sk/${h}`); return null; }
  if (pkNew) await s.setJSON(`pk/${pkNew}`, { customer });
  if (old && old !== h) await s.delete(`sk/${old}`);
  return raw;
}

// ---------- one-time Stripe setup (idempotent): products, prices, meter, portal, webhook
export async function getCfg() { return bget(`cfg/${mode()}`); }
export async function ensureSetup(base, force = false) {
  const cur = await getCfg();
  if (cur && cur.ok && !force) return cur;
  const cfg = { ...(cur || {}), mode: mode(), base, prices: {}, at: Date.now() };
  // parallel rounds keep this well inside the 10 s function limit on a first checkout
  await Promise.all(Object.entries(PRODUCTS).map(async ([id, [name, description]]) => {
    try { await stripe('GET', `products/${id}`); }
    catch (e) { if (e.status !== 404) throw e; await stripe('POST', 'products', { id, name, description }); }
  }));
  const [meters, found, hooks] = await Promise.all([stripe('GET', 'billing/meters', { status: 'active', limit: 100 }), stripe('GET', 'prices', { active: 'true', limit: 100, lookup_keys: Object.keys(PRICES) }), stripe('GET', 'webhook_endpoints', { limit: 100 })]);
  let meter = (meters.data || []).find(m => m.event_name === METER_EVENT);
  if (!meter) meter = await stripe('POST', 'billing/meters', { display_name: 'Terrace Sun API calls', event_name: METER_EVENT, default_aggregation: { formula: 'sum' }, customer_mapping: { type: 'by_id', event_payload_key: 'stripe_customer_id' }, value_settings: { event_payload_key: 'value' } });
  cfg.meter = meter.id;
  for (const p of found.data || []) cfg.prices[p.lookup_key] = p.id;
  await Promise.all(Object.entries(PRICES).filter(([lk]) => !cfg.prices[lk]).map(async ([lk, def]) => {
    const body = { ...def, currency: 'eur', lookup_key: lk, transfer_lookup_key: 'true', tax_behavior: 'exclusive' };
    if (def.recurring?.usage_type === 'metered') body.recurring = { ...def.recurring, meter: meter.id };
    cfg.prices[lk] = (await stripe('POST', 'prices', body)).id;
  }));
  const portal = {
    business_profile: { headline: 'Terrace Sun: manage your plan, card and invoices', privacy_policy_url: `${PRIMARY}/terms/#privacy`, terms_of_service_url: `${PRIMARY}/terms/` },
    default_return_url: `${base}/account/`,
    features: {
      invoice_history: { enabled: true }, payment_method_update: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ['email', 'address', 'tax_id'] },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      subscription_update: {
        enabled: true, default_allowed_updates: ['price'], proration_behavior: 'create_prorations',
        products: [{ product: 'ts_agent', prices: [cfg.prices.ts_agent_month, cfg.prices.ts_agent_year] }, { product: 'ts_agency', prices: [cfg.prices.ts_agency_month, cfg.prices.ts_agency_year] }]
      }
    }
  };
  const url = `${base}/api/stripe/webhook`;
  const same = (hooks.data || []).filter(h => h.url === url);
  const keep = same.find(h => h.id === cur?.webhook?.id && cur?.webhook?.secret);
  const [portalCfg, webhook] = await Promise.all([
    stripe('POST', cur?.portal_config ? `billing_portal/configurations/${cur.portal_config}` : 'billing_portal/configurations', portal),
    (async () => {
      await Promise.all(same.filter(h => h !== keep).map(h => stripe('DELETE', `webhook_endpoints/${h.id}`)));
      if (keep) { await stripe('POST', `webhook_endpoints/${keep.id}`, { enabled_events: WEBHOOK_EVENTS, disabled: 'false' }); return cur.webhook; }
      const h = await stripe('POST', 'webhook_endpoints', { url, enabled_events: WEBHOOK_EVENTS, description: 'Terrace Sun billing' });
      return { id: h.id, secret: h.secret, url };
    })()
  ]);
  cfg.portal_config = portalCfg.id; cfg.webhook = webhook;
  cfg.ok = true;
  await bstore().setJSON(`cfg/${mode()}`, cfg);
  return cfg;
}

export async function createCheckout(base, q) {
  const cfg = await ensureSetup(base), P = cfg.prices, cut = (v, n = 450) => String(v ?? '').slice(0, n);
  const params = {
    success_url: `${base}/account/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/listings/?checkout=cancelled#pricing`,
    allow_promotion_codes: 'true', billing_address_collection: 'auto', tax_id_collection: { enabled: 'true' },
    custom_text: { submit: { message: `Terms and refunds: ${PRIMARY}/terms/` } }
  };
  if (env('STRIPE_AUTOMATIC_TAX') === '1') params.automatic_tax = { enabled: 'true' };
  if (q.plan === 'single') {
    const lat = Number(q.lat), lon = Number(q.lon);
    if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) throw Object.assign(new Error('Open the report for the address first, then buy it from there.'), { code: 'bad_request' });
    const back = new URL(`${base}/report/`);
    for (const k of ['lat', 'lon', 'floor', 'floors', 'h', 'name', 'agency', 'logo', 'agent']) if (q[k]) back.searchParams.set(k, cut(q[k]));
    Object.assign(params, {
      mode: 'payment', cancel_url: back.href, customer_creation: 'always', invoice_creation: { enabled: 'true' },
      line_items: [{ price: P.ts_single, quantity: 1 }],
      metadata: { plan: 'single', lat: String(lat), lon: String(lon), floor: cut(q.floor || 0, 3), floors: cut(q.floors, 3), h: cut(q.h, 6), name: cut(q.name), agency: cut(q.agency), logo: cut(q.logo, 490), agent: cut(q.agent) }
    });
  } else {
    const interval = q.interval === 'year' ? 'year' : 'month';
    const items = q.plan === 'portal' ? [{ price: P.ts_portal_base, quantity: 1 }, { price: P.ts_portal_metered }]
      : PLANS[q.plan] ? [{ price: P[`ts_${q.plan}_${interval}`], quantity: 1 }] : null;
    if (!items) throw Object.assign(new Error('Unknown plan'), { code: 'bad_request' });
    Object.assign(params, { mode: 'subscription', line_items: items, metadata: { plan: q.plan }, subscription_data: { metadata: { plan: q.plan } } });
  }
  return stripe('POST', 'checkout/sessions', params);
}

export const meterCall = customer => stripe('POST', 'billing/meter_events', { event_name: METER_EVENT, payload: { stripe_customer_id: customer, value: '1' } });

// ---------- mirror site (terrace-sun2): billing lives on the primary site only
export function isPrimary(req, context) {
  if (context?.site?.name) return context.site.name === 'terrace-sun';
  const host = new URL(req.url).hostname;
  return !/\.netlify\.app$/.test(host) || /(^|--)terrace-sun\.netlify\.app$/.test(host);
}
export async function proxyPrimary(req) {
  const u = new URL(req.url), headers = { 'x-ts-proxied': '1' };
  for (const h of ['authorization', 'content-type', 'origin', 'referer']) if (req.headers.get(h)) headers[h] = req.headers.get(h);
  const r = await fetch(PRIMARY + u.pathname + u.search, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text() });
  const out = new Headers();
  for (const h of ['content-type', 'cache-control', 'retry-after', 'access-control-allow-origin', 'access-control-allow-headers', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-terrace-sun']) if (r.headers.get(h)) out.set(h, r.headers.get(h));
  return new Response(await r.text(), { status: r.status, headers: out });
}
export const baseUrl = req => { const u = new URL(req.url); return /^(localhost|127\.0\.0\.1)$/.test(u.hostname) ? u.origin : PRIMARY; };
export const canProxy = (req, context) => !isPrimary(req, context) && !req.headers.get('x-ts-proxied');
export async function after(context, promise) { if (typeof context?.waitUntil === 'function') context.waitUntil(promise); else await promise; }
