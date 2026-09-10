#!/usr/bin/env python3
"""Build the blog (HTML, Markdown copy, RSS), OG images, sitemap, llms.txt, llms-full.txt and robots.txt.
Run from the site root after editing blog/posts/*.md."""
import re, os, json, html, glob, datetime, markdown
from PIL import Image, ImageDraw, ImageFont

BASE = 'https://terrace-sun.netlify.app'
BRAND = 'Terrace Sun'
AUTHOR = {'@type': 'Person', 'name': 'Yanni Papoutsi', 'jobTitle': 'Founder', 'address': {'@type': 'PostalAddress', 'addressLocality': 'Rome', 'addressCountry': 'IT'}}
PUBLISHER = {'@type': 'Organization', 'name': BRAND, 'url': BASE + '/', 'logo': {'@type': 'ImageObject', 'url': BASE + '/og.png', 'width': 1200, 'height': 630}}

DATA = json.load(open('data/sun-hours-cities.json'))
CITY = {c['slug']: c for c in DATA['cities']}
DAYK = ['spring', 'summer', 'autumn', 'winter']
ORI = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
ORI_NAME = {'N': 'North', 'NE': 'North-east', 'E': 'East', 'SE': 'South-east', 'S': 'South', 'SW': 'South-west', 'W': 'West', 'NW': 'North-west'}
def day(c, k): return next(d for d in c['days'] if d['key'] == k)
def num(v):
    if isinstance(v, float): return ('%.1f' % v).rstrip('0').rstrip('.') if abs(v - round(v)) < 1e-9 else '%.1f' % v
    return str(v)
def resolve(path):
    parts = path.split('.'); c = CITY[parts[0]]
    if parts[1] in DAYK:
        cur = day(c, parts[1]); rest = parts[2:]
    else:
        cur = c; rest = parts[1:]
    for r in rest:
        cur = cur[int(r)] if isinstance(cur, list) else cur[r]
    return num(cur)
def t_basics(c):
    rows = ['| | 20 March | 21 June | 22 September | 21 December |', '|---|---|---|---|---|']
    ds = [day(c, k) for k in DAYK]
    rows.append('| Daylight (hours) | ' + ' | '.join(num(d['daylight_h']) for d in ds) + ' |')
    rows.append('| Sunrise / sunset | ' + ' | '.join(f"{d['sunrise']} / {d['sunset']}" for d in ds) + ' |')
    rows.append('| Solar noon | ' + ' | '.join(d['solar_noon'] for d in ds) + ' |')
    rows.append('| Sun height at noon | ' + ' | '.join(num(d['noon_altitude_deg']) + '°' for d in ds) + ' |')
    rows.append('| Sunrise / sunset direction | ' + ' | '.join(f"{d['sunrise_azimuth_deg']}° / {d['sunset_azimuth_deg']}°" for d in ds) + ' |')
    return '\n'.join(rows) + f"\n\nLocal time ({c['tz']}). Directions clockwise from north: 90° east, 180° south, 270° west."
def t_solstices():
    rows = ['| City | Latitude | 21 Dec daylight | 21 Dec noon sun | 21 Jun daylight | 21 Jun noon sun |', '|---|---|---|---|---|---|']
    for c in DATA['cities']:
        w, su = day(c, 'winter'), day(c, 'summer')
        rows.append(f"| [{c['name']}](/sun-hours/{c['slug']}/) | {c['lat']:.1f}° N | {num(w['daylight_h'])} h | {num(w['noon_altitude_deg'])}° | {num(su['daylight_h'])} h | {num(su['noon_altitude_deg'])}° |")
    return '\n'.join(rows)
def t_orientation(c):
    rows = ['| Window faces | 20 March | 21 June | 22 September | 21 December |', '|---|---|---|---|---|']
    for o in ORI:
        rows.append(f"| {ORI_NAME[o]} | " + ' | '.join(num(day(c, k)['orientation_h'][o]) + ' h' for k in DAYK) + ' |')
    return '\n'.join(rows)
def t_canyon(c, fac, k):
    d = day(c, k); widths = ['8', '12', '20', '30']
    rows = ['| Floor | ' + ' | '.join(f'{w} m street' for w in widths) + ' |', '|---|' + '---|' * len(widths)]
    names = ['Ground', '1st', '2nd', '3rd', '4th', '5th']
    for f in range(6):
        rows.append(f"| {names[f]} | " + ' | '.join(num(d['canyon_h'][fac][w][f]) + ' h' for w in widths) + ' |')
    return '\n'.join(rows)
def t_minfloor(cities=None):
    rows = ['| City | 8 m street | 12 m street | 20 m street | 30 m street |', '|---|---|---|---|---|']
    names = ['ground', '1st', '2nd', '3rd', '4th', '5th', '6th']
    for c in (cities or DATA['cities']):
        m = day(c, 'winter')['min_floor_for_noon_sun_S']
        rows.append(f"| [{c['name']}](/sun-hours/{c['slug']}/) | " + ' | '.join(names[m[w]] if m[w] < 6 else 'above 5th' for w in ['8', '12', '20', '30']) + ' |')
    return '\n'.join(rows)
