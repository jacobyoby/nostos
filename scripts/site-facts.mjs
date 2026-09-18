/** Classify library-website links for services, hours, and contact. Pure. */

export const SERVICE_RULES = [
  { name: "notary", href: /notary/i, text: /\bnotary\b/i },
  { name: "passport", href: /passport/i, text: /\bpassports?\b/i },
  { name: "meeting rooms", href: /meeting[-_/ ]?rooms?|room[-_/ ]?reserv|study[-_/ ]?room/i, text: /\bmeeting rooms?\b|\bstudy rooms?\b/i },
  { name: "tax prep", href: /tax[-_/ ]?prep|\bvita\b/i, text: /\btax prep\b|\bvita\b/i },
  { name: "language help", href: /\/esl\/?|\besol\b|english-as-a-second|esl-classes/i, text: /\besl\b|\besol\b|english as a second/i },
  { name: "computer access", href: /public-access-computer|public-computers?/i, text: /public access computers?|public computers?/i },
  { name: "printing/scanning", href: /mobile-print|print(ing)?[-_/ ]?scan|online-print/i, text: /mobile printing|print(ing)? and scan/i },
  { name: "lawyer-in-the-library", href: /lawyer-in-the-library|lawyerinthe/i, text: /lawyer in the library/i },
];

function absolutize(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return "";
  }
}

export function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

export function extractLinks(html, base) {
  const out = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const hrefMatch = m[1].match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const href = absolutize(hrefMatch[1].replace(/&amp;/g, "&"), base);
    const text = stripTags(m[2]).trim();
    if (href) out.push({ href, text });
  }
  return out;
}

export function classifyServiceLink(link) {
  let path = "";
  try {
    path = new URL(link.href).pathname;
  } catch {
    path = "";
  }
  const hay = `${link.href} ${link.text}`;
  if (/board-games|boardgames|game night|teenadvisory/i.test(hay)) return null;
  for (const rule of SERVICE_RULES) {
    if (rule.href.test(path) || rule.href.test(link.href) || rule.text.test(link.text)) {
      return rule;
    }
  }
  return null;
}

export function isBoardLink(link) {
  const hay = `${link.href} ${link.text}`;
  if (/libcal|board-games|boardgames|teenadvisory|advisory-board|teen-advisory|eventdetail|event-detail|\/calendars?\//i.test(hay)) {
    return false;
  }
  return /board of trustees|library board|board of directors|governing body/i.test(link.text);
}

export function isHoursLink(link) {
  return /\bhours\b|hours-of|location-hours|\/hours/i.test(`${link.text} ${link.href}`);
}

export function isContactLink(link) {
  let path = "";
  try {
    path = new URL(link.href).pathname.toLowerCase();
  } catch {
    path = "";
  }
  if (/books-by-mail|interlibrary|card-application|room-reserv/.test(path)) return false;
  if (/\/contact\/?$|\/contact-us\/?$/.test(path)) return true;
  return /^(contact us|contact the library)$/i.test(link.text.trim()) && /contact/i.test(path);
}

export function isHoursPath(url) {
  try {
    const p = new URL(url).pathname.toLowerCase().replace(/\/+$/, "") || "/";
    if (p === "/") return true;
    return /\/(hours|visit|about|location|locations|hours-of-operation)$/.test(p);
  } catch {
    return false;
  }
}

export function hoursGuessPaths(base) {
  try {
    const origin = new URL(base).origin;
    return [`${origin}/hours/`, `${origin}/hours`, `${origin}/visit/`, `${origin}/about/`];
  } catch {
    return [];
  }
}

export function hasForm(html) {
  return /<form\b/i.test(html);
}

export function isEmailAddress(value) {
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(value || "").trim());
}

const CONSORTIUM_EMAIL_DOMAINS = ["bccls.org", "mainlib.org", "lib.nj.us", "njlibraries.org"];
const JUNK_EMAIL_DOMAINS = /eprintitsaas|literacynj|sewingstudio|constantcontact|sentry|wixpress|wordpress/;

export function isAcceptableAdminEmail(email, siteUrl) {
  if (!isEmailAddress(email)) return false;
  const normalized = email.trim().toLowerCase();
  const edomain = normalized.split("@")[1];
  const local = normalized.split("@")[0];
  if (JUNK_EMAIL_DOMAINS.test(edomain)) return false;
  const siteHost = host(siteUrl);
  if (siteHost && (edomain === siteHost || registrable(edomain) === registrable(siteHost))) return true;
  if (CONSORTIUM_EMAIL_DOMAINS.some((d) => edomain === d || edomain.endsWith(`.${d}`))) return true;
  if (["gmail.com", "yahoo.com", "comcast.net", "outlook.com", "hotmail.com"].includes(edomain)) {
    return /librar/.test(local);
  }
  if (edomain.includes("library") || edomain.includes("lib.")) return true;
  return false;
}

export function mailtoAddresses(html) {
  const found = [];
  const re = /mailto:([^"'>\s?]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    const email = decodeURIComponent(m[1]).trim().toLowerCase();
    if (!isEmailAddress(email)) continue;
    if (/noreply|no-reply|donotreply/.test(email)) continue;
    found.push(email);
  }
  return [...new Set(found)];
}

export function host(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function registrable(hostname) {
  const parts = String(hostname || "")
    .split(".")
    .filter(Boolean);
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join(".");
}

export function sameProperty(original, candidate) {
  const a = registrable(host(original));
  const b = registrable(host(candidate));
  if (!a || !b) return false;
  if (a === b) return true;
  return b === "libcal.com" || b.endsWith(".libcal.com");
}

export function pickAdminEmail(emails, siteUrl) {
  const scored = emails
    .filter((email) => isAcceptableAdminEmail(email, siteUrl))
    .map((email) => {
      const edomain = email.split("@")[1] || "";
      let score = 0;
      const domain = host(siteUrl);
      if (domain && (edomain === domain || registrable(edomain) === registrable(domain))) score += 3;
      if (/^(info|library|director|admin|reference|contact|ask|circulation)@/i.test(email)) score += 2;
      return { email, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.email || null;
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

export function extractDirector(html) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const nodes = [];
      walkJson(JSON.parse(m[1]), nodes);
      for (const node of nodes) {
        const title = String(node.jobTitle || node.roleName || "");
        const name = String(node.name || "").trim();
        if (!/director/i.test(title)) continue;
        if (!/^[A-Za-z][A-Za-z .'-]{2,60}$/.test(name)) continue;
        const parts = name.split(/\s+/);
        if (parts.length < 2 || parts.length > 3) continue;
        if (/^(email|phone|contact|secretary|director|library)$/i.test(parts.at(-1))) continue;
        return name;
      }
    } catch {
      // skip malformed JSON-LD
    }
  }
  return null;
}
