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
export function resolveLocationQuery(query, libraries) {
  const q = query.trim();
  if (!q) return null;

  const zipMatch = q.match(/^\d{5}(?:-\d{4})?$/);
  if (zipMatch) {
    const zip5 = q.slice(0, 5);
    const hits = libraries.filter((r) => String(r.zip || "").startsWith(zip5) && isValidCoord(r));
    if (hits.length === 0) return null;
    return centroid(hits, `ZIP ${zip5}`);
  }

  const term = q.toLowerCase();
  const cityHits = libraries.filter((r) => String(r.city || "").toLowerCase().includes(term) && isValidCoord(r));
  if (cityHits.length > 0) return centroid(cityHits, title(cityHits[0].city));

  const nameHits = libraries.filter(
    (r) =>
      isValidCoord(r) &&
      [r.outlet_name, r.system_name, r.address].some((f) => String(f || "").toLowerCase().includes(term)),
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