def expand(md):
    md = re.sub(r'\{\{v:([A-Za-z0-9_.]+)\}\}', lambda m: resolve(m.group(1)), md)
    def tab(m):
        a = m.group(1).split(':')
        if a[0] == 'basics': return t_basics(CITY[a[1]])
        if a[0] == 'cities_solstices': return t_solstices()
        if a[0] == 'orientation': return t_orientation(CITY[a[1]])
        if a[0] == 'canyon': return t_canyon(CITY[a[1]], a[2], a[3])
        if a[0] == 'min_floor': return t_minfloor()
        raise ValueError(a)
    return re.sub(r'\{\{table:([a-z_:A-Z]+)\}\}', tab, md)

def front(md):
    m = re.match(r'---\n(.*?)\n---\n', md, re.S)
    meta = {}
    for line in m.group(1).splitlines():
        k, v = line.split(':', 1); meta[k.strip()] = v.strip()
    return meta, md[m.end():]

def font(sz, bold=True):
    p = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    return ImageFont.truetype(p, sz)

def og_image(title, path):
    W, H = 1200, 630
    im = Image.new('RGB', (W, H), '#fbf7f0'); d = ImageDraw.Draw(im)
    d.rectangle([0, 520, W, H], fill='#2b2118')
    d.ellipse([930, 70, 1110, 250], fill='#f0a202')
    for i, (h, lab) in enumerate([(0.62, 'G'), (0.72, '2'), (0.85, '4'), (0.95, '5')]):
        x = 880 + i * 70; d.rectangle([x, 470 - int(200 * h), x + 50, 470], fill='#c2562b' if i == 3 else '#d6ccbf')
    words, lines, cur = title.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font(54)) > 780: lines.append(cur); cur = w
        else: cur = t
    lines.append(cur)
    y = 90
    for ln in lines[:5]:
        d.text((70, y), ln, font=font(54), fill='#2b2118'); y += 68
    d.text((70, 548), BRAND + ' blog', font=font(34), fill='#fde6b0')
    d.text((700, 556), 'terrace-sun.netlify.app', font=font(26, False), fill='#fde6b0')
    im.save(path, optimize=True)

HEAD = '''<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta name="author" content="Yanni Papoutsi">
<meta property="og:type" content="{ogtype}">
<meta property="og:site_name" content="Terrace Sun">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
{extra}
<link rel="alternate" type="application/rss+xml" title="Terrace Sun blog" href="/blog/feed.xml">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='26' fill='%23f0a202'/></svg>">
<link rel="stylesheet" href="/style.css">
<link rel="stylesheet" href="/blog.css">
<script type="application/ld+json">
{ld}
</script>
</head>
<body class="blog">
<header class="top"><div class="wrap titlerow"><a class="brandlink" href="/"><span class="sun" aria-hidden="true"></span>Terrace Sun</a>
<nav class="topnav" aria-label="Main"><a href="/">Check a spot</a><a href="/listings/" data-track="nav_listings">For estate agents</a><a href="/sun-hours/">Sun hours by city</a><a href="/blog/">Blog</a><a href="/rome-sunny-cafes/">Rome cafés</a></nav></div></header>
'''
FOOT = '''<footer class="wrap foot muted"><p>Terrace Sun · <a href="/">Check any spot</a> · <a href="/listings/">For estate agents</a> · <a href="/blog/">Blog</a> · <a href="/blog/feed.xml">RSS</a> · <a href="/llms.txt">llms.txt</a> · Building data © <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap contributors</a> (ODbL). No cookies; anonymous visit counts only.</p></footer>
<script src="/t.js" defer></script>
</body>
</html>
'''

