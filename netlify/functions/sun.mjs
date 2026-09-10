// Terrace Sun API: GET /api/v1/sun?lat=..&lon=..&floor=2&floors=5&name=..&key=..
// Answers from the report cache, then the building-data cache, then a live fetch; slow fetches are finished by a background worker.
import { record } from '../../lib/analytics.mjs';
import { parseParams, reportKey, osmKey, cacheGet, cacheSet, overpassFast, buildReport } from '../../lib/sunreport.mjs';

const BASE_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'X-Terrace-Sun': 'v1' };
const reply = (code, body, extra) => new Response(JSON.stringify(body), { status: code, headers: Object.assign({}, BASE_HEADERS, extra || {}) });
const CACHED = { 'Cache-Control': 'public, max-age=3600', 'Netlify-CDN-Cache-Control': 'public, max-age=86400, durable' };

export default async (req, context) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: BASE_HEADERS });
  const url = new URL(req.url), p = parseParams(url.searchParams);
  let callerHost = '';
  try { callerHost = new URL(req.headers.get('origin') || req.headers.get('referer') || '').hostname; } catch (e) { }
  const log = (st, plan, src) => record('api', { st, plan, src, h: callerHost, g: context.geo?.country?.code || '' }, 700);
  const keys = (Netlify.env.get('TS_API_KEYS') || '').split(',').map(s => s.trim()).filter(Boolean);
  const key = p.key || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  let plan = key === 'demo' ? 'demo' : 'open';
  if (keys.length && key !== 'demo') {
    if (!key) { await log(401, 'none'); return reply(401, { error: 'missing_key', message: 'Pass ?key=YOUR_KEY or an Authorization: Bearer header. Get a key at https://terrace-sun.netlify.app/listings/' }); }
    if (!keys.includes(key)) { await log(403, 'invalid'); return reply(403, { error: 'invalid_key', message: 'This key is not active.' }); }
    plan = 'paid';
  }
  if (!p.ok) { await log(400, plan); return reply(400, { error: 'bad_coordinates', message: 'lat and lon are required, decimal degrees.' }); }

  const rk = reportKey(p);
  const hit = await cacheGet(rk, 30);
  if (hit) {
    await log(200, plan, 'report-cache');
    const report_url = hit.report_url.replace(/&name=[^&]*/, '') + (p.name ? '&name=' + encodeURIComponent(p.name) : '');
    return reply(200, { ...hit, plan, cache: 'hit', input: { ...hit.input, name: p.name || null }, report_url }, CACHED);
  }

  let json = await cacheGet(osmKey(p.lat, p.lon), 30), src = 'osm-cache';
  if (!json) {
    try { json = await overpassFast(p.lat, p.lon); src = 'live'; await cacheSet(osmKey(p.lat, p.lon), json); }
    catch (e) {
      // hand over to the background worker and ask the caller to retry
      const bg = new URL('/.netlify/functions/sun-background', req.url); bg.search = url.search;
      try { await Promise.race([fetch(bg, { method: 'POST' }), new Promise(r => setTimeout(r, 1500))]); } catch (err) { }
      await log(503, plan, 'queued');
      return reply(503, { error: 'calculating', message: 'Building data for this location is being fetched. Retry in 20 seconds.', retry_after_s: 20, detail: e.message }, { 'Retry-After': '20', 'Cache-Control': 'no-store' });
    }
  }
  const out = buildReport(json, p, plan);
  await cacheSet(rk, out);
  await log(200, plan, src);
  return reply(200, { ...out, cache: src }, CACHED);
};

export const config = { path: '/api/v1/sun' };
