/* Terrace Sun: cookieless, first-party visit counts. No cookies, no IP stored. Respects Do Not Track and Global Privacy Control. */
(function () {
  try {
    if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl) { window.tsTrack = function () { }; return; }
    var send = function (o) {
      o.p = location.pathname; var b = JSON.stringify(o);
      if (navigator.sendBeacon) navigator.sendBeacon('/api/t', new Blob([b], { type: 'text/plain' }));
      else fetch('/api/t', { method: 'POST', body: b, keepalive: true });
    };
    var q = new URLSearchParams(location.search);
    send({ k: 'pv', r: document.referrer, s: q.get('utm_source') || '', m: q.get('utm_medium') || '', c: q.get('utm_campaign') || '' });
    var seen = {};
    window.tsTrack = function (n, x) { var id = n + '|' + (x || ''); if (seen[id] && n !== 'check') return; seen[id] = 1; send({ k: 'ev', n: n, x: x || '' }); };
    document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('[data-track]'); if (a) window.tsTrack(a.getAttribute('data-track'), a.getAttribute('data-track-x') || ''); }, true);
    document.addEventListener('submit', function (e) { var f = e.target, nm = f && f.getAttribute('name'); if (nm) { var pl = f.querySelector('[name=plan]'); window.tsTrack('form_' + nm, pl ? pl.value : ''); } }, true);
  } catch (e) { }
})();
