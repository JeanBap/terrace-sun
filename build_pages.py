#!/usr/bin/env python3
"""Generate the vertical landing pages from index.html. Run after editing index.html."""
import re, json, html, os
BASE='https://terrace-sun.netlify.app'
src=open('index.html',encoding='utf-8').read()

PAGES={
 'hotels':dict(mode='hotel',title='Sunny rooms and terraces for hotels and B&Bs',
  desc='See which rooms, balconies and terraces of a hotel get morning or evening sun, floor by floor, on any date. Free, from OpenStreetMap buildings.',
  h1='Terrace Sun for hotels',
  lede='Which rooms get the morning sun? Is the roof terrace still lit at aperitivo time? Type the hotel name or address, then pick the floor.',
  ph='Hotel Santa Maria, Rome  or  address',
  how=['Search the hotel and click its building on the map.','Read the sun times for each street-facing wall: that is the light through the windows on that side.','Open "Apartment or house", pick a floor, and copy the sentence into the room description.','Use 21 June and 21 December to describe summer and winter honestly.'],
  faq=[('How do I price rooms by sun?','Rooms on a wall with 6 h or more of direct sun in winter are the ones guests remember. Name them ("the morning-sun room"), photograph them at the lit time shown here, and price the difference.'),
       ('What about the breakfast terrace?','Click the terrace itself, not the building. The "Tables" row gives the sun times at table height. Check it for the breakfast window on 21 December, the worst case.')]),
 'hosts':dict(mode='host',title='Show the sunny balcony in your short-term rental listing',
  desc='Prove to guests when the balcony, terrace or living room of your holiday rental gets direct sun. Floor-aware, any date, free.',
  h1='Terrace Sun for holiday rentals',
  lede='"Sunny balcony" is a claim. "Sun on the balcony from 10:30 to 17:40" is a fact guests can plan around. Type the address and pick your floor.',
  ph='Via Marmorata 25, Roma  or  41.8757, 12.4757',
  how=['Search the address and click the building.','Pick the floor of the flat under "Apartment or house".','Click "Copy listing text" and paste it into the listing description.','Take the balcony photo at the lit time the page shows.'],
  faq=[('Which date should I quote?','Quote the season guests book. For a summer rental use 21 June; for a year-round listing give both 21 June and 21 December.'),
       ('Does the site know my floor?','No, you tell it. If the building height is estimated, set "Floors in building" so the floor maths is right.')]),
 'solar':dict(mode='solar',title='Roof and balcony solar shading pre-check',
  desc='Before a site visit, check how many hours a roof or balcony is unshaded by neighbouring buildings, month by month. Free, from OpenStreetMap.',
  h1='Terrace Sun for solar installers',
  lede='Rank leads before you drive out. Type the address: you get roof shading by month and balcony shading per wall and floor.',
  ph='Address of the roof',
  how=['Search the address and click the roof.','Read "Roof and balcony solar check": unshaded share of daylight by month.','For balcony PV, pick the floor and read the wall that gets the most sun.','Move on to PVGIS or your yield tool for kWh: this is a shading and orientation check only.'],
  faq=[('Is this a yield estimate?','No. It counts direct-beam hours with a clear sky and flat ground. It tells you whether neighbours shade the roof and when, which is the part a desk check usually gets wrong.'),
       ('Roof pitch and orientation?','Not modelled: the roof is treated as flat at the building height. Use the wall directions on the page to see which way the building faces.')]),
 'weddings':dict(mode='wedding',title='Sun and shade at your ceremony spot, by the hour',
  desc='Check whether guests will be in sun or shade during the ceremony or reception, where the sun comes from, and when golden hour is. Any venue, any date.',
  h1='Terrace Sun for weddings and events',
  lede='Will the guests squint at 17:00? Where will the sun be behind the couple? Type the venue, set the date, click the exact spot.',
  ph='Venue name or address',
  how=['Search the venue, then click the exact spot for the ceremony or the tables.','Set the event date.','Enter start and end time in "Event time check".','Use the map slider to see the shadows move during the event and find the photo spot for golden hour.'],
  faq=[('Which way should the ceremony face?','Away from the sun direction given on the page, so guests are not looking into it. Photographers usually want the sun behind or to the side of the couple.'),
       ('Does it include trees, tents or umbrellas?','No. Only buildings. In a garden venue the trees will add shade the page does not show.')]),
 'cities':dict(mode='city',title='Shade for bus stops, benches, playgrounds and cool routes',
  desc='Check direct sun and shade on any public spot by time of day and season. For municipalities, planners and heat-resilience teams.',
  h1='Terrace Sun for cities and planners',
  lede='Where is a bench in shade at 14:00 in July? Which side of the street is the cool route? Click any spot, any date.',
  ph='Piazza Testaccio, Roma  or  coordinates',
  how=['Click the bus stop, bench or playground on the map.','Set the date: 21 July for heat, 21 January for winter comfort.','Read the sun times at the pin and play the shadow slider.','Compare candidate spots by clicking them one after the other.'],
  faq=[('Can I run this for a whole district?','The page does one spot at a time. The same engine (open source, MIT) runs as a batch script for thousands of points; see the GitHub repo.'),
       ('What does it not model?','Trees, canopies, hills and heat itself. It gives direct-beam sun, which is the main driver of surface temperature in a street.')]),
}

