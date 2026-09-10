// Original dataset: sun geometry, unobstructed façade hours by orientation, and street-canyon hours by floor, for 12 cities.
import fs from 'node:fs';
import E from '../engine.js';
import tzlookup from '../vendor/tz-node.js';
const RAD = Math.PI / 180, YEAR = 2026;
const CITIES = [
  ['rome', 'Rome', 'Italy', 41.9028, 12.4964], ['milan', 'Milan', 'Italy', 45.4642, 9.1900], ['florence', 'Florence', 'Italy', 43.7696, 11.2558], ['naples', 'Naples', 'Italy', 40.8518, 14.2681],
  ['madrid', 'Madrid', 'Spain', 40.4168, -3.7038], ['barcelona', 'Barcelona', 'Spain', 41.3874, 2.1686], ['lisbon', 'Lisbon', 'Portugal', 38.7223, -9.1393], ['athens', 'Athens', 'Greece', 37.9838, 23.7275],
  ['paris', 'Paris', 'France', 48.8566, 2.3522], ['london', 'London', 'United Kingdom', 51.5072, -0.1276], ['amsterdam', 'Amsterdam', 'Netherlands', 52.3676, 4.9041], ['berlin', 'Berlin', 'Germany', 52.5200, 13.4050]
];
const DAYS = [['spring', 3, 20, '20 March'], ['summer', 6, 21, '21 June'], ['autumn', 9, 22, '22 September'], ['winter', 12, 21, '21 December']];
const ORIENT = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
const WIDTHS = [8, 12, 20, 30], H = 18, FLOOR_H = 3, SILL = 1.5, STEP = 1; // minutes
// Same thresholds as the Terrace Sun engine: sun centre more than 0.1° above a flat horizon and in front of the wall.
const MIN_ALT = 0.1 * RAD;
const rect = (id, x0, y0, x1, y1, h, lat0, lon0) => ({ type: 'way', id, tags: { building: 'yes', height: String(h) }, geometry: [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => ({ lat: lat0 + y / 110574, lon: lon0 + x / (111320 * Math.cos(lat0 * RAD)) })) });
const out = [];
for (const [slug, name, country, lat, lon] of CITIES) {
  const tz = tzlookup(lat, lon);
  const city = { slug, name, country, lat, lon, tz, days: [] };
  for (const [key, m, d, label] of DAYS) {
    const [t0, t1] = E.dayWindow(YEAR, m, d, tz);
    let rise = null, set = null, noonAlt = -99, noonT = null, riseAz = null, setAz = null;
    const ori = Object.fromEntries(ORIENT.map(([o]) => [o, 0]));
    const canyon = { S: {}, E: {} };
    for (const w of WIDTHS) { canyon.S[w] = Array(6).fill(0); canyon.E[w] = Array(6).fill(0); }
    const noonTest = {};
    for (let t = t0; t < t1; t += STEP * 6e4) {
      const p = E.sunPosition(t, lat, lon);
      if (p.alt <= MIN_ALT) continue;
      if (rise === null) { rise = t; riseAz = p.az; }
      set = t; setAz = p.az;
      if (p.alt > noonAlt) { noonAlt = p.alt; noonT = t; }
      for (const [o, deg] of ORIENT) if (Math.cos(p.az - deg * RAD) > 0.02) ori[o] += STEP / 60;
    }
    // street canyon by ray casting with the product engine: a 2 km row of 18 m buildings across a straight street
    for (const [fk, geo] of [['S', w => ({ own: [-30, 0, 30, 15], opp: [-1000, -w - 15, 1000, -w], n: [0, -1] })], ['E', w => ({ own: [-15, -30, 0, 30], opp: [w, -1000, w + 15, 1000], n: [1, 0] })]]) {
      for (const w of WIDTHS) {
        const g = geo(w), model = E.parseOSM({ elements: [rect(1, ...g.own, H, lat, lon), rect(2, ...g.opp, H, lat, lon)] }, lat, lon);
        const fac = { nx: g.n[0], ny: g.n[1], samples: [{ x: 0, y: 0, nx: g.n[0], ny: g.n[1] }], line: [[0, 0]], faces: fk, length: 1, dist: 0 };
        for (let f = 0; f < 6; f++) {
          const r = E.analyse(model, lat, lon, t0, t1, { stepMin: 5, facades: [fac], wallZ: SILL + f * FLOOR_H, noPave: true });
          canyon[fk][w][f] = r.facades[0].wallSum.hours;
        }
      }
    }
    const minFloorNoon = {};
    for (const w of WIDTHS) { const zmin = H - w * Math.tan(noonAlt); minFloorNoon[w] = zmin <= SILL ? 0 : Math.ceil((zmin - SILL) / FLOOR_H); }
    city.days.push({
      key, label, date: `${YEAR}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      daylight_h: +((set - rise) / 36e5 + STEP / 60).toFixed(2), sunrise: E.hhmm(rise, tz), sunset: E.hhmm(set, tz), solar_noon: E.hhmm(noonT, tz),
      noon_altitude_deg: +(noonAlt / RAD).toFixed(1), sunrise_azimuth_deg: Math.round(riseAz / RAD), sunset_azimuth_deg: Math.round(setAz / RAD),
      orientation_h: Object.fromEntries(Object.entries(ori).map(([k, v]) => [k, +v.toFixed(1)])),
      canyon_h: { S: Object.fromEntries(WIDTHS.map(w => [w, canyon.S[w].map(v => +v.toFixed(1))])), E: Object.fromEntries(WIDTHS.map(w => [w, canyon.E[w].map(v => +v.toFixed(1))])) },
      min_floor_for_noon_sun_S: minFloorNoon
    });
  }
  out.push(city);
}
fs.writeFileSync('data/sun-hours-cities.json', JSON.stringify({ generated: new Date().toISOString().slice(0, 10), year: YEAR, method: 'Solar position (Meeus/SunCalc, apparent altitude incl. refraction) sampled every minute; sun counted when its centre is above a flat horizon. Orientation hours: sun in front of a vertical wall with no obstructions. Canyon hours: ray casting with the Terrace Sun engine against a 2 km continuous row of 18 m buildings across a straight street of the given width; window 1.5 m above each floor, 3 m per floor; sampled every 5 minutes.', street_building_height_m: H, cities: out }, null, 1));
// CSVs
let csv = 'city,country,lat,lon,day,date,daylight_h,sunrise,sunset,solar_noon,noon_altitude_deg,sunrise_azimuth_deg,sunset_azimuth_deg,' + ORIENT.map(o => 'facing_' + o[0] + '_h').join(',') + '\n';
for (const c of out) for (const d of c.days) csv += [c.name, c.country, c.lat, c.lon, d.key, d.date, d.daylight_h, d.sunrise, d.sunset, d.solar_noon, d.noon_altitude_deg, d.sunrise_azimuth_deg, d.sunset_azimuth_deg, ...ORIENT.map(o => d.orientation_h[o[0]])].join(',') + '\n';
fs.writeFileSync('data/sun-hours-by-orientation.csv', csv);
let csv2 = 'city,day,facade,street_width_m,opposite_height_m,floor,direct_sun_h\n';
for (const c of out) for (const d of c.days) for (const fk of ['S', 'E']) for (const w of WIDTHS) d.canyon_h[fk][w].forEach((v, f) => { csv2 += [c.name, d.key, fk === 'S' ? 'south' : 'east_or_west', w, H, f, v].join(',') + '\n'; });
fs.writeFileSync('data/sun-hours-by-floor-and-street.csv', csv2);
const r = out[0];
console.log(r.name, JSON.stringify(r.days.map(d => [d.key, d.daylight_h, d.sunrise, d.sunset, d.noon_altitude_deg, d.sunrise_azimuth_deg, d.sunset_azimuth_deg, d.orientation_h, d.canyon_h.S[12], d.canyon_h.E[12], d.min_floor_for_noon_sun_S])));
console.log('London winter', JSON.stringify(out[9].days[3]));
