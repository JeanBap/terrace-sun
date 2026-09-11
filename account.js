(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var P = new URLSearchParams(location.search), sid = P.get('session_id'), sk = null, base = 'https://terrace-sun.netlify.app';
  function msg(t, err) { var m = $('msg'); m.textContent = t || ''; m.classList.toggle('err', !!err); }
  function call(body) {
    var headers = { 'Content-Type': 'application/json' };
    if (sk) headers.Authorization = 'Bearer ' + sk; else if (sid) body.session_id = sid;
    return fetch('/api/account', { method: 'POST', headers: headers, body: JSON.stringify(body) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.message || 'Something went wrong.'); e.code = j.error; throw e; } return j; });
    });
  }
  function load(action, tries) {
    tries = tries || 0;
    msg(action === 'rotate' ? 'Rotating your key…' : 'Loading your account…');
    call(action ? { action: action } : {}).then(function (j) { msg(''); render(j); }).catch(function (e) {
      if (e.code === 'not_complete' && tries < 15) { msg('Confirming your payment…'); return setTimeout(function () { load(action, tries + 1); }, 2000); }
      msg(e.message, true);
      if (e.code !== 'billing_not_configured') $('signin').hidden = false;
    });
  }
  function fmtDate(s) { return new Date(s * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function render(j) {
    $('signin').hidden = true;
    if (window.tsTrack) window.tsTrack('account_view', j.kind === 'single' ? 'single' : j.plan || '');
    if (j.kind === 'single') {
      $('single').hidden = false;
      if (!j.paid) { $('singleText').textContent = 'Your payment is still being confirmed by your bank. Refresh this page in a minute.'; $('singleLink').hidden = true; return; }
      $('singleText').textContent = 'Paid. ' + (j.name ? j.name + ': t' : 'T') + 'his report now carries your branding instead of ours.';
      $('singleLink').href = j.report_url; $('singleUrl').textContent = j.report_url;
      return;
    }
    $('acct').hidden = false;
    if (j.secret_key) { $('newKey').hidden = false; $('skVal').textContent = j.secret_key; if (sk) sk = j.secret_key; }
    var status = { active: 'Active', trialing: 'Trial', past_due: 'Payment failed, Stripe is retrying', canceled: 'Cancelled', unpaid: 'Unpaid', incomplete: 'Waiting for payment', incomplete_expired: 'Payment expired', paused: 'Paused' }[j.status] || j.status || '';
    $('planName').textContent = (j.plan_name || 'No plan') + (j.mode === 'test' ? ' (test mode)' : '');
    var renew = j.period_end ? (j.cancel_at_period_end ? 'ends ' : 'renews ') + fmtDate(j.period_end) : '';
    $('planMeta').textContent = [status, j.interval === 'year' ? 'billed yearly' : j.interval === 'month' ? 'billed monthly' : '', renew, j.email].filter(Boolean).join(' · ');
    var w = $('planWarn');
    w.hidden = j.active && j.status !== 'past_due';
    w.textContent = j.status === 'past_due' ? 'Your last payment failed. Update your card to keep the API running.' : 'This plan is not active, so the API answers 402 and reports show our branding. Restart it from Manage billing or choose a plan again.';
    var u = j.usage || {}, calls = u.calls || 0;
    $('used').textContent = calls.toLocaleString('en-GB');
    $('usedOf').textContent = u.metered ? 'of ' + u.included.toLocaleString('en-GB') + ' included' : 'of ' + (u.cap || 0).toLocaleString('en-GB');
    $('bar').style.width = Math.min(100, u.included ? calls / u.included * 100 : 0) + '%';
    var over = Math.max(0, calls - (u.included || 0));
    $('usageNote').textContent = u.metered ? (over ? over.toLocaleString('en-GB') + ' calls above the included 25,000 so far: about €' + (over * 0.02).toFixed(2) + ' on the next invoice.' : 'Calls above 25,000 cost €0.02 each, billed with the next invoice.') + ' Counter resets on the 1st (UTC).' : 'Above the limit the API answers 429 until the 1st of next month (UTC). Need more? Switch plan under Manage billing.';
    $('skMask').textContent = j.sk_last4 ? 'ts_sk_…' + j.sk_last4 : 'not issued yet';
    var pk = j.pk || 'YOUR_PUBLISHABLE_KEY';
    $('pkVal').textContent = pk;
    $('snBadge').textContent = '<script async src="' + base + '/embed.js"\n  data-lat="41.8773" data-lon="12.4736" data-floor="2" data-floors="5"\n  data-name="Via Volta 3" data-agency="Your Agency"\n  data-pk="' + pk + '"></script>';
    $('snLink').textContent = base + '/report/?lat=41.8773&lon=12.4736&floor=2&floors=5\n  &name=Via+Volta+3&agency=Your+Agency\n  &logo=https://youragency.com/logo.png&agent=Anna+Rossi+%2B39+06+000000\n  &pk=' + pk;
    $('snApi').textContent = 'curl -H "Authorization: Bearer YOUR_SECRET_KEY" \\\n  "' + base + '/api/v1/sun?lat=41.8773&lon=12.4736&floor=2&floors=5"';
  }
  $('signinForm').addEventListener('submit', function (e) { e.preventDefault(); sk = $('skIn').value.trim(); $('skIn').value = ''; load(); });
  $('portalBtn').addEventListener('click', function () {
    var b = this; b.disabled = true; msg('Opening Stripe billing…');
    call({ action: 'portal' }).then(function (j) { location.href = j.url; }).catch(function (e) { b.disabled = false; msg(e.message, true); });
  });
  var armed = false;
  $('rotateBtn').addEventListener('click', function () {
    if (!armed) { armed = true; this.textContent = 'Click again: the old key stops working'; return; }
    armed = false; this.textContent = 'Rotate'; load('rotate');
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-copy]'); if (!t) return;
    var text = $(t.getAttribute('data-copy')).textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { t.textContent = 'Copied'; setTimeout(function () { t.textContent = 'Copy'; }, 1500); }).catch(function () { msg('Select the text and copy it by hand.'); });
  });
  if (sid || sk) load(); else $('signin').hidden = false;
})();