def page(key,p):
    s=src
    s=s.replace('<body>',f'<body data-mode="{p["mode"]}">')
    s=re.sub(r'<title>.*?</title>',f'<title>{html.escape(p["title"])}</title>',s)
    s=re.sub(r'<meta name="description" content=".*?">',f'<meta name="description" content="{html.escape(p["desc"])}">',s)
    s=s.replace(f'<link rel="canonical" href="{BASE}/">',f'<link rel="canonical" href="{BASE}/{key}/">')
    s=re.sub(r'<meta property="og:title" content=".*?">',f'<meta property="og:title" content="{html.escape(p["title"])}">',s)
    s=re.sub(r'<meta property="og:description" content=".*?">',f'<meta property="og:description" content="{html.escape(p["desc"])}">',s)
    s=s.replace(f'<meta property="og:url" content="{BASE}/">',f'<meta property="og:url" content="{BASE}/{key}/">')
    s=re.sub(r'<h1>(.*?)Terrace Sun</h1>',lambda m:f'<h1>{m.group(1)}{html.escape(p["h1"])}</h1>',s)
    s=re.sub(r'<p class="lede">.*?</p>',f'<p class="lede">{html.escape(p["lede"])}</p>',s,flags=re.S)
    s=re.sub(r'placeholder=".*?"',f'placeholder="{html.escape(p["ph"])}"',s)
    how='\n'.join(f'        <li>{html.escape(x)}</li>' for x in p['how'])
    s=re.sub(r'<ol>.*?</ol>',f'<ol>\n{how}\n      </ol>',s,flags=re.S)
    s=re.sub(r'<p class="muted">Try: .*?</p>','<p class="muted">Or use the <a href="/">general café and terrace tool</a>.</p>',s,flags=re.S)
    faq='\n'.join(f'  <details><summary>{html.escape(q)}</summary><p>{html.escape(a)}</p></details>' for q,a in p['faq'])
    s=re.sub(r'(<section class="wrap faq">\s*<h2>Questions</h2>)',r'\1\n'+faq,s)
    ld={"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":p["title"],"url":f"{BASE}/{key}/","description":p["desc"],"isPartOf":{"@type":"WebSite","name":"Terrace Sun","url":BASE+"/"}},{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in p['faq']]}]}
    s=re.sub(r'<script type="application/ld\+json">.*?</script>','<script type="application/ld+json">\n'+json.dumps(ld,ensure_ascii=False)+'\n</script>',s,flags=re.S)
    os.makedirs(key,exist_ok=True); open(f'{key}/index.html','w',encoding='utf-8').write(s)

for k,p in PAGES.items(): page(k,p)

# nav on every page incl. index
NAV='<nav class="subnav wrap" aria-label="Uses"><a href="/">Cafés</a><a href="/hotels/">Hotels</a><a href="/hosts/">Holiday rentals</a><a href="/solar/">Solar</a><a href="/weddings/">Weddings</a><a href="/cities/">Cities</a><a href="/rome-sunny-cafes/">Sunny cafés in Rome</a></nav>'
for f in ['index.html']+[f'{k}/index.html' for k in PAGES]:
    t=open(f,encoding='utf-8').read()
    if 'class="subnav' not in t: t=t.replace('<header class="top">',NAV+'\n<header class="top">',1)
    open(f,'w',encoding='utf-8').write(t)

# sitemap
urls=[BASE+'/']+[f'{BASE}/{k}/' for k in PAGES]+[BASE+'/rome-sunny-cafes/']
open('sitemap.xml','w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+'\n'.join(f'  <url><loc>{u}</loc><lastmod>2026-09-10</lastmod></url>' for u in urls)+'\n</urlset>\n')
print('built',list(PAGES))
