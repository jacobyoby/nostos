# Shipping & Launch — Checklist, Staged Rollouts, Rollback (25)

## Staged rollout (flag-gated)

1. Ship behind flag off (`src/flags.js` defaults false) — PR gated by CI (`bff9e4f` workflow).
2. Enable for maintainers via `?flags=nearest` or `localStorage nostos_flags={"nearest":true}` — smoke via `docs/browser-testing.md` plan.
3. Flip default to true in `src/flags.js` DEFAULTS after field validation — small commit, revertible.
4. Remove flag plumbing after one release (see `docs/workflow.md` deprecation).

## Pre-ship checklist

- [ ] `node --test src/*.test.js && python3 -m unittest discover -s tests` green (17+8)
- [ ] `node --check src/*.js && python3 -m py_compile scripts/*.py` + `validateAll(live data)` passes
- [ ] http smoke `GET /src/index.html` + `/data/nj-libraries.json` 200, 449 rows, console clean, a11y tree labels+live region, 320/768/1024 screenshots
- [ ] Security: `esc()`+`safeUrl()` active, CSP header planned at deploy (`default-src 'self'`)
- [ ] Perf: 282KB JSON gzips to ~40KB, no long tasks
- [ ] Docs updated: `docs/contract.md`, `docs/testing.md`, `docs/browser-testing.md`

## Rollback

- **Code:** `git revert <commit>` — each slice additive. Flag flip reverted by `DEFAULTS.nearest=false`.
- **Data:** `data/nj-libraries.json` is generated — revert via `git checkout main -- data/nj-libraries.json` or re-run `python3 scripts/merge.py ...`.
- **No DB migration** yet; when added, include rollback script per `docs/workflow.md`.

## Launch note

Static hosting (GitHub Pages / Netlify). Publish `src/` + `data/` only. No staged canary needed until backend arrives.
