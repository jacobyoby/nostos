/** @typedef {import('./nostos-types.js').LibraryRecord} LibraryRecord */

const EARTH_RADIUS_MI = 3958.7613;

/**
 * @param {string | null | undefined} s
 * @returns {string}
 */
export function title(s) {
  return (s || "")
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\bOf\b/g, "of");
}

/**
 * @param {unknown} s
 * @returns {string}
 */
export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Display a 10-digit US number as (201) 420-2346. Returns the original string
 * when it is not a 10- or 11-digit NANP value.
 * @param {unknown} s
 * @returns {string}
 */
export function formatPhone(s) {
  const raw = String(s ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  const nanp = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (nanp.length !== 10) return raw;
  return `(${nanp.slice(0, 3)}) ${nanp.slice(3, 6)}-${nanp.slice(6)}`;
}

/**
 * Digits-only tel: target, or null when there are no digits.
 * @param {unknown} s
 * @returns {string | null}
 */
export function telHref(s) {
  const digits = String(s ?? "").replace(/\D/g, "");
  return digits.length ? digits : null;
}

/**
 * Accept only http(s) URLs with no whitespace (rejects javascript:, data:,
 * parenthetical evidence notes, and non-URLs).
 * @param {unknown} s
 * @returns {string | null}
 */
export function safeHttpUrl(s) {
  if (typeof s !== "string") return null;
  const raw = s.trim();
  if (!/^https?:\/\/[^\s]+$/i.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} distance in miles
 */
export function haversineMiles(lat1, lon1, lat2, lon2) {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return Number.POSITIVE_INFINITY;
  }
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MI * c;
}

/**
 * Resolve a ZIP or town query to a lat/lon using outlet records only (no external geocoder).
 * @param {string} query
 * @param {LibraryRecord[]} libraries
 * @returns {{ lat: number; lon: number; label: string } | null}
 */
const NAME_FALLBACK_MIN_LEN = 4;
const GENERIC_NAME_TERMS = new Set([
  "main",
  "street",
  "avenue",
  "north",
  "south",
  "east",
  "west",
  "new",
  "park",
  "city",
  "library",
]);

/**
 * @param {unknown} zip
 * @returns {string | null} 5-digit ZIP, or null if the field is not a ZIP / ZIP+4
 */
function zip5Of(zip) {
  const z = String(zip || "").trim();
  if (/^\d{5}$/.test(z)) return z;
  if (/^\d{5}-\d{4}$/.test(z)) return z.slice(0, 5);
  return null;
}

/**
 * Case-fold a place name. Periods drop so "W. Milford" matches "W MILFORD".
 * @param {unknown} s
 */
function normalizePlaceName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} haystack
 * @param {string} needle
 */
function hasWordBoundary(haystack, needle) {
  if (!needle || needle.length > 80) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
}

/**
 * City match that does not treat "Milford" as "New Milford".
 * Normalized exact equality (periods stripped) — never substring includes.
 * @param {string} city
 * @param {string} term
 */
function cityMatchesQuery(city, term) {
  const c = normalizePlaceName(city);
  const t = normalizePlaceName(term);
  return Boolean(c && t && c === t);
}

export function resolveLocationQuery(query, libraries) {
  const q = query.trim();
  if (!q) return null;

  const zipMatch = q.match(/^\d{5}(?:-\d{4})?$/);
  if (zipMatch) {
    const zip5 = q.slice(0, 5);
    const hits = libraries.filter((r) => zip5Of(r.zip) === zip5 && isValidCoord(r));
    if (hits.length === 0) return null;
    return centroid(hits, `ZIP ${zip5}`);
  }

  if (q.length > 80) return null;

  const exactCity = libraries.filter((r) => isValidCoord(r) && cityMatchesQuery(String(r.city || ""), q));
  if (exactCity.length > 0) {
    const cities = [...new Set(exactCity.map((r) => normalizePlaceName(r.city)))];
    const labelCity = title(exactCity[0].city);
    const label =
      exactCity.length > 1
        ? `${labelCity} (${exactCity.length} locations)`
        : labelCity;
    return centroid(exactCity, cities.length === 1 ? label : `${title(q)} (${exactCity.length} locations)`);
  }

  const term = q.toLowerCase();
  if (term.length < NAME_FALLBACK_MIN_LEN || term.length > 80 || GENERIC_NAME_TERMS.has(term)) return null;

  const nameHits = libraries.filter(
    (r) =>
      isValidCoord(r) &&
      [r.outlet_name, r.system_name].some((f) => hasWordBoundary(String(f || ""), term)),
  );
  if (nameHits.length > 0) return centroid(nameHits, q);

  return null;
}

