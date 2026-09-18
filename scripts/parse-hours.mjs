/** Parse library hours from schema.org JSON-LD and unambiguous HTML. Null beats guessed. */

const DAY_ALIASES = {
  mo: "monday",
  mon: "monday",
  monday: "monday",
  tu: "tuesday",
  tue: "tuesday",
  tues: "tuesday",
  tuesday: "tuesday",
  we: "wednesday",
  wed: "wednesday",
  wednesday: "wednesday",
  th: "thursday",
  thu: "thursday",
  thur: "thursday",
  thurs: "thursday",
  thursday: "thursday",
  fr: "friday",
  fri: "friday",
  friday: "friday",
  sa: "saturday",
  sat: "saturday",
  saturday: "saturday",
  su: "sunday",
  sun: "sunday",
  sunday: "sunday",
};

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/**
 * @param {string} token
 * @returns {string | null}
 */
export function dayName(token) {
  const key = String(token || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/schema\.org\//, "");
  return DAY_ALIASES[key] || null;
}

/**
 * @param {string} raw
 * @returns {string | null} 24h HH:MM
 */
export function toHhmm(raw) {
  const s = String(raw || "")
    .trim()
    .replace(/\u00a0/g, " ")
    .toUpperCase();
  const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(AM|PM)$/);
  if (ampm) {
    let h = Number(ampm[1]);
    const min = Number(ampm[2] || "0");
    if (h < 1 || h > 12 || min > 59) return null;
    if (ampm[3] === "AM") h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  const mil = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!mil) return null;
  const h = Number(mil[1]);
  const min = Number(mil[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * @param {string} start
 * @param {string | null} end
 * @returns {string[]}
 */
export function expandDayRange(start, end) {
  const a = DAY_ORDER.indexOf(start);
  if (a < 0) return [];
  if (!end) return [start];
  const b = DAY_ORDER.indexOf(end);
  if (b < 0 || b < a) return [start];
  return DAY_ORDER.slice(a, b + 1);
}

const CLOCK =
  "(\\d{1,2}(?::\\d{2})?(?::\\d{2})?(?:\\s*[AaPp][Mm])?)";

/**
 * Schema.org compact openingHours: "Mo 10:00-20:00, Tu 10:00-17:00, Su 13:00-17:00"
 * also "Mo-Th 10:00-20:00, Fr 10:00-17:00"
 * @param {string} s
 * @returns {{ day: string, open: string, close: string }[]}
 */
export function parseOpeningHoursString(s) {
  const slots = [];
  const parts = String(s || "")
    .replace(/\u2013|\u2014|&ndash;|&#8211;/g, "-")
    .split(/[,;]/);
  const re = new RegExp(`^([A-Za-z]+)(?:\\s*-\\s*([A-Za-z]+))?\\s+${CLOCK}\\s*-\\s*${CLOCK}$`);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const m = trimmed.match(re);
    if (!m) continue;
    const open = toHhmm(m[3]);
    const close = toHhmm(m[4]);
    if (!open || !close || open === close) continue;
    const start = dayName(m[1]);
    const end = m[2] ? dayName(m[2]) : null;
    if (!start) continue;
    for (const day of expandDayRange(start, end)) {
      slots.push({ day, open, close });
    }
  }
  return dedupeSlots(slots);
}

/**
 * @param {unknown} spec
 * @returns {{ day: string, open: string, close: string }[]}
 */
export function parseOpeningHoursSpec(spec) {
  const nodes = Array.isArray(spec) ? spec : [spec];
  const slots = [];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const opens = toHhmm(node.opens);
    const closes = toHhmm(node.closes);
    if (!opens || !closes) continue;
    const days = Array.isArray(node.dayOfWeek) ? node.dayOfWeek : [node.dayOfWeek];
    for (const d of days) {
      const day = dayName(typeof d === "string" ? d : "");
      if (day) slots.push({ day, open: opens, close: closes });
    }
  }
  return dedupeSlots(slots);
}

/**
 * @param {{ day: string, open: string, close: string }[]} slots
 */
function dedupeSlots(slots) {
  const seen = new Set();
  const out = [];
  for (const s of slots) {
    const key = `${s.day}|${s.open}|${s.close}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  out.sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.open.localeCompare(b.open));
  return out;
}

/**
 * Accept only if at least 4 distinct weekdays — a partial invented row is worse than null.
 * @param {{ day: string, open: string, close: string }[]} slots
 */
export function isCompleteEnough(slots) {
  const days = new Set(slots.map((s) => s.day));
  return days.size >= 4;
}

function walkJson(value, acc) {
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, acc);
    return;
  }
  if (!value || typeof value !== "object") return;
  acc.push(value);
  for (const v of Object.values(value)) walkJson(v, acc);
}

/**
 * @param {string} html
 * @returns {object[]}
 */
export function extractJsonLd(html) {
  const blocks = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // JSON-LD with trailing commas is not trusted.
    }
  }
  const nodes = [];
  for (const b of blocks) walkJson(b, nodes);
  return nodes;
}

/**
 * @param {string} html
 * @returns {{ day: string, open: string, close: string }[]}
 */
export function parseHoursFromJsonLd(html) {
  const nodes = extractJsonLd(html);
  const slots = [];
  for (const node of nodes) {
    const types = []
      .concat(node["@type"] || [])
      .map((t) => String(t).toLowerCase());
    if (node.openingHoursSpecification) {
      slots.push(...parseOpeningHoursSpec(node.openingHoursSpecification));
    }
    if (node.openingHours) {
      const raw = Array.isArray(node.openingHours) ? node.openingHours.join(", ") : String(node.openingHours);
      slots.push(...parseOpeningHoursString(raw));
    }
    if (types.includes("openinghoursspecification") && node.opens) {
      slots.push(...parseOpeningHoursSpec(node));
    }
  }
  return dedupeSlots(slots);
}

const HTML_DAY_LINE =
  /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b\s*[:.]?\s*(?:Closed|(?:(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*(?:-|–|—|&ndash;|&#8211;|to)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))))/gi;

const HTML_DAY_RANGE =
  /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*(?:-|–|—|to)\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*[:.]?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*(?:-|–|—|&ndash;|&#8211;|to)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/gi;

/**
 * Microdata itemprop="openingHours" content="Mo-Fr 09:00-17:00"
 * @param {string} html
 * @returns {{ day: string, open: string, close: string }[]}
 */
export function parseHoursFromMicrodata(html) {
  const slots = [];
  const re =
    /itemprop=["']openingHours["'][^>]*content=["']([^"']+)["']|content=["']([^"']+)["'][^>]*itemprop=["']openingHours["']/gi;
  let m;
  while ((m = re.exec(html))) {
    slots.push(...parseOpeningHoursString(m[1] || m[2] || ""));
  }
  return dedupeSlots(slots);
}

/**
 * Visible-text hours. Split into week blocks when the weekday order resets so
 * a main library and a branch on the same page are not mashed together.
 * @param {string} html
 * @returns {{ day: string, open: string, close: string }[]}
 */
export function parseHoursFromHtml(html) {
  let text = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8211;|&ndash;|&mdash;/g, "-")
    .replace(/\s+/g, " ");
  text = text.replace(HTML_DAY_RANGE, (_, a, b, open, close) => {
    const days = expandDayRange(dayName(a), dayName(b));
    return days.map((d) => `${d}: ${open} - ${close}`).join(" ");
  });
  const hits = [];
  const re = new RegExp(HTML_DAY_LINE.source, "gi");
  let m;
  while ((m = re.exec(text))) {
    const day = dayName(m[1]);
    if (!day) continue;
    if (!m[2] || !m[3]) {
      hits.push({ day, open: null, close: null });
      continue;
    }
    const open = toHhmm(m[2]);
    const close = toHhmm(m[3]);
    if (open && close) hits.push({ day, open, close });
  }
  const blocks = [];
  let current = [];
  let lastIdx = -1;
  for (const hit of hits) {
    const idx = DAY_ORDER.indexOf(hit.day);
    if (idx < lastIdx) {
      blocks.push(current);
      current = [];
    }
    current.push(hit);
    lastIdx = idx;
  }
  if (current.length) blocks.push(current);
  const complete = [];
  for (const block of blocks) {
    const slots = dedupeSlots(block.filter((h) => h.open && h.close));
    if (isCompleteEnough(slots)) complete.push(slots);
  }
  if (complete.length >= 1) return complete[0];
  return [];
}

/**
 * @param {string} html
 * @returns {{ day: string, open: string, close: string }[]}
 */
export function parseHoursFromPage(html) {
  const fromLd = parseHoursFromJsonLd(html);
  if (isCompleteEnough(fromLd)) return fromLd;
  const fromMicro = parseHoursFromMicrodata(html);
  if (isCompleteEnough(fromMicro)) return fromMicro;
  const fromHtml = parseHoursFromHtml(html);
  if (isCompleteEnough(fromHtml)) return fromHtml;
  return [];
}
