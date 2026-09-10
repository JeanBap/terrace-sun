// Shared by the sync API and the background worker.
import E from '../engine.js';
import tzlookup from '../vendor/tz-node.js';
import { store } from './analytics.mjs';

export const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter', 'https://z.overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
export const RADIUS = 250;
const DAY = 864e5;

async function fetchMirror(url, q, ms) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json, */*', 'User-Agent': 'Mozilla/5.0 (compatible; TerraceSun/1.0; +https://terrace-sun.netlify.app/listings/)' }, signal: ac.signal });
    if (!r.ok) throw new Error(url.split('/')[2] + ' HTTP ' + r.status);
    const j = await r.json();
    if (!j.elements) throw new Error(url.split('/')[2] + ' bad reply');
    return j;
  } finally { clearTimeout(t); }
}
export function queries(lat, lon, t = 8) {
  const a = `(around:${RADIUS},${lat.toFixed(6)},${lon.toFixed(6)})`;
  return {
    ways: `[out:json][timeout:${t}];(way["building"]${a};way["building:part"]${a};way["highway"]["name"](around:90,${lat.toFixed(6)},${lon.toFixed(6)}););out geom;`,
    rels: `[out:json][timeout:${t}];relation["building"]${a};out geom;`
  };
}
// Fast path for the ~10 s synchronous limit: race all mirrors; relations are optional.
export async function overpassFast(lat, lon) {
  const q = queries(lat, lon, 7);
  const race = (qq, ms) => Promise.any(MIRRORS.map(u => fetchMirror(u, qq, ms)));
  const [ways, rels] = await Promise.all([
    race(q.ways, 6800).catch(e => { throw new Error('building data unavailable: ' + (e.errors || [e]).map(x => x.message).join('; ')); }),
    race(q.rels, 5500).catch(() => null)
  ]);
  if (rels && rels.elements) ways.elements = ways.elements.concat(rels.elements);
  ways.relations_included = !!rels;
  return ways;
}
// Slow path for the background worker: patient, sequential, complete.
export async function overpassPatient(lat, lon) {
  const q = queries(lat, lon, 50);
  let last = '';
  for (const u of MIRRORS) {
    try {
      const ways = await fetchMirror(u, q.ways, 55000);
      let rels = null;
      for (const u2 of MIRRORS) { try { rels = await fetchMirror(u2, q.rels, 40000); break; } catch (e) { } }
      if (rels && rels.elements) ways.elements = ways.elements.concat(rels.elements);
      ways.relations_included = !!rels;
      return ways;
    } catch (e) { last = e.message; }
  }
  throw new Error('building data unavailable: ' + last);
}

export const osmKey = (lat, lon) => `o/${lat.toFixed(4)}/${lon.toFixed(4)}`;
export const reportKey = p => `r/v1/${p.lat.toFixed(5)}/${p.lon.toFixed(5)}/${p.floor}/${p.floors || '-'}/${p.height || '-'}/${p.year}`;

export async function cacheGet(key, maxAgeDays) {
  try {
    const v = await store('sun-cache').get(key, { type: 'json' });
    if (v && Date.now() - v.ts < maxAgeDays * DAY) return v.data;
  } catch (e) { }
  return null;
}
export async function cacheSet(key, data) { try { await store('sun-cache').setJSON(key, { ts: Date.now(), data }); } catch (e) { console.log('cache write failed', e.message); } }

export function buildReport(json, p, plan) {
  const t0 = Date.now();
  const model = E.parseOSM(json, p.lat, p.lon);
  if (p.height) E.applyHeights(model, p.height, true);
  const tz = tzlookup(p.lat, p.lon);
  const rep = E.propertyReport(model, p.lat, p.lon, tz, { floor: p.floor, floors: p.floors, year: p.year, stepMin: 10 });
  return {
    api: 'terrace-sun/v1', generated_at: new Date().toISOString(), plan,
    input: { lat: p.lat, lon: p.lon, floor: p.floor, floors: p.floors, height: p.height, year: p.year, name: p.name || null, timezone: tz },
    report_url: `https://terrace-sun.netlify.app/report/?lat=${p.lat}&lon=${p.lon}&floor=${p.floor}${p.floors ? '&floors=' + p.floors : ''}${p.name ? '&name=' + encodeURIComponent(p.name) : ''}`,
    sun_score: rep.score, grade: rep.grade, annual_avg_direct_sun_hours: rep.annual_avg_hours,
    building: { floors: rep.floors_in_building, height_m: rep.building_height_m, height_from_osm: rep.building_height_tagged, point_mode: rep.point_mode },
    facades: rep.facades.map((f, i) => Object.assign({ index: i + 1, character: rep.character[i] }, f)),
    seasons: rep.seasons, monthly_best_wall_hours: rep.monthly, floors: rep.floors,
    data: { source: 'OpenStreetMap (ODbL)', buildings_within_m: RADIUS, multipolygon_buildings_included: json.relations_included !== false, buildings_used: rep.buildings_used, share_of_built_area_with_real_height: rep.height_coverage, assumed_height_m: rep.default_height_m },
    method: 'Direct-beam sun, clear sky, flat ground, 2.5D shadow casting from OSM building footprints and heights. No trees, awnings or terrain. Wall samples 1.5 m above the chosen floor, every 10 minutes.',
    compute_ms: Date.now() - t0
  };
}

export function parseParams(sp) {
  const p = Object.fromEntries(sp);
  const lat = parseFloat(p.lat), lon = parseFloat(p.lon);
  return {
    ok: Math.abs(lat) <= 90 && Math.abs(lon) <= 180, lat, lon, name: p.name || '',
    floor: Math.min(60, Math.max(0, parseInt(p.floor || '0', 10) || 0)),
    floors: p.floors ? Math.min(60, Math.max(1, parseInt(p.floors, 10) || 1)) : null,
    height: p.height ? Math.min(200, Math.max(2, parseFloat(p.height))) : null,
    year: p.year ? Math.min(2100, Math.max(1900, parseInt(p.year, 10))) : new Date().getFullYear(),
    key: p.key || ''
  };
}
