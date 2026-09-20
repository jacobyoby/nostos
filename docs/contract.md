# Contract — nj-libraries.json (Public API)

Source-of-truth for every consumer of `data/nj-libraries.json` (currently `src/index.html`; future community-input, contact features). Contract-first: change this file, then implement. [Hyrum's Law](https://www.hyrumslaw.com/) applies — every observable behavior becomes a dependency, so this contract is intentionally stingy.

## Interface (TypeScript shape)

```ts
// Input (IMLS + NJSL) → merge → Output (this contract)
interface Outlet {
  fscskey: string;               // IMLS FSCS key, e.g. "NJ0003"
  fscs_seq: string;              // sequence within system, e.g. "002"
  system_name: string;           // canonical, upper-case from IMLS
  outlet_name: string;           // outlet display name
  outlet_type: "central" | "branch" | "bookmobile" | "books-by-mail" | string;
  address: string | null;
  city: string | null;
  zip: string | null;
  county: string | null;         // uppercase, matches `data/nj-libraries.json` ordering key
  phone: string | null;          // digits only if present
  lat: number | null;
  lon: number | null;
  hours_open_weekly: number | null;
  source_year: "FY2023";         // pinned

  // Joined from njsl-systems via normalize_name(system_name)
  website: string | null;        // https? URL if known
  catalog_url: string | null;
  library_card_signup_url: string | null;
  has_legal_help_program: boolean | null;   // true/false if known, null unknown
  legal_help_evidence: string | null;       // URL evidence when true

  outreach: { status: "todo" | "contacted" | "posted" | "partner"; notes: string | null; }
}

// List contract
type NjLibraries = Outlet[];
```

## Rules

- **Required:** `fscskey`, `fscs_seq`, `system_name`, `outlet_name`, `outreach`. Everything else nullable.
- **Naming:** snake_case in JSON (matches IMLS source), camelCase only in JS locals. Booleans `has_*`, enums UPPER not needed (outreach is lowercase per script).
- **Sorting:** `merge` sorts by `(county, system_name, outlet_name)` — but consumers MUST NOT depend on order; it's not part of the contract (Hyrum). Sort explicitly if order matters.
- **Additive only:** new optional fields may appear; no existing field will change type or be removed without a major contract bump and migration.
- **Null vs missing:** absent fields are treated as `null` by the validator; do not depend on key presence.

## Validation — Where

- **Producer (boundary):** `scripts/merge.py:merge` validates required keys, throws `ValueError` on bad shape (fail-loud).
- **Consumer (boundary):** `src/validate.js:isValidOutlet` + `src/index.html` fetch handler validates array shape before render; on failure, shows user-visible error and logs structured error (no silent misrender).
- **Third-party source:** IMLS CSV is untrusted — `scripts/ingest_imls_nj.py` validates row shape before emit.

## Errors (consistent)

```ts
// ValidationError — thrown at boundaries, never leaked as HTML
{ code: "VALIDATION_ERROR", message: "nj-libraries.json shape invalid", details: { path: "0.outreach.status", expected: "todo|contacted|posted|partner" } }
```

No HTTP API yet — when a REST endpoint arrives, it will use `422` for validation, `404` for not-found, `409` for duplicate key, and the same `{ error:{code,message,details}}` envelope.

## Versioning

One JSON file, one version at a time (no forked APIs). Consumers pin to `data/nj-libraries.meta.json` if needed; breaking changes bump a `contract_version` field (not yet needed).

## Checklist (per skill)

- [x] Typed input/output (`Outlet`, `NjLibraries`) committed here
- [x] Validation at boundaries (produce + consume)
- [ ] Pagination (N/A — static 449 rows; paginate when >1k or when endpoint added)
- [ ] Naming consistent (snake_case JSON, camelCase JS)
- [ ] Additive & docs committed with implementation
