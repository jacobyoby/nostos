# Changelog

## Unreleased

- Finder and outlet pages show a weekday open/close schedule from the library website (schema.org or a single unambiguous week). IMLS hours-per-week is not treated as a schedule.
- Every outlet has a 4-digit DCA municipality code from NJOGIS boundaries.
- GitHub Pages deploys `www/` from `main`.

## 0.1.0 — 2026-09-18

First shippable NJ release.

- Finder: ZIP/town (exact city) or geolocation, distance, county/type filters.
- Outlet pages: contact above the fold (phone, email, form, director, board — null when unpublished), services, hours status.
- Community proposals: service / hours / resource only, moderation queue via GitHub issue + `data/proposals/`, no reviews.
- Capacitor Android and iOS shells.
- CI: unit tests, data schema, Playwright e2e.
