# Increments — Incremental Implementation for Nostos

Discipline: `incremental-implementation` skill. Each slice leaves `main` buildable, tested, and revertable.

## Audit (2026-09-19) — prior history

- `baa3155 chore: scaffold` → `1892b91 feat: finder page, merge and outreach scripts` was a **too-large slice** (HTML + 2 Python scripts + data in one commit). Red flag: >100 lines without intermediate test/verify.
- Fix: going forward, one logical thing per commit (Rule 1), feature-flag gated (Rule 3).

## Feature flag helper (Slice 1 — landed)

- `src/flags.js` — additive, safe defaults (off), unknown flags ignored, query > localStorage > defaults. Unit-tested via `node --test`.
- `src/index.html` wires `<script src="flags.js">` with no user-visible change (flag off). Rollback: delete the script tag + file.

Verify: `node --test src/flags.test.js`, `node --check src/flags.js`, `python3 -m py_compile scripts/*.py`

## Next feature: "Nearest library" (README Finder)

Vertical slicing (preferred), risk-first where noted.

- [x] **Slice 1 — Flag infra** (this doc): flag system + tests, no behavior change.
- [ ] **Slice 2 — Distance (risk-first):** pure `haversine(lat,lon,lat,lon)` in `src/geo.js`, sort outlets by distance behind `nearest` flag. Test with fixed coordinates; no geolocation yet.
      Verify: `node --test src/geo.test.js`
- [ ] **Slice 3 — Geolocation button:** `Get my location` button + `navigator.geolocation` error states (denied/unavailable) behind same flag. Uses Slice 2 sort.
      Verify: manual + `node --test` for error branches.
- [ ] **Slice 4 — Remove flag:** flip `nearest` default to `true`, delete flag plumbing for this feature after field validation.

Each slice: Implement → Test → Verify (commands above + `python3 -m http.server` smoke) → Commit with `feat:` prefix.

## Slicing for other roadmap (not yet started)

- **Community input, no reviews:** Slice 0 contract (service-hours type) → Slice 1 POST to local JSON behind `community_input` flag → Slice 2 render.
- **Contact the library:** Slice 1 add `contact` fields to `nj-libraries.json` + UI link behind `contact_admin` flag.

## Rules checklist (per slice)

- [ ] Simplicity first — fewest lines, no premature abstraction
- [ ] Scope discipline — only files the slice needs
- [ ] One thing per commit
- [ ] Keep compilable — `node --check` + tests + JSON valid
- [ ] Feature flag for incomplete UI
- [ ] Safe defaults (off)
- [ ] Rollback-friendly (additive; delete to revert)
