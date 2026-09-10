/* Terrace Sun badge. One line on any listing page:
   <script async src="https://terrace-sun.netlify.app/embed.js" data-lat="41.8772" data-lon="12.4736" data-floor="2" data-floors="5" data-name="Via Volta 3" data-agency="Your Agency" data-key="YOUR_KEY"></script> */
(function () {
  var s = document.currentScript; if (!s) return;
  var d = s.dataset, base = 'https://terrace-sun.netlify.app';
  var q = 'lat=' + encodeURIComponent(d.lat) + '&lon=' + encodeURIComponent(d.lon) + '&floor=' + encodeURIComponent(d.floor || 0) + (d.floors ? '&floors=' + encodeURIComponent(d.floors) : '') + (d.name ? '&name=' + encodeURIComponent(d.name) : '');
  var reportUrl = base + '/report/?' + q + (d.agency ? '&agency=' + encodeURIComponent(d.agency) : '') + (d.logo ? '&logo=' + encodeURIComponent(d.logo) : '');
  var a = document.createElement('a'); a.href = reportUrl; a.target = '_blank'; a.rel = 'noopener';
  a.style.cssText = 'display:inline-flex;align-items:center;gap:8px;font:600 14px/1.2 system-ui,sans-serif;color:#1f1a15;text-decoration:none;border:1px solid #e8dfd2;border-radius:10px;padding:8px 12px;background:#fff';
  a.innerHTML = '<span style="width:14px;height:14px;border-radius:50%;background:#f0a202;box-shadow:0 0 0 3px #fde6b0"></span><span>Sun Score</span><span data-ts="v" style="color:#6e6255;font-weight:500">checking…</span>';
  s.parentNode.insertBefore(a, s.nextSibling);
  var col = { A: '#2e7d32', B: '#7cb342', C: '#f0a202', D: '#ef6c00', E: '#8d6e63' };
  fetch(base + '/api/v1/sun?' + q + (d.key ? '&key=' + encodeURIComponent(d.key) : '')).then(function (r) { return r.json(); }).then(function (j) {
    var v = a.querySelector('[data-ts=v]');
    if (!j || j.error) { v.textContent = 'see report'; return; }
    v.innerHTML = '<b style="display:inline-block;min-width:22px;text-align:center;color:#fff;border-radius:6px;padding:1px 6px;background:' + (col[j.grade] || '#888') + '">' + j.grade + '</b> ' + j.sun_score + '/100 · ' + j.annual_avg_direct_sun_hours + ' h/day';
  }).catch(function () { a.querySelector('[data-ts=v]').textContent = 'see report'; });
})();