def render_post(path):
    raw = open(path, encoding='utf-8').read()
    meta, body = front(raw)
    body = expand(body)
    slug = meta['slug']; url = f'{BASE}/blog/{slug}/'
    # special blocks
    body_html_src = re.sub(r':::(tldr|facts)\n(.*?)\n:::', lambda m: f'<div class="{m.group(1)}" markdown="1">\n\n{m.group(2)}\n\n</div>', body, flags=re.S)
    md = markdown.Markdown(extensions=['tables', 'fenced_code', 'toc', 'md_in_html', 'attr_list', 'sane_lists'])
    content = md.convert(body_html_src)
    toc = [(t['id'], t['name']) for t in md.toc_tokens]
    content = content.replace('<table>', '<div class="tablewrap"><table>').replace('</table>', '</table></div>')
    content = re.sub(r'<a href="(https?://[^"]+)"', lambda m: f'<a href="{m.group(1)}" rel="noopener"', content)
    # FAQ for JSON-LD
    faq = []
    fsec = re.search(r'## Frequently asked questions\n(.*?)\n## ', body, re.S)
    if fsec:
        for q, a in re.findall(r'### (.+?)\n\n(.+?)(?=\n\n### |\Z)', fsec.group(1).strip() + '\n', re.S):
            faq.append({'@type': 'Question', 'name': q.strip(), 'acceptedAnswer': {'@type': 'Answer', 'text': re.sub(r'\[(.*?)\]\(.*?\)', r'\1', a.strip())}})
    cites = [{'@type': 'CreativeWork', 'name': re.sub(r'\[.*?\]\(.*?\)|\*|·', '', c).strip(' .'), 'url': re.findall(r'\((https?://[^)]+)\)', c)[0]} for c in re.findall(r'^\d+\. (.+)$', body.split('## Sources')[1], re.M) if re.findall(r'\((https?://[^)]+)\)', c)]
    words = len(re.sub(r'<[^>]+>', ' ', content).split())
    mins = max(1, round(words / 220))
    img = f'{BASE}/blog/{slug}/og.png'
    ld = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'BlogPosting', '@id': url + '#article', 'headline': meta['title'], 'description': meta['description'], 'url': url, 'mainEntityOfPage': url,
         'datePublished': meta['date'], 'dateModified': meta['updated'], 'inLanguage': 'en-GB', 'author': AUTHOR, 'publisher': PUBLISHER,
         'image': {'@type': 'ImageObject', 'url': img, 'width': 1200, 'height': 630}, 'wordCount': words, 'keywords': meta['keywords'],
         'about': [{'@type': 'Thing', 'name': 'Sun exposure'}, {'@type': 'Thing', 'name': 'Real estate listings'}], 'citation': cites,
         'isPartOf': {'@type': 'Blog', '@id': BASE + '/blog/#blog', 'name': 'Terrace Sun blog'}},
        {'@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Terrace Sun', 'item': BASE + '/'},
            {'@type': 'ListItem', 'position': 2, 'name': 'Blog', 'item': BASE + '/blog/'},
            {'@type': 'ListItem', 'position': 3, 'name': meta['title'], 'item': url}]},
        {'@type': 'FAQPage', 'mainEntity': faq},
        {'@type': 'WebAPI', 'name': 'Terrace Sun sun exposure API', 'documentation': BASE + '/openapi.json', 'provider': PUBLISHER, 'url': BASE + '/listings/#api'}
    ]}
    d = datetime.date.fromisoformat(meta['date'])
    related = '<aside class="card related"><h2>Related</h2><ul>' + ''.join(f'<li><a href="/blog/{k}/">{html.escape(v["title"])}</a></li>' for k, v in POST_META.items() if k != slug) + '<li><a href="/sun-hours/">Sun hours by city: orientation, floor and street tables for 12 cities</a></li><li><a href="/listings/">Sun Score for property listings</a></li></ul></aside>'
    crumb = html.escape(meta.get('crumb', meta['title'].split(':')[0].split('?')[0]))
    tochtml = '<nav class="toc" aria-label="Contents"><strong>Contents</strong><ol>' + ''.join(f'<li><a href="#{i}">{html.escape(n)}</a></li>' for i, n in toc if n not in ()) + '</ol></nav>'
    # insert TOC after the facts box
    content = content.replace('</div>\n<h2', '</div>\n' + tochtml + '\n<h2', 1) if '<div class="facts">' in content else tochtml + content
    page = HEAD.format(title=html.escape(meta.get('seo_title', meta['title'])), desc=html.escape(meta['description']), url=url, img=img, ogtype='article',
                       extra=f'<meta property="article:published_time" content="{meta["date"]}">\n<meta property="article:modified_time" content="{meta["updated"]}">\n<meta property="article:author" content="Yanni Papoutsi">\n<link rel="alternate" type="text/markdown" href="/blog/{slug}/index.md">',
                       ld=json.dumps(ld, ensure_ascii=False, indent=1))
    page += f'''<main class="wrap post">
<nav class="crumbs small muted" aria-label="Breadcrumb"><a href="/">Terrace Sun</a> › <a href="/blog/">Blog</a> › <span>{crumb}</span></nav>
<article>
<h1>{html.escape(meta["title"])}</h1>
<p class="byline muted">By <strong>Yanni Papoutsi</strong>, Rome · Published <time datetime="{meta["date"]}">{d.strftime("%-d %B %Y")}</time> · Updated <time datetime="{meta["updated"]}">{datetime.date.fromisoformat(meta["updated"]).strftime("%-d %B %Y")}</time> · {mins} min read</p>
{content}
<aside class="cta card"><h2>Put a Sun Score on your next listing</h2><p>Free for 5 reports a month. One line of code, one link, or the API.</p><p class="ctas"><a class="btn" href="/listings/#signup" data-track="blog_cta_start">Start free</a> <a class="btn ghostbtn" href="/report/?lat=41.8799368&lon=12.4768852&floor=5&floors=6&name=Piazza%20Testaccio%2C%20top%20floor" data-track="blog_cta_report">See the sample report</a></p></aside>
{related}
<aside class="authorbox small"><strong>About the author.</strong> Yanni Papoutsi is a founder and author based in Rome, building data tools for property and short-term rentals. Terrace Sun started as a way to find the sunniest café terraces in Testaccio. <a href="/about/">About Terrace Sun</a>.</aside>
</article>
</main>
''' + FOOT
    os.makedirs(f'blog/{slug}', exist_ok=True)
    open(f'blog/{slug}/index.html', 'w', encoding='utf-8').write(page)
    md_copy = f'# {meta["title"]}\n\n> {meta["description"]}\n\nBy Yanni Papoutsi, Rome. Published {meta["date"]}, updated {meta["updated"]}. Canonical: {url}\n\n' + re.sub(r':::(tldr|facts)\n(.*?)\n:::', r'\2', body, flags=re.S).replace('](/', f']({BASE}/')
    open(f'blog/{slug}/index.md', 'w', encoding='utf-8').write(md_copy)
    og_image(meta['title'], f'blog/{slug}/og.png')
    return {**meta, 'url': url, 'mins': mins, 'md': md_copy, 'img': img}

