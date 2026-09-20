# Observability — Structured Logging, RED (24)

Nostos is static; observability is client-side + data-pipeline.

## Structured logging (no OpenTelemetry agent yet)

- **Browser:** `console.error("Contract validation failed:", {code, message, details})` in `src/index.html` — structured object, not interpolated string. Future flag posts will log `{flag, enabled}`.
- **Python:** `scripts/merge.py` prints JSON summary `{outlets, systems_in_directory, unmatched_system_names, out}` to stdout — parseable for CI dashboards.
- **No PII in logs** — outlet data is public IMLS.

## RED (Rate/Errors/Duration) — lightweight

- Rate: JSON fetch 1 per pageview; count via server access logs (`/data/nj-libraries.json` 200s).
- Errors: contract validation errors (see above) + fetch !ok → thrown.
- Duration: `performance.now()` around `fetch`+`render` when nearest feature lands; until then, manual via DevTools Performance trace.

## When to graduate to OTel

Add endpoint + `fetch`-instrumented OTel JS only when we add a backend or user-initiated writes (community input, contact). Not before.

## Checklist

- [x] Logs are structured, not string-interpolated
- [x] Errors include code + details
- [x] No secrets in logs/data
