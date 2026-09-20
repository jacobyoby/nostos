// flags.js — tiny feature-flag helper for incremental delivery.
// Sources: URLSearchParams https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
//          localStorage https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
//          IIFE/globalThis https://developer.mozilla.org/en-US/docs/Glossary/IIFE
// Rule 3 (feature flags) + Rule 4 (safe defaults: off unless explicitly enabled).
// Usage in index.html:
//   <script src="flags.js"></script>
//   if (Flags.isEnabled('nearest')) { /* gated UI */ }
// Sources (priority order): hardcoded defaults → ?flags=a,b → ?enable_<flag>=1 → localStorage nostos_flags
// All flags default to false. No flag is enabled without an explicit opt-in.
(function (global) {
  const DEFAULTS = Object.freeze({
    nearest: false,
    community_input: false,
    contact_admin: false,
  });

  function parseQuery(search) {
    const out = {};
    const params = new URLSearchParams(search || "");
    const list = params.get("flags");
    if (list) {
      for (const name of list.split(",")) {
        const key = name.trim().toLowerCase();
        if (key && key in DEFAULTS) out[key] = true;
      }
    }
    for (const key of Object.keys(DEFAULTS)) {
      if (params.get("enable_" + key) === "1" || params.get("enable_" + key) === "true") out[key] = true;
      if (params.get("disable_" + key) === "1" || params.get("disable_" + key) === "true") out[key] = false;
    }
    return out;
  }

  function parseStorage() {
    try {
      const raw = global.localStorage && global.localStorage.getItem("nostos_flags");
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      const out = {};
      for (const k of Object.keys(DEFAULTS)) if (parsed[k] === true) out[k] = true;
      return out;
    } catch {
      return {};
    }
  }

  function isEnabled(name, opts) {
    const search = opts && typeof opts.search === "string" ? opts.search : (global.location ? global.location.search : "");
    const storageOverrides = opts && opts.storage ? opts.storage : parseStorage();
    const queryOverrides = opts && typeof opts.search === "string" ? parseQuery(opts.search) : parseQuery(search);
    // Priority: defaults < storage < query  (query wins for manual testing)
    if (name in queryOverrides) return queryOverrides[name];
    if (name in storageOverrides) return storageOverrides[name];
    if (name in DEFAULTS) return DEFAULTS[name];
    return false;
  }

  function allFlags(opts) {
    const search = opts && typeof opts.search === "string" ? opts.search : (global.location ? global.location.search : "");
    const storageOverrides = opts && opts.storage ? opts.storage : parseStorage();
    const queryOverrides = parseQuery(search);
    const out = {};
    for (const k of Object.keys(DEFAULTS)) out[k] = isEnabled(k, { search, storage: storageOverrides, _q: queryOverrides });
    // isEnabled already handles priority; recompute simply:
    for (const k of Object.keys(DEFAULTS)) out[k] = isEnabled(k, { search, storage: storageOverrides });
    return out;
  }

  const Flags = { DEFAULTS, isEnabled, allFlags, _parseQuery: parseQuery };

  // Export for both browser globals and Node/test ESM-like require
  if (typeof module !== "undefined" && module.exports) module.exports = Flags;
  else global.Flags = Flags;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