/**
 * @param {LibraryRecord} r
 */
function isValidCoord(r) {
  return Number.isFinite(r.lat) && Number.isFinite(r.lon);
}

/**
 * @param {LibraryRecord[]} hits
 * @param {string} label
 */
function centroid(hits, label) {
  let lat = 0;
  let lon = 0;
  for (const h of hits) {
    lat += h.lat;
    lon += h.lon;
  }
  return { lat: lat / hits.length, lon: lon / hits.length, label };
}

/**
 * @param {LibraryRecord} r
 */
export function statusOf(r) {
  return (r.outreach && r.outreach.status) || "todo";
}

/**
 * @param {LibraryRecord} r
 */
export function legalOf(r) {
  if (r.has_legal_help_program === true) return "yes";
  if (r.has_legal_help_program === false) return "no";
  return "unknown";
}

/**
 * @param {LibraryRecord[]} all
 * @param {object} opts
 * @param {string} [opts.term]
 * @param {string} [opts.county]
 * @param {string} [opts.status]
 * @param {string} [opts.legal]
 */
export function filterDirectory(all, opts) {
  const term = (opts.term || "").trim().toLowerCase();
  const county = opts.county || "";
  const st = opts.status || "";
  const lg = opts.legal || "";
  return all.filter(
    (r) =>
      (!county || r.county === county) &&
      (!st || statusOf(r) === st) &&
      (!lg || legalOf(r) === lg) &&
      (!term || [r.outlet_name, r.system_name, r.city, r.zip].filter(Boolean).join(" ").toLowerCase().includes(term)),
  );
}

/**
 * @param {LibraryRecord[]} all
 * @param {number} lat
 * @param {number} lon
 * @param {object} opts
 * @param {string} [opts.county]
 * @param {string} [opts.outletType]
 * @param {number} [opts.limit]
 */
export function nearestLibraries(all, lat, lon, opts = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  const county = opts.county || "";
  const outletType = opts.outletType || "";
  const limit = opts.limit ?? 50;

  const withDist = all
    .filter((r) => isValidCoord(r))
    .filter((r) => (!county || r.county === county) && (!outletType || r.outlet_type === outletType))
    .map((r) => ({
      record: r,
      distanceMi: haversineMiles(lat, lon, r.lat, r.lon),
    }))
    .filter((x) => Number.isFinite(x.distanceMi))
    .sort((a, b) => a.distanceMi - b.distanceMi);

  return withDist.slice(0, Math.max(0, limit));
}

/**
 * @param {LibraryRecord[]} all
 */
export function progressStats(all) {
  const counties = [...new Set(all.map((r) => r.county).filter(Boolean))].sort();
  const by = { contacted: 0, posted: 0, partner: 0 };
  for (const r of all) {
    const s = statusOf(r);
    if (s in by) by[s]++;
  }
  const done = by.contacted + by.posted + by.partner;
  const legal = all.filter((r) => r.has_legal_help_program === true).length;
  const systems = new Set(all.map((r) => r.system_name)).size;
  return {
    total: all.length,
    systems,
    counties: counties.length,
    countyList: counties,
    reached: done,
    postedPartner: by.posted + by.partner,
    legal,
    donePct: all.length ? (100 * done) / all.length : 0,
  };
}