POST_META = {}
for _p in glob.glob('blog/posts/*.md'):
    _m, _ = front(open(_p, encoding='utf-8').read()); POST_META[_m['slug']] = _m
posts = sorted([render_post(p) for p in glob.glob('blog/posts/*.md')], key=lambda p: p['date'], reverse=True)


# ---------- sun hours by city ----------
FLOORN = ['ground', '1st', '2nd', '3rd', '4th', '5th', '6th']
def md_to_html(md_src):
    md_src = re.sub(r':::(tldr|facts)\n(.*?)\n:::', lambda m: f'<div class="{m.group(1)}" markdown="1">\n\n{m.group(2)}\n\n</div>', md_src, flags=re.S)
    mdx = markdown.Markdown(extensions=['tables', 'fenced_code', 'toc', 'md_in_html', 'attr_list', 'sane_lists'])
    h = mdx.convert(md_src).replace('<table>', '<div class="tablewrap"><table>').replace('</table>', '</table></div>')
    h = re.sub(r'<a href="(https?://[^"]+)"', lambda m: f'<a href="{m.group(1)}" rel="noopener"', h)
    return h, mdx
def page_shell(title, seo_title, desc, url, ld, body_html, crumbs, img=BASE + '/og.png', ogtype='article'):
    out = HEAD.format(title=html.escape(seo_title), desc=html.escape(desc), url=url, img=img, ogtype=ogtype, extra='', ld=json.dumps(ld, ensure_ascii=False, indent=1))
    crumb_html = ' › '.join(f'<a href="{u}">{html.escape(n)}</a>' if u else f'<span>{html.escape(n)}</span>' for n, u in crumbs)
    return out + f'<main class="wrap post"><nav class="crumbs small muted" aria-label="Breadcrumb">{crumb_html}</nav><article>{body_html}</article></main>' + FOOT
