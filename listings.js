(function () {
  var P = new URLSearchParams(location.search), $ = function (id) { return document.getElementById(id); };
  if (P.get('sent') === '1') { var m = $('sentMsg'); if (m) m.hidden = false; }
  var msgs = { cancelled: 'Checkout cancelled. No payment was taken.', error: 'Checkout could not start. Please try again in a minute, or send the form below.', soon: 'Online payment is being switched on right now. Send the form and we will reply with a payment link.' };
  var c = P.get('checkout'), el = c && msgs[c] && $(c === 'soon' ? 'soonMsg' : 'checkoutMsg');
  if (el) { el.textContent = msgs[c]; el.hidden = false; }
  document.querySelectorAll('[data-plan]').forEach(function (a) { a.addEventListener('click', function () { var s = $('f-plan'); if (s && a.dataset.plan !== 'free') s.value = a.dataset.plan; }); });
  var btns = document.querySelectorAll('.billtoggle button');
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      var iv = b.dataset.interval;
      btns.forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      document.querySelectorAll('#pricing input[name=interval]').forEach(function (i) { if (i.form.querySelector('[name=plan]').value !== 'portal') i.value = iv; });
      document.querySelectorAll('#pricing [data-month]').forEach(function (e) { e.innerHTML = e.getAttribute('data-' + iv); });
      if (window.tsTrack) window.tsTrack('billing_toggle', iv);
    });
  });
})();
