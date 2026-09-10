(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Number(n).toLocaleString('en-GB');
  try { $('key').value = localStorage.getItem('ts_stats_key') || ''; } catch (e) { }
  $('auth').addEventListener('submit', e => { e.preventDefault(); load(); });
  $('days').addEventListener('change', () => { if ($('key').value) load(); });
  if ($('key').value) load();

  async function load() {
    const key = $('key').value.trim(); if (!key) return;
    $('msg').textContent = 'Loading…';
    try {
      const r = await fetch('/api/stats?days=' + $('days').value, { headers: { 'x-stats-key': key } });
      if (r.status === 401) { $('msg').textContent = 'Wrong key.'; return; }
      const d = await r.json();
      try { localStorage.setItem('ts_stats_key', key); } catch (e) { }
      $('msg').textContent = ''; render(d);
    } catch (e) { $('msg').textContent = 'Could not load stats: ' + e.message; }
  }

  function render(d) {
    $('out').hidden = false;
    $('gen').textContent = 'Updated ' + new Date(d.generated_at).toLocaleString('en-GB');
    const t = d.totals, crawl = d.series.reduce((s, r) => s + r.bot + r.disco, 0);
    const clicks = d.events.reduce((s, e) => s + e[1], 0);
    $('tiles').innerHTML = [['Pageviews', t.pv], ['Visitors (daily unique)', t.uv], ['From AI assistants', t.ai], ['From search engines', t.search], ['Crawler and AI fetches', crawl], ['API calls', t.api], ['Badge views', t.badge], ['Clicks and forms', clicks]]
      .map(([l, n]) => `<div class="tile"><div class="n">${fmt(n)}</div><div class="l">${l}</div></div>`).join('');
    columns('c-pv', d.series.map(r => [r.d, r.pv]), 'pageviews');
    columns('c-bot', d.series.map(r => [r.d, r.bot + r.disco]), 'fetches');
    $('t-pv').innerHTML = `<table class="ltab"><tbody>${d.series.slice().reverse().map(r => `<tr><td>${r.d}</td><td class="num">${fmt(r.pv)} views</td><td class="num">${fmt(r.uv)} visitors</td><td class="num">${fmt(r.bot + r.disco)} bot</td></tr>`).join('')}</tbody></table>`;
    const lists = [
      ['Top pages', d.pages, ['views', 'visitors']], ['AI assistants sending visitors', d.ai_referrals], ['Search engines', d.search_engines], ['All referrers', d.referrers],
      ['Campaigns (utm)', d.utm], ['Clicks and forms', d.events], ['Crawlers and AI agents', d.crawlers], ['What crawlers fetched', d.discovery_fetches],
      ['Bot page renders', d.crawler_pages], ['API calls (plan · status)', d.api_calls], ['API callers', d.api_callers], ['Badges on other sites', d.badges], ['Countries', d.countries], ['Devices', d.devices]
    ];
    $('lists').innerHTML = lists.map(([title, rows, cols]) => `<section class="card"><h2>${title}</h2>${table(rows, cols)}</section>`).join('');
  }

  function table(rows, cols) {
    if (!rows || !rows.length) return '<p class="empty">Nothing yet.</p>';
    const max = Math.max(...rows.map(r => r[1]), 1);
    return `<table class="ltab"><tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td><td class="b"><i style="width:${(r[1] / max * 100).toFixed(1)}%"></i></td><td class="num">${fmt(r[1])}</td>${cols && r.length > 2 ? `<td class="num muted">${fmt(r[2])}</td>` : ''}</tr>`).join('')}</tbody></table>`;
  }

  // Column chart: one series, baseline-anchored, 4px rounded top, 2px surface gap, hover tooltip.
  function columns(id, data, unit) {
    const el = $(id), W = el.clientWidth || 600, H = el.clientHeight || 190, padL = 30, padB = 20, padT = 8;
    const n = data.length, max = Math.max(1, ...data.map(x => x[1])), nice = Math.ceil(max / Math.pow(10, Math.floor(Math.log10(max)))) * Math.pow(10, Math.floor(Math.log10(max)));
    const slot = (W - padL) / n, bw = Math.max(2, Math.min(24, slot - 2)), ph = H - padB - padT;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${unit} per day"><line class="gl" x1="${padL}" x2="${W}" y1="${padT}" y2="${padT}"/><line class="gl" x1="${padL}" x2="${W}" y1="${H - padB}" y2="${H - padB}"/>`;
    s += `<text class="ax" x="${padL - 6}" y="${padT + 4}" text-anchor="end">${fmt(nice)}</text><text class="ax" x="${padL - 6}" y="${H - padB + 4}" text-anchor="end">0</text>`;
    data.forEach(([d, v], i) => {
      const x = padL + i * slot + (slot - bw) / 2, h = v ? Math.max(2, v / nice * ph) : 0, y = H - padB - h, r = Math.min(4, bw / 2, h);
      s += `<rect class="hit" x="${padL + i * slot}" y="${padT}" width="${slot}" height="${ph}" data-i="${i}"/>`;
      if (h) s += `<path class="bar" d="M${x},${H - padB} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${H - padB} Z"/>`;
      if (i === 0 || i === n - 1 || (n <= 14 && i % 2 === 0)) s += `<text class="ax" x="${x + bw / 2}" y="${H - 4}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${d.slice(5).replace('-', '/')}</text>`;
    });
    el.innerHTML = s + '</svg>';
    const tip = $('tip');
    el.querySelectorAll('.hit').forEach(h => {
      h.addEventListener('mousemove', ev => { const [d, v] = data[+h.dataset.i]; tip.hidden = false; tip.textContent = `${d}: ${fmt(v)} ${unit}`; tip.style.left = (ev.clientX + 12) + 'px'; tip.style.top = (ev.clientY - 28) + 'px'; });
      h.addEventListener('mouseleave', () => { tip.hidden = true; });
    });
  }
})();
