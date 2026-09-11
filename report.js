(function () {
  'use strict';
  const $ = id => document.getElementById(id), E = window.SunEngine, RAD = E.RAD;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DIRS = { N: 'north', NNE: 'north-north-east', NE: 'north-east', ENE: 'east-north-east', E: 'east', ESE: 'east-south-east', SE: 'south-east', SSE: 'south-south-east', S: 'south', SSW: 'south-south-west', SW: 'south-west', WSW: 'west-south-west', W: 'west', WNW: 'west-north-west', NW: 'north-west', NNW: 'north-north-west' };
  const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
  const P = new URLSearchParams(location.search);
  const lat = parseFloat(P.get('lat')), lon = parseFloat(P.get('lon'));
  const floor = Math.max(0, parseInt(P.get('floor') || '0', 10) || 0), floors = P.get('floors') ? parseInt(P.get('floors'), 10) : null, height = P.get('h') ? parseFloat(P.get('h')) : null;
  const name = P.get('name') || 'Property', agency = P.get('agency'), logo = P.get('logo'), agent = P.get('agent'), year = new Date().getFullYear();
  const floorName = f => f === 0 ? 'Ground floor' : f === 1 ? '1st floor' : f === 2 ? '2nd floor' : f === 3 ? '3rd floor' : f + 'th floor';
  const status = (m, err) => { const el = $('status'); el.textContent = m || ''; el.classList.toggle('err', !!err); el.hidden = !m; };
  $('printBtn').onclick = () => { if (window.tsTrack) window.tsTrack('report_print', agency || ''); window.print(); };
  $('genDate').textContent = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  // Agency branding needs a paid plan (publishable key pk) or a paid single report (t); otherwise the report carries ours.
  const pk = P.get('pk'), tok = P.get('t');
  function applyBrand(b) {
    if (b && b.branded) {
      const ag = b.agency || agency, lg = b.logo || logo, at = b.agent || agent;
      document.body.classList.add('branded');
      if (ag) { $('brandName').textContent = ag; document.title = `Sun Exposure Report: ${name} | ${ag}`; }
      if (lg && /^https:\/\//.test(lg)) { const img = document.createElement('img'); img.src = lg; img.alt = ag || 'logo'; img.onerror = () => img.remove(); $('brand').insertBefore(img, $('brandName')); const sun = $('brand').querySelector('.sun'); if (sun) sun.remove(); }
      if (at) { $('agentLine').textContent = at; $('agentLine').hidden = false; }
      $('powered').hidden = true;
      if (b.sample || b.test) { const r = document.createElement('span'); r.className = 'samplebadge'; r.textContent = b.sample ? 'Sample report' : 'Test mode'; $('brand').appendChild(r); }
      return;
    }
    if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return;
    const f = $('buyForm');
    for (const k of ['lat', 'lon', 'floor', 'floors', 'h', 'name']) if (P.get(k)) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = P.get(k); f.appendChild(i); }
    for (const k of ['agency', 'logo', 'agent']) if (P.get(k)) f.elements[k].value = P.get(k);
    const note = { cancelled: 'Checkout cancelled. No payment was taken.', error: 'Checkout could not start. Please try again in a minute.', soon: 'Online payment is being switched on. Please try again later.' }[P.get('checkout')];
    if (note) { $('upsellNote').textContent = note; $('upsellNote').hidden = false; }
    $('upsell').hidden = false;
  }
  if (pk || tok) fetch('/api/brand?' + new URLSearchParams({ pk: pk || '', t: tok || '', lat: P.get('lat') || '', lon: P.get('lon') || '' })).then(r => r.json()).catch(() => ({ branded: true, unverified: true })).then(applyBrand);
  else applyBrand({ branded: false });

  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) { status('This report link is missing coordinates. Open it from your listing tool or add ?lat=..&lon=.. to the address.', true); return; }

  async function overpass() {
    const a = `(around:250,${lat.toFixed(6)},${lon.toFixed(6)})`;
    const q = `[out:json][timeout:25];(way["building"]${a};relation["building"]${a};way["building:part"]${a};way["highway"]["name"](around:90,${lat.toFixed(6)},${lon.toFixed(6)}););out geom;`;
    let last;
    for (const url of OVERPASS) {
      try {
        const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 30000);
        const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ac.signal }).finally(() => clearTimeout(t));
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json(); if (!j.elements) throw new Error('bad reply'); return j;
      } catch (e) { last = e; }
    }
    throw new Error('Building data servers are busy (' + (last && last.message) + '). Reload in a minute.');
  }

  const bars = (rows, selIdx) => `<div class="bars">${rows.map((r, i) => `<span class="${i === selIdx ? 'sel' : ''}">${esc(r[0])}</span><span class="bar ${i === selIdx ? 'sel' : ''}"><i style="width:${r[2] ? Math.min(100, r[1] / r[2] * 100) : 0}%"></i></span><span class="${i === selIdx ? 'sel' : ''}">${r[1].toFixed(1)} h</span>`).join('')}</div>`;
  const timesText = t => t.length ? t.map(x => x[0] + ' to ' + x[1]).join(', ') : 'no direct sun';

  (async () => {
    try {
      const json = await overpass();
      status('Calculating…');
      await new Promise(r => setTimeout(r, 20));
      const model = E.parseOSM(json, lat, lon);
      if (height >= 2) E.applyHeights(model, height, true);
      const tz = (window.tzlookup && tzlookup(lat, lon)) || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const rep = E.propertyReport(model, lat, lon, tz, { floor, floors, year, stepMin: 10 });
      status('');
      $('doc').hidden = false; // show first: Leaflet needs a visible, sized container
      render(model, rep, tz);
      if (window.tsTrack) window.tsTrack('report_view', agency || '');
    } catch (e) { status(e.message, true); }
  })();

  function render(model, rep, tz) {
    const fl = rep.floor;
    $('propName').textContent = name;
    $('propMeta').textContent = `${rep.point_mode ? 'Open spot' : floorName(fl) + ' of ' + rep.floors_in_building} · ${lat.toFixed(5)}, ${lon.toFixed(5)} · times in ${tz}`;
    $('gradeLetter').textContent = rep.grade; $('gradeLetter').className = 'gradeLetter g-' + rep.grade; $('scoreNum').textContent = rep.score;
    const bestI = rep.seasons[0].best_wall, bestF = rep.facades[bestI];
    const sideTxt = rep.point_mode ? 'at this spot' : `on the ${DIRS[bestF.faces]}-facing side${bestF.street ? ' (' + esc(bestF.street) + ')' : ''}`;
    $('summary').innerHTML = `Direct sun ${sideTxt} for <strong>${rep.score}% of daylight hours</strong>, averaged over the four seasons: about <strong>${rep.annual_avg_hours} hours a day</strong>. ${rep.grade === 'A' ? 'Among the brightest homes a city street can offer.' : rep.grade === 'B' ? 'A bright home for most of the year.' : rep.grade === 'C' ? 'Good sun for part of the day; check the winter figures below.' : rep.grade === 'D' ? 'Limited direct sun; the neighbouring buildings shade this floor for much of the day.' : 'Very little direct sun reaches this floor.'}`;
    $('tiles').innerHTML = rep.seasons.map(s => `<div class="tile"><div class="t">${s.season[0].toUpperCase() + s.season.slice(1)} · ${s.date.slice(5).replace('-', '/')}</div><div class="big">${s.walls[s.best_wall].hours} h</div><div class="t">${esc(timesText(s.walls[s.best_wall].times))}</div><div class="t">daylight ${s.daylight_hours} h</div></div>`).join('');
    $('facTbl').innerHTML = `<thead><tr><th>Side</th><th>Character</th>${rep.seasons.map(s => `<th>${s.season[0].toUpperCase() + s.season.slice(1)}</th>`).join('')}</tr></thead><tbody>` +
      rep.facades.map((f, i) => `<tr><td><strong>${rep.point_mode ? 'This spot' : (i + 1) + ' · ' + f.faces}</strong><span class="times">${f.street ? esc(f.street) : ''}${f.length_m ? ' · ' + f.length_m + ' m of wall' : ''}</span></td><td>${esc(rep.character[i])}</td>${rep.seasons.map(s => `<td><strong>${s.walls[i].hours} h</strong><span class="times">${esc(timesText(s.walls[i].times))}</span></td>`).join('')}</tr>`).join('') + '</tbody>';
    const dayEq = rep.seasons[0].daylight_hours;
    $('floorChart').innerHTML = rep.floors.length > 1 ? bars(rep.floors.slice().reverse().map(f => [floorName(f.floor), f.hours, dayEq]), rep.floors.length - 1 - fl) : '<p class="muted small">Single-floor building.</p>';
    $('monthChart').innerHTML = bars(rep.monthly.map(m => [m.month, m.hours, m.daylight_hours]), -1);
    // meaning
    const ms = [];
    rep.facades.forEach((f, i) => { if (rep.point_mode) return; const w = rep.seasons[3].walls[i], su = rep.seasons[1].walls[i]; ms.push(`<p><strong>${DIRS[f.faces][0].toUpperCase() + DIRS[f.faces].slice(1)} side${f.street ? ', ' + esc(f.street) : ''}:</strong> ${esc(rep.character[i])}. Rooms on this side get ${su.hours} h of direct sun in midsummer and ${w.hours} h in midwinter${w.times.length ? ' (' + esc(timesText(w.times)) + ')' : ''}.</p>`); });
    const top = rep.floors[rep.floors.length - 1], ground = rep.floors[0];
    if (rep.floors.length > 1) ms.push(`<p><strong>Floor:</strong> ${floorName(fl)} gets ${rep.floors[fl].hours} h on the equinox, against ${ground.hours} h on the ground floor and ${top.hours} h on the top floor.</p>`);
    const win = rep.seasons[3], sum = rep.seasons[1];
    ms.push(`<p><strong>Winter check:</strong> on 21 December the sunniest side gets ${win.walls[win.best_wall].hours} h of a ${win.daylight_hours} h day${win.walls[win.best_wall].hours / (win.daylight_hours || 1) > 0.6 ? ', which is excellent for a city home' : win.walls[win.best_wall].hours / (win.daylight_hours || 1) > 0.35 ? ', a fair result for a city street' : ', so expect a dim home in winter'}. In midsummer it gets ${sum.walls[sum.best_wall].hours} h.</p>`);
    $('meaning').innerHTML = ms.join('');
    $('method').innerHTML = `<p>Building footprints and heights come from OpenStreetMap (${model.buildings.length} buildings within 250 m). ${Math.round(rep.height_coverage * 100)}% of the built area nearby has a real height tag; the rest is estimated at ${rep.default_height_m} m${rep.building_height_tagged === false ? ', including this building' : ''}${floors ? ' (floor count set by the agent: ' + floors + ')' : ''}. For each street-facing wall, points 1.5 m above the ${floorName(fl).toLowerCase()} are tested every 10 minutes from sunrise to sunset for a clear line to the sun. The Sun Score is the share of daylight hours with direct sun on the sunniest wall, averaged over 20 March, 21 June, 22 September and 21 December.</p><p>Not included: trees, awnings, balconies above, hills and weather. Figures are direct-beam sun on a clear day, not light levels inside, and not an energy calculation. Courtyard-facing rooms are not assessed. OpenStreetMap data can be incomplete; the agent is responsible for the floor and building details supplied.</p>`;
    $('verify').innerHTML = `Report ID ${hash(location.search)} · generated ${new Date().toISOString().slice(0, 10)} · anyone can re-run this report at <a href="${esc(location.href)}">this link</a>.`;
    drawMap(model, rep, tz);
  }
  function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i); return ('TS-' + (h >>> 0).toString(36).toUpperCase()); }

  function drawMap(model, rep, tz) {
    const map = L.map('map', { scrollWheelZoom: false, maxZoom: 19 }).setView([lat, lon], 18);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    map.createPane('shadows'); map.getPane('shadows').style.zIndex = 350;
    const F = E.findFacades(model), tgt = F.target, toLL = (x, y) => model.proj.toLL(x, y);
    for (const b of model.buildings) { if (b.isPart) continue; L.polygon(b.rings.map(r => r.map(p => toLL(p[0], p[1]))), { stroke: b === tgt, color: '#c2562b', weight: 2, fillColor: b === tgt ? '#f3c9b5' : '#f6f1ea', fillOpacity: b === tgt ? 0.95 : 0.9, interactive: false }).addTo(map); }
    F.facades.forEach((f, i) => L.polyline(f.line.map(p => toLL(p[0] + f.nx * 0.4, p[1] + f.ny * 0.4)), { color: '#f0a202', weight: 6, lineCap: 'round' }).bindTooltip(`${i + 1} · ${f.faces}`).addTo(map));
    L.circleMarker([lat, lon], { radius: 6, color: '#2b2118', weight: 2, fillColor: '#fff', fillOpacity: 1, interactive: false }).addTo(map);
    const canvas = L.DomUtil.create('canvas', 'leaflet-zoom-hide'); map.getPane('shadows').appendChild(canvas);
    let polys = null;
    const draw = () => { const size = map.getSize(), dpr = window.devicePixelRatio || 1; canvas.width = size.x * dpr; canvas.height = size.y * dpr; canvas.style.width = size.x + 'px'; canvas.style.height = size.y + 'px'; L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0])); const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size.x, size.y); if (!polys) return; ctx.beginPath(); for (const p of polys) { p.forEach((ll, i) => { const pt = map.latLngToContainerPoint(ll); i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y); }); ctx.closePath(); } ctx.fillStyle = 'rgba(30,35,75,0.42)'; ctx.fill('nonzero'); };
    map.on('moveend zoomend resize viewreset', draw);
    const [t0] = E.dayWindow(year, 3, 20, tz);
    const times = [['09:00', 9], ['13:00', 13], ['17:00', 17]];
    const btns = $('timeBtns');
    const show = h => { const t = t0 + h * 36e5, p = E.sunPosition(t, lat, lon); polys = p.alt > 0.1 * RAD ? E.shadowShapes(model, p.alt, p.az, 300).map(poly => poly.map(q => toLL(q[0], q[1]))) : null; draw(); $('mapCap').textContent = `Shadows at ${String(h).padStart(2, '0')}:00 on 20 March${p.alt > 0 ? `, sun ${Math.round(p.alt / RAD)}° high from the ${DIRS[E.compass(p.az / RAD)]}` : ' (sun below the horizon)'}. Highlighted building is the property; gold lines are its street-facing walls.`; };
    times.forEach(([l, h], i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'lg' + (i === 1 ? ' on' : ''); b.textContent = l; b.onclick = () => { btns.querySelectorAll('.lg').forEach(x => x.classList.remove('on')); b.classList.add('on'); show(h); }; btns.appendChild(b); });
    show(13);
    // re-measure once layout settles (fonts, print CSS, late images)
    setTimeout(() => { map.invalidateSize(); draw(); }, 60);
    window.addEventListener('resize', () => { map.invalidateSize(); draw(); });
    window.addEventListener('beforeprint', () => { map.invalidateSize(); draw(); });
  }
})();
