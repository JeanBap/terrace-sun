// Background worker (15 min limit): fetch building data patiently, cache it, and cache the requested report.
import { parseParams, reportKey, osmKey, cacheGet, cacheSet, overpassPatient, buildReport } from '../../lib/sunreport.mjs';

export default async (req) => {
  const p = parseParams(new URL(req.url).searchParams);
  if (!p.ok) return;
  let json = await cacheGet(osmKey(p.lat, p.lon), 30);
  if (!json) { json = await overpassPatient(p.lat, p.lon); await cacheSet(osmKey(p.lat, p.lon), json); }
  const out = buildReport(json, p, 'queued');
  await cacheSet(reportKey(p), out);
  console.log('cached report', reportKey(p), out.sun_score, out.grade);
};