/**
 * @param {LibraryRecord} r
 */
export function outletKey(r) {
  return `${r.fscskey}-${r.fscs_seq}`;
}

/**
 * @param {LibraryRecord[]} all
 * @param {string} key
 */
export function findOutlet(all, key) {
  return all.find((r) => outletKey(r) === key) || null;
}

export const SERVICE_NAMES = Object.freeze([
  "legal-help desk",
  "lawyer-in-the-library",
  "notary",
  "passport",
  "printing/scanning",
  "meeting rooms",
  "tax prep",
  "language help",
  "computer access",
  "other",
]);

export const PROPOSAL_KINDS = Object.freeze(["service", "hours", "resource"]);

/**
 * @param {unknown} raw
 * @returns {{ name: string; evidence_url: string | null; verified_on: string | null } | null}
 */
export function normalizeService(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return null;
  const allowed = SERVICE_NAMES.includes(name) || name.startsWith("other:");
  if (!allowed) return null;
  return {
    name,
    evidence_url: safeHttpUrl(raw.evidence_url),
    verified_on: typeof raw.verified_on === "string" ? raw.verified_on : null,
  };
}

/**
 * @param {LibraryRecord} r
 */
export function servicesOf(r) {
  if (!Array.isArray(r.services)) return [];
  return r.services.map(normalizeService).filter(Boolean);
}

/**
 * @param {unknown} field
 * @returns {{ value: string; verified_on: string | null } | null}
 */
export function contactField(field) {
  if (field == null) return null;
  if (typeof field === "string") {
    const value = field.trim();
    return value ? { value, verified_on: null } : null;
  }
  if (typeof field === "object" && typeof field.value === "string" && field.value.trim()) {
    return {
      value: field.value.trim(),
      verified_on: typeof field.verified_on === "string" ? field.verified_on : null,
    };
  }
  return null;
}

const DAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/**
 * @param {string} hhmm
 * @returns {number | null} minutes from midnight
 */
