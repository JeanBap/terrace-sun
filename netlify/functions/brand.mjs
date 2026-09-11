// GET /api/brand?pk=ts_pk_...  or  ?t=<single report token>&lat=..&lon=..  -> may this report carry the agent's branding?
import { acctForPk, bget, ACTIVE, canProxy, proxyPrimary } from '../../lib/billing.mjs';

const res = b => new Response(JSON.stringify(b), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, max-age=300', 'Access-Control-Allow-Origin': '*' } });

export default async (req, context) => {
  const u = new URL(req.url), pk = u.searchParams.get('pk') || '', t = u.searchParams.get('t') || '';
  const lat = Number(u.searchParams.get('lat')), lon = Number(u.searchParams.get('lon'));
  try {
    if (/^[\w-]{16,64}$/.test(t)) {
      const r = await bget(`single/${t}`);
      if (!r && canProxy(req, context)) return proxyPrimary(req);
      const ok = !!(r && r.paid && Math.abs(r.lat - lat) < 1e-4 && Math.abs(r.lon - lon) < 1e-4);
      return res(ok ? { branded: true, kind: 'single', agency: r.agency, logo: r.logo, agent: r.agent } : { branded: false });
    }
    if (pk === 'demo') return res({ branded: true, sample: true });
    if (/^ts_pk_(test|live)_[\w-]+$/.test(pk)) {
      const a = await acctForPk(pk);
      if (!a && canProxy(req, context)) return proxyPrimary(req);
      return res({ branded: !!(a && ACTIVE.has(a.status)), plan: a?.plan || null, test: a?.mode === 'test' });
    }
    return res({ branded: false });
  } catch (e) {
    console.log('brand check failed', e.message);
    return res({ branded: true, unverified: true }); // never punish a paying agent for a storage hiccup
  }
};

export const config = { path: '/api/brand' };
