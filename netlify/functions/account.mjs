// POST /api/account  {session_id?, action?: portal|rotate}  or Authorization: Bearer ts_sk_...
import { acctForSecret, bget, provisionSession, stripe, stripeKey, getAcct, issueKeys, syncAcct, count, month, PLANS, ACTIVE, getCfg, PRIMARY, DAY, baseUrl } from '../../lib/billing.mjs';

const out = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export default async req => {
  if (req.method !== 'POST') return out(405, { error: 'method_not_allowed' });
  if (!stripeKey()) return out(503, { error: 'billing_not_configured', message: 'Online payments are being switched on. Please check back soon.' });
  const body = await req.json().catch(() => ({})), base = baseUrl(req);
  const auth = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  try {
    let a = null, link = null;
    if (auth) {
      a = await acctForSecret(auth);
      if (!a) return out(401, { error: 'invalid_key', message: 'Key not recognised. If you rotated it, use the newest key.' });
    } else if (/^cs_(test|live)_\w+$/.test(body.session_id || '')) {
      let rec = await bget(`sess/${body.session_id}`);
      if (!rec) {
        const s = await stripe('GET', `checkout/sessions/${body.session_id}`).catch(e => { if (e.status === 404) return null; throw e; });
        if (!s) return out(404, { error: 'unknown_purchase', message: 'This purchase link is not valid.' });
        if (s.status !== 'complete') return out(409, { error: 'not_complete', message: 'Payment is not complete yet.' });
        rec = await provisionSession(s);
      }
      if (Date.now() - rec.created > 30 * DAY) return out(401, { error: 'link_expired', message: 'This purchase link has expired. Sign in with your secret key.' });
      if (rec.kind === 'single') {
        const t = await bget(`single/${rec.token}`);
        if (!t?.paid) return out(200, { kind: 'single', paid: false });
        const r = new URL(`${PRIMARY}/report/`);
        for (const k of ['lat', 'lon', 'floor', 'floors', 'name', 'agency', 'logo', 'agent']) if (t[k] !== null && t[k] !== '' && t[k] !== undefined) r.searchParams.set(k, t[k]);
        r.searchParams.set('t', t.token);
        return out(200, { kind: 'single', paid: true, name: t.name, report_url: r.href });
      }
      a = await getAcct(rec.customer); link = body.session_id;
    } else return out(401, { error: 'sign_in', message: 'Open the link from your purchase, or paste your secret key.' });
    if (!a) return out(404, { error: 'no_account', message: 'Account not found yet. Try again in a minute.' });

    if (body.action === 'portal') {
      const cfg = await getCfg();
      const ps = await stripe('POST', 'billing_portal/sessions', { customer: a.customer, configuration: cfg?.portal_config, return_url: `${base}/account/${link ? '?session_id=' + link : ''}` });
      return out(200, { url: ps.url });
    }
    if (Date.now() - (a.synced || 0) > 10 * 60e3) await syncAcct(a).catch(e => console.log('sync failed', e.message));
    let secret_key = null;
    if (body.action === 'rotate') secret_key = await issueKeys(a.customer, { rotate: true });
    else if (!a.sk_hash && link) secret_key = await issueKeys(a.customer);
    a = await getAcct(a.customer);
    const plan = PLANS[a.plan] || null, calls = await count(`use/${a.customer}/${month()}`);
    return out(200, {
      kind: 'plan', plan: a.plan, plan_name: plan?.name || a.plan, interval: a.interval, status: a.status, active: ACTIVE.has(a.status),
      email: a.email, mode: a.mode, pk: a.pk, sk_last4: a.sk_last4, secret_key, period_end: a.period_end, cancel_at_period_end: !!a.cancel_at_period_end,
      usage: { month: month(), calls, included: plan?.included || 0, cap: plan?.cap || 0, metered: !!plan?.metered }
    });
  } catch (e) {
    console.log('account error', e.message);
    return out(500, { error: 'server_error', message: 'Something went wrong. Try again in a minute.' });
  }
};

export const config = { path: '/api/account' };