function parseHhmm(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * @param {string} hhmm
 * @returns {string}
 */
export function formatClock(hhmm) {
  const mins = parseHhmm(hhmm);
  if (mins == null) return String(hhmm || "");
  const hour24 = Math.floor(mins / 60);
  const min = mins % 60;
  const ampm = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(min).padStart(2, "0")} ${ampm}`;
}

/**
 * @param {LibraryRecord} r
 * @returns {{ day: string, open: string, close: string }[]}
 */
export function hoursSlots(r) {
  if (Array.isArray(r?.hours)) return r.hours;
  if (r?.hours && Array.isArray(r.hours.days)) return r.hours.days;
  return [];
}

/**
 * Open-now / opens-at using America/New_York. Weekly IMLS totals are not a schedule.
 * @param {LibraryRecord} r
 * @param {Date} [now]
 */
export function hoursStatus(r, now = new Date()) {
  const slots = hoursSlots(r);
  if (slots.length > 0) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
    const dayName = String(parts.weekday || "").toLowerCase();
    const nowMin = parseHhmm(`${parts.hour}:${parts.minute}`);
    const today = slots.filter((s) => String(s.day || "").toLowerCase() === dayName);
    for (const s of today) {
      const open = parseHhmm(s.open);
      const close = parseHhmm(s.close);
      if (open == null || close == null || nowMin == null) continue;
      if (nowMin >= open && nowMin < close) {
        return { kind: "open", label: `Open now · closes ${formatClock(s.close)}` };
      }
    }
    const upcoming = slots
      .map((s) => ({ s, idx: DAY_INDEX[String(s.day || "").toLowerCase()] }))
      .filter((x) => x.idx != null)
      .sort((a, b) => a.idx - b.idx);
    const todayIdx = DAY_INDEX[dayName];
    if (todayIdx != null) {
      const laterToday = today
        .map((s) => ({ s, open: parseHhmm(s.open) }))
        .filter((x) => x.open != null && nowMin != null && x.open > nowMin)
        .sort((a, b) => a.open - b.open)[0];
      if (laterToday) {
        return { kind: "opens", label: `Opens at ${formatClock(laterToday.s.open)}` };
      }
      const next = upcoming.find((x) => x.idx > todayIdx) || upcoming[0];
      if (next) {
        return { kind: "opens", label: `Opens ${title(next.s.day)} at ${formatClock(next.s.open)}` };
      }
    }
    return { kind: "closed", label: "Closed" };
  }
  return { kind: "unpublished", label: "Hours not published" };
}

/**
 * @param {LibraryRecord} r
 * @returns {{ day: string, label: string }[]}
 */
export function hoursWeek(r) {
  const slots = hoursSlots(r);
  return DAY_ORDER.map((day) => {
    const today = slots.filter((s) => s.day === day);
    if (!today.length) return { day, label: "Closed" };
    return {
      day,
      label: today.map((s) => `${formatClock(s.open)}–${formatClock(s.close)}`).join(", "),
    };
  });
}

/**
 * @param {object} input
 * @returns {{ ok: true; proposal: object } | { ok: false; error: string }}
 */
export function makeProposal(input) {
  const kind = input && input.kind;
  if (!PROPOSAL_KINDS.includes(kind)) {
    return { ok: false, error: "Kind must be service, hours, or resource." };
  }
  const outlet_key = typeof input.outlet_key === "string" ? input.outlet_key.trim() : "";
  if (!/^[A-Z]{2}\d{4}-\d{3}$/.test(outlet_key)) {
    return { ok: false, error: "Outlet key is required." };
  }
  const value = typeof input.value === "string" ? input.value.trim() : "";
  if (!value || value.length > 200) {
    return { ok: false, error: "Value is required (max 200 characters)." };
  }
  if (/[★☆⭐]|\b(stars?|rating|review)\b/i.test(value)) {
    return { ok: false, error: "Ratings and reviews are not accepted." };
  }
  if (kind === "service") {
    const okName = SERVICE_NAMES.includes(value) || value.startsWith("other:");
    if (!okName) return { ok: false, error: "Service must be a known name or other:…" };
  }
  const evidence_url = input.evidence_url ? safeHttpUrl(input.evidence_url) : null;
  if (input.evidence_url && !evidence_url) {
    return { ok: false, error: "Evidence must be an http(s) URL." };
  }
  const submitter = typeof input.submitter_contact === "string" ? input.submitter_contact.trim() : "";
  return {
    ok: true,
    proposal: {
      outlet_key,
      kind,
      value,
      evidence_url,
      submitter_contact: submitter || null,
    },
  };
}

/**
 * Apply an accepted proposal onto a copy of the outlet record.
 * @param {LibraryRecord} record
 * @param {object} proposal
 */
export function applyAcceptedProposal(record, proposal) {
  const next = { ...record, services: Array.isArray(record.services) ? [...record.services] : [] };
  if (proposal.kind === "service") {
    const svc = normalizeService({
      name: proposal.value,
      evidence_url: proposal.evidence_url,
      verified_on: proposal.verified_on || null,
    });
    if (svc && !next.services.some((s) => s && s.name === svc.name)) next.services.push(svc);
  } else if (proposal.kind === "hours") {
    next.proposed_hours_note = proposal.value;
  } else if (proposal.kind === "resource") {
    next.resources = Array.isArray(next.resources) ? [...next.resources] : [];
    next.resources.push({ name: proposal.value, evidence_url: proposal.evidence_url || null });
  }
  return next;
}

/**
 * @param {object} proposal
 * @param {string} [repo]
 */
export function proposalIssueUrl(proposal, repo = "jacobyoby/nostos") {
  const title = `Proposal: ${proposal.kind} at ${proposal.outlet_key}`;
  const body = [
    "```json",
    JSON.stringify(proposal, null, 2),
    "```",
    "",
    "Maintainer: move this object into data/proposals/accepted.json or rejected.json.",
  ].join("\n");
  return `https://github.com/${repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
