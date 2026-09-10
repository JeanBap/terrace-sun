(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = window.SunEngine, RAD = E.RAD, STEP = 5, RADIUS = 250;
  const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DIRS = { N: 'north', NNE: 'north-north-east', NE: 'north-east', ENE: 'east-north-east', E: 'east', ESE: 'east-south-east', SE: 'south-east', SSE: 'south-south-east', S: 'south', SSW: 'south-south-west', SW: 'south-west', WSW: 'west-south-west', W: 'west', WNW: 'west-north-west', NW: 'north-west', NNW: 'north-north-west' };
  const MODES = {
    cafe: { label: 'Café name or coordinates', ph: 'Bar Fratelli Capone, Rome  or  41.8757, 12.4757', lede: 'When does direct sun reach the terrace? Type the café name, address, coordinates or a Google Maps link.', empty: 'The times direct sun reaches each street-facing wall and the tables in front, whether it is sunny right now, a shadow map you can play through the day, and the sunniest cafés nearby.', hint: 'Click anywhere on the map to check that spot. Coloured dots are nearby cafés, brighter means more sun.' },
    hotel: { label: 'Hotel name or address', ph: 'Hotel Santa Maria, Rome', lede: 'Which rooms get the morning sun? Is the terrace lit at aperitivo time? Type the hotel, then pick the floor.', empty: 'Sun times on the windows of each wall, floor by floor, plus a sentence you can paste into the room description.', hint: 'Click the hotel building on the map, or the terrace itself.' },
    host: { label: 'Address of the flat', ph: 'Via Marmorata 25, Roma', lede: '"Sunny balcony" is a claim. "Sun on the balcony from 10:30 to 17:40" is a fact. Type the address, pick your floor.', empty: 'Sun times on the windows and balcony of each wall, floor by floor, plus listing text to copy.', hint: 'Click the building on the map.' },
    solar: { label: 'Address of the roof', ph: 'Address', lede: 'Is the roof shaded by neighbours? Type the address and get the unshaded share by month, before a site visit.', empty: 'Unshaded share of daylight on the roof for each month, and sun on each wall by floor for balcony panels. Not a kWh estimate.', hint: 'Click the roof on the map.' },
    wedding: { label: 'Venue name or address', ph: 'Venue', lede: 'Will guests squint at 17:00? Where will the sun be behind the couple? Type the venue, set the date, click the exact spot.', empty: 'Sun and shade for your start and end time, which side the sun comes from, sunset and golden hour, and a shadow map you can play through the event.', hint: 'Click the exact spot for the ceremony or the tables.' },
    city: { label: 'Place or coordinates', ph: 'Piazza Testaccio, Roma', lede: 'Where is a bench in shade at 14:00 in July? Which side of the street is the cool route? Click any spot, any date.', empty: 'Sun times at the pin, on any date, with a shadow map to play through the day.', hint: 'Click the bus stop, bench or playground on the map.' }
  };
  let MODE = 'cafe';
  function setMode(m, recompute) {
    MODE = MODES[m] ? m : 'cafe'; const c = MODES[MODE];
    document.body.dataset.mode = MODE; $('mode').value = MODE;
    $('qlabel').textContent = c.label; $('q').placeholder = c.ph; $('lede').textContent = c.lede; $('emptyText').textContent = c.empty; $('maphint').textContent = c.hint;
    if (recompute && S.model && !S.busy) compute();
  }
  const S = { model: null, lat: null, lon: null, name: '', tz: null, res: null, busy: false, yearToken: 0, nearToken: 0, floorToken: 0, roofToken: 0, floor: 0 };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- date & time zone ----------
  const pad = n => String(n).padStart(2, '0');
  const now = new Date();
  $('date').value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  function tzFor(lat, lon) { try { return window.tzlookup(lat, lon); } catch (e) { return Intl.DateTimeFormat().resolvedOptions().timeZone; } }
  function offsetMin(tz, ms) {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms));
    const g = t => +p.find(x => x.type === t).value;
    return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second')) - ms) / 6e4);
  }
  function dayWindow(y, m, d, tz) {
    const base = Date.UTC(y, m - 1, d);
    const start = base - offsetMin(tz, base + 12 * 36e5) * 6e4;
    return [start, start + 864e5];
  }
  const fmt = ms => new Intl.DateTimeFormat('en-GB', { timeZone: S.tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
  const fmtDate = (y, m, d) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
  const runsText = runs => runs.length ? runs.map(r => `${fmt(r[0])} to ${fmt(r[1])}`).join(', ') : 'no direct sun';
  const hrs = h => `${h.toFixed(1)} h`;

  // ---------- status ----------
  function status(msg, err) { const el = $('status'); el.textContent = msg || ''; el.classList.toggle('err', !!err); }
  function busy(on) { S.busy = on; $('go').disabled = on; $('go').textContent = on ? 'Checking…' : 'Check the sun'; }

  // ---------- network ----------
  async function fetchT(url, opts = {}, ms = 20000) {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
    try { return await fetch(url, { ...opts, signal: ac.signal }); } finally { clearTimeout(t); }
  }
  async function geocode(q) {
    const r = await fetchT('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=' + encodeURIComponent(q), {}, 15000);
    if (r.status === 429) throw new Error('the search service is busy. Wait a few seconds, or paste coordinates instead');
    if (!r.ok) throw new Error('search service error ' + r.status);
    return r.json();
  }
  async function overpass(lat, lon) {
    const a = `(around:${RADIUS},${lat.toFixed(6)},${lon.toFixed(6)})`;
    const q = `[out:json][timeout:25];(way["building"]${a};relation["building"]${a};way["building:part"]${a};way["highway"]["name"](around:90,${lat.toFixed(6)},${lon.toFixed(6)});nwr["amenity"~"^(cafe|bar|restaurant|pub|ice_cream)$"]${a};nwr["shop"="bakery"]${a};);out geom;`;
    let last;
    for (const url of OVERPASS) {
      try {
        const r = await fetchT(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 30000);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        if (!j.elements) throw new Error('bad reply');
        return j;
      } catch (e) { last = e; }
    }
    throw new Error('Building data servers are busy (' + (last && last.message) + '). Please try again in a minute.');
  }

  // ---------- input parsing ----------
  function parseCoords(s) {
    let m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/) || s.match(/^\s*\(?\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?\s*$/) || s.match(/[?&]q=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/);
    if (!m) return null;
    const lat = +m[1], lon = +m[2];
    return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
  }

  // ---------- map ----------
  const map = L.map('map', { zoomControl: true, maxZoom: 19 }).setView([41.8766, 12.4757], 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
  map.createPane('shadows'); map.getPane('shadows').style.zIndex = 350;
  const canvas = L.canvas({ padding: 0.2 });
  const baseLayer = L.layerGroup().addTo(map), fcLayer = L.layerGroup().addTo(map), sunLayer = L.layerGroup().addTo(map);
  const ShadowLayer = L.Layer.extend({
    onAdd(m) { this._c = L.DomUtil.create('canvas', 'leaflet-zoom-hide'); m.getPane('shadows').appendChild(this._c); m.on('moveend zoomend resize viewreset', this._draw, this); this._draw(); },
    onRemove(m) { this._c.remove(); m.off('moveend zoomend resize viewreset', this._draw, this); },
    set(polys) { this._polys = polys; this._draw(); },
    _draw() {
      const m = this._map; if (!m) return;
      const size = m.getSize(), c = this._c, dpr = window.devicePixelRatio || 1;
      c.width = size.x * dpr; c.height = size.y * dpr; c.style.width = size.x + 'px'; c.style.height = size.y + 'px';
      L.DomUtil.setPosition(c, m.containerPointToLayerPoint([0, 0]));
      const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size.x, size.y);
      if (!this._polys) return;
      ctx.beginPath();
      for (const p of this._polys) { p.forEach((ll, i) => { const pt = m.latLngToContainerPoint(ll); i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y); }); ctx.closePath(); }
      ctx.fillStyle = 'rgba(30,35,75,0.42)'; ctx.fill('nonzero');
    }
  });
  const shadows = new ShadowLayer().addTo(map);
  let pendingPin = null;
  function showPending(lat, lon) {
    if (pendingPin) pendingPin.remove();
    pendingPin = L.marker([lat, lon], { icon: L.divIcon({ className: 'pending', html: '<span class="dot"></span><span class="ring"></span>', iconSize: [44, 44], iconAnchor: [22, 22] }), interactive: false, zIndexOffset: 1000 }).addTo(map);
    $('map').classList.add('loading');
  }
  function clearPending() { if (pendingPin) { pendingPin.remove(); pendingPin = null; } $('map').classList.remove('loading'); }
  map.on('click', e => {
    if (S.busy) return;
    const la = e.latlng.lat, lo = e.latlng.lng;
    $('q').value = `${la.toFixed(5)}, ${lo.toFixed(5)}`;
    showPending(la, lo);
    start(la, lo, null);
  });

  // ---------- flow ----------
  $('form').addEventListener('submit', async ev => {
    ev.preventDefault();
    if (S.busy) return;
    const q = $('q').value.trim();
    $('choices').hidden = true;
    const c = parseCoords(q);
    if (c) return start(c[0], c[1], null);
    busy(true); status('Searching for "' + q + '"…');
    try {
      let list = await geocode(q);
      busy(false);
      if (!list.length) return status('Nothing found. Add the city, e.g. "Caffè Greco, Rome", or paste coordinates.', true);
      list.sort((a, b) => (b.category === 'amenity') - (a.category === 'amenity'));
      if (list.length === 1) return start(+list[0].lat, +list[0].lon, list[0].name || list[0].display_name);
      status('Which one did you mean?');
      const box = $('choices'); box.innerHTML = '';
      list.forEach(p => {
        const b = document.createElement('button'); b.type = 'button';
        b.innerHTML = `<strong>${esc(p.name || p.display_name.split(',')[0])}</strong><span class="muted">${esc(p.type.replace(/_/g, ' '))} · ${esc(p.display_name)}</span>`;
        b.onclick = () => { box.hidden = true; start(+p.lat, +p.lon, p.name || p.display_name.split(',')[0]); };
        box.appendChild(b);
      });
      box.hidden = false;
    } catch (e) { busy(false); status('Search failed: ' + e.message, true); }
  });
  $('locBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return status('Your browser has no location service.', true);
    status('Finding you…');
    navigator.geolocation.getCurrentPosition(p => { const la = p.coords.latitude, lo = p.coords.longitude; $('q').value = `${la.toFixed(5)}, ${lo.toFixed(5)}`; showPending(la, lo); start(la, lo, null); },
      () => status('Could not get your location. Click the map instead.', true), { enableHighAccuracy: true, timeout: 10000 });
  });
  $('mode').addEventListener('change', () => setMode($('mode').value, true));
  $('date').addEventListener('change', () => { if (S.model && !S.busy) compute(); });

  async function start(lat, lon, name) {
    busy(true);
    if (!pendingPin) showPending(lat, lon);
    const prev = S.fetchAt;
    S.lat = lat; S.lon = lon; S.name = name || nearestVenueName(lat, lon) || `Spot at ${lat.toFixed(5)}, ${lon.toFixed(5)}`; S.tz = tzFor(lat, lon);
    const reuse = prev && S.json && Math.hypot((lat - prev[0]) * 110574, (lon - prev[1]) * 111320 * Math.cos(lat * RAD)) < 110;
    if (!reuse || map.getZoom() < 16) map.setView([lat, lon], Math.max(map.getZoom(), 17));
    status(reuse ? 'Calculating…' : 'Loading buildings from OpenStreetMap…');
    try {
      if (!reuse) { S.json = await overpass(lat, lon); S.fetchAt = [lat, lon]; }
      S.model = E.parseOSM(S.json, lat, lon);
      if (S.userHeight) E.applyHeights(S.model, S.userHeight, true);
      S.venues = extractVenues(S.json, lat, lon);
      status('');
      await new Promise(r => setTimeout(r, 20));
      compute();
    } catch (e) { status(e.message, true); }
    clearPending();
    busy(false);
  }

  function extractVenues(json, lat, lon) {
    const out = [];
    for (const el of json.elements || []) {
      const t = el.tags || {};
      if (!(t.amenity || t.shop) || !t.name) continue;
      let la, lo;
      if (el.type === 'node') { la = el.lat; lo = el.lon; }
      else if (el.bounds) { la = (el.bounds.minlat + el.bounds.maxlat) / 2; lo = (el.bounds.minlon + el.bounds.maxlon) / 2; }
      else continue;
      out.push({ name: t.name, kind: (t.amenity || t.shop).replace(/_/g, ' '), lat: la, lon: lo, seating: t.outdoor_seating });
    }
    return out;
  }
  function nearestVenueName(lat, lon) {
    if (!S.venues) return null;
    let best = null, bd = 25;
    for (const v of S.venues) { const d = Math.hypot((v.lat - lat) * 110574, (v.lon - lon) * 111320 * Math.cos(lat * RAD)); if (d < bd) { bd = d; best = v; } }
    return best ? best.name : null;
  }

  function compute() {
    const [y, m, d] = $('date').value.split('-').map(Number);
    if (!y) return;
    const [t0, t1] = dayWindow(y, m, d, S.tz);
    const F = E.findFacades(S.model);
    if (F.target && S.floorOverride && S.floorOverride.id === F.target.id) F.target.h = S.floorOverride.n * E.M_PER_LEVEL;
    const res = E.analyse(S.model, S.lat, S.lon, t0, t1, { stepMin: STEP, facades: F.facades, point: (F.pointInside && MODE !== 'wedding' && MODE !== 'city') ? null : [0, 0] });
    Object.assign(S, { res, F, t0, ymd: [y, m, d] });
    const u = new URL(location.href); u.search = '';
    u.searchParams.set('lat', S.lat.toFixed(6)); u.searchParams.set('lon', S.lon.toFixed(6)); u.searchParams.set('date', $('date').value); if (MODE !== 'cafe') u.searchParams.set('mode', MODE);
    if (!/^Spot at/.test(S.name)) u.searchParams.set('name', S.name);
    history.replaceState(null, '', u);
    drawMap(); render(); initSlider(); year(); nearby(); floors(); roof(); eventCheck();
    if (window.tsTrack) window.tsTrack('check', MODE);
  }

  // ---------- rendering ----------
  const toLL = (x, y) => S.model.proj.toLL(x, y);
  function hoursColour(h, max) { const t = max ? Math.min(1, h / max) : 0; const a = [120, 130, 150], b = [240, 162, 2]; return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`; }

  function drawMap() {
    baseLayer.clearLayers(); fcLayer.clearLayers();
    const tgt = S.F.target;
    for (const b of S.model.buildings) {
      if (b.isPart) continue;
      const rings = b.rings.map(r => r.map(p => toLL(p[0], p[1])));
      L.polygon(rings, { renderer: canvas, stroke: b === tgt, color: '#c2562b', weight: 2, fillColor: b === tgt ? '#f3c9b5' : '#f6f1ea', fillOpacity: b === tgt ? 0.95 : 0.9, interactive: false }).addTo(baseLayer);
    }
    const day = (S.res.sunset - S.res.sunrise) / 36e5 || 1;
    S.res.facades.forEach((f, i) => {
      const line = L.polyline(f.line.map(p => toLL(p[0] + f.nx * 0.4, p[1] + f.ny * 0.4)), { color: hoursColour(f.wallSum.hours, day), weight: 7, lineCap: 'round' }).addTo(fcLayer);
      line.bindTooltip(`${i + 1}. ${f.faces} wall: ${hrs(f.wallSum.hours)}`, { direction: 'top' });
      f._line = line;
      const mid = f.line[Math.floor(f.line.length / 2)];
      L.marker(toLL(mid[0] + f.nx * 5, mid[1] + f.ny * 5), { icon: L.divIcon({ className: 'fnum', html: `<span>${i + 1}</span>`, iconSize: [22, 22] }), interactive: false }).addTo(fcLayer);
    });
    L.circleMarker([S.lat, S.lon], { radius: 6, color: '#2b2118', weight: 2, fillColor: '#fff', fillOpacity: 1 }).bindTooltip(esc(S.name)).addTo(fcLayer);
  }

  function timelineSVG(arr, idx) {
    const n = arr.length; let r = `<svg class="bar" viewBox="0 0 ${n} 10" preserveAspectRatio="none" aria-hidden="true"><rect width="${n}" height="10" style="fill:var(--night)"/>`;
    S.res.sun.forEach((p, k) => { if (p.alt > 0) r += `<rect x="${k}" width="1.05" height="10" style="fill:var(--line)"/>`; });
    arr.forEach((v, k) => { if (v > 0) r += `<rect x="${k}" width="1.05" height="10" style="fill:var(--sun)" fill-opacity="${Math.max(0.25, v).toFixed(2)}"/>`; });
    return r + `<line class="now" data-i="${idx}" x1="0" x2="0" y1="0" y2="10" style="stroke:var(--ink)" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>`;
  }
  const axis = () => `<div class="axis" style="position:relative" aria-hidden="true">${[0, 3, 6, 9, 12, 15, 18, 21].map(h => `<span style="position:absolute;left:${h / 24 * 100}%;font-size:.7rem" class="muted">${pad(h)}</span>`).join('')}</div>`;

  function render() {
    const { res, F, model } = S, [y, m, d] = S.ymd;
    $('empty').hidden = true; const out = $('out'); out.hidden = false;
    const main = res.facades[0];
    let answer;
    if (main) {
      answer = `On ${fmtDate(y, m, d)}, the ${DIRS[main.faces]}-facing wall${main.street ? ' on ' + esc(main.street) : ''} gets direct sun ${main.wallSum.runs.length ? runsText(main.wallSum.runs) : 'at no time'} (${hrs(main.wallSum.hours)}).` + (MODE === 'cafe' ? ` Tables in front: ${hrs(main.paveSum.hours)}${main.paveSum.runs.length ? ', ' + runsText(main.paveSum.runs) : ''}.` : '');
    } else if (res.point) {
      answer = `No building found at this spot. At table height here, direct sun on ${fmtDate(y, m, d)}: ${runsText(res.point.sum.runs)} (${hrs(res.point.sum.hours)}).`;
    } else answer = 'No street-facing walls found near this point. Try clicking right next to the café on the map.';
    const cov = Math.round(model.heightCoverage * 100);
    const nowK = Math.floor((Date.now() - S.t0) / (STEP * 6e4)), isToday = nowK >= 0 && nowK < res.times.length;
    let nowLine = '';
    if (isToday && main && MODE === 'cafe') {
      const lit = main.wall[nowK] >= 0.5, litT = main.pave[nowK] >= 0.5;
      const next = (arr, want) => { for (let k = nowK + 1; k < arr.length; k++) if ((arr[k] >= 0.5) === want) return res.times[k]; return null; };
      const sunUp = res.sun[nowK].alt > 0;
      if (!sunUp) nowLine = 'Right now the sun is down.';
      else if (litT) { const t = next(main.pave, false); nowLine = `Right now the tables are in the sun${t ? ', until about ' + fmt(t) : ' for the rest of the day'}.`; }
      else { const t = next(main.pave, true); nowLine = `Right now the tables are in shade${t ? ', sun arrives about ' + fmt(t) : ' for the rest of the day'}.`; }
      if (sunUp) nowLine += lit ? ' The wall is lit.' : ' The wall is in shade.';
    }
    const chips = [['Today', null], ['21 Jun', '-06-21'], ['21 Mar', '-03-21'], ['21 Dec', '-12-21']].map(([l, sfx]) => { const v = sfx ? y + sfx : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`; return `<button type="button" class="chip${v === $('date').value ? ' on' : ''}" data-date="${v}">${l}</button>`; }).join('');
    let h = `<div class="card place"><div class="placehead"><h2>${esc(S.name)}</h2><button type="button" class="ghost small" id="share">Copy link</button></div>
      <div class="muted">${fmtDate(y, m, d)} · sunrise ${res.sunrise ? fmt(res.sunrise) : 'none'} · sunset ${res.sunset ? fmt(res.sunset) : 'none'} · times in ${esc(S.tz)}</div>
      <p class="answer">${answer}</p>
      ${nowLine ? `<p class="now"><span class="pulse"></span>${nowLine}</p>` : ''}
      <div class="chips">${chips}</div>
      <p class="note muted"><span style="color:var(--sun)">■</span> direct sun · <span style="color:#cfc4b5">■</span> shade · <span style="color:#9d948a">■</span> night</p></div>`;
    { const h0 = h; h = '';     if (F.target && res.facades.length && (MODE === 'hotel' || MODE === 'host' || MODE === 'solar')) {
        const nF = Math.max(1, Math.round(F.target.h / E.M_PER_LEVEL));
        const opts = Array.from({ length: nF }, (_, f) => `<option value="${f}"${f === (S.floor || 0) ? ' selected' : ''}>${floorName(f)}</option>`).join('');
        h += `<article class="card" id="homeCard"><h3>${MODE === 'hotel' ? 'Rooms by floor' : MODE === 'solar' ? 'Balcony panels by floor' : 'Flat by floor'}</h3>
          <p class="note muted">How much sun comes through the windows depends on the floor: higher floors clear the buildings opposite. This building is about ${Math.round(F.target.h)} m tall (${nF} floor${nF > 1 ? 's' : ''}${F.target.tagged ? '' : ', estimated'}).</p>
          <div class="settings"><div class="field"><label for="floor">${MODE === 'hotel' ? 'Room is on' : 'Flat is on'}</label><select id="floor">${opts}</select></div><div class="field"><label for="nfloors">Floors in building</label><input id="nfloors" type="number" min="1" max="60" value="${nF}"></div><button type="button" class="ghost" id="copyListing">Copy listing text</button></div>
          <p class="answer" id="floorAnswer">Calculating…</p>
          <div style="overflow-x:auto"><table class="year" id="floorTbl"></table></div>
          <p class="note muted">Hours of direct sun on each wall's windows, at 1.5 m above each floor. Click a row to select that floor.</p></article>`;
      }
      if (MODE === 'solar' && F.target) {
        h += `<article class="card" id="roofCard"><h3>Roof and balcony solar check <span class="tag">pre-visit</span></h3><p class="answer" id="roofAnswer">Calculating…</p><table class="year" id="roofTbl"></table><p class="note muted">Direct-beam hours on the roof of this building (${Math.round(F.target.h)} m) on the 21st of each month, and on a balcony at the chosen floor for each wall. Not an irradiance model: use it to rank sites and spot shading from neighbours, then run PVGIS or a proper yield tool for kWh.</p></article>`;
      }
      if (MODE === 'wedding') {
        h += `<article class="card" id="eventCard"><h3>Event time check</h3><div class="settings"><div class="field"><label for="evStart">Starts</label><input id="evStart" type="time" value="${S.evStart || '17:00'}"></div><div class="field"><label for="evEnd">Ends</label><input id="evEnd" type="time" value="${S.evEnd || '19:00'}"></div></div><p class="answer" id="evAnswer"></p><p class="note muted">Guests at the pin, at table height. "Sun from the west" means the sun is behind anyone facing west, so face the ceremony the other way. Golden hour is the last hour before sunset.</p></article>`;
      }

      h = h0 + h; }
    res.facades.forEach((f, i) => {
      h += `<article class="card"><h3><span class="badge">${i + 1} · ${f.faces}</span>${f.street ? esc(f.street) : 'Wall'} <span class="tag">${Math.round(f.length)} m of wall</span>${i === 0 ? '<span class="tag">nearest to pin</span>' : ''}</h3>
        <div class="rows">
          <span></span>${axis()}<span></span>
          <span class="lbl">Wall</span>${timelineSVG(f.wall, i)}<span class="hrs">${hrs(f.wallSum.hours)}</span>
          <span class="times">${runsText(f.wallSum.runs)}</span>
          ${MODE === 'cafe' ? `<span class="lbl">Tables</span>${timelineSVG(f.pave, i)}<span class="hrs">${hrs(f.paveSum.hours)}</span><span class="times">${runsText(f.paveSum.runs)}</span>` : ''}
        </div></article>`;
    });
    if (res.point && res.facades.length && (MODE === 'wedding' || MODE === 'city')) {
      h += `<article class="card"><h3><span class="badge">Pin</span>At the pin, 1 m above ground</h3><div class="rows"><span class="lbl">Sun</span>${timelineSVG(res.point.lit, 99)}<span class="hrs">${hrs(res.point.sum.hours)}</span><span class="times">${runsText(res.point.sum.runs)}</span></div></article>`;
    } else if (res.point) {
      h += `<article class="card"><div class="rows"><span class="lbl">Sun</span>${timelineSVG(res.point.lit, 99)}<span class="hrs">${hrs(res.point.sum.hours)}</span></div></article>`;
    }
    h += `<article class="card" id="yearCard"><h3>Through the year <span class="tag">21st of each month</span></h3><table class="year" id="yearTbl"><tbody><tr><td class="muted" colspan="4">Calculating…</td></tr></tbody></table>
      <p class="note muted"><span style="color:var(--sun)">■</span> wall · <span style="color:var(--accent)">■</span> tables</p></article>`;
    if (MODE === 'cafe') h += `<article class="card" id="nearby" hidden><h3>Sunniest places nearby <span class="tag">tables, this date</span></h3><table class="year" id="nearbyTbl"></table><p class="note muted">Every named café, bar and restaurant within 220 m. Click one to check it.</p></article>`;
    h += `<details class="card"><summary><strong>Building heights and limits</strong> <span class="tag ${cov < 50 ? 'warn' : ''}">${cov}% real heights</span></summary>
      <p class="note ${cov < 50 ? 'warn' : 'muted'}">${cov}% of nearby building area has a real height in OpenStreetMap. The rest is assumed to be ${model.defaultHeight} m tall${model.taggedSamples >= 3 ? ' (typical of the tagged buildings nearby)' : ''}.${cov < 50 ? ' If the street is lined with 5 or 6 storey blocks, try 18 to 20 m.' : ''}</p>
      <form class="settings" id="hform"><div class="field"><label for="hdef">Assumed height (m)</label><input id="hdef" type="number" min="2" max="200" step="0.5" value="${model.defaultHeight}"></div><button class="ghost" type="submit">Recalculate</button></form>
      <p class="note muted">Direct sun on a clear day. Flat ground. Trees, awnings, umbrellas and hills are not included. Buildings within ${RADIUS} m are used.</p></details>`;
    out.innerHTML = h;
    document.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { $('date').value = b.dataset.date; compute(); }));
    $('share').addEventListener('click', async () => {
      const b = $('share');
      try { if (navigator.share) await navigator.share({ title: 'Terrace Sun: ' + S.name, url: location.href }); else { await navigator.clipboard.writeText(location.href); b.textContent = 'Copied'; setTimeout(() => b.textContent = 'Copy link', 1500); } } catch (e) { }
    });
    if ($('floor')) { $('nfloors').addEventListener('change', () => { const n = parseInt($('nfloors').value, 10); if (n >= 1) { S.floorOverride = { id: F.target.id, n }; compute(); } });
      $('floor').addEventListener('change', () => { S.floor = +$('floor').value; floors(); }); $('copyListing').addEventListener('click', async () => { try { await navigator.clipboard.writeText(S.listingText || ''); $('copyListing').textContent = 'Copied'; setTimeout(() => $('copyListing').textContent = 'Copy listing text', 1500); } catch (e) { } }); }
    $('hform').addEventListener('submit', e => { e.preventDefault(); const v = parseFloat($('hdef').value); if (v >= 2) { S.userHeight = v; E.applyHeights(S.model, v, true); compute(); } });
  }

  // ---------- floors (real estate) ----------
  function floorName(f) { return f === 0 ? 'Ground floor' : f === 1 ? '1st floor' : f === 2 ? '2nd floor' : f === 3 ? '3rd floor' : f + 'th floor'; }
  function floors() {
    const tbl = $('floorTbl'); if (!tbl) return;
    const token = ++S.floorToken, F = S.F, res = S.res, [y, m, d] = S.ymd;
    const nF = Math.max(1, Math.round(F.target.h / E.M_PER_LEVEL));
    if ((S.floor || 0) >= nF) S.floor = nF - 1;
    const rows = []; let f = 0;
    const stepFn = () => {
      if (token !== S.floorToken || !$('floorTbl')) return;
      const r = E.analyse(S.model, S.lat, S.lon, S.t0, S.t0 + 864e5, { stepMin: 10, facades: res.facades, wallZ: f * E.M_PER_LEVEL + 1.5, noPave: true });
      rows.push(r.facades.map(x => x.wallSum));
      f++;
      if (f < nF) return setTimeout(stepFn, 0);
      const max = Math.max(...rows.flat().map(x => x.hours), 0.1);
      tbl.innerHTML = `<thead><tr><th style="text-align:left">Floor</th>${res.facades.map((x, i) => `<th>${i + 1} · ${x.faces}</th>`).join('')}<th>Best wall</th></tr></thead><tbody>` +
        rows.map((row, fi) => `<tr class="frow${fi === S.floor ? ' sel' : ''}" data-f="${fi}"><td>${floorName(fi)}</td>${row.map(x => `<td title="${esc(runsText(x.runs))}"><div class="fill" style="width:${x.hours / max * 100}%;min-width:2px"></div><span class="small">${x.hours.toFixed(1)} h</span></td>`).join('')}<td class="hrs">${Math.max(...row.map(x => x.hours)).toFixed(1)} h</td></tr>`).reverse().join('') + '</tbody>';
      tbl.querySelectorAll('.frow').forEach(tr => tr.addEventListener('click', () => { S.floor = +tr.dataset.f; $('floor').value = S.floor; floors(); }));
      const sel = rows[S.floor || 0];
      const parts = sel.map((x, i) => `${DIRS[res.facades[i].faces]}-facing windows${res.facades[i].street ? ' on ' + res.facades[i].street : ''}: ${x.runs.length ? runsText(x.runs) : 'no direct sun'} (${hrs(x.hours)})`);
      const best = sel.reduce((bi, x, i, a) => x.hours > a[bi].hours ? i : bi, 0);
      const txt = `${floorName(S.floor || 0)}, ${fmtDate(y, m, d)}: ${parts.join('; ')}.`;
      $('floorAnswer').textContent = txt;
      S.listingText = `${S.name}, ${floorName(S.floor || 0)}. Direct sunlight on ${fmtDate(y, m, d)}: ${parts.join('; ')}. Longest sun on the ${DIRS[res.facades[best].faces]} side, ${hrs(sel[best].hours)}. Computed from OpenStreetMap building heights with Terrace Sun (${location.href}).`;
    };
    setTimeout(stepFn, 40);
  }

  // ---------- solar roof ----------
  function roof() {
    const tbl = $('roofTbl'); if (!tbl) return;
    const token = ++S.roofToken, b = S.F.target, [y] = S.ymd;
    const cx = (b.bbox[0] + b.bbox[2]) / 2, cy = (b.bbox[1] + b.bbox[3]) / 2;
    const rows = []; let mon = 0;
    const stepFn = () => {
      if (token !== S.roofToken || !$('roofTbl')) return;
      const [t0, t1] = dayWindow(y, mon + 1, 21, S.tz);
      const r = E.analyse(S.model, S.lat, S.lon, t0, t1, { stepMin: 10, facades: [], point: [cx, cy], pointZ: b.h + 0.5 });
      const day = (r.sunset - r.sunrise) / 36e5;
      rows.push([MONTHS[mon], r.point.sum.hours, day]);
      mon++;
      if (mon < 12) return setTimeout(stepFn, 0);
      const tot = rows.reduce((s, r) => s + r[1], 0), dl = rows.reduce((s, r) => s + r[2], 0);
      tbl.innerHTML = '<thead><tr><th style="text-align:left">Month</th><th>Roof sun</th><th>Daylight</th><th>Unshaded</th></tr></thead><tbody>' + rows.map(([n, h, d]) => `<tr><td>${n}</td><td class="hrs">${h.toFixed(1)} h</td><td class="hrs muted">${d.toFixed(1)} h</td><td class="b"><div class="fill" style="width:${d ? h / d * 100 : 0}%"></div><span class="small">${d ? Math.round(h / d * 100) : 0}%</span></td></tr>`).join('') + '</tbody>';
      $('roofAnswer').textContent = `The roof is unshaded for ${Math.round(tot / dl * 100)}% of daylight hours across the year (${(tot / 12).toFixed(1)} h a day on average). ${tot / dl > 0.95 ? 'No meaningful shading from neighbours: a good candidate.' : tot / dl > 0.8 ? 'Some shading from neighbours in low-sun months: check panel placement on the sunny side.' : 'Significant shading: expect reduced winter yield, consider a higher mount or another roof.'}`;
    };
    setTimeout(stepFn, 40);
  }

  // ---------- wedding / event ----------
  function eventCheck() {
    const el = $('evAnswer'); if (!el) return;
    const run = () => {
      S.evStart = $('evStart').value; S.evEnd = $('evEnd').value;
      const [h1, m1] = S.evStart.split(':').map(Number), [h2, m2] = S.evEnd.split(':').map(Number);
      const k1 = Math.round((h1 * 60 + m1) / STEP), k2 = Math.max(k1 + 1, Math.round((h2 * 60 + m2) / STEP));
      const lit = S.res.point ? S.res.point.lit : (S.res.facades[0] ? S.res.facades[0].pave : null);
      if (!lit) { el.textContent = 'Click the exact spot where guests will be.'; return; }
      let sunny = 0, n = 0, dirs = {};
      for (let k = k1; k < k2 && k < lit.length; k++) { n++; if (lit[k] >= 0.5) { sunny++; const d = DIRS[E.compass(S.res.sun[k].az / RAD)].split('-')[0]; dirs[d] = (dirs[d] || 0) + 1; } }
      const pct = n ? Math.round(sunny / n * 100) : 0;
      const mainDir = Object.keys(dirs).sort((a, b) => dirs[b] - dirs[a])[0];
      const golden = S.res.sunset ? `${fmt(S.res.sunset - 36e5)} to ${fmt(S.res.sunset)}` : 'none';
      el.textContent = `From ${S.evStart} to ${S.evEnd} this spot is in direct sun ${pct}% of the time${mainDir ? ', coming from the ' + mainDir : ''}. ${pct > 70 ? 'Bright: plan shade, water and sunglasses, and face guests away from the ' + mainDir + '.' : pct > 20 ? 'Mixed sun and shade: dappled light, fine for photos, watch the transition times.' : 'Mostly shade: cool for guests, flat light for photos.'} Sunset ${S.res.sunset ? fmt(S.res.sunset) : 'none'}, golden hour ${golden}.`;
    };
    $('evStart').onchange = run; $('evEnd').onchange = run; run();
  }

  // ---------- nearby venues ----------
  const venueLayer = L.layerGroup().addTo(map);
  function nearby() {
    venueLayer.clearLayers();
    const card = $('nearby'); if (!card) { ++S.nearToken; return; }
    const vs = (S.venues || []).filter(v => Math.hypot((v.lat - S.lat) * 110574, (v.lon - S.lon) * 111320 * Math.cos(S.lat * RAD)) <= 220);
    if (!vs.length) { card.hidden = true; return; }
    card.hidden = false;
    const tbl = $('nearbyTbl'); tbl.innerHTML = '<tbody><tr><td class="muted">Checking ' + vs.length + ' places…</td></tr></tbody>';
    const token = ++S.nearToken, rows = [];
    let i = 0;
    const [t0, t1] = [S.t0, S.t0 + 864e5];
    const stepFn = () => {
      if (token !== S.nearToken) return;
      const v = vs[i];
      const [x, y] = S.model.proj.toXY(v.lat, v.lon);
      let px = x, py = y;
      // move point to nearest open cell in front if inside a building
      if (S.model.buildings.some(b => E.inside(b, px, py))) {
        let found = false;
        for (let r = 2; r <= 14 && !found; r += 2) for (let a = 0; a < 360 && !found; a += 30) { const qx = x + r * Math.sin(a * RAD), qy = y + r * Math.cos(a * RAD); if (!S.model.buildings.some(b => E.inside(b, qx, qy))) { px = qx; py = qy; found = true; } }
      }
      const r = E.analyse(S.model, S.lat, S.lon, t0, t1, { stepMin: 10, facades: [], point: [px, py] });
      rows.push({ v, hours: r.point.sum.hours, runs: r.point.sum.runs });
      i++;
      if (i < vs.length) return setTimeout(stepFn, 0);
      rows.sort((a, b) => b.hours - a.hours);
      const max = Math.max(...rows.map(r => r.hours), 0.1);
      tbl.innerHTML = '<tbody>' + rows.map((r, n) => `<tr class="vrow" data-i="${n}"><td>${esc(r.v.name)}<div class="muted small">${esc(r.v.kind)}${r.v.seating === 'yes' ? ' · outdoor seating' : ''} · ${runsText(r.runs)}</div></td><td class="b"><div class="fill" style="width:${r.hours / max * 100}%"></div></td><td class="hrs">${r.hours.toFixed(1)}</td></tr>`).join('') + '</tbody>';
      tbl.querySelectorAll('.vrow').forEach(tr => tr.addEventListener('click', () => { const r = rows[+tr.dataset.i]; $('q').value = r.v.name; showPending(r.v.lat, r.v.lon); start(r.v.lat, r.v.lon, r.v.name); }));
      rows.forEach(r => {
        const m = L.circleMarker([r.v.lat, r.v.lon], { radius: 7, color: '#2b2118', weight: 1.5, fillColor: hoursColour(r.hours, max), fillOpacity: 1 }).addTo(venueLayer);
        m.bindTooltip(`${esc(r.v.name)}: ${r.hours.toFixed(1)} h sun`);
        m.on('click', ev => { L.DomEvent.stop(ev); $('q').value = r.v.name; showPending(r.v.lat, r.v.lon); start(r.v.lat, r.v.lon, r.v.name); });
      });
    };
    setTimeout(stepFn, 50);
  }

  // ---------- slider ----------
  function initSlider() {
    const box = $('sliderBox'), sl = $('slider'); box.hidden = false;
    sl.max = S.res.times.length - 1;
    let k = S.res.sun.reduce((bi, p, i, a) => p.alt > a[bi].alt ? i : bi, 0);
    const nowK = Math.floor((Date.now() - S.t0) / (STEP * 6e4));
    if (nowK >= 0 && nowK < S.res.times.length && S.res.sun[nowK].alt > 0) k = nowK;
    sl.value = k; sl.oninput = () => { stopPlay(); slide(+sl.value); }; slide(k);
    $('nowBtn').hidden = !(nowK >= 0 && nowK < S.res.times.length);
    $('nowBtn').onclick = () => { stopPlay(); sl.value = nowK; slide(nowK); };
    $('playBtn').onclick = () => { if (S.playing) stopPlay(); else play(); };
  }
  function stopPlay() { clearInterval(S.playing); S.playing = null; $('playBtn').textContent = '▶ Play'; }
  function play() {
    const sl = $('slider'); let k = +sl.value;
    const first = S.res.sun.findIndex(p => p.alt > 0), last = S.res.sun.length - 1 - [...S.res.sun].reverse().findIndex(p => p.alt > 0);
    if (k >= last || k < first) k = first;
    $('playBtn').textContent = '❚❚ Pause';
    S.playing = setInterval(() => { k += 2; if (k > last) return stopPlay(); sl.value = k; slide(k); }, 120);
  }
  function slide(k) {
    const t = S.res.times[k], p = S.res.sun[k];
    $('sliderTime').textContent = fmt(t);
    sunLayer.clearLayers();
    if (p.alt > 0) {
      $('sunInfo').textContent = `· sun ${Math.round(p.alt / RAD)}° high, from the ${DIRS[E.compass(p.az / RAD)]}`;
      const polys = E.shadowShapes(S.model, p.alt, p.az, RADIUS + 50);
      shadows.set(polys ? polys.map(poly => poly.map(q => toLL(q[0], q[1]))) : null);
      const far = [Math.sin(p.az) * 45, Math.cos(p.az) * 45];
      L.polyline([[S.lat, S.lon], toLL(far[0], far[1])], { color: '#f0a202', weight: 3, dashArray: '6 6', interactive: false }).addTo(sunLayer);
      L.circleMarker(toLL(far[0], far[1]), { radius: 9, color: '#f0a202', fillColor: '#ffd35c', fillOpacity: 1, weight: 2, interactive: false }).addTo(sunLayer);
    } else { $('sunInfo').textContent = '· sun below the horizon'; shadows.set(null); }
    S.res.facades.forEach(f => { if (f._line) f._line.setStyle({ color: f.wall[k] >= 0.5 ? '#f0a202' : '#5b6275', opacity: 1 }); });
    document.querySelectorAll('svg.bar line.now').forEach(l => { l.setAttribute('x1', k + 0.5); l.setAttribute('x2', k + 0.5); });
  }

  // ---------- year ----------
  function year() {
    const token = ++S.yearToken, main = S.res.facades[0], useWall = !!main;
    const rows = []; let mon = 0, max = 0;
    const step = () => {
      if (token !== S.yearToken || !$('yearTbl')) return;
      const [t0, t1] = dayWindow(S.ymd[0], mon + 1, 21, S.tz);
      const r = E.analyse(S.model, S.lat, S.lon, t0, t1, { stepMin: 10, facades: useWall ? [main] : [], point: useWall ? null : [0, 0] });
      const w = useWall ? r.facades[0].wallSum.hours : r.point.sum.hours, tb = useWall ? r.facades[0].paveSum.hours : null;
      rows.push([MONTHS[mon], w, tb, useWall ? runsText(r.facades[0].wallSum.runs) : runsText(r.point.sum.runs)]);
      max = Math.max(max, w, tb || 0);
      mon++;
      if (mon < 12) return setTimeout(step, 0);
      $('yearTbl').innerHTML = '<tbody>' + rows.map(([n, w, tb, rt]) => `<tr title="${esc(rt)}"><td>${n}</td><td class="b"><div class="fill" style="width:${max ? w / max * 100 : 0}%"></div>${tb != null ? `<div class="fill t" style="width:${max ? tb / max * 100 : 0}%;margin-top:2px"></div>` : ''}</td><td>${w.toFixed(1)}</td><td>${tb != null ? tb.toFixed(1) : ''}</td></tr>`).join('') + '</tbody>';
    };
    setTimeout(step, 30);
  }

  // ---------- boot from URL ----------
  const P = new URLSearchParams(location.search);
  setMode(P.get('mode') || 'cafe', false);
  if (P.get('date') && /^\d{4}-\d{2}-\d{2}$/.test(P.get('date'))) $('date').value = P.get('date');
  if (P.get('lat') && P.get('lon')) { const la = +P.get('lat'), lo = +P.get('lon'); if (!isNaN(la) && !isNaN(lo)) { $('q').value = P.get('name') || `${la}, ${lo}`; start(la, lo, P.get('name')); } }
  else if (P.get('q')) { $('q').value = P.get('q'); $('form').requestSubmit(); }
})();
