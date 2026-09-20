# Doubt-Driven Review — 2026-09-19

## Claim
- **CLAIM:** `src/flags.js` and `src/geo.js` are safe for incremental rollout: flags default off (query > storage > defaults, unknowns ignored), geo is pure/null-safe/non-mutating and `allFlags` is correct.
- **Why it matters:** flags gate incomplete UI; geo will gate nearest-library sorting — silent contract violation would expose unfinished UI or mis-sort outlets.

## Extract (artifact + contract)
Artifact: `src/flags.js` (73 lines), `src/geo.js` (36 lines) as committed at `197d923`.
Contract: see `docs/sources.md` + `docs/testing.md` + inline: safe defaults, query overrides storage overrides defaults, unknowns never enable, pure/no I/O/null-safe/stable sort nulls last/no input mutation.

## Doubt — Fresh-context adversarial review
- Reviewer: `adversarial-reviewer` subagent `01a0bc96-dcb1-7821-b27d-2e0d0cf3b2c6` (isolated context, ARTIFACT+CONTRACT only, adversarial prompt).
- Cross-model: offered (Gemini CLI / Codex CLI / manual / skip) — **user not prompted interactively this cycle; non-interactive-style skip** — single-model findings reconciled below. Next cycle will surface the choice interactively per skill.
- Raw summary (truncated by runner): flagged `allFlags` dead code/cache broken (queryOverrides computed unused, double loop), plus overconfidence notes.

## Reconcile — classification
1. **Valid + actionable — `allFlags` dead code:** `const queryOverrides = parseQuery(search)` computed but never used; loop passed `_q` ignored by `isEnabled`, second loop overwrote first. Fix: collapse to single loop calling `isEnabled(k,{search,storage})`.
   - Action: fixed in `src/flags.js` (this commit), re-verified `node --test` 13/13 pass.
2. **Noise — geo mutation concern:** reviewer assumed in-place sort mutation; `sortByDistance` uses `map` + `withD.sort` on wrapper + `map` back — input not mutated (covered by `does not mutate input` test). No change.
3. **Noise/Trade-off — haversine edge coverage:** null/NaN/Infinity already handled; full antipodal clamp `Math.min(1, sqrt(h))` present. No change.

## Stop condition
- 1 cycle, 1 actionable fixed, re-green confirmed, remaining findings classified as noise/trade-off. Stop per skill (trivial findings threshold).

## Follow-up
- Keep `docs/doubt.md` as audit trail per doubt-driven skill; next non-trivial decision will re-run doubt cycle with explicit cross-model offer.