def crumbs_ld(crumbs):
    return {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': BASE + (u or '')} for i, (n, u) in enumerate(crumbs) if u is not None or i == len(crumbs) - 1]}
city_pages = []
for c in DATA['cities']:
    sl, name = c['slug'], c['name']
    w, su, sp = day(c, 'winter'), day(c, 'summer'), day(c, 'spring')
    mf = w['min_floor_for_noon_sun_S']
    S12 = w['canyon_h']['S']['12']; S20 = w['canyon_h']['S']['20']
    top_note = (f"In summer the strongest sun in {name} arrives on west-facing windows in the afternoon, so shading matters as much as sun." if c['lat'] < 45
                else f"Winter sun is scarce in {name}: on 21 December the day lasts {num(w['daylight_h'])} hours and the sun never climbs above {num(w['noon_altitude_deg'])}°, so floor and street width decide whether a flat sees any.")
    faq = [
        (f"How many hours of sun does a south-facing flat get in {name}?", f"With nothing in front, a south-facing window in {name} can see the sun for {num(w['orientation_h']['S'])} hours on 21 December and {num(su['orientation_h']['S'])} hours on 21 June. On a 12 m street lined with 18 m buildings, the ground floor gets {num(S12[0])} hours on 21 December and the 5th floor {num(S12[5])} hours."),
        (f"Which floor gets winter sun in {name}?", f"For a south-facing window opposite 18 m buildings, midday sun on 21 December starts at the {FLOORN[mf['8']] if mf['8'] < 6 else 'top'} floor on an 8 m street, the {FLOORN[mf['12']] if mf['12'] < 6 else 'top'} floor on a 12 m street, the {FLOORN[mf['20']]} floor on a 20 m street and the {FLOORN[mf['30']]} floor on a 30 m street."),
        (f"Does a north-facing flat in {name} get any direct sun?", f"Only in the warmer half of the year: {num(su['orientation_h']['N'])} hours on 21 June with a clear view, early in the morning and in the evening, and none between the September and March equinoxes."),
        (f"When is the sun lowest in {name}?", f"On 21 December the sun rises at {w['sunrise']} and sets at {w['sunset']} local time, and reaches {num(w['noon_altitude_deg'])}° above the horizon at {w['solar_noon']}.")]
    others = ' · '.join(f'[{o["name"]}](/sun-hours/{o["slug"]}/)' for o in DATA['cities'] if o['slug'] != sl)
    md_src = f"""# Sun hours for homes in {name}: orientation, floor and season

:::tldr
**In short.** In {name} ({c['lat']:.1f}° N) the sun climbs to **{num(w['noon_altitude_deg'])}°** at noon on 21 December and **{num(su['noon_altitude_deg'])}°** on 21 June. A south-facing window with a clear view can see the sun for **{num(w['orientation_h']['S'])} hours** on the shortest day; a north-facing window gets **none** from the September to the March equinox and **{num(su['orientation_h']['N'])} hours** on 21 June. On a 12 m street lined with 18 m buildings, a south-facing flat gets midday sun in December only from the **{FLOORN[mf['12']] if mf['12'] < 6 else 'top'} floor** up.
:::

## Sun basics in {name}

{t_basics(c)}

## Hours of sun by window orientation

Hours when the sun is above the horizon and in front of the window, with no obstructions: the most a window facing that way can receive.

{t_orientation(c)}

## Hours of sun by floor on a typical street, 21 December

A long straight street lined with continuous 18 m buildings (five to six storeys), window 1.5 m above each floor.

**South-facing façade**

{t_canyon(c, 'S', 'winter')}

**East- or west-facing façade**

{t_canyon(c, 'E', 'winter')}

**Lowest floor with midday sun on 21 December (south-facing)**

{t_minfloor([c])}

## Hours of sun by floor on the equinox, 20 March

**South-facing façade**

{t_canyon(c, 'S', 'spring')}

Around the equinoxes the sun's angle across an east-west street stays almost constant all day, so a south-facing window tends to get sun for most of the day or not at all: the jump between floors is real, not a rounding artefact.

## What this means for homes in {name}

- **For winter sun, south-facing and high beats everything.** A clear south-facing window sees the sun for {num(w['orientation_h']['S'])} of the {num(w['daylight_h'])} daylight hours on 21 December; east or west sees {num(w['orientation_h']['E'])}.
- **On narrow streets, low floors lose the winter sun.** On a 20 m street the south-facing floors get {', '.join(f"{FLOORN[i]} {num(v)} h" for i, v in enumerate(S20))} on 21 December.
- **Summer is generous to every orientation**, including north ({num(su['orientation_h']['N'])} h with a clear view on 21 June).
- {top_note}

Every building is different: a square, a park or a tall neighbour changes the numbers. [Check a specific address in {name}](/?lat={c['lat']}&lon={c['lon']}&name={name.replace(' ', '%20')}) for the hours on each side of the building, floor by floor, or get a [Sun Score report for a listing](/listings/).

## Frequently asked questions

""" + '\n\n'.join(f'### {q}\n\n{a}' for q, a in faq) + f"""

## Method and data

Solar position from the Meeus model used by SunCalc, with refraction, in local time ({c['tz']}), reference days in 2026. Street tables use the Terrace Sun ray-casting engine against a 2 km row of 18 m buildings. Direct sun on a clear day; trees, terrain and clouds are not included. Full explanation in [How much sun does a home get? The complete guide](/blog/how-much-sun-does-a-home-get/). Download the data for all cities: [by orientation (CSV)](/data/sun-hours-by-orientation.csv) · [by floor and street (CSV)](/data/sun-hours-by-floor-and-street.csv).

**Other cities:** {others}
"""
    body_html, mdx = md_to_html(md_src)
    url = f'{BASE}/sun-hours/{sl}/'
    crumbs = [('Terrace Sun', '/'), ('Sun hours by city', '/sun-hours/'), (name, None)]
    title = f'Sun hours for homes in {name}: orientation, floor and season'
    seo_title = f'{name} sun hours by orientation and floor'
    desc = f'How many hours of direct sun does a flat in {name} get? Tables by window orientation, floor and street width for every season, from solar geometry.'
    ld = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'Article', 'headline': title, 'description': desc, 'url': url, 'mainEntityOfPage': url, 'datePublished': DATA['generated'], 'dateModified': DATA['generated'], 'inLanguage': 'en-GB', 'author': AUTHOR, 'publisher': PUBLISHER, 'image': BASE + '/og.png',
         'about': {'@type': 'Place', 'name': f"{name}, {c['country']}", 'geo': {'@type': 'GeoCoordinates', 'latitude': c['lat'], 'longitude': c['lon']}},
         'isBasedOn': {'@type': 'Dataset', 'name': 'Terrace Sun sun hours by city, orientation and floor', 'url': BASE + '/data/sun-hours-cities.json'}},
        {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': 1, 'name': 'Terrace Sun', 'item': BASE + '/'}, {'@type': 'ListItem', 'position': 2, 'name': 'Sun hours by city', 'item': BASE + '/sun-hours/'}, {'@type': 'ListItem', 'position': 3, 'name': name, 'item': url}]},
        {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faq]}]}
    os.makedirs(f'sun-hours/{sl}', exist_ok=True)
    open(f'sun-hours/{sl}/index.html', 'w', encoding='utf-8').write(page_shell(title, seo_title, desc, url, ld, body_html, crumbs))
    city_pages.append((sl, name, c, md_src))

