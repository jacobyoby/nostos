// validate.js — contract validator for nj-libraries.json (see docs/contract.md).
// Pure, no I/O. Used at consumer boundary in src/index.html and in tests.
// Source: contract-first — docs/contract.md is spec, this is impl.
(function (global) {
  const STATUSES = new Set(["todo", "contacted", "posted", "partner"]);

  function isValidOutlet(o) {
    if (!o || typeof o !== "object") return "not an object";
    if (typeof o.fscskey !== "string" || !o.fscskey.trim()) return "fscskey required";
    if (typeof o.fscs_seq !== "string" || !o.fscs_seq.trim()) return "fscs_seq required";
    if (typeof o.system_name !== "string" || !o.system_name.trim()) return "system_name required";
    if (typeof o.outlet_name !== "string" || !o.outlet_name.trim()) return "outlet_name required";
    if (!o.outreach || typeof o.outreach !== "object") return "outreach required";
    if (!STATUSES.has(o.outreach.status)) return "outreach.status invalid";
    // Other fields nullable strings/numbers — no throw, just ensure no wrong-type crash where used
    return null;
  }

  function validateAll(arr) {
    if (!Array.isArray(arr)) return { code: "VALIDATION_ERROR", message: "expected array", details: { type: typeof arr } };
    for (let i = 0; i < arr.length; i++) {
      const err = isValidOutlet(arr[i]);
      if (err) return { code: "VALIDATION_ERROR", message: `item ${i}: ${err}`, details: { path: `${i}`, outlet: arr[i] } };
    }
    return null;
  }

  const api = { isValidOutlet, validateAll, STATUSES: [...STATUSES] };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.Validate = api;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
