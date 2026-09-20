# Testing — Test-Driven Development for Nostos

## Discover the Stack First

Nostos has no build system: vanilla JS frontend (`src/*.js`) + Python data scripts (`scripts/*.py`).

| Layer | Tool | Command |
|-------|------|---------|
| JS unit (small) | Node 22 built-in `node:test` | `node --test src/flags.test.js src/geo.test.js` |
| Python unit (small) | stdlib `unittest` | `python3 -m unittest discover -s tests -v` |
| Full suite | both | `node --test src/*.test.js && python3 -m unittest discover -s tests` |
| Static checks | `node --check`, `py_compile` | `node --check src/*.js && python3 -m py_compile scripts/*.py` |

No `package.json`, no `pytest`, no `Makefile`. Prefer the checked-in/available wrappers above; do not assume `npm test`.

## Test Pyramid

- **Unit (small) ~90%%** — `src/flags.test.js`, `src/geo.test.js`, `tests/test_merge.py`. Pure logic, no I/O, ms each.
- **Integration (medium) ~10%%** — future: `scripts/merge.py` against fixture `data/*.json`, `src/index.html` fetch + render via fake DOM.
- **E2E (large) 0%%** — future: browser smoke via `browser-testing-with-devtools` when critical user flows exist.

## TDD Cycle Applied

### Slice 1 — flags.js (incremental-implementation Slice 1)
- RED: wrote `src/flags.test.js` with 8 cases (defaults off, unknown ignored, query > storage)
- RED verified: 1 failing (unknown flag bug), fixed filter to `key in DEFAULTS`
- GREEN: `src/flags.js` minimal implementation
- REFACTOR: extracted `parseQuery`, `parseStorage`, safe defaults

### Slice 2 — geo.js (this increment)
- RED: wrote `src/geo.test.js` that failed with `Cannot find module './geo.js'`
- GREEN: implemented `src/geo.js` (`haversine`, `sortByDistance`) — 13 tests pass
- REFACTOR: pure functions, no mutation, early null checks

### Python — merge.py
- Prove-It pattern: `test_prove_it_regression_outreach_preserved_across_rerun` guards re-run overwriting outreach
- State-based assertions, DAMP style, no mocks (real module)

## Writing Good Tests (project conventions)

- State over interactions — assert on return values, not internal calls
- DAMP over DRY — each test self-contained
- Real implementations over mocks — only mock at boundaries (none yet)
- Name tests descriptively — `test_joins_system_info_and_preserves_outreach`
- One assertion per concept — separate tests for empty title, trimming, etc.

## Verify Before Commit

```
node --test src/*.test.js
python3 -m unittest discover -s tests -v
node --check src/*.js && python3 -m py_compile scripts/*.py
python3 -c "import json; json.load(open('data/nj-libraries.json'))"
```
