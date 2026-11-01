# Adversarial review — nostos v0.1.0 vs competitors

Reviewed 2026-10-31 against live competitors. The question: if someone in NJ
needs a library, why would they use nostos instead of what already exists?

## The field

```
  User intent: "library near me"
      │
      ├── Google Maps ──── 100% hours, reviews, map, voice
      │                    NO admin contact, NO legal-help, NO IMLS authority
      │
      ├── NJ State Library ── official directory, catalog links
      │                       NO geolocation, NO hours, NO mobile UX
      │
      ├── Pillar Libraries ── map, service filters, Open Now, radius
      │   (pillarlibraries.org)    ~60 outlets, 7 counties only
      │
      ├── LibraryTechnology.org ── deep metadata, national
      │                            NO UX, NO hours, NO mobile, data table only
      │
      └── nostos ──── 449/449 NJ outlets, admin contact, legal-help
                      28% hours, 0% catalog, no map, no SEO presence
```

## Verdict by dimension

| Dimension | Google Maps | NJSL | Pillar | LibTech | Nostos | Winner |
|---|---|---|---|---|---|---|
| Hours coverage | ~100% (GBP) | 0% | via pages | 0% | 28% | Google |
| Admin contact (email/director/board) | 0% | partial | 0% | 0% | 31% | Nostos |
| Legal-help flag | no | no | no | no | 3% (16/449) | Nostos |
| Services list (filterable) | no | no | yes (curbside, PC, contactless) | no | yes (not filterable) | Pillar |
| Geolocation finder | yes (map) | no | yes (map + radius) | no | yes (list) | Google |
| Map visualization | yes | no | yes (interactive) | no | no | Google |
| Mobile UX | excellent | poor | good | poor | good | Google |
| Data authority | crowdsourced (GBP) | official | member libraries | IMLS | IMLS | Tie (NJSL/Nostos) |
| Catalog link | no | yes | yes | yes | 0% | NJSL |
| NJ completeness | ~95% | yes | ~60/449 (7 counties) | yes | 100% (449/449) | Nostos |
| Search engine presence | dominant | strong | top 5 | moderate | zero | Google |
| Offline / PWA | no | no | no | no | no (manifest, no SW) | None |

## Critical vulnerabilities (ordered by user impact)

### 1. Hours: 72% missing (CRITICAL)

This is the single biggest reason a user would leave nostos for Google. "Is it
open now?" is the #1 question after "where is it?". Google answers this for
every library via Google Business Profile.

**Current state:** 129/449 outlets have structured hours. The `seed:hours`
script parses schema.org and unambiguous week schedules from library websites.

**Mitigation:** Run `seed:hours` against all remaining systems. For the ~100
outlets whose sites don't publish structured hours, fall back to IMLS
`hours_open_weekly` as a weekly total indicator ("Open ~X hrs/week") rather
than leaving the field blank. This doesn't violate the "null beats guessed"
rule — IMLS weekly hours are a reported fact, just not a schedule.

### 2. Catalog / card signup: 0% (CRITICAL)

A user who finds their library wants to search its catalog or sign up for a
card. Nostos has zero catalog URLs. Every individual library website has this.
Google Maps links to the website, which gets them there in one more click.

**Mitigation:** `seed:sites` already visits library websites. Add catalog URL
extraction (look for links containing "catalog", "opac", "bibliocommons",
"sirsi", "polaris", "evergreen") and card signup (links containing "card",
"register", "sign up", "account").

### 3. No map (HIGH)

Google Maps IS a map. Nostos is a table. For the "near me" intent, a map is
the natural interface. Nostos has lat/lon for all 449 outlets.

**Mitigation:** Add a Leaflet + OpenStreetMap tile layer. No API key needed.
Show markers for search results. This is ~50 lines of code and a CDN include.

### 4. No search engine presence (HIGH)

Nostos was just deployed. It has zero Google index. Nobody will find it by
searching "NJ library finder" or "library near 07030".

**Mitigation:**
- Add sitemap.xml with per-outlet pages (`/nostos/#/outlet/NJ0003-002` etc.)
- Add structured data (schema.org `Library` + `LocalBusiness`)
- Submit to Google Search Console
- Cross-link from jacobrakai.org main site

### 5. Director / board: 0.2% (HIGH)

"Contact is first-class" is a product rule, but only 1/449 outlets has a
director name. The NJSL directory lists system directors. This is nostos's
claimed differentiator — it needs to be filled.

**Mitigation:** Seed director names from the NJSL system directory. Board URLs
from library websites (138/449 already have contact forms, so the seeding
infra works).

### 6. CSP blocks geolocation on loam (MEDIUM)

The nginx config on loam has `Permissions-Policy: geolocation=()` which blocks
the Geolocation API. The "Use my location" button will silently fail.

**Mitigation:** Update the nginx default.conf to allow geolocation for the
nostos path: `geolocation=(self)`.

### 7. No offline support (MEDIUM)

The manifest.webmanifest exists but there's no service worker. The 282KB JSON
dataset is small enough to cache entirely. A library visitor with spotty
reception could use nostos offline.

**Mitigation:** Add a simple cache-first service worker for the static assets
and data JSON.

## Nostos's moat (what competitors can't easily copy)

1. **No reviews, no stars.** Google Maps will never remove reviews. Nostos's
   "library is not a restaurant" stance is a genuine differentiator for users
   who find reviews on public institutions inappropriate.

2. **Admin contact above the fold.** Director name, board URL, admin email —
   none of this is on Google Maps. For someone filing a FOIA request or
   contacting governance, nostos is the only tool.

3. **Legal-help flag.** No competitor tracks which libraries offer
   lawyer-in-the-library, notary, legal-help desk. This is unique and
   high-value for underserved communities.

4. **IMLS-sourced, NJ-complete.** Google Maps is crowdsourced; it misses small
   branches and bookmobiles. Nostos has the definitive 449 from IMLS PLS.

5. **No vendor lock-in.** Static HTML + JSON. No backend. No API key. Runs on
   any host.

## Recommended priority

1. Seed hours to ≥80% coverage (closes the critical gap vs Google)
2. Seed catalog URLs and card signup links (closes the "now what?" gap)
3. Add Leaflet map (visual parity with Google Maps for the "near me" flow)
4. Fix Permissions-Policy on loam (geolocation broken right now)
5. SEO: sitemap, structured data, GSC submission
6. Seed directors from NJSL directory
7. Service worker for offline