# hub
hub_rows = ['| City | 21 Dec daylight | Noon sun 21 Dec | South-facing, clear view, 21 Dec | Midday winter sun on a 12 m street from |', '|---|---|---|---|---|']
for sl, name, c, _ in city_pages:
    w = day(c, 'winter'); m = w['min_floor_for_noon_sun_S']['12']
    hub_rows.append(f"| [{name}](/sun-hours/{sl}/) | {num(w['daylight_h'])} h | {num(w['noon_altitude_deg'])}° | {num(w['orientation_h']['S'])} h | {FLOORN[m] if m < 6 else 'above 5th'} floor |")
hub_md = """# Sun hours by city: orientation, floor and street

:::tldr
**How much direct sun does a home get in your city?** These pages give the hours of sun by window orientation, by floor on a typical street, and for every season, for 12 European cities. They are calculated from solar geometry and the same shadow engine behind the Terrace Sun tool. For one specific address, [check the building](/).
:::

""" + '\n'.join(hub_rows) + """

South-facing window opposite a continuous row of 18 m buildings; floors counted from the ground floor, 3 m each. The [complete guide](/blog/how-much-sun-does-a-home-get/) explains the method and what the numbers mean. Data: [CSV by orientation](/data/sun-hours-by-orientation.csv) · [CSV by floor and street](/data/sun-hours-by-floor-and-street.csv) · [JSON](/data/sun-hours-cities.json).
"""
hub_html, _ = md_to_html(hub_md)
hub_ld = {'@context': 'https://schema.org', '@graph': [
    {'@type': 'CollectionPage', 'name': 'Sun hours by city', 'url': BASE + '/sun-hours/', 'inLanguage': 'en-GB', 'publisher': PUBLISHER, 'hasPart': [{'@type': 'Article', 'name': f'Sun hours for homes in {n}', 'url': f'{BASE}/sun-hours/{sl}/'} for sl, n, _, _ in city_pages]},
    {'@type': 'Dataset', 'name': 'Sun hours by city, window orientation, floor and street width', 'description': 'Hours of direct sun for 12 European cities on 20 March, 21 June, 22 September and 21 December 2026: daylight, noon sun height, sunrise and sunset direction, unobstructed hours for eight window orientations, and hours by floor for south- and east/west-facing facades across 8, 12, 20 and 30 m streets lined with 18 m buildings.',
     'url': BASE + '/sun-hours/', 'creator': PUBLISHER, 'license': 'https://creativecommons.org/licenses/by/4.0/', 'isAccessibleForFree': True, 'keywords': ['sun hours', 'orientation', 'sunlight', 'real estate', 'urban canyon'],
     'spatialCoverage': [{'@type': 'Place', 'name': n, 'geo': {'@type': 'GeoCoordinates', 'latitude': c['lat'], 'longitude': c['lon']}} for _, n, c, _ in city_pages], 'temporalCoverage': '2026',
     'distribution': [{'@type': 'DataDownload', 'encodingFormat': 'text/csv', 'contentUrl': BASE + '/data/sun-hours-by-orientation.csv'}, {'@type': 'DataDownload', 'encodingFormat': 'text/csv', 'contentUrl': BASE + '/data/sun-hours-by-floor-and-street.csv'}, {'@type': 'DataDownload', 'encodingFormat': 'application/json', 'contentUrl': BASE + '/data/sun-hours-cities.json'}]}]}
os.makedirs('sun-hours', exist_ok=True)
open('sun-hours/index.html', 'w', encoding='utf-8').write(page_shell('Sun hours by city', 'Sun hours by city: orientation, floor and street', 'Hours of direct sun by window orientation, floor and street width for Rome, Milan, Madrid, Barcelona, Lisbon, Paris, London, Berlin and more, for every season.', BASE + '/sun-hours/', hub_ld, hub_html, [('Terrace Sun', '/'), ('Sun hours by city', None)], ogtype='website'))

