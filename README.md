# Terrace Sun

Live: https://terrace-sun.netlify.app

Type a café name, address, coordinates or Google Maps link. The site loads buildings from OpenStreetMap and tells you when direct sun hits each street-facing wall, the terrace tables in front of it, and the windows of every floor. Includes a shadow map with a time slider, monthly totals and a ranking of the sunniest cafés nearby.

Static site, no server, no API keys. Deployed on Netlify.

## Files
- `index.html`, `style.css`, `app.js`: the page
- `engine.js`: solar position (Meeus/SunCalc) + 2.5D ray-cast shadow engine, verified against [cityshade](https://github.com/milanjanosov/cityshade) to about 5 minutes
- `vendor/`: Leaflet 1.9.4, tz-lookup
- `netlify.toml`: security headers and CSP

## Limits
Direct sun only, clear sky, flat ground, no trees or awnings. Untagged building heights are estimated and adjustable on the page.

## Licence
MIT. Map data © OpenStreetMap contributors (ODbL).
