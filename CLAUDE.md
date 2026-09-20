# Nostos — Rules for AI Agents

## Tech Stack
- Frontend: vanilla HTML/CSS/JS, no bundler (`src/index.html` + `src/*.js`, IIFE globals, `node:test` for JS)
- Data: Python 3.14 scripts (`scripts/*.py`), JSON datasets (`data/*.json`), stdlib `unittest`
- No `package.json` / `pyproject.toml` — use available wrappers, don't assume `npm test`

## Commands
- JS tests: `node --test src/*.test.js`
- Python tests: `python3 -m unittest discover -s tests -v`
- Full suite: `node --test src/*.test.js && python3 -m unittest discover -s tests`
- Static checks: `node --check src/*.js && python3 -m py_compile scripts/*.py && python3 -c "import json; json.load(open('data/nj-libraries.json'))"`
- Data ingest: `python3 scripts/ingest_imls_nj.py` (downloads IMLS) — never hand-edit `data/imls-nj-outlets.json`
- Merge: `python3 scripts/merge.py data/imls-nj-outlets.json data/njsl-systems.json data/nj-libraries.json` (preserves `outreach`)
- Outreach: `python3 scripts/outreach.py <fscskey>-<seq> <todo|contacted|posted|partner> "<note>"`
- Serve: `python3 -m http.server` from repo root, open `/src/` (fetch needs http, not file://)

## Code Conventions
- Pure functions: don't mutate inputs, return new values; IIFE modules (`(function(global){...})(globalThis)`) exporting via `module.exports` for tests + `global.Flags`/`global.Geo` for browser
- Strict typing in comments/types; validate external data at runtime, ignore extras
- Tests colocated (`src/flags.test.js`) or `tests/test_*.py`; DAMP over DRY, state-based assertions
- One logical thing per commit (see `docs/increments.md`); safe defaults (flags off), additive & rollback-friendly
- Simplicity first — fewest lines, no premature abstraction (Rule of 3)

## Boundaries
- Never commit secrets, `.env`, or `data/*.json` hand-edits (generated)
- Never `find /` or read `__pycache__`/`.pyc`/`../agent-skills` graders — public contract only
- Ask before changing `data/` schema or IMLS source URL
- Always run full suite before committing; keep `main` buildable per `docs/testing.md`

## Patterns
Prefer one focused pattern per task. Example — feature flag helper (safe defaults, query > storage > defaults):
```js
// src/flags.js — isEnabled('nearest',{search,storage}) — unknowns ignored, defaults off
if (Flags.isEnabled('nearest')) { /* gated UI */ }
```
See `src/geo.js` for pure haversine/sort (no mutation, null-safe) and `scripts/merge.py` for pure `normalize_name`/`merge`.

## Context Hierarchy (this project)
1. Rules: this file + `AGENTS.md` (always loaded)
2. Spec: `README.md` + `docs/increments.md` + `docs/testing.md` (per feature)
3. Source: `src/index.html`, `scripts/merge.py`, `data/nj-libraries.json` sample (per task)
4. Errors: focused test failure, not full logs (per iteration)
5. History: summarize, trim at 75% — keep task definition + current error last
