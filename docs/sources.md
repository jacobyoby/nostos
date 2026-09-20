# Sources — Source-Driven Development for Nostos

## Stack Detected (2026-09-19)

No dependency manifest (`package.json`, `pyproject.toml`, `requirements.txt`) — vanilla JS + Python stdlib.

- Node.js 26.7.0 (from `node --version`) — provides built-in `node:test`, `node:assert`
- Python 3.14.7 (from `python3 --version`) — provides stdlib `unittest`, `json`, `re`, `pathlib`
- Browser APIs: `URLSearchParams`, `localStorage`, `fetch` (WhatWG/MDN)

→ No framework version ambiguity; all patterns are Web Standards / Node / Python official docs.

## Docs Fetched & Patterns Used

| Pattern in repo | Official source fetched | Decision & citation |
|-----------------|-------------------------|---------------------|
| `URLSearchParams` for `?flags=` / `?enable_*` | MDN Web Docs — URLSearchParams — https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams | Use `new URLSearchParams(search)` + `.get()` — matches spec; no polyfill needed (supported since Chrome 49, Node 10). |
| `localStorage.getItem` + `JSON.parse` | MDN — Window/localStorage — https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage | Wrapped in try/catch per docs (can throw on opaque origins / quota). |
| IIFE module `(function(global){...})(globalThis)` exported via `module.exports` + `global.Flags` | MDN — IIFE, `globalThis` — https://developer.mozilla.org/en-US/docs/Glossary/IIFE, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis | Keeps `src/*.js` runnable in browser (`<script src>`) and testable in Node (`require`) without bundler. |
| Haversine formula (`sin`, `cos`, `asin`, `toRad`) | MDN — Math — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math + WGS84 radius 6371km (geodesy standard) | Pure math, no external lib; verified against known AC→Trenton distance tolerance test. |
| `node:test` + `node:assert/strict` for `src/*.test.js` | Node.js v26 Docs — Test Runner — https://nodejs.org/api/test.html, https://nodejs.org/api/assert.html | Uses `node --test` + `describe`/`it` per docs; no Jest/Mocha dependency to keep stack vanilla. |
| `python3 -m unittest discover` for `tests/test_merge.py` | Python Docs — unittest — https://docs.python.org/3/library/unittest.html | Stdlib `unittest.TestCase` per docs; no `pytest` install needed. |
| `fetch("../data/nj-libraries.json",{cache:"no-store"})` | MDN — Fetch API + WhatWG Fetch Standard — https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API, https://fetch.spec.whatwg.org/ | Cache-busted fetch; `res.ok` + `throw` per spec. Requires http (not file://) — documented in README. |
| Geolocation (future `nearest` slice) | MDN — Geolocation API — https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition | Not yet implemented; will use `navigator.geolocation.getCurrentPosition(success, error, {enableHighAccuracy:false, timeout:5000})` per docs, handling `PERMISSION_DENIED` etc. |

## Conflicts Surfaced

- `README.md` vs existing code for "nearest by location": spec says Finder does nearest, but `src/index.html` only filters by county/status/legal. No code conflict — scope is future slices (see `docs/increments.md` Slice 2/3) gated by `Flags.isEnabled('nearest')`.
- No framework migration conflict (no React/Vue/etc). Existing IIFE pattern is consistent with vanilla recommendation on MDN; no modern ESM migration needed until bundler added.

## Unverified

- None — all implemented patterns have official sources above. Any future `navigator.geolocation` usage will be re-verified against MDN at implementation time.

## Verification

- [x] Dependency files inspected (none found — vanilla)
- [x] Official docs fetched for each framework-specific pattern (table above)
- [x] Deep links provided (with anchors where applicable)
- [x] No deprecated APIs used
- [x] Conflicts surfaced
