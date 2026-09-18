# Nostos

Find the public library near you and what it offers.

## Product

- **Finder.** Nearest publicly funded libraries by location, with hours, phone, address, and the
  services each location offers (legal-help desks, notary, passport, meeting rooms, printing,
  language help, tax prep, and whatever the community adds).
- **Community input, no reviews.** People can name a service, post hours or closures, or note that a
  book or resource is at a location. There is no rating, no star, no free-text review. Reviews turn
  into a place to fight; a library is not a restaurant.
- **Contact the library.** Every location page has a direct route to the library's administration:
  phone, email or contact form, and the board or governing body. This is a first-class feature, not a
  footer link.
- **Publicly funded only.** The IMLS Public Libraries Survey outlet file defines the universe. Anything
  not in IMLS needs a citation before it goes in.

Starting scope is New Jersey: every outlet, every county, every municipality.

## Data

- `data/imls-nj-outlets.json` — every active NJ outlet from IMLS PLS FY2023 (449 rows), produced by
  `scripts/ingest_imls_nj.py`. Re-run it; never hand-edit.
- `data/nj-libraries.json` — canonical merged list: outlets + system website + legal-help flag +
  Forma Pauperis outreach status. Produced by `scripts/merge.py`, which preserves outreach status
  across re-runs.
- `scripts/outreach.py <fscskey>-<seq> <todo|contacted|posted|partner> "<note>"` — records outreach
  progress on one outlet.

## Apps

### Web

`src/index.html` is a static ES-module app:

- **Find nearby** — ZIP/town or device geolocation, haversine distance, county and outlet-type filters (issue #1).
- **Directory** — outreach progress tiles, county / status / legal-help filters, search.

Serve from the repo root (JSON fetch needs http, not `file://`):

```bash
python3 -m http.server 8080
# http://127.0.0.1:8080/src/
```

### Android & iOS (Capacitor)

Shared UI is copied into `www/` and wrapped with Capacitor 7.

```bash
npm install
npm run build:www
npx cap sync
# Android (requires SDK + JDK)
npm run android:assemble
# iOS (requires macOS + Xcode)
npm run ios:pod
npx cap open ios
```

Location permissions are declared in `android/app/src/main/AndroidManifest.xml` and `ios/App/App/Info.plist`.

## Tests (adversarial)

```bash
npm test          # fuzzed inputs, XSS payloads, mobile project checks
npm run test:e2e  # Playwright: ZIP finder, geolocation denied, XSS in search
npm run test:all
```