# about
about_md = """# About Terrace Sun

Terrace Sun calculates how much direct sun reaches a place: a café terrace, the windows of a flat on a given floor, a roof, a wedding spot or a bench. It started in Rome, as a way to find the sunniest café tables in Testaccio, and grew into a tool for buyers, estate agents, portals and AI assistants.

## Who is behind it

Terrace Sun is built by **Yanni Papoutsi**, a founder and author based in Rome who works on data tools for property and short-term rentals.

## How the numbers are made

- **Buildings:** footprints and heights from OpenStreetMap within 250 m of the location. Where a height is missing, a typical local height is assumed and the result says so.
- **Sun position:** the standard Meeus model used by SunCalc, with atmospheric refraction.
- **Shadows:** 2.5D ray casting every 5 or 10 minutes from sunrise to sunset, at street level, at table height, or 1.5 m above each floor on each street-facing wall.
- **Checked against:** the open-source cityshade model; floor-by-floor wall hours on a real Rome building matched to within 0.1 hour.
- **Not included:** trees, awnings, balconies above, terrain and clouds.

## Guides and data

- [How much sun does a home get? The complete guide](/blog/how-much-sun-does-a-home-get/)
- [Sun exposure in property listings](/blog/sun-exposure-property-listings/)
- [Sun hours by city](/sun-hours/) and the [open data](/data/sun-hours-cities.json)
- [API and OpenAPI specification](/openapi.json)

## Contact

Use the [key request form](/listings/#signup) for API keys, partnerships and corrections.
"""
about_html, _ = md_to_html(about_md)
about_ld = {'@context': 'https://schema.org', '@graph': [{'@type': 'AboutPage', 'name': 'About Terrace Sun', 'url': BASE + '/about/', 'publisher': PUBLISHER}, {**AUTHOR, 'url': BASE + '/about/', 'worksFor': {'@type': 'Organization', 'name': BRAND, 'url': BASE + '/'}}]}
os.makedirs('about', exist_ok=True)
open('about/index.html', 'w', encoding='utf-8').write(page_shell('About Terrace Sun', 'About Terrace Sun: method, data and author', 'Who builds Terrace Sun, how sun exposure is calculated from OpenStreetMap buildings, what is checked and what is not included.', BASE + '/about/', about_ld, about_html, [('Terrace Sun', '/'), ('About', None)], ogtype='website'))

# blog index
ld = {'@context': 'https://schema.org', '@type': 'Blog', '@id': BASE + '/blog/#blog', 'name': 'Terrace Sun blog', 'url': BASE + '/blog/', 'inLanguage': 'en-GB', 'publisher': PUBLISHER,
      'blogPost': [{'@type': 'BlogPosting', 'headline': p['title'], 'url': p['url'], 'datePublished': p['date'], 'author': AUTHOR} for p in posts]}
idx = HEAD.format(title='Terrace Sun blog: sun exposure, light and property data', desc='Guides on measuring sun exposure and natural light for homes, listings, cafés and cities, with data and code.', url=BASE + '/blog/', img=BASE + '/og.png', ogtype='website', extra='', ld=json.dumps(ld, ensure_ascii=False, indent=1))
idx += '<main class="wrap post"><h1>Blog</h1><p class="lede">Guides on measuring sun exposure and natural light, for estate agents, portals, developers and AI assistants.</p><ul class="postlist">' + ''.join(
    f'<li class="card"><a class="postlink" href="/blog/{p["slug"]}/"><h2>{html.escape(p["title"])}</h2></a><p>{html.escape(p["description"])}</p><p class="small muted"><time datetime="{p["date"]}">{datetime.date.fromisoformat(p["date"]).strftime("%-d %B %Y")}</time> · {p["mins"]} min read</p></li>' for p in posts) + '</ul></main>' + FOOT
open('blog/index.html', 'w', encoding='utf-8').write(idx)

# RSS
def rfc822(d): return datetime.datetime.fromisoformat(d + 'T08:00:00+00:00').strftime('%a, %d %b %Y %H:%M:%S +0000')
rss = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n<title>Terrace Sun blog</title>\n<link>' + BASE + '/blog/</link>\n<atom:link href="' + BASE + '/blog/feed.xml" rel="self" type="application/rss+xml"/>\n<description>Sun exposure and natural light data for property, cafés and cities.</description>\n<language>en-gb</language>\n' + ''.join(
    f'<item><title>{html.escape(p["title"])}</title><link>{p["url"]}</link><guid isPermaLink="true">{p["url"]}</guid><pubDate>{rfc822(p["date"])}</pubDate><description>{html.escape(p["description"])}</description></item>\n' for p in posts) + '</channel>\n</rss>\n'
open('blog/feed.xml', 'w', encoding='utf-8').write(rss)

