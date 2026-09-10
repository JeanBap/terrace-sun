#!/usr/bin/env python3
"""Build the blog (HTML, Markdown copy, RSS), OG images, sitemap, llms.txt, llms-full.txt and robots.txt.
Run from the site root after editing blog/posts/*.md."""
import re, os, json, html, glob, datetime, markdown
from PIL import Image, ImageDraw, ImageFont

BASE = 'https://terrace-sun.netlify.app'
BRAND = 'Terrace Sun'
AUTHOR = {'@type': 'Person', 'name': 'Yanni Papoutsi', 'jobTitle': 'Founder', 'address': {'@type': 'PostalAddress', 'addressLocality': 'Rome', 'addressCountry': 'IT'}}
PUBLISHER = {'@type': 'Organization', 'name': BRAND, 'url': BASE + '/', 'logo': {'@type': 'ImageObject', 'url': BASE + '/og.png', 'width': 1200, 'height': 630}}

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
<nav class="topnav" aria-label="Main"><a href="/">Check a spot</a><a href="/listings/" data-track="nav_listings">For estate agents</a><a href="/blog/">Blog</a><a href="/rome-sunny-cafes/">Rome cafés</a></nav></div></header>
'''
FOOT = '''<footer class="wrap foot muted"><p>Terrace Sun · <a href="/">Check any spot</a> · <a href="/listings/">For estate agents</a> · <a href="/blog/">Blog</a> · <a href="/blog/feed.xml">RSS</a> · <a href="/llms.txt">llms.txt</a> · Building data © <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap contributors</a> (ODbL). No cookies; anonymous visit counts only.</p></footer>
<script src="/t.js" defer></script>
</body>
</html>
'''

def render_post(path):
    raw = open(path, encoding='utf-8').read()
    meta, body = front(raw)
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
    tochtml = '<nav class="toc" aria-label="Contents"><strong>Contents</strong><ol>' + ''.join(f'<li><a href="#{i}">{html.escape(n)}</a></li>' for i, n in toc if n not in ()) + '</ol></nav>'
    # insert TOC after the facts box
    content = content.replace('</div>\n<h2', '</div>\n' + tochtml + '\n<h2', 1) if '<div class="facts">' in content else tochtml + content
    page = HEAD.format(title=html.escape(meta.get('seo_title', meta['title'])), desc=html.escape(meta['description']), url=url, img=img, ogtype='article',
                       extra=f'<meta property="article:published_time" content="{meta["date"]}">\n<meta property="article:modified_time" content="{meta["updated"]}">\n<meta property="article:author" content="Yanni Papoutsi">\n<link rel="alternate" type="text/markdown" href="/blog/{slug}/index.md">',
                       ld=json.dumps(ld, ensure_ascii=False, indent=1))
    page += f'''<main class="wrap post">
<nav class="crumbs small muted" aria-label="Breadcrumb"><a href="/">Terrace Sun</a> › <a href="/blog/">Blog</a> › <span>Sun exposure in listings</span></nav>
<article>
<h1>{html.escape(meta["title"])}</h1>
<p class="byline muted">By <strong>Yanni Papoutsi</strong>, Rome · Published <time datetime="{meta["date"]}">{d.strftime("%-d %B %Y")}</time> · Updated <time datetime="{meta["updated"]}">{datetime.date.fromisoformat(meta["updated"]).strftime("%-d %B %Y")}</time> · {mins} min read</p>
{content}
<aside class="cta card"><h2>Put a Sun Score on your next listing</h2><p>Free for 5 reports a month. One line of code, one link, or the API.</p><p class="ctas"><a class="btn" href="/listings/#signup" data-track="blog_cta_start">Start free</a> <a class="btn ghostbtn" href="/report/?lat=41.8799368&lon=12.4768852&floor=5&floors=6&name=Piazza%20Testaccio%2C%20top%20floor" data-track="blog_cta_report">See the sample report</a></p></aside>
<aside class="authorbox small"><strong>About the author.</strong> Yanni Papoutsi is a founder and author based in Rome, building data tools for property and short-term rentals. Terrace Sun started as a way to find the sunniest café terraces in Testaccio.</aside>
</article>
</main>
''' + FOOT
    os.makedirs(f'blog/{slug}', exist_ok=True)
    open(f'blog/{slug}/index.html', 'w', encoding='utf-8').write(page)
    md_copy = f'# {meta["title"]}\n\n> {meta["description"]}\n\nBy Yanni Papoutsi, Rome. Published {meta["date"]}, updated {meta["updated"]}. Canonical: {url}\n\n' + re.sub(r':::(tldr|facts)\n(.*?)\n:::', r'\2', body, flags=re.S).replace('](/', f']({BASE}/')
    open(f'blog/{slug}/index.md', 'w', encoding='utf-8').write(md_copy)
    og_image(meta['title'], f'blog/{slug}/og.png')
    return {**meta, 'url': url, 'mins': mins, 'md': md_copy, 'img': img}

posts = sorted([render_post(p) for p in glob.glob('blog/posts/*.md')], key=lambda p: p['date'], reverse=True)

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
pages = [('/', '2026-09-10'), ('/listings/', '2026-09-10'), ('/rome-sunny-cafes/', '2026-09-10'), ('/blog/', max(p['updated'] for p in posts))] + [(f'/blog/{p["slug"]}/', p['updated']) for p in posts]
open('sitemap.xml', 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{BASE}{u}</loc><lastmod>{d}</lastmod></url>\n' for u, d in pages) + '</urlset>\n')

# llms.txt (llmstxt.org format)
llms = f'''# Terrace Sun

> Terrace Sun calculates hours of direct sunlight for any address from OpenStreetMap building footprints and heights: per street-facing wall, per floor, per season. It publishes a 0-100 Sun Score (grades A to E) for property listings, a branded sun-exposure report, a one-line listing badge and a JSON API. It also checks sun on café terraces, roofs and event spots.

Figures are direct-beam sun on a clear day over flat ground, sampled every 10 minutes (5 in the interactive tool); trees, awnings and terrain are not modelled. Sun Score = share of daylight hours with direct sun on the sunniest street-facing wall at the given floor, averaged over 20 March, 21 June, 22 September and 21 December; A >= 70, B >= 55, C >= 40, D >= 25, E < 25.

## Docs
- [Sun exposure in property listings: how to measure it, show it and sell it]({BASE}/blog/sun-exposure-property-listings/index.md): method, Sun Score definition, worked example in Rome, listing copy, API fields, tool definition for AI assistants, limits, sources
- [OpenAPI specification]({BASE}/openapi.json): GET /api/v1/sun?lat&lon&floor&floors&height&name&year&key
- [Product, pricing and API reference]({BASE}/listings/): Free (5 reports a month), Agent EUR 19/month, Agency EUR 79/month, Portal API EUR 390/month, single report EUR 9

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
