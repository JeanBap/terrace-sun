// Private stats: GET /api/stats?days=30 with header x-stats-key (or ?key=).
import { readDay } from '../../lib/analytics.mjs';

const top = (m, n = 20) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
const inc = (m, k, by = 1) => { if (k) m.set(k, (m.get(k) || 0) + by); };

export default async (req) => {
  const url = new URL(req.url);
  const key = req.headers.get('x-stats-key') || url.searchParams.get('key') || '';
  const want = Netlify.env.get('STATS_KEY');
  if (!want || key !== want) return Response.json({ error: 'unauthorised' }, { status: 401 });
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '30', 10) || 30));
  const list = [];
  for (let i = days - 1; i >= 0; i--) list.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
  const perDay = await Promise.all(list.map(d => readDay(d).then(ev => [d, ev]).catch(() => [d, []])));
  const series = [], pages = new Map(), pageUv = new Map(), refs = new Map(), ai = new Map(), search = new Map(), utm = new Map(), countries = new Map(), devices = new Map(),
    events = new Map(), bots = new Map(), botPaths = new Map(), disco = new Map(), api = new Map(), apiHosts = new Map(), badges = new Map();
  let tot = { pv: 0, uv: 0, bot: 0, disco: 0, api: 0, badge: 0, ev: 0, ai: 0, search: 0 };
  for (const [d, evs] of perDay) {
    const row = { d, pv: 0, uv: 0, bot: 0, disco: 0, api: 0, badge: 0, ev: 0, ai: 0, search: 0 }, uv = new Set(), puv = new Map();
    for (const e of evs) {
      if (e.kind === 'pv') {
        row.pv++; if (e.v) uv.add(e.v); inc(pages, e.p);
        if (e.v) { const s = puv.get(e.p) || new Set(); s.add(e.v); puv.set(e.p, s); }
        inc(refs, e.r); inc(countries, e.g); inc(devices, { m: 'Mobile', t: 'Tablet', d: 'Desktop' }[e.d]);
        if (e.ai) { row.ai++; inc(ai, e.ai); }
        if (e.se) { row.search++; inc(search, e.se); }
        if (e.s || e.m || e.c) inc(utm, [e.s, e.m, e.c].filter(Boolean).join(' / '));
      } else if (e.kind === 'bot') { row.bot++; inc(bots, e.b); inc(botPaths, `${e.b} → ${e.p}`); }
      else if (e.kind === 'disco') { row.disco++; inc(disco, `${e.b} → ${e.p}`); if (e.b !== 'Browser') inc(bots, e.b); }
      else if (e.kind === 'api') { row.api++; inc(api, `${e.plan || 'open'} · ${e.st}`); inc(apiHosts, e.h || '(direct)'); }
      else if (e.kind === 'badge') { row.badge++; inc(badges, e.h); }
      else if (e.kind === 'ev') { row.ev++; inc(events, e.x ? `${e.n} · ${e.x}` : e.n); }
    }
    row.uv = uv.size;
    for (const [p, s] of puv) inc(pageUv, p, s.size);
    for (const k of Object.keys(tot)) tot[k] += row[k];
    series.push(row);
  }
  return Response.json({
    generated_at: new Date().toISOString(), days, totals: tot, series,
    pages: top(pages, 25).map(([p, n]) => [p, n, pageUv.get(p) || 0]), referrers: top(refs), ai_referrals: top(ai), search_engines: top(search), utm: top(utm),
    countries: top(countries), devices: top(devices), events: top(events, 30), crawlers: top(bots, 30), crawler_pages: top(botPaths, 30), discovery_fetches: top(disco, 30),
    api_calls: top(api), api_callers: top(apiHosts), badges: top(badges)
  }, { headers: { 'Cache-Control': 'no-store' } });
};

export const config = { path: '/api/stats' };
