// Terrace Sun API: GET /api/v1/sun?lat=..&lon=..&floor=2&floors=5&name=..
// Keys: secret (Authorization: Bearer ts_sk_...) for servers, publishable (?pk=ts_pk_...) for badges, none = free allowance.
// Answers from the report cache, then the building-data cache, then a live fetch; slow fetches are finished by a background worker.
import { record } from '../../lib/analytics.mjs';
import { parseParams, reportKey, osmKey, cacheGet, cacheSet, overpassFast, buildReport } from '../../lib/sunreport.mjs';
import { env, acctForSecret, acctForPk, PLANS, FREE_MONTHLY, PK_DAILY, ACTIVE, count, bump, month, today, hash, meterCall, syncAcct, canProxy, proxyPrimary, after, DAY, PRIMARY } from '../../lib/billing.mjs';

const BASE_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Expose-Headers': 'X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After', 'X-Terrace-Sun': 'v1' };
const reply = (code, body, extra) => new Response(JSON.stringify(body), { status: code, headers: Object.assign({}, BASE_HEADERS, extra || {}) });
// Never cache at the CDN: every call must pass the key check and be counted.
const PRIVATE = { 'Cache-Control': 'private, max-age=300', 'Netlify-CDN-Cache-Control': 'no-store' };
const NOSTORE = { 'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store' };
const nextMonth = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString(); };

export default async (req, context) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: BASE_HEADERS });
  const url = new URL(req.url), p = parseParams(url.searchParams);
  let callerHost = '';
  try { callerHost = new URL(req.headers.get('origin') || req.headers.get('referer') || '').hostname; } catch (e) { }
  let plan = 'free', counter = null, limit = 0, shown = 0, used = 0, acct = null, metered = false;
  const log = (st, src) => record('api', { st, plan, src, h: callerHost, g: context.geo?.country?.code || '' }, 700);
  const deny = async (code, body) => { await log(code); return reply(code, body, NOSTORE); };
  const key = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim() || p.key || '';
  const pk = url.searchParams.get('pk') || (key.startsWith('ts_pk_') ? key : '');
  const manual = env('TS_API_KEYS').split(',').map(s => s.trim()).filter(Boolean);

  try {
    if (key && manual.includes(key)) plan = 'manual';
    else if (key.startsWith('ts_sk_')) {
      acct = await acctForSecret(key);
      if (!acct) {
        if (canProxy(req, context)) return proxyPrimary(req);
        plan = 'invalid';
        return deny(403, { error: 'invalid_key', message: `This key is not active. See your keys at ${PRIMARY}/account/` });
      }
      plan = acct.plan || 'agent';
      if (!ACTIVE.has(acct.status)) return deny(402, { error: 'payment_required', status: acct.status, message: `Subscription status is "${acct.status}". Update billing at ${PRIMARY}/account/` });
      const P = PLANS[plan] || PLANS.agent;
      counter = `use/${acct.customer}/${month()}`; limit = P.cap; shown = P.included; metered = !!P.metered;
      used = await count(counter);
      if (used >= limit) return deny(429, { error: 'quota_exceeded', used, limit, resets_at: nextMonth(), message: P.metered ? `Safety cap of ${limit} calls this month reached. Ask us for volume pricing: ${PRIMARY}/listings/#signup` : `Monthly limit of ${limit} calls reached on the ${P.name} plan. Upgrade at ${PRIMARY}/account/` });
    } else if (pk && pk !== 'demo') {
      acct = /^ts_pk_(test|live)_[\w-]+$/.test(pk) ? await acctForPk(pk) : null;
      if (!acct) {
        if (canProxy(req, context)) return proxyPrimary(req);
        plan = 'invalid';
        return deny(403, { error: 'invalid_key', message: 'Unknown publishable key.' });
      }
      if (ACTIVE.has(acct.status)) {
        plan = (acct.plan || 'agent') + '-badge';
        counter = `pkday/${acct.customer}/${today()}`; limit = shown = PK_DAILY;
        used = await count(counter);
        if (used >= limit) return deny(429, { error: 'badge_daily_limit', used, limit, message: 'Daily badge allowance reached; badges fall back to computing in the browser.' });
      } else acct = null; // lapsed plan: the badge keeps working on the free allowance
    } else if (key && key !== 'demo') {
      if (canProxy(req, context)) return proxyPrimary(req);
      plan = 'invalid';
      return deny(403, { error: 'invalid_key', message: `Unknown key. Secret keys start with ts_sk_. Plans: ${PRIMARY}/listings/#pricing` });
    }
    if (plan === 'free') {
      counter = `ip/${month()}/${hash('ip:' + (context.ip || '')).slice(0, 24)}`; limit = shown = FREE_MONTHLY;
      used = await count(counter);
      if (used >= limit) return deny(429, { error: 'free_limit', used, limit, resets_at: nextMonth(), message: `The free allowance is ${FREE_MONTHLY} calls a month per caller. Plans with keys: ${PRIMARY}/listings/#pricing` });
    }
  } catch (e) {
    console.log('billing check failed, serving without counting', e.message);
    counter = null; metered = false;
  }
  if (!p.ok) return deny(400, { error: 'bad_coordinates', message: 'lat and lon are required, decimal degrees.' });

  const rl = counter ? { 'X-RateLimit-Limit': String(shown), 'X-RateLimit-Remaining': String(Math.max(0, shown - used - 1)) } : {};
  const counted = () => {
    const jobs = [];
    if (counter) jobs.push(bump(counter));
    if (metered && acct) jobs.push(meterCall(acct.customer).catch(e => console.log('meter event failed', acct.customer, e.message)));
    if (acct && Date.now() - (acct.synced || 0) > DAY) jobs.push(syncAcct(acct).catch(() => { }));
    return after(context, Promise.allSettled(jobs));
  };

  const brandUrl = u => acct?.pk ? u + '&pk=' + acct.pk : u; // paid callers get report links with their branding
  const rk = reportKey(p);
  const hit = await cacheGet(rk, 30);
  if (hit) {
    await counted(); await log(200, 'report-cache');
    const report_url = hit.report_url.replace(/&name=[^&]*/, '') + (p.name ? '&name=' + encodeURIComponent(p.name) : '');
    return reply(200, { ...hit, plan, cache: 'hit', input: { ...hit.input, name: p.name || null }, report_url: brandUrl(report_url) }, { ...PRIVATE, ...rl });
  }

  let json = await cacheGet(osmKey(p.lat, p.lon), 30), src = 'osm-cache';
  if (!json) {
    try { json = await overpassFast(p.lat, p.lon); src = 'live'; await cacheSet(osmKey(p.lat, p.lon), json); }
    catch (e) {
      // hand over to the background worker and ask the caller to retry (not counted)
      const bg = new URL('/.netlify/functions/sun-background', req.url); bg.search = url.search;
      try { await Promise.race([fetch(bg, { method: 'POST' }), new Promise(r => setTimeout(r, 1500))]); } catch (err) { }
      await log(503, 'queued');
      return reply(503, { error: 'calculating', message: 'Building data for this location is being fetched. Retry in 20 seconds; retries are not counted.', retry_after_s: 20, detail: e.message }, { 'Retry-After': '20', ...NOSTORE });
    }
  }
  const out = buildReport(json, p, plan);
  await cacheSet(rk, out);
  await counted(); await log(200, src);
  return reply(200, { ...out, cache: src, report_url: brandUrl(out.report_url) }, { ...PRIVATE, ...rl });
};

export const config = { path: '/api/v1/sun' };
