---
title: How much sun does a home get? The complete guide to orientation, floor, street and season
seo_title: How much sun does a home get? Orientation, floor and season
slug: how-much-sun-does-a-home-get
description: Hours of direct sun by orientation, floor, street width and season in 12 European cities, the standards for enough sun, and how to check any home.
date: 2026-09-10
updated: 2026-09-10
author: Yanni Papoutsi
keywords: how many hours of sun does a south facing house get, which floor gets the most sun, north facing apartment sunlight, east or west facing flat, sun exposure by floor, winter sun hours apartment, EN 17037 sunlight exposure, BRE 209 sunlight, profile angle, esposizione solare, orientación vivienda, exposition plein sud, Besonnung
---

:::tldr
**The short answer.** Three things decide how much direct sun a home gets: the direction its windows face, how high the windows are compared with the buildings opposite, and the time of year. In Rome, a south-facing window with nothing in front of it can see the sun for **{{v:rome.winter.orientation_h.S}} hours on 21 December** and a north-facing one for **{{v:rome.winter.orientation_h.N}}**. Put that south-facing window on a 12 m street lined with 18 m buildings and it gets **{{v:rome.winter.canyon_h.S.12.0}} hours on the ground floor** but **{{v:rome.winter.canyon_h.S.12.5}} hours on the 5th floor**. Further north the effect is stronger: in London the same street gives midday winter sun only from floor {{v:london.winter.min_floor_for_noon_sun_S.12}} up. Winter is the honest test, and the floor often matters more than the compass.
:::

