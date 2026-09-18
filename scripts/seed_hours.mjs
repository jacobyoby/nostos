/**
 * Fetch library websites and write structured hours onto central outlets.
 *
 *   node scripts/seed_hours.mjs
 *
 * Only records hours when parseHoursFromPage is complete enough. Branches are
 * left null unless they have their own website. Null beats guessed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHoursFromPage } from "./parse-hours.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = join(root, "data/nj-libraries.json");
const UA = "NostosHours/0.1 (+https://github.com/jacobyoby/nostos)";
const TODAY = new Date().toISOString().slice(0, 10);

function host(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function registrable(hostname) {
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join(".");
}

function sameProperty(original, finalUrl) {
  const a = registrable(host(original));
  const b = registrable(host(finalUrl));
  if (!a || !b) return false;
  if (a === b) return true;
  return b === "libcal.com" || b.endsWith(".libcal.com");
}

async function fetchHtml(url) {
  const ctrl = AbortSignal.timeout(12000);
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: ctrl,
  });
  if (!res.ok) return { url: res.url, html: "", status: res.status };
  const html = await res.text();
  return { url: res.url, html, status: res.status };
}

function isHoursPath(url) {
  try {
    const p = new URL(url).pathname.toLowerCase().replace(/\/+$/, "") || "/";
    if (p === "/") return true;
    return /\/(hours|visit|about|location|locations|hours-of-operation)$/.test(p);
  } catch {
    return false;
  }
}

function hoursPaths(base) {
  let origin;
  try {
    origin = new URL(base).origin;
  } catch {
    return [];
  }
  return [`${origin}/hours/`, `${origin}/hours`, `${origin}/visit/`, `${origin}/about/`];
}

async function hoursForSite(website) {
  const home = await fetchHtml(website);
  if (home.html && sameProperty(website, home.url)) {
    const slots = parseHoursFromPage(home.html);
    if (slots.length) return { slots, source: home.url };
  }
  for (const extra of hoursPaths(website)) {
    try {
      const page = await fetchHtml(extra);
      if (!page.html || !sameProperty(website, page.url) || !isHoursPath(page.url)) continue;
      const slots = parseHoursFromPage(page.html);
      if (slots.length) return { slots, source: page.url };
    } catch {
      // next candidate
    }
  }
  return null;
}

function pool(items, n, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  return Promise.all(runners);
}

const libraries = JSON.parse(readFileSync(dataPath, "utf8"));
if (!Array.isArray(libraries)) throw new Error("nj-libraries.json must be an array");

const byWebsite = new Map();
for (const row of libraries) {
  if (row.outlet_type !== "central") continue;
  const site = typeof row.website === "string" ? row.website : "";
  if (!site) continue;
  const list = byWebsite.get(site) || [];
  list.push(row);
  byWebsite.set(site, list);
}

const sites = [...byWebsite.entries()].filter(([, rows]) => rows.length === 1);
const skippedShared = [...byWebsite.values()].filter((rows) => rows.length > 1).length;

let wrote = 0;
let failed = 0;
let empty = 0;

await pool(sites, 8, async ([website, rows]) => {
  const row = rows[0];
  try {
    const found = await hoursForSite(website);
    if (!found) {
      empty += 1;
      return;
    }
    row.hours = {
      days: found.slots,
      source_url: found.source,
      verified_on: TODAY,
    };
    wrote += 1;
    process.stdout.write(`ok ${row.outlet_name} ${found.slots.length} days from ${found.source}\n`);
  } catch (err) {
    failed += 1;
    process.stdout.write(`fail ${website} ${err.message}\n`);
  }
});

writeFileSync(dataPath, `${JSON.stringify(libraries, null, 1)}\n`);
process.stdout.write(
  JSON.stringify(
    {
      central_sites_unique: byWebsite.size,
      scraped: sites.length,
      skipped_shared_website: skippedShared,
      wrote,
      no_parse: empty,
      failed,
      out: dataPath,
    },
    null,
    1,
  ) + "\n",
);
