# ADR 001 — Vanilla JS + Python stdlib (no bundler, no framework)

Date: 2026-09-19
Status: Accepted
Context: Nostos is a 449-row static finder for NJ public libraries. Product spec says Finder + community input (no reviews) + contact admin, publicly funded only (IMLS source). Team is small, data pipeline is Python, site is read-only table with filters.

Decision: Keep `src/index.html` as single HTML file with inline CSS + IIFE JS modules (`flags.js`, `geo.js`, `validate.js`), no `package.json`, no bundler, no React/Vue. Python stays stdlib (`unittest`, no pytest). Tests via `node:test` + `unittest discover`.

Consequences:
- + Fastest load (~300KB total, no hydration), simplest CI, no supply-chain vuln.
- + Contract `data/nj-libraries.json` remains stable; future nearest/geo can be added behind flags without framework churn.
- − No component hot-reload; manual IIFE exports; if community-input adds POST, may revisit.

Alternatives considered: Vite+React (rejected: 449 rows don't need SPA), Next.js (rejected: no SSR need yet).

Related: `docs/contract.md`, `docs/sources.md`, `CLAUDE.md`.
