# Nostos

Find a public library. Every publicly funded library in New Jersey, every outlet, as open data and one page.

- `data/nj-libraries.json` — canonical list (IMLS Public Libraries Survey outlets, enriched from the NJ State Library directory)
- `src/index.html` — the finder page; reads the JSON, shows a progress counter of records verified
- `scripts/` — ingest and merge tools; re-runnable, never edit the JSON by hand

Source of truth for "publicly funded": IMLS PLS outlet file, filtered to NJ. Anything not in IMLS needs a citation before it goes in.
