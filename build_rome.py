#!/usr/bin/env python3
import json, html, urllib.parse
BASE='https://terrace-sun.netlify.app'
V=json.load(open('../rome/ranked_clean.json'))
Q=['Testaccio','San Saba','Garbatella']
W=[('morning','Morning, 08:00 to 11:00',3),('midday','Midday, 11:00 to 15:00',4),('afternoon','Afternoon, 15:00 to sunset',5)]
KIND={'cafe':'café','bar':'bar','ice_cream':'gelateria'}
def link(v): return f'/?lat={v["lat"]:.6f}&lon={v["lon"]:.6f}&name={urllib.parse.quote(v["name"])}'
def maps(v): return f'https://www.google.com/maps?q={v["lat"]:.6f},{v["lon"]:.6f}'
def table(rows,w,season):
    out=['<table class="rank"><thead><tr><th>#</th><th>Place</th><th>Sun in window</th><th>Sun times (Sep)</th><th>Whole day</th></tr></thead><tbody>']
    for i,v in enumerate(rows,1):
        out.append(f'<tr><td>{i}</td><td><a href="{link(v)}">{html.escape(v["name"])}</a><div class="muted small">{KIND[v["kind"]]}{" · "+html.escape(v["street"]) if v["street"] else ""}{" · outdoor seating" if v["seating"]=="yes" else ""} · <a href="{maps(v)}" rel="noopener">map</a></div></td><td class="hrs">{v[season+"_"+w]:.1f} h</td><td class="small">{html.escape(v["sep_runs"] or "none")}</td><td class="hrs muted">{v[season+"_total"]:.1f} h</td></tr>')
    out.append('</tbody></table>'); return '\n'.join(out)
sections=[]
for q in Q:
    vs=[v for v in V if v['q']==q]
    sec=[f'<section class="card quarter" id="{q.lower().replace(" ","-")}"><h2>{q} <span class="tag">{len(vs)} places checked</span></h2>']
    for w,label,cap in W:
        rows=sorted(vs,key=lambda v:(-v['sep_'+w],-v['sep_total']))[:8]
        rows=[r for r in rows if r['sep_'+w]>0]
        sec.append(f'<h3>{label}</h3>'+table(rows,w,'sep'))
    # winter pick
    win=sorted(vs,key=lambda v:-v['dec_total'])[:5]
    sec.append('<h3>Best in winter (21 December, whole day)</h3><p>'+', '.join(f'<a href="{link(v)}">{html.escape(v["name"])}</a> ({v["dec_total"]:.1f} h)' for v in win)+'</p>')
    sec.append('</section>'); sections.append('\n'.join(sec))
