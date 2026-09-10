/* Sun engine: solar position (SunCalc/Meeus) + 2.5D ray casting against OSM building prisms.
   Direct beam only. Flat ground. Buildings from OpenStreetMap. MIT licence. */
(function (root) {
  'use strict';
  const RAD = Math.PI / 180, DAY = 864e5, J1970 = 2440588, J2000 = 2451545, OBL = RAD * 23.4397;
  const M_PER_LEVEL = 3.04, FALLBACK_H = 12;

  function refraction(h) { if (h < 0) h = 0; return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179)); }

  // altitude (apparent, rad) and azimuth (rad, clockwise from north)
  function sunPosition(ms, lat, lon) {
    const d = ms / DAY - 0.5 + J1970 - J2000;
    const M = RAD * (357.5291 + 0.98560028 * d);
    const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const L = M + C + RAD * 102.9372 + Math.PI;
    const dec = Math.asin(Math.sin(L) * Math.sin(OBL));
    const ra = Math.atan2(Math.sin(L) * Math.cos(OBL), Math.cos(L));
    const H = RAD * (280.16 + 360.9856235 * d) + RAD * lon - ra;
    const phi = RAD * lat;
    const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
    let az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) + Math.PI;
    az = (az + 2 * Math.PI) % (2 * Math.PI);
    return { alt: alt + refraction(alt), az };
  }

  function parseNum(v) { if (v == null) return NaN; const m = String(v).replace(',', '.').match(/\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : NaN; }
  function tagHeight(t) {
    let h = parseNum(t.height);
    if (!isNaN(h) && /ft|'/.test(String(t.height))) h *= 0.3048;
    if (isNaN(h)) { const l = parseNum(t['building:levels']); if (!isNaN(l)) h = l * M_PER_LEVEL + (parseNum(t['roof:levels']) * 1.5 || 0); }
    return h;
  }

  function projector(lat0, lon0) {
    const kx = 111320 * Math.cos(lat0 * RAD), ky = 110574;
    return {
      toXY: (lat, lon) => [(lon - lon0) * kx, (lat - lat0) * ky],
      toLL: (x, y) => [lat0 + y / ky, lon0 + x / kx]
    };
  }

  // Parse Overpass "out geom" JSON into prisms in local metres
  function parseOSM(json, lat0, lon0) {
    const P = projector(lat0, lon0), buildings = [], streets = [];
    const ringsOf = el => {
      if (el.type === 'way' && el.geometry) return [el.geometry.map(g => P.toXY(g.lat, g.lon))];
      if (el.type === 'relation' && el.members) return el.members.filter(m => m.type === 'way' && m.geometry && (m.role === 'outer' || m.role === 'inner' || m.role === ''))
        .map(m => { const r = m.geometry.map(g => P.toXY(g.lat, g.lon)); r.inner = m.role === 'inner'; return r; });
      return [];
    };
    for (const el of json.elements || []) {
      const t = el.tags || {};
      if (t.highway && t.name && el.geometry) { streets.push({ name: t.name, pts: el.geometry.map(g => P.toXY(g.lat, g.lon)) }); continue; }
      const isPart = !!t['building:part'] && !t.building;
      if (!t.building && !isPart) continue;
      if (['roof', 'carport', 'no', 'construction', 'ruins', 'collapsed', 'demolished', 'proposed'].includes(t.building)) continue;
      const rings = ringsOf(el).filter(r => r.length >= 3);
      if (!rings.length) continue;
      let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
      const edges = [], inner = [];
      for (const r of rings) for (let i = 0; i < r.length - 1; i++) {
        const a = r[i], b = r[i + 1];
        if (a[0] === b[0] && a[1] === b[1]) continue;
        edges.push(a[0], a[1], b[0], b[1]); inner.push(r.inner ? 1 : 0);
        minx = Math.min(minx, a[0], b[0]); maxx = Math.max(maxx, a[0], b[0]); miny = Math.min(miny, a[1], b[1]); maxy = Math.max(maxy, a[1], b[1]);
      }
      let area = 0; for (const r of rings) for (let i = 0; i < r.length - 1; i++) area += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
      const h = tagHeight(t);
      buildings.push({ id: el.type + '/' + el.id, tags: t, isPart, rings, edges: new Float64Array(edges), inner, bbox: [minx, miny, maxx, maxy], area: Math.abs(area / 2), tagH: h, h, tagged: !isNaN(h) });
    }
    const LOW = ['garage', 'garages', 'shed', 'kiosk', 'hut', 'toilets', 'service', 'storage_tank', 'greenhouse', 'market', 'industrial', 'warehouse', 'storage', 'retail', 'hangar', 'barn', 'farm_auxiliary', 'container', 'cabin', 'shelter', 'transformer_tower'];
    // auto default: area-weighted median of tagged, non low-rise buildings nearby
    const known = buildings.filter(b => b.tagged && !b.isPart && !LOW.includes(b.tags.building) && b.area >= 100).sort((a, b) => a.h - b.h);
    let autoH = 15;
    if (known.length >= 3) { const tot = known.reduce((s, b) => s + b.area, 0); let acc = 0; for (const b of known) { acc += b.area; if (acc >= tot / 2) { autoH = b.h; break; } } }
    let builtTagged = 0, builtAll = 0;
    for (const b of buildings) {
      b.low = LOW.includes(b.tags.building);
      if (!b.isPart) { builtAll += b.area; if (b.tagged) builtTagged += b.area; }
    }
    const model = { buildings, streets, proj: P, heightCoverage: builtAll ? builtTagged / builtAll : 0, autoHeight: Math.round(autoH * 10) / 10, taggedSamples: known.length };
    applyHeights(model, model.autoHeight);
    return model;
  }

  function applyHeights(model, def) {
    model.defaultHeight = def;
    for (const b of model.buildings) {
      let h = b.tagged ? b.tagH : (b.low ? 4 : ['house', 'detached', 'bungalow', 'semidetached_house'].includes(b.tags.building) ? 7 : def);
      b.h = Math.min(Math.max(h, 2), 830);
    }
    return model;
  }

  function inside(b, x, y) {
    if (x < b.bbox[0] || x > b.bbox[2] || y < b.bbox[1] || y > b.bbox[3]) return false;
    const e = b.edges; let c = false;
    for (let i = 0; i < e.length; i += 4) {
      const x1 = e[i], y1 = e[i + 1], x2 = e[i + 2], y2 = e[i + 3];
      if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) c = !c;
    }
    return c;
  }
  function segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - x1) * dx + (py - y1) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    const qx = x1 + t * dx, qy = y1 + t * dy; return [Math.hypot(px - qx, py - qy), t];
  }

  // Is point (x,y,z) shadowed for sun direction (dx,dy) with tan(altitude)?
  function blocked(bs, x, y, z, dx, dy, tanA, maxH) {
    const maxS = (maxH - z) / tanA;
    if (maxS <= 0) return false;
    const idx = dx !== 0 ? 1 / dx : 1e12, idy = dy !== 0 ? 1 / dy : 1e12;
    for (let k = 0; k < bs.length; k++) {
      const b = bs[k];
      if (b.h <= z) continue;
      const lim = Math.min(maxS, (b.h - z) / tanA);
      // slab test against bbox
      let t1 = (b.bbox[0] - x) * idx, t2 = (b.bbox[2] - x) * idx;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      t1 = (b.bbox[1] - y) * idy; t2 = (b.bbox[3] - y) * idy;
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmax < 0 || tmin > tmax || tmin > lim) continue;
      const e = b.edges;
      for (let i = 0; i < e.length; i += 4) {
        const ex = e[i + 2] - e[i], ey = e[i + 3] - e[i + 1];
        const den = dx * ey - dy * ex;
        if (den === 0) continue;
        const wx = e[i] - x, wy = e[i + 1] - y;
        const s = (wx * ey - wy * ex) / den;       // distance along ray
        if (s <= 1e-6 || s >= lim) continue;
        const u = (wx * dy - wy * dx) / den;       // position along edge
        if (u < 0 || u > 1) continue;
        return true;
      }
    }
    return false;
  }

  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const COMPASS_LONG = { N: 'north', S: 'south', E: 'east', W: 'west' };
  function compass(deg) { return COMPASS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]; }

  // Find the cafe's building and the street-facing wall sections near the point
  function findFacades(model, opts = {}) {
    const R = opts.range || 20, bs = model.buildings;
    const mains = bs.filter(b => !b.isPart);
    let target = null, best = 1e9;
    for (const b of mains) if (inside(b, 0, 0) && b.area < best) { best = b.area; target = b; }
    let pointInside = !!target;
    if (!target) {
      for (const b of mains) {
        if (Math.max(b.bbox[0], -b.bbox[2], b.bbox[1], -b.bbox[3]) > 60) continue;
        const e = b.edges;
        for (let i = 0; i < e.length; i += 4) { const [d] = segDist(0, 0, e[i], e[i + 1], e[i + 2], e[i + 3]); if (d < best) { best = d; target = b; } }
      }
      if (best > 30) target = null;
    }
    if (!target) return { target: null, facades: [], pointInside: false };
    const others = bs.filter(b => b !== target && !(b.isPart && inside(target, (b.bbox[0] + b.bbox[2]) / 2, (b.bbox[1] + b.bbox[3]) / 2)));
    const builtAt = (x, y) => others.some(b => inside(b, x, y));
    // samples every ~1.5 m along exposed edges, with outward normals
    const samples = [];
    const e = target.edges;
    let dmin = 1e9;
    for (let i = 0; i < e.length; i += 4) dmin = Math.min(dmin, segDist(0, 0, e[i], e[i + 1], e[i + 2], e[i + 3])[0]);
    const keepDist = Math.max(R, dmin + 8);
    for (let i = 0, ei = 0; i < e.length; i += 4, ei++) {
      const x1 = e[i], y1 = e[i + 1], x2 = e[i + 2], y2 = e[i + 3], len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 1.2 || target.inner[ei]) continue;
      let nx = (y2 - y1) / len, ny = -(x2 - x1) / len;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      if (inside(target, mx + nx * 0.3, my + ny * 0.3)) { nx = -nx; ny = -ny; }
      const n = Math.max(1, Math.round(len / 1.5));
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n, px = x1 + t * (x2 - x1), py = y1 + t * (y2 - y1);
        if (Math.hypot(px, py) > keepDist) continue;
        if (builtAt(px + nx * 0.6, py + ny * 0.6)) continue; // party wall
        samples.push({ x: px, y: py, nx, ny, edge: ei, t });
      }
    }
    // group consecutive samples on edges with similar orientation
    samples.sort((a, b) => a.edge - b.edge || a.t - b.t);
    const groups = [];
    for (const s of samples) {
      const g = groups[groups.length - 1];
      const last = g && g.s[g.s.length - 1];
      if (g && (s.edge === last.edge || s.edge === last.edge + 1) && (s.nx * g.nx + s.ny * g.ny) > Math.cos(25 * RAD) && Math.hypot(s.x - last.x, s.y - last.y) < 4) {
        g.s.push(s);
      } else groups.push({ s: [s], nx: s.nx, ny: s.ny });
    }
    // merge wrap-around group (last edge -> first edge)
    if (groups.length > 1) {
      const a = groups[0], z = groups[groups.length - 1], zs = z.s[z.s.length - 1], as = a.s[0];
      if ((a.nx * z.nx + a.ny * z.ny) > Math.cos(25 * RAD) && Math.hypot(zs.x - as.x, zs.y - as.y) < 4) { a.s = z.s.concat(a.s); groups.pop(); }
    }
    const facades = groups.filter(g => g.s.length >= 2).map(g => {
      let nx = 0, ny = 0; for (const s of g.s) { nx += s.nx; ny += s.ny; }
      const L = Math.hypot(nx, ny); nx /= L; ny /= L;
      const dist = Math.min(...g.s.map(s => Math.hypot(s.x, s.y)));
      const faceDeg = (Math.atan2(nx, ny) / RAD + 360) % 360;
      // nearest named street in front of the wall
      const mid = g.s[Math.floor(g.s.length / 2)];
      let street = null, sd = 1e9;
      for (const st of model.streets) for (let i = 0; i < st.pts.length - 1; i++) {
        const [d] = segDist(mid.x + nx * 6, mid.y + ny * 6, st.pts[i][0], st.pts[i][1], st.pts[i + 1][0], st.pts[i + 1][1]);
        if (d < sd) { sd = d; street = st.name; }
      }
      let pts = g.s;
      if (pts.length > 14) { const step = pts.length / 14; pts = Array.from({ length: 14 }, (_, i) => g.s[Math.floor(i * step)]); }
      return { nx, ny, faceDeg, faces: compass(faceDeg), street: sd < 35 ? street : null, dist, length: g.s.length * 1.5, samples: pts, line: g.s.map(s => [s.x, s.y]) };
    }).sort((a, b) => a.dist - b.dist);
    return { target, facades, pointInside };
  }

  // Sun timeline for each facade over [startMs, endMs)
  function analyse(model, lat, lon, startMs, endMs, opts = {}) {
    const step = (opts.stepMin || 5) * 6e4;
    const f = opts.facades || findFacades(model, opts).facades;
    const bs = model.buildings;
    const maxH = bs.reduce((m, b) => Math.max(m, b.h), 0);
    const occluders = f => bs; // all buildings
    const times = [], sun = [];
    for (let t = startMs; t < endMs; t += step) times.push(t);
    const out = f.map(fc => {
      const wallPts = fc.samples.map(s => ({ x: s.x + s.nx * 0.25, y: s.y + s.ny * 0.25, z: opts.wallZ ?? 1.5 }));
      const pavePts = fc.samples.map(s => {
        let d = 2.5; while (d > 0.5 && bs.some(b => inside(b, s.x + s.nx * d, s.y + s.ny * d))) d -= 0.5;
        return { x: s.x + s.nx * d, y: s.y + s.ny * d, z: 1.0 };
      });
      return { facade: fc, wallPts, pavePts, wall: new Float32Array(times.length), pave: new Float32Array(times.length) };
    });
    let point = null;
    if (opts.point) point = { x: opts.point[0], y: opts.point[1], z: opts.pointZ ?? 1.0, lit: new Float32Array(times.length) };
    times.forEach((t, k) => {
      const p = sunPosition(t, lat, lon);
      sun.push(p);
      if (p.alt <= 0.1 * RAD) return;
      const dx = Math.sin(p.az), dy = Math.cos(p.az), tanA = Math.tan(p.alt);
      for (const o of out) {
        const facing = o.facade.nx * dx + o.facade.ny * dy;
        let w = 0, v = 0;
        for (let i = 0; i < o.wallPts.length; i++) {
          const s = o.facade.samples[i];
          if (s.nx * dx + s.ny * dy > 0.02) { const q = o.wallPts[i]; if (!blocked(bs, q.x, q.y, q.z, dx, dy, tanA, maxH)) w++; }
          if (!opts.noPave) { const q2 = o.pavePts[i]; if (!blocked(bs, q2.x, q2.y, q2.z, dx, dy, tanA, maxH)) v++; }
        }
        o.wall[k] = w / o.wallPts.length; o.pave[k] = v / o.pavePts.length;
      }
      if (point) point.lit[k] = blocked(bs, point.x, point.y, point.z, dx, dy, tanA, maxH) ? 0 : 1;
    });
    const stepH = step / 36e5;
    const summarise = arr => {
      let hours = 0; const runs = []; let start = -1;
      for (let k = 0; k <= arr.length; k++) {
        const on = k < arr.length && arr[k] >= 0.5;
        if (k < arr.length) hours += arr[k] * stepH;
        if (on && start < 0) start = k;
        if (!on && start >= 0) { runs.push([times[start], times[k - 1] + step]); start = -1; }
      }
      // merge runs separated by one step
      const merged = [];
      for (const r of runs) { const m = merged[merged.length - 1]; if (m && r[0] - m[1] <= step) m[1] = r[1]; else merged.push(r.slice()); }
      return { hours, runs: merged.filter(r => r[1] - r[0] >= step * 2 || merged.length === 1) };
    };
    let sunrise = null, sunset = null;
    sun.forEach((p, k) => { if (p.alt > 0) { if (sunrise === null) sunrise = times[k]; sunset = times[k] + step; } });
    return {
      times, sun, step, sunrise, sunset,
      facades: out.map(o => ({ ...o.facade, wall: o.wall, pave: o.pave, wallSum: summarise(o.wall), paveSum: summarise(o.pave) })),
      point: point ? { lit: point.lit, sum: summarise(point.lit) } : null
    };
  }

  // Shadow polygons (local metres) for drawing: translated footprints + edge quads
  function shadowShapes(model, alt, az, radius) {
    if (alt <= 0.1 * RAD) return null;
    const tanA = Math.tan(alt), dx = -Math.sin(az), dy = -Math.cos(az), polys = [];
    for (const b of model.buildings) {
      if (Math.hypot((b.bbox[0] + b.bbox[2]) / 2, (b.bbox[1] + b.bbox[3]) / 2) > radius) continue;
      const L = Math.min(b.h / tanA, 400), ox = dx * L, oy = dy * L;
      for (const r of b.rings) {
        polys.push(r.map(p => [p[0] + ox, p[1] + oy]));
        for (let i = 0; i < r.length - 1; i++) polys.push([r[i], r[i + 1], [r[i + 1][0] + ox, r[i + 1][1] + oy], [r[i][0] + ox, r[i][1] + oy]]);
      }
    }
    // consistent winding so a nonzero fill unions them
    for (const p of polys) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } if (a < 0) p.reverse(); }
    return polys;
  }

  const api = { M_PER_LEVEL, sunPosition, parseOSM, applyHeights, findFacades, analyse, shadowShapes, projector, compass, inside, RAD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SunEngine = api;
})(typeof self !== 'undefined' ? self : this);