:::facts
- **{{v:rome.winter.noon_altitude_deg}}°** is the highest the sun gets over Rome on 21 December; in London it is **{{v:london.winter.noon_altitude_deg}}°**, in Athens **{{v:athens.winter.noon_altitude_deg}}°** (our calculation).
- **{{v:rome.summer.orientation_h.N}} hours**: the direct sun a north-facing window in Rome can see on 21 June, early morning and evening, and **0** from the September equinox to the March equinox.
- **2.4%, 7.2%, 16.2%**: price effects linked to sunlight in Wellington, Shanghai and Seoul ([sources](#sources)).
- **1.5 h, 3 h, 4 h**: minimum, medium and high sunlight exposure in EN 17037; **4 h** at the equinox in Germany's DIN 5034-1; **25% of annual probable sunlight hours** in the UK's BRE guide ([standards](#standards-and-rules-how-much-sun-is-enough)).
- **0.1 h**: the largest difference between our floor-by-floor wall calculation and the independent cityshade model on a real Rome building ([method](#data-method-and-quality-checks)).
:::

## The short answer, in three rules

1. **Orientation sets the maximum.** A window can only receive sun when the sun is in front of it. South-facing windows (north-facing in the southern hemisphere) see the most sun in winter; east and west see sun half the day; north-facing windows in Europe see direct sun only on summer mornings and evenings.
2. **Obstructions set what you actually get.** The building across the street removes the low sun first. Whether a window keeps its winter sun depends on the angle from the window to the top of the building opposite, compared with the height of the sun.
3. **Winter decides.** Summer sun is plentiful almost everywhere; the difference between a bright and a dim home shows up between November and February, when the sun is low and the days are short.

The rest of this guide puts numbers on each rule, city by city, and shows how to check a specific home.

## Why sunlight matters to buyers and renters

**It shows up in prices.** Three studies from very different markets point the same way:

| Study | Market | Finding |
|---|---|---|
| Fleming, Grimes, Lebreton, Maré and Nunns (2018) | 5,584 house sales, Wellington, New Zealand, 2008 to 2014 | Each extra hour of average daily direct sunlight added **2.4%** to market value |
| Zhong, Lu and Li (2022) | 40,000+ homes, Shanghai, 2019 to 2021 | Homeowners were willing to pay about **7.2%** more for south-facing flats with a high level of sunshine than for north-facing flats with no direct sun |
| Jung, Kim and Hong (2022) | Two 32-storey buildings in Seoul, one newly blocked by a tower | Sunlight and view together accounted for **16.2%** of the apartment price |

**It shows up in what people ask for.** In an AstraRicerche survey for Netrais reported by idealista in July 2025, 43.7% of Italians describing their ideal home named bright rooms.

**It is regulated.** European, British and German guidance all define how much sun a home should get, which is why architects and planners calculate it (see [standards](#standards-and-rules-how-much-sun-is-enough)).

## How the sun moves: the three numbers that decide everything

Everything about sun exposure follows from three numbers for a place and a date:

- **Daylight hours:** how long the sun is above the horizon.
- **Noon altitude:** how high the sun climbs at solar noon. It is roughly 90° minus the latitude, plus 23.4° at the June solstice and minus 23.4° at the December solstice.
- **Sunrise and sunset azimuth:** where on the horizon the sun rises and sets. Only at the equinoxes does it rise due east (90°) and set due west (270°). In winter it rises in the south-east; in summer it rises in the north-east and sets in the north-west.

**Rome ({{v:rome.lat}}° N)**

{{table:basics:rome}}

**Twelve European cities on the shortest and longest days**

{{table:cities_solstices}}

Two things stand out. First, the December sun is low everywhere: {{v:berlin.winter.noon_altitude_deg}}° in Berlin, {{v:rome.winter.noon_altitude_deg}}° in Rome. Low sun is blocked by almost anything, so obstructions matter far more in winter. Second, in June the sun rises and sets well to the north of the east-west line, which is why north-facing windows get some summer sun and south-facing façades lose sun at both ends of a summer day.

In the southern hemisphere everything mirrors: the sun passes to the north, so north-facing windows are the sunny ones.

## Orientation: hours of sun by the direction a window faces

These are the hours when the sun is above the horizon **and in front of the window**, with nothing in the way. It is the maximum a window facing that direction could ever receive on that day.

**Rome, no obstructions**

{{table:orientation:rome}}

**London, no obstructions**

{{table:orientation:london}}

What the tables say:

- **South is the winter champion.** In Rome a clear south-facing window can see the sun all {{v:rome.winter.orientation_h.S}} hours of 21 December; east and west see {{v:rome.winter.orientation_h.E}}.
- **South is not the summer champion.** On 21 June a south-facing window in Rome sees {{v:rome.summer.orientation_h.S}} hours, fewer than south-east or south-west ({{v:rome.summer.orientation_h.SE}}), because the sun spends the early morning and late evening behind the façade.
- **East and west are mirror images** in hours, but not in comfort: east gets cool morning sun, west gets the hottest part of a summer afternoon.
- **North gets summer only.** {{v:rome.summer.orientation_h.N}} hours on 21 June in Rome, all of it in the early morning and evening, and none at all between the September and March equinoxes.

The full dataset for all 12 cities and eight orientations is in the [sun hours by city pages](/sun-hours/) and as a [CSV download](/data/sun-hours-by-orientation.csv).

## Floor: why higher floors get more sun

In a city, the building across the street is the main obstruction. We modelled a long straight street lined with an unbroken row of 18 m buildings (five to six storeys, typical of central Rome, Barcelona, Paris or Berlin) and calculated the direct sun on a window 1.5 m above each floor, ray by ray, every five minutes.

**Rome, south-facing façade, 21 December (hours of direct sun)**

{{table:canyon:rome:S:winter}}

**Rome, east- or west-facing façade, 21 December**

{{table:canyon:rome:E:winter}}

**London, south-facing façade, 21 December**

{{table:canyon:london:S:winter}}

Reading the tables:

- **On a narrow street, winter sun belongs to the top floors.** On an 8 m Roman street the south-facing ground to 4th floors get no direct sun on 21 December; the 5th floor gets {{v:rome.winter.canyon_h.S.8.5}} hours.
- **Width buys floors.** On a 30 m avenue the same façade gets {{v:rome.winter.canyon_h.S.30.2}} hours on the 2nd floor and {{v:rome.winter.canyon_h.S.30.4}} on the 4th.
- **East and west façades change gradually** with height, because the sun reaches them at an angle; south façades flip from none to most of the day across one or two floors.
- **Latitude compounds it.** On a 30 m street, a south-facing 2nd floor gets {{v:rome.winter.canyon_h.S.30.2}} hours of December sun in Rome, {{v:london.winter.canyon_h.S.30.2}} in London and {{v:athens.winter.canyon_h.S.30.2}} in Athens.

**The lowest floor that gets sun at midday on 21 December (south-facing, 18 m buildings opposite)**

{{table:min_floor}}

Floors counted from 0 (ground), 3 m per floor, window 1.5 m above the floor.

### The profile angle rule

Architects use one angle to decide whether a window gets sun past an obstruction: the **profile angle** of the sun, measured in the vertical plane at right angles to the façade. If the angle from the window up to the top of the building opposite (the **obstruction angle**) is smaller than the sun's profile angle, the sun gets through.

- Obstruction angle = arctan((height of the building opposite − height of the window) ÷ street width).
- On 21 December at solar noon, the profile angle for a south-facing window equals the sun's altitude: {{v:rome.winter.noon_altitude_deg}}° in Rome, {{v:london.winter.noon_altitude_deg}}° in London.

A useful consequence: **around the equinoxes, the sun's profile angle on a south-facing façade stays almost constant all day** (about 90° minus the latitude). A window on an east-west street therefore tends to get sun for nearly the whole day or not at all in March and September. That is why the tables jump from zero to many hours between neighbouring floors.

## Street width and what is across the street

A quick way to judge a street without any tools is the ratio of the building height opposite to the street width, measured from your window:

| (Height above your window) ÷ street width | Obstruction angle | Gets winter noon sun (south-facing) in |
|---|---|---|
| 0.25 | 14° | Every city in the table above |
| 0.4 | 22° | Rome, Madrid, Lisbon, Athens, Naples, Barcelona, Florence |
| 0.5 | 27° | Lisbon and Athens only |
| 1.0 | 45° | None of the 12 cities |

For example, a 1st-floor window (4.5 m up) facing an 18 m building across a 12 m street has 13.5 ÷ 12 = 1.1: no winter sun in any of these cities. From the 4th floor (13.5 m up) the ratio is 4.5 ÷ 12 = 0.375, and in Rome the winter sun at {{v:rome.winter.noon_altitude_deg}}° clears it.

What is across the street matters as much as how wide it is: a square, a park, a railway cutting, a low market hall or a school playground opens the view to the low winter sun; a single tall building does the opposite. This is why real buildings need a real calculation.

## Seasons: why 21 December is the honest test

- **Winter** has the fewest daylight hours and the lowest sun, so obstructions bite hardest. It is also when people most want sun indoors. A home with good December sun will be bright all year.
- **The equinoxes** (around 20 March and 22 September) are the midpoint and the reference day most standards use.
- **Summer** gives plenty of sun to almost every orientation and floor. In southern Europe the question in July is often how to keep the sun out, especially from west-facing rooms.

If a listing quotes one figure, it should be the winter one.

## Other things that add or remove sun

- **Trees.** Deciduous trees shade in summer and let most winter sun through; evergreens shade all year. A calculation from building data ignores trees, so real summer shade in a leafy street is greater.
- **Balconies and overhangs above.** A deep balcony above a window blocks high summer sun but not low winter sun. On a south façade this is often an advantage.
- **Courtyards.** Rooms facing an inner courtyard usually get far less sun than street-facing rooms, especially on lower floors.
- **Terrain.** Hills and slopes change the horizon. In a hilly city a south-facing slope gains sun and a north-facing slope loses it.
- **Clouds.** Calculations give sun on a clear day. How often the sky is clear varies by city and season; that is a climate question, separate from the geometry of the home.
- **Reflections.** Light-coloured façades and glass across the street reflect light into a room, but reflected light is not direct sun.

## Standards and rules: how much sun is enough?

| Standard or rule | Where | What it asks for |
|---|---|---|
| **EN 17037:2018** Daylight in buildings | Europe | Sunlight exposure on a clear day between 1 February and 21 March: at least **1.5 h** (minimum), **3 h** (medium), **4 h** (high) |
| **BRE BR 209** (2022 edition) | United Kingdom | For existing homes near new development: at least **25% of annual probable sunlight hours**, including **5% between 21 September and 21 March**, for main windows facing within 90° of due south. For new homes: one habitable room, preferably the main living room, should get at least **1.5 h** of sunlight on **21 March** |
| **DIN 5034-1** (2011 edition) | Germany | At least one living room should be able to receive **4 h** of sun at the equinox, and, if winter sun is wanted, at least **1 h** on **17 January**, measured at the centre of the window |
| **DM Sanità 5 luglio 1975**, art. 5 | Italy | Daylight rather than direct sun: an average daylight factor of at least **2%** and openable windows of at least **1/8** of the floor area |

Two practical points. First, these standards are written for planning and design; nothing obliges a seller to publish sun hours, which is exactly why published numbers stand out. Second, they measure at the window, the same way a floor-by-floor calculation does.

## How to check a specific home

**1. Find the orientation.** Use a map: the direction the main windows face is at right angles to the façade. Phone compass apps are affected by steel and concrete indoors, so check on the street.

**2. Look across the street.** Estimate the height of the building opposite above the window and the distance to it. Use the ratio table above as a first filter.

**3. Visit at the right times.** Morning and mid-afternoon viewings show different things. A winter viewing between 12:00 and 14:00 is the toughest test.

**4. Check the floor.** Ask which floor the flat is on and how many floors the building opposite has.

**5. Calculate it.** A 3D shadow calculation gives the hours for every side of the home, every floor and every season in seconds. [Terrace Sun](/) does this from OpenStreetMap buildings for any address; estate agents can put the result on the listing as a [Sun Score and report](/listings/).

**Buyer's viewing checklist**

- Which way do the living room and bedroom windows face?
- How tall is the building opposite, and how far away is it?
- Is anything planned across the street (a crane, a planning notice, an empty plot)?
- Are there trees in front? Evergreen or deciduous?
- Is there a balcony above the living room window?
- What does the sun do on 21 December? Ask for the calculation, or run it yourself.

## Reading a sun exposure report

A good sun exposure report answers four questions:

1. **How sunny overall?** A single score, such as the Sun Score: the share of daylight hours with direct sun on the sunniest street-facing wall at the home's floor, averaged over four reference days, graded A (70 or more) to E (below 25).
2. **Which side, and when?** Hours and exact times per façade, per season: "south-south-east side: 08:00 to 16:20 on 21 December".
3. **How does this floor compare?** Hours for every floor of the building.
4. **What was assumed?** Data source, building heights that were estimated, and what is not modelled (trees, awnings, terrain, clouds).

See a [sample report for a top-floor flat on Piazza Testaccio](/report/?lat=41.8799368&lon=12.4768852&floor=5&floors=6&name=Piazza%20Testaccio%2C%20top%20floor) and the [first guide](/blog/sun-exposure-property-listings/) for how agents use it.

## For estate agents: describing sun exposure honestly

**By grade**

| Grade | Example wording |
|---|---|
| A | "Direct sun for most of the day in every season: 07:40 to 16:40 on 21 December." |
| B | "Bright for most of the year; direct sun from 10:30 to 15:00 in midwinter." |
| C | "Morning sun all year; winter sun limited to late morning." |
| D | "Limited direct sun because of the building opposite; bright, even light." |
| E | "No direct sun on this floor; calm, north-facing light." |

**Photograph when the sun is in the room.** The report's times tell you when.

**Terms buyers search for, by language**

| Language | Sun exposure | Sunny / bright | Faces south | Dual aspect |
|---|---|---|---|---|
| Italian | esposizione solare | soleggiato / luminoso | esposto a sud | doppia esposizione |
| Spanish | orientación | soleado / luminoso | orientación sur | doble orientación |
| French | exposition | ensoleillé / lumineux | exposé plein sud | traversant |
| German | Besonnung / Ausrichtung | sonnig / hell | Südlage | durchgesteckt |
| Portuguese | exposição solar | soalheiro / luminoso | orientado a sul | dupla exposição solar |
| Greek | προσανατολισμός | ηλιόλουστο / φωτεινό | νότιος προσανατολισμός | διαμπερές |

## Glossary

- **Altitude (solar elevation):** the sun's angle above the horizon.
- **Azimuth:** the sun's compass direction, measured clockwise from north (90° east, 180° south, 270° west).
- **Solar noon:** the moment the sun is highest; rarely 12:00 on the clock because of time zones and daylight saving.
- **Declination:** the sun's angle north or south of the celestial equator, from +23.4° in June to −23.4° in December.
- **Equinox:** around 20 March and 22 September, when day and night are close to equal and the sun rises due east.
- **Solstice:** around 21 June (longest day in the northern hemisphere) and 21 December (shortest).
- **Orientation (aspect):** the compass direction a façade or window faces.
- **Dual aspect:** a home with windows on two different façades, usually opposite or adjacent.
- **Direct sunlight:** light arriving in a straight line from the sun, which casts shadows.
- **Daylight:** all natural light, including diffuse light from the sky; a room can be bright without direct sun.
- **Daylight factor:** indoor daylight as a percentage of outdoor daylight under an overcast sky.
- **Sunlight exposure:** in EN 17037, the hours of direct sun a room receives on a clear reference day.
- **APSH (annual probable sunlight hours):** in the UK BRE guide, the long-term average hours of sun a window could receive, allowing for typical cloud.
- **Profile angle:** the sun's angle in the vertical plane at right angles to a façade; used to test obstructions and design shading.
- **Obstruction angle:** the angle from a window up to the top of an obstruction in front of it.
- **Street canyon:** a street lined on both sides with continuous buildings.
- **Height-to-width ratio:** building height divided by street width, a quick measure of how enclosed a street is.
- **Sky view factor:** the share of the sky visible from a point.
- **Shadow casting:** calculating shadows from the sun's position and the shape of buildings.
- **2.5D model:** buildings represented as footprints with a single height each; it cannot represent overhangs.
- **DSM and DTM:** digital surface model (ground plus buildings and trees) and digital terrain model (bare ground).
- **Sunshine duration:** the hours of bright sun recorded by weather stations, which includes the effect of cloud.
- **Refraction:** the bending of sunlight by the atmosphere, which makes the sun visible slightly before it is geometrically above the horizon.
- **Overshadowing:** loss of sunlight caused by a new or existing building.
- **Sun Score:** a 0 to 100 summary of a home's direct sun at its floor through the year, graded A to E.

## Frequently asked questions

### How many hours of sun does a south-facing flat get?

It depends on the floor and the street. With nothing in front, a south-facing window in Rome can see the sun for {{v:rome.winter.orientation_h.S}} hours on 21 December and {{v:rome.summer.orientation_h.S}} hours on 21 June. On a 12 m street with 18 m buildings opposite, the ground floor gets {{v:rome.winter.canyon_h.S.12.0}} hours on 21 December and the 5th floor {{v:rome.winter.canyon_h.S.12.5}}.

### Is a north-facing flat bad?

It gets no direct sun between the September and March equinoxes in Europe, and some early-morning and evening sun in summer ({{v:rome.summer.orientation_h.N}} hours on 21 June in Rome, unobstructed). It can still be bright with even daylight, and it stays cooler in summer.

### East or west facing: which is better?

They get similar hours. East-facing rooms get morning sun, which suits bedrooms and kitchens; west-facing rooms get afternoon and evening sun, which is pleasant in winter and can overheat in a southern European summer.

### Which floor gets the most sun?

Usually the highest, because it clears the buildings opposite, and the gap is largest in winter. On a 30 m Roman street, a south-facing 2nd floor gets {{v:rome.winter.canyon_h.S.30.2}} hours on 21 December and the 4th floor {{v:rome.winter.canyon_h.S.30.4}}.

### How many hours of sun is enough?

EN 17037 treats 1.5 hours on a clear day between 1 February and 21 March as the minimum, 3 hours as medium and 4 hours as high. The UK's BRE guide asks new homes for at least 1.5 hours on 21 March in one main room, and Germany's DIN 5034-1 recommends 4 hours at the equinox.

### Why does my south-facing flat get less sun in summer?

Because in June the sun rises in the north-east and sets in the north-west. For the first and last hours of the day it is behind a south-facing façade, and at midday it is so high that deep window reveals and balconies block it.

### How does latitude change sun exposure?

The further north, the lower the winter sun and the shorter the winter day. On 21 December the sun reaches {{v:athens.winter.noon_altitude_deg}}° in Athens and {{v:london.winter.noon_altitude_deg}}° in London, and daylight lasts {{v:athens.winter.daylight_h}} and {{v:london.winter.daylight_h}} hours.

### What is the difference between daylight and sunlight?

Daylight is all natural light, including light from a cloudy sky. Sunlight is direct light from the sun. A room can have good daylight and no direct sun.

### What is a dual-aspect flat?

A flat with windows on two sides. It usually gets sun at two different times of day and better cross-ventilation.

### Do sun calculations include trees?

Most building-based calculations do not, including ours. Deciduous trees mostly let winter sun through; evergreens do not.

### How can I check the sun for a specific address?

Search the address or click the building on [Terrace Sun](/). You get hours per side, per floor and per season, a shadow map and a report you can share.

### What orientation is best in a hot climate?

South is easiest to control: the summer sun is high and a simple overhang or balcony blocks it, while the low winter sun still comes in. West-facing glass is the hardest to keep cool on summer afternoons.

### Which way should a home face in the southern hemisphere?

North. Everything in this guide mirrors: north-facing windows get the most winter sun and south-facing windows the least.

### Does a higher floor always get more sun?

Almost always on a street, but not if a taller building stands next door or across a square at an angle. That is why the calculation is done per building.

### Can estate agents publish sun exposure data?

Yes, as a calculated estimate with the method and limits stated. A report with a link anyone can re-run is more defensible than an adjective.

## Data, method and quality checks

**Data you can reuse.** [Sun hours by orientation for 12 cities (CSV)](/data/sun-hours-by-orientation.csv) · [Sun hours by floor and street width (CSV)](/data/sun-hours-by-floor-and-street.csv) · [All values (JSON)](/data/sun-hours-cities.json). Free to cite with a link to this page.

**Method.** Solar position from the standard Meeus model used by SunCalc, with atmospheric refraction, sampled every minute for the sun basics and orientation tables. The sun counts when its centre is more than 0.1° above a flat horizon and it is in front of the wall. Street tables use the same ray-casting engine as the Terrace Sun tool and API, against a 2 km row of 18 m buildings, every five minutes, windows 1.5 m above each floor at 3 m per floor. Reference days for 2026: 20 March, 21 June, 22 September and 21 December, in each city's local time.

**Quality checks.**

- Solar positions match the cityshade reference implementation to a fraction of a degree.
- On a real Testaccio building, the hours of sun on the wall at each of five floors on 20 March matched cityshade's independent wall-shadow calculation to within 0.1 hour on every floor (8.3, 9.2, 9.3, 9.5 and 9.5 hours).
- The street tables were checked against the textbook profile-angle formula; the two agree except within a few centimetres of the boundary between sun and shade, where either answer is legitimate.

**Limits.** Direct sun on a clear day; no trees, terrain, balconies above or clouds; idealised streets in the tables. For a real address, the building footprints and heights come from OpenStreetMap.

## Sources

1. Fleming, D., Grimes, A., Lebreton, L., Maré, D. C. and Nunns, P. (2018). "Valuing sunshine". *Regional Science and Urban Economics*, 68, 268-276. [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0166046217302387) · [Motu executive summary](https://www.motu.nz/assets/Documents/our-work/urban-and-regional/housing/Valuing-Sunshine-Executive-Summary.pdf)
2. Zhong, Y., Lu, J. and Li, Z. (2022). "Impact of access to sunlight on residential property values: an empirical analysis of the housing market in Shanghai". *International Journal of Strategic Property Management*, 26(5). [Journal](https://journals.vilniustech.lt/index.php/IJSPM/article/view/18004)
3. Jung, H., Kim, D. and Hong, H. (2022). "Value of an Apartment with Sunlight and View: a Quasi-Experimental Analysis". SSRN working paper 4181988. [SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4181988)
4. idealista/news (22 July 2025). "La casa perfetta esiste? Ecco cosa ne pensano gli italiani", AstraRicerche for Netrais. [Article](https://www.idealista.it/news/immobiliare/residenziale/2025/07/22/256191-la-casa-perfetta-esiste-ecco-cosa-ne-pensano-gli-italiani)
5. CEN (2018). *EN 17037:2018 Daylight in buildings*. [Standard record](https://standards.iteh.ai/catalog/standards/cen/836e5b91-1eb0-4643-a2ba-7ca5a5988e64/en-17037-2018) · [Sunlight exposure levels, IES VE documentation](https://help.iesve.com/ve2025/10_4_exposure_to_sunlight_hours.htm)
6. BRE (2022). *Site layout planning for daylight and sunlight: a guide to good practice* (BR 209), as summarised by Anstey Horne. [Summary](https://www.ansteyhorne.co.uk/news/annual-probable-sunlight-hours-apsh)
7. DIN 5034-1 (2011) sunlight recommendations, as quoted in Cornelius, "Quo vadis DIN 5034", LiTG (2016). [PDF](https://www.litg.de/media/10624.icht2016_Cornelius-Langfassung_QuoVadisDIN5034.pdf)
8. Decreto Ministeriale Sanità 5 luglio 1975, art. 5. [Text](https://www.bosettiegatti.eu/info/norme/statali/1975_dm_05_07.htm)
9. cityshade, open-source sun and shade model used for accuracy checks. [GitHub](https://github.com/milanjanosov/cityshade)
10. Building data © OpenStreetMap contributors, ODbL. [Copyright](https://www.openstreetmap.org/copyright)
