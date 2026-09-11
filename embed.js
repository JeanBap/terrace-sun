/* Terrace Sun badge. One line on any listing page:
   <script async src="https://terrace-sun.netlify.app/embed.js" data-lat="41.8772" data-lon="12.4736" data-floor="2" data-floors="5" data-name="Via Volta 3" data-agency="Your Agency" data-pk="ts_pk_live_..."></script>
   The badge computes in the visitor's browser from OpenStreetMap buildings (no server round-trip needed), caches the
   result for 7 days, and links to the branded report. */
(function () {
  var s = document.currentScript; if (!s) return;
  var d = s.dataset, base = 'https://terrace-sun.netlify.app';
  var pk = d.pk || (/^ts_pk_/.test(d.key || '') ? d.key : ''); // publishable key only; never put a secret key in a page
  var lat = parseFloat(d.lat), lon = parseFloat(d.lon), floor = parseInt(d.floor || '0', 10) || 0, floors = d.floors ? parseInt(d.floors, 10) : null;
  var q = 'lat=' + lat + '&lon=' + lon + '&floor=' + floor + (floors ? '&floors=' + floors : '') + (d.name ? '&name=' + encodeURIComponent(d.name) : '');
  var reportUrl = base + '/report/?' + q + (d.agency ? '&agency=' + encodeURIComponent(d.agency) : '') + (d.logo ? '&logo=' + encodeURIComponent(d.logo) : '') + (d.agent ? '&agent=' + encodeURIComponent(d.agent) : '') + (pk ? '&pk=' + encodeURIComponent(pk) : '');
  var a = document.createElement('a'); a.href = reportUrl; a.target = '_blank'; a.rel = 'noopener';
  a.style.cssText = 'display:inline-flex;align-items:center;gap:8px;font:600 14px/1.2 system-ui,sans-serif;color:#1f1a15;text-decoration:none;border:1px solid #e8dfd2;border-radius:10px;padding:8px 12px;background:#fff';
  a.innerHTML = '<span style="width:14px;height:14px;border-radius:50%;background:#f0a202;box-shadow:0 0 0 3px #fde6b0"></span><span>Sun Score</span><span data-ts="v" style="color:#6e6255;font-weight:500">checking…</span>';
  s.parentNode.insertBefore(a, s.nextSibling);
  try { if (navigator.sendBeacon) navigator.sendBeacon(base + '/api/t', new Blob([JSON.stringify({ k: 'badge', h: location.hostname, p: location.pathname, x: d.agency || '' })], { type: 'text/plain' })); } catch (e) { }
  var col = { A: '#2e7d32', B: '#7cb342', C: '#f0a202', D: '#ef6c00', E: '#8d6e63' }, v = a.querySelector('[data-ts=v]');
  function show(r) { v.innerHTML = '<b style="display:inline-block;min-width:22px;text-align:center;color:#fff;border-radius:6px;padding:1px 6px;background:' + (col[r.grade] || '#888') + '">' + r.grade + '</b> ' + r.score + '/100 · ' + r.hours + ' h/day'; }
  function fail() { v.textContent = 'see report'; }
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return fail();
  var ck = 'ts:' + lat.toFixed(5) + ':' + lon.toFixed(5) + ':' + floor + ':' + (floors || '');
  try { var c = JSON.parse(localStorage.getItem(ck) || 'null'); if (c && Date.now() - c.t < 7 * 864e5) return show(c); } catch (e) { }
  // 1) fast path: cached server answer
  fetch(base + '/api/v1/sun?' + q + (pk ? '&pk=' + encodeURIComponent(pk) : '')).then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (j) {
    if (!j || j.error) throw 0;
    var r = { grade: j.grade, score: j.sun_score, hours: j.annual_avg_direct_sun_hours, t: Date.now() }; show(r); try { localStorage.setItem(ck, JSON.stringify(r)); } catch (e) { }
  }).catch(function () {
    // 2) compute in the browser: load the engine and OpenStreetMap buildings directly
    var load = function (src) { return new Promise(function (res, rej) { var t = document.createElement('script'); t.src = src; t.onload = res; t.onerror = rej; document.head.appendChild(t); }); };
    Promise.all([load(base + '/engine.js'), load(base + '/vendor/tz.js')]).then(function () {
      var E = window.SunEngine, a250 = '(around:250,' + lat.toFixed(6) + ',' + lon.toFixed(6) + ')';
      var qq = '[out:json][timeout:25];(way["building"]' + a250 + ';relation["building"]' + a250 + ';way["building:part"]' + a250 + ';way["highway"]["name"](around:90,' + lat.toFixed(6) + ',' + lon.toFixed(6) + '););out geom;';
      var mirrors = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
      var i = 0;
      (function next() {
        if (i >= mirrors.length) return fail();
        var ac = new AbortController(), tm = setTimeout(function () { ac.abort(); }, 30000);
        fetch(mirrors[i++], { method: 'POST', body: 'data=' + encodeURIComponent(qq), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ac.signal }).then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (j) {
          clearTimeout(tm);
          var model = E.parseOSM(j, lat, lon), tz = window.tzlookup ? tzlookup(lat, lon) : 'UTC';
          var rep = E.propertyReport(model, lat, lon, tz, { floor: floor, floors: floors, stepMin: 15 });
          var r = { grade: rep.grade, score: rep.score, hours: rep.annual_avg_hours, t: Date.now() }; show(r); try { localStorage.setItem(ck, JSON.stringify(r)); } catch (e) { }
        }).catch(function () { clearTimeout(tm); next(); });
      })();
    }).catch(fail);
  });
})();