# sitemap
pages = [('/', '2026-09-10'), ('/listings/', '2026-09-10'), ('/blog/', max(p['updated'] for p in posts))] + [(f'/blog/{p["slug"]}/', p['updated']) for p in posts] + [('/sun-hours/', DATA['generated'])] + [(f'/sun-hours/{sl}/', DATA['generated']) for sl, _, _, _ in city_pages] + [('/rome-sunny-cafes/', '2026-09-10'), ('/about/', '2026-09-10')]
open('sitemap.xml', 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{BASE}{u}</loc><lastmod>{d}</lastmod></url>\n' for u, d in pages) + '</urlset>\n')

# llms.txt (llmstxt.org format)
llms = f'''# Terrace Sun

> Terrace Sun calculates hours of direct sunlight for any address from OpenStreetMap building footprints and heights: per street-facing wall, per floor, per season. It publishes a 0-100 Sun Score (grades A to E) for property listings, a branded sun-exposure report, a one-line listing badge and a JSON API. It also checks sun on café terraces, roofs and event spots.

Figures are direct-beam sun on a clear day over flat ground, sampled every 10 minutes (5 in the interactive tool); trees, awnings and terrain are not modelled. Sun Score = share of daylight hours with direct sun on the sunniest street-facing wall at the given floor, averaged over 20 March, 21 June, 22 September and 21 December; A >= 70, B >= 55, C >= 40, D >= 25, E < 25.

## Docs
- [Sun exposure in property listings: how to measure it, show it and sell it]({BASE}/blog/sun-exposure-property-listings/index.md): method, Sun Score definition, worked example in Rome, listing copy, API fields, tool definition for AI assistants, limits, sources
- [OpenAPI specification]({BASE}/openapi.json): GET /api/v1/sun?lat&lon&floor&floors&height&name&year&key
- [Product, pricing and API reference]({BASE}/listings/): Free (5 reports a month), Agent EUR 19/month, Agency EUR 79/month, Portal API EUR 390/month, single report EUR 9

- [How much sun does a home get? The complete guide]({BASE}/blog/how-much-sun-does-a-home-get/index.md): hours of sun by orientation, floor, street width and season for 12 cities; profile angle rule; EN 17037, BRE BR 209, DIN 5034-1 and Italian DM 1975; buyer checklist; glossary; FAQ
- [Sun hours by city]({BASE}/sun-hours/): Rome, Milan, Florence, Naples, Madrid, Barcelona, Lisbon, Athens, Paris, London, Amsterdam, Berlin
- [Open data (JSON)]({BASE}/data/sun-hours-cities.json), [CSV by orientation]({BASE}/data/sun-hours-by-orientation.csv), [CSV by floor and street]({BASE}/data/sun-hours-by-floor-and-street.csv)

## Tools
- [Sun exposure API]({BASE}/api/v1/sun?lat=41.8799368&lon=12.4768852&floor=5&floors=6&key=demo): JSON; key "demo" works for testing
- [Report page]({BASE}/report/?lat=41.8799368&lon=12.4768852&floor=5&floors=6&name=Example): /report/?lat&lon&floor&floors&name&agency&logo&agent
- [Interactive tool]({BASE}/): café terraces, hotel rooms, holiday rentals, roofs for solar, wedding spots, public spaces (?mode=cafe|hotel|host|solar|wedding|city&lat&lon&date)
- [Listing badge]({BASE}/embed.js): <script async src="{BASE}/embed.js" data-lat data-lon data-floor data-floors data-name data-agency></script>

## Optional
- [Sunniest cafés in Testaccio, San Saba and Garbatella, Rome]({BASE}/rome-sunny-cafes/): ranked by morning, midday and afternoon sun
- [Blog]({BASE}/blog/)
- [Full text for LLMs]({BASE}/llms-full.txt)
'''
open('llms.txt', 'w').write(llms)
open('llms-full.txt', 'w').write(llms + '\n\n---\n\n' + '\n\n---\n\n'.join(p['md'] for p in posts))

# robots.txt
robots = f'''# Terrace Sun. Search engines and AI assistants are welcome.
User-agent: *
Allow: /
Disallow: /api/
Disallow: /stats/
Disallow: /.netlify/

# User-initiated AI fetchers may call the API on a user's behalf
User-agent: ChatGPT-User
User-agent: Claude-User
User-agent: Perplexity-User
User-agent: MistralAI-User
Allow: /

# AI search and training crawlers
User-agent: OAI-SearchBot
User-agent: GPTBot
User-agent: Claude-SearchBot
User-agent: ClaudeBot
User-agent: PerplexityBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: Amazonbot
User-agent: CCBot
User-agent: meta-externalagent
Allow: /
Disallow: /api/
Disallow: /stats/

Content-Signal: search=yes, ai-input=yes, ai-train=yes

Sitemap: {BASE}/sitemap.xml
'''
open('robots.txt', 'w').write(robots)
print('built', [p['slug'] for p in posts])
