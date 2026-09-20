# Workflow & Operations (20–22)

## 20 Git Workflow & Versioning (Trunk-based, atomic commits)

- **Branch:** `main` is trunk. No long-lived feature branches; work behind flags (`src/flags.js`).
- **Commits:** one logical thing per commit, `type(scope): subject` (conventional). History so far: 7 atomic commits e23e693…fadc512.
- **Rollback-friendly:** each increment additive; revert one commit reverts one slice (see `docs/increments.md`).
- **No force-push, no rebase of public history.**
- **Before commit:** `node --test src/*.test.js && python3 -m unittest discover -s tests && node --check src/*.js`

## 21 CI/CD & Automation (Shift Left, quality gates)

- **Gates:** `.github/workflows/ci.yml` runs on push/PR: static check (`node --check`, `py_compile`, JSON), JS tests, Python tests. Fails fast.
- **Shift left:** same commands locally before push (`docs/testing.md`), plus `validate.js` contract check in browser.
- **No deploy yet** — static site; when deployed, add deploy job gated on `verify` passing, with artifact `src/` + `data/`.

## 22 Deprecation & Migration (Zombie removal)

- **Pattern:** flag→default-on→remove flag plumbing (see increments Slice 4: flip `nearest` to true, delete `Flags` branches).
- **No zombies currently** — no deprecated files. When removing, keep entry in this doc for one release, then delete.
- **Data migration:** `scripts/merge.py` preserves `outreach` by `(fscskey,fscs_seq)`; future schema changes bump `docs/contract.md` and add `scripts/migrate_<version>.py` with idempotent rerun.
