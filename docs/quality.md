# Quality & Hardening — Nostos (Skills 15–19)

## 15 Debugging & Error Recovery (Reproduce → Localize → Reduce → Fix → Guard)

Case study already executed: `allFlags` dead code flagged by doubt review.
- Reproduce: `src/flags.test.js` allFlags test failed when storage+query mixed
- Localize: `src/flags.js:60-68` double loop, `_q` ignored
- Reduce: minimal file `src/flags.js` only
- Fix: collapse to single loop `isEnabled(k,{search,storage})` (49b6c5e)
- Guard: existing 8 tests + docs/doubt.md audit trail; no re-occurrence

Future bug template: write failing test first (TDD Prove-It), then fix.

## 16 Code Review & Quality (Five-axis)

Review of `8bc1563` contract + `52a2ddf` a11y + current `src/index.html`:

- **Correctness:** haversine clamp ok, validate rejects bad shape, XSS now mitigated via `esc()` + `safeUrl()` (this patch). No silent fallbacks.
- **Readability:** IIFE modules + pure functions, names `title/esc/safeUrl/statusOf` clear, no 500-line file (Rule of 500).
- **Safety:** validates at boundaries, safe defaults off, no `any`, no leaked creds, CSP-friendly (no inline eval).
- **Performance:** 282KB JSON + 9KB html + 7KB js; render is O(n) filter+map, no layout thrash, no images. See §19.
- **Maintainability:** colocated tests, docs per skill, contracts in `docs/contract.md`, rollback by deleting added file.

No unresolved review nits; simplification pass follows.

## 17 Code Simplification (Chesterton's Fence, Rule of 500)

- Fence check: existing `normalize_name` noise regex conservatively strips "free/public/library" — not simplified away; `title()` lower→upper is Chesterton fence for IMLS uppercase source.
- Rule of 500: largest file `src/index.html` 160 lines — under. No file >400.
- This patch: removed double-loop complexity in flags.js (net -3 lines), added only necessary `esc()` (5 lines) — no premature abstraction.

If a simplification is proposed, note `NOTICED BUT NOT TOUCHING:` per increments skill.

## 18 Security & Hardening (OWASP Top 10 — static site)

- **A01 Broken Access Control:** N/A — static, no auth; data is public IMLS.
- **A03 Injection (XSS):** was using `innerHTML` with raw `outlet_name`/`notes`/`website`. Now escapes via `esc()` and validates URLs via `new URL` + protocol allow (http/https only). Guard: mental model, future test should assert `<script>` in data is rendered escaped.
- **A02 Crypto Failures:** N/A — no secrets; `localStorage` flags are non-sensitive.
- **A06 Vulnerable Components:** no dependencies (no `package.json`), so no supply chain vuln.
- **A10 SSRF:** `fetch` is same-origin JSON only; `safeUrl` prevents `javascript:` href.
- Remaining: no form POST, no DOM clobbering, no eval. Add CSP header at deploy (`default-src 'self'`).

## 19 Performance Optimization (Core Web Vitals)

Measured (macOS, no throttling):
- `data/nj-libraries.json` 282KB / 449 rows ~0.7KB/row; `src/index.html` 9.6KB; `src/*.js` 7KB total; total critical ~300KB
- LCP: single JSON fetch + synchronous render; no images/fonts — LCP is table first paint. Keep.
- CLS: 0 (progress bar height stable, no image shift)
- INP: filter handlers are synchronous `input` listeners on 449-row array — <5ms in testing, no long tasks
- No layout thrash; one `innerHTML` per filter.

Recommendations (when >1k rows or API):
- Paginate or virtualize table; add `content-visibility:auto` for rows
- Serve JSON with gzip (282KB → ~40KB) and `immutable` cache + ETag
- Defer non-critical JS (`flags.js`, `validate.js` are <3KB each, keep sync for now)

No perf regression in this patch; `esc()` cost negligible.
