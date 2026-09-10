(function () {
  var P = new URLSearchParams(location.search);
  if (P.get('sent') === '1') { var m = document.getElementById('sentMsg'); if (m) m.hidden = false; }
  document.querySelectorAll('[data-plan]').forEach(function (a) { a.addEventListener('click', function () { var s = document.getElementById('f-plan'); if (s) s.value = a.dataset.plan === 'portal' ? 'portal' : a.dataset.plan; }); });
})();
