// Terrace Sun API: GET /api/v1/sun?lat=..&lon=..&floor=2&floors=5&name=..&key=..
// Returns a structured sun-exposure report for a property, computed from OpenStreetMap buildings.
const E = require('../../engine.js');
const tzlookup = require('../../vendor/tz-node.js');

const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const RADIUS = 250;
const H = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'X-Terrace-Sun': 'v1' };
const reply = (code, body, extra) => ({ statusCode: code, headers: Object.assign({}, H, extra || {}), body: JSON.stringify(body) });

async function fetchMirror(url, q, ms) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'TerraceSun/1.0 (+https://terrace-sun.netlify.app)' }, signal: ac.signal });
    if (!r.ok) throw new Error(url.split('/')[2] + ' HTTP ' + r.status);
    const j = await r.json();
    if (!j.elements) throw new Error(url.split('/')[2] + ' bad reply');
    return j;
  } finally { clearTimeout(t); }
}
// Synchronous functions get ~10 s. Ways (fast) are required; multipolygon relations (slow to assemble)
// are fetched in parallel with a shorter budget and merged in when they arrive in time.
async function overpass(lat, lon) {
  const a = `(around:${RADIUS},${lat.toFixed(6)},${lon.toFixed(6)})`;
  const qWays = `[out:json][timeout:8];(way["building"]${a};way["building:part"]${a};way["highway"]["name"](around:90,${lat.toFixed(6)},${lon.toFixed(6)}););out geom;`;
  const qRels = `[out:json][timeout:6];relation["building"]${a};out geom;`;
  const race = (q, ms) => Promise.any(MIRRORS.map(u => fetchMirror(u, q, ms)));
  const [ways, rels] = await Promise.all([
    race(qWays, 8000).catch(e => { throw new Error('building data unavailable: ' + (e.errors || [e]).map(x => x.message).join('; ')); }),
    race(qRels, 6500).catch(() => null)
  ]);
  if (rels && rels.elements) ways.elements = ways.elements.concat(rels.elements);
  ways.relations_included = !!rels;
  return ways;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };
  const p = event.queryStringParameters || {};
  const keys = (process.env.TS_API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
  const auth = (event.headers && (event.headers.authorization || event.headers.Authorization) || '').replace(/^Bearer\s+/i, '');
  const key = p.key || auth;
  let plan = 'open';
  if (keys.length) {
    if (!key) return reply(401, { error: 'missing_key', message: 'Pass ?key=YOUR_KEY or an Authorization: Bearer header. Get a key at https://terrace-sun.netlify.app/listings/' });
    if (key === 'demo') plan = 'demo';
    else if (!keys.includes(key)) return reply(403, { error: 'invalid_key', message: 'This key is not active.' });
    else plan = 'paid';
  }
  const lat = parseFloat(p.lat), lon = parseFloat(p.lon);
  if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) return reply(400, { error: 'bad_coordinates', message: 'lat and lon are required, decimal degrees.' });
  const floor = Math.min(60, Math.max(0, parseInt(p.floor || '0', 10) || 0));
  const floors = p.floors ? Math.min(60, Math.max(1, parseInt(p.floors, 10) || 1)) : null;
  const height = p.height ? Math.min(200, Math.max(2, parseFloat(p.height))) : null;
  const year = p.year ? Math.min(2100, Math.max(1900, parseInt(p.year, 10))) : new Date().getFullYear();
  const t0 = Date.now();
  try {
    const json = await overpass(lat, lon);
    const model = E.parseOSM(json, lat, lon);
    if (height) E.applyHeights(model, height, true);
    const tz = tzlookup(lat, lon);
    const rep = E.propertyReport(model, lat, lon, tz, { floor, floors, year, stepMin: plan === 'demo' ? 15 : 10 });
    const out = {
      api: 'terrace-sun/v1', generated_at: new Date().toISOString(), plan,
      input: { lat, lon, floor, floors, height, year, name: p.name || null, timezone: tz },
      report_url: `https://terrace-sun.netlify.app/report/?lat=${lat}&lon=${lon}&floor=${floor}${floors ? '&floors=' + floors : ''}${p.name ? '&name=' + encodeURIComponent(p.name) : ''}`,
      sun_score: rep.score, grade: rep.grade, annual_avg_direct_sun_hours: rep.annual_avg_hours,
      building: { floors: rep.floors_in_building, height_m: rep.building_height_m, height_from_osm: rep.building_height_tagged, point_mode: rep.point_mode },
      facades: rep.facades.map((f, i) => Object.assign({ index: i + 1, character: rep.character[i] }, f)),
      seasons: rep.seasons, monthly_best_wall_hours: rep.monthly, floors: rep.floors,
      data: { source: 'OpenStreetMap (ODbL)', buildings_within_m: RADIUS, multipolygon_buildings_included: json.relations_included, buildings_used: rep.buildings_used, share_of_built_area_with_real_height: rep.height_coverage, assumed_height_m: rep.default_height_m },
      method: 'Direct-beam sun, clear sky, flat ground, 2.5D shadow casting from OSM building footprints and heights. No trees, awnings or terrain. Wall samples 1.5 m above the chosen floor.',
      compute_ms: Date.now() - t0
    };
    return reply(200, out, { 'Cache-Control': 'public, max-age=3600', 'Netlify-CDN-Cache-Control': 'public, max-age=86400, durable' });
  } catch (e) {
    return reply(503, { error: 'upstream', message: e.message, retry_after_s: 30 }, { 'Retry-After': '30' });
  }
};