n=len(V)
VJSON=json.dumps([{'name':v['name'],'kind':KIND[v['kind']],'street':v['street'],'lat':round(v['lat'],6),'lon':round(v['lon'],6),'morning':v['sep_morning'],'midday':v['sep_midday'],'afternoon':v['sep_afternoon'],'runs':v['sep_runs']} for v in V],ensure_ascii=False).replace('</','<\\/')
page=f'''<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sunniest cafés in Testaccio, San Saba and Garbatella, by time of day</title>
<meta name="description" content="Ranked list of the cafés, bars and gelaterie in Testaccio, San Saba and Garbatella (Rome) whose outdoor tables get the most direct sun in the morning, at midday and in the afternoon, computed from building shadows.">
<link rel="canonical" href="{BASE}/rome-sunny-cafes/">
<meta property="og:type" content="article"><meta property="og:title" content="Sunniest cafés in Testaccio, San Saba and Garbatella"><meta property="og:description" content="Where to sit in the sun in Rome's southern rioni, morning, midday and afternoon. Computed from building shadows, not guessed."><meta property="og:url" content="{BASE}/rome-sunny-cafes/"><meta property="og:image" content="{BASE}/og.png"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='26' fill='%23f0a202'/></svg>">
<link rel="stylesheet" href="/vendor/leaflet.css">
<link rel="stylesheet" href="/style.css">
<script type="application/ld+json">
{json.dumps({"@context":"https://schema.org","@type":"Article","headline":"Sunniest cafés in Testaccio, San Saba and Garbatella, by time of day","datePublished":"2026-09-10","dateModified":"2026-09-10","author":{"@type":"Person","name":"Yanni Papoutsi"},"publisher":{"@type":"Organization","name":"Terrace Sun","url":BASE+"/"},"mainEntityOfPage":BASE+"/rome-sunny-cafes/","about":[{"@type":"Place","name":q+", Rome"} for q in Q]},ensure_ascii=False)}
</script>
</head>
<body>
<nav class="subnav wrap" aria-label="Uses"><a href="/">Cafés</a><a href="/hotels/">Hotels</a><a href="/hosts/">Holiday rentals</a><a href="/solar/">Solar</a><a href="/weddings/">Weddings</a><a href="/cities/">Cities</a><a href="/rome-sunny-cafes/" aria-current="page">Sunny cafés in Rome</a></nav>
<header class="top"><div class="wrap">
<h1><span class="sun" aria-hidden="true"></span>Sunniest cafés in Testaccio, San Saba and Garbatella</h1>
<p class="lede">Where to sit outside in the sun, morning, midday or afternoon. Every café, bar and gelateria on OpenStreetMap in the three quarters ({n} places) was checked against the shadows of the surrounding buildings, every 10 minutes, for a September day. Click a name to see its sun times on any date.</p>
<p class="muted small">Jump to: <a href="#testaccio">Testaccio</a> · <a href="#san-saba">San Saba</a> · <a href="#garbatella">Garbatella</a> · <a href="#method">method and limits</a></p>
</div></header>
<main class="wrap">
<section class="card mapcard">
<div class="legend" role="group" aria-label="Time period">
  <button type="button" class="lg on" data-w="best"><span class="sw" style="background:linear-gradient(90deg,#f0a202,#c2562b,#6a4c93)"></span>Best time of each café</button>
  <button type="button" class="lg" data-w="morning"><span class="sw" style="background:#f0a202"></span>Morning 8 to 11</button>
  <button type="button" class="lg" data-w="midday"><span class="sw" style="background:#c2562b"></span>Midday 11 to 15</button>
  <button type="button" class="lg" data-w="afternoon"><span class="sw" style="background:#6a4c93"></span>Afternoon 15 to sunset</button>
</div>
<div id="rmap" aria-label="Map of sunny cafés"></div>
<p class="note muted">Bigger dot, more sun in that period. Grey dots get under 1 h in the chosen period. Click a dot for the sun times and a link to the full check. September day, tables outside.</p>
</section>
<p class="answer">Short version. Morning sun: the east-facing side of Via Marmorata and Piazza Testaccio in Testaccio, Caffè il Dollaro, Bar Foschi and Santa Garba in Garbatella, Tram Depot in San Saba. Midday: almost any piazza-side table. Afternoon: Oasi della Birra and Il Seme e la Foglia in Testaccio, Verso and Bar Piramide in San Saba, al Ponte and Coffeebar da Roma in Garbatella.</p>
{''.join(sections)}
<section class="card" id="method"><h2>Method and limits</h2>
<p>Building footprints and heights come from OpenStreetMap. Where a building has no height tag (about 60% of built area here) it is assumed to be 18 m, typical of a Roman palazzina of five or six floors. For each place, a point on the pavement 2 m out from the entrance is tested for a clear line to the sun every 10 minutes on 20 September, 21 June and 21 December 2026. "Sun in window" is the number of those minutes, as hours, inside the time band.</p>
<p>Not included: trees (Via Marmorata and Piazza Testaccio have plane trees, so their summer numbers are optimistic), umbrellas and awnings, the Aventine and Monte Testaccio hills, clouds. Positions are the OpenStreetMap pin, which for a large bar may not be the terrace. The ranking is a good guide; the exact minute is not a promise. Data as of September 2026, ODbL.</p>
<p>Want this for another neighbourhood or city? The engine is open source. <a href="/">Check any spot</a> or write to <a href="mailto:papoutsis89@gmail.com">papoutsis89@gmail.com</a>.</p>
</section>
</main>
<footer class="wrap foot muted"><p>Map data © <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap contributors</a> (ODbL). Shadow method after cityshade (MIT). Direct sun only, clear sky, no trees. Written by Yanni Papoutsi, Rome. Updated 10 September 2026.</p></footer>
<script src="/vendor/leaflet.js"></script>
<script id="venues" type="application/json">{VJSON}</script>
<script>
(function(){{
  var V=JSON.parse(document.getElementById('venues').textContent);
  var COL={{morning:'#f0a202',midday:'#c2562b',afternoon:'#6a4c93'}},LAB={{morning:'morning',midday:'midday',afternoon:'afternoon'}},CAP={{morning:3,midday:4,afternoon:4.5}};
  var map=L.map('rmap',{{scrollWheelZoom:false}}).setView([41.871,12.482],14);
  L.tileLayer('https://tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png',{{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}}).addTo(map);
  var layer=L.layerGroup().addTo(map);
  function best(v){{var b='morning',m=-1;['morning','midday','afternoon'].forEach(function(w){{var x=v[w]/CAP[w];if(x>m){{m=x;b=w;}}}});return b;}}
  function draw(mode){{
    layer.clearLayers();
    V.forEach(function(v){{
      var w=mode==='best'?best(v):mode,h=v[w],frac=Math.min(1,h/CAP[w]);
      var grey=h<1,r=grey?4:4+frac*9;
      var m=L.circleMarker([v.lat,v.lon],{{radius:r,color:'#2b2118',weight:1,fillColor:grey?'#b8b0a6':COL[w],fillOpacity:grey?.6:.9}});
      m.bindPopup('<strong>'+v.name+'</strong><br>'+v.kind+(v.street?' · '+v.street:'')+'<br>Morning '+v.morning+' h · Midday '+v.midday+' h · Afternoon '+v.afternoon+' h<br>Sun: '+(v.runs||'none')+'<br><a href="/?lat='+v.lat+'&lon='+v.lon+'&name='+encodeURIComponent(v.name)+'">Check any date</a>');
      m.addTo(layer); if(!grey) m.bringToFront();
    }});
  }}
  draw('best'); map.fitBounds(V.map(function(v){{return [v.lat,v.lon];}}),{{padding:[20,20]}});
  document.querySelectorAll('.lg').forEach(function(b){{b.addEventListener('click',function(){{document.querySelectorAll('.lg').forEach(function(x){{x.classList.remove('on');}});b.classList.add('on');draw(b.dataset.w);}});}});
}})();
</script>
</body>
</html>'''
import os; os.makedirs('rome-sunny-cafes',exist_ok=True); open('rome-sunny-cafes/index.html','w',encoding='utf-8').write(page); print('ok',n)
