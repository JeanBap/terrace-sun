// GET /api/v1/osm?lat=..&lon=..  Building footprints around a point, cached 30 days.
// The site's own pages call this first: one cached answer beats four busy Overpass mirrors in the browser.
import { record } from '../../lib/analytics.mjs';
import { osmKey, cacheGet, cacheSet, overpassFast, RADIUS } from '../../lib/sunreport.mjs';
import { count, bump, month, hash, after } from '../../lib/billing.mjs';

const HEAD = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'X-Terrace-Sun': 'v1' };
const CACHED = { 'Cache-Control': 'public, max-age=3600', 'Netlify-CDN-Cache-Control': 'public, max-age=604800, durable' };
const reply = (code, body, extra) => new Response(JSON.stringify(body), { status: code, headers: { ...HEAD, ...(extra || {}) } });
const MONTHLY_PER_CALLER = 3000;

export default async (req, context) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEAD });
  const url = new URL(req.url), lat = Number(url.searchParams.get('lat')), lon = Number(url.searchParams.get('lon'));
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return reply(400, { error: 'bad_coordinates', message: 'lat and lon are required, decimal degrees.' }, { 'Cache-Control': 'no-store' });

  const key = osmKey(lat, lon);
  const hit = await cacheGet(key, 30);
  if (hit) { await record('osm', { st: 200, src: 'cache' }, 500); return reply(200, { ...hit, radius_m: RADIUS, cache: 'hit' }, CACHED); }

  const counter = `osmip/${month()}/${hash('ip:' + (context.ip || '')).slice(0, 24)}`;
  try {
    if (await count(counter) >= MONTHLY_PER_CALLER) return reply(429, { error: 'too_many_requests', message: 'Too many new locations from this caller this month.' }, { 'Cache-Control': 'no-store' });
  } catch (e) { }

  try {
    const json = await overpassFast(lat, lon);
    await cacheSet(key, json);
    await after(context, bump(counter));
    await record('osm', { st: 200, src: json.source || 'live' }, 500);
    return reply(200, { ...json, radius_m: RADIUS, cache: 'miss' }, CACHED);
  } catch (e) {
    const bg = new URL('/.netlify/functions/sun-background', req.url); bg.search = url.search;
    try { await Promise.race([fetch(bg, { method: 'POST' }), new Promise(r => setTimeout(r, 1200))]); } catch (err) { }
    await record('osm', { st: 503 }, 500);
    return reply(503, { error: 'busy', message: 'Map servers are busy. Retry in 15 seconds.', retry_after_s: 15, detail: e.message }, { 'Retry-After': '15', 'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store' });
  }
};

export const config = { path: '/api/v1/osm' };
