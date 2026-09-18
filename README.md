# Nostos

Find the public library near you and what it offers. **v0.1.0** covers every IMLS public library outlet in New Jersey.

## Product (v0.1.0)

- **Finder.** Nearest publicly funded libraries by ZIP, town, or device location: miles, address, phone, hours.
- **Outlet page.** Contact the administration above the fold (phone, email, contact form, director, board). Unpublished fields are shown as “Not published”, never guessed.
- **Services.** Documented list per outlet (`{name, evidence_url, verified_on}`). Legal-help desks are seeded from the NJSL flags; other services stay empty until evidenced.
- **Community input, no reviews.** Propose a service, hours/closure, or that a book/resource is here. Proposals go to a moderation queue (`data/proposals/`), never onto the page. No ratings, stars, or free-text reviews.
- **Publicly funded only.** Universe is the IMLS Public Libraries Survey outlet file.

## Data

- `data/imls-nj-outlets.json` — every active NJ outlet from IMLS PLS FY2023 (449 rows), produced by `scripts/ingest_imls_nj.py`.
- `data/nj-libraries.json` — merged outlets + NJSL website/legal-help + services + admin contact + outreach. Produced by `scripts/merge.py`.
- `data/proposals/accepted.json` / `rejected.json` / `inbox/` — community queue. `merge.py` applies accepted proposals.
- Service names: legal-help desk, lawyer-in-the-library, notary, passport, printing/scanning, meeting rooms, tax prep, language help, computer access, other.
- Each service: `{name, evidence_url, verified_on}`.
- Admin fields: `admin_phone`, `admin_email`, `contact_form_url`, `director`, `board_url` as `{value, verified_on}` or null.
- Hours: `hours` as `[{day, open, close}]` plus weekly `hours_open_weekly`. Finder shows open-now when structured hours exist.

## Apps

Web: static ES modules in `src/`. Hash routes `#/`, `#/directory`, `#/outlet/NJ0003-002`.

```bash
python3 -m http.server 8080
# http://127.0.0.1:8080/src/
```

Android & iOS: Capacitor 7 (`com.jacobyoby.nostos`, version 0.1.0).

```bash
npm install
npm run build:www
npx cap sync
npm run android:assemble   # SDK + JDK
npm run ios:pod            # macOS + Xcode
```

## Hosting and CI

CI on every push/PR: `npm test`, `node scripts/check-data.mjs` (JSON parse + http(s) website/service URLs), Playwright e2e.

Intended production host is **loam**, alongside other jacobrakai static sites. Until that deploy path is wired, serve `src/` + `data/` (or `www/` after `npm run build:www`) as a static site. GitHub Pages can publish `www/`.

## Tests

```bash
npm test          # builds www/, unit + mobile project checks
npm run check:data
npm run test:e2e
npm run test:all
```
