/**
 * Seed services, admin contact, and extra hours from library websites.
 *
 *   node scripts/seed_from_sites.mjs
 *
 * Conservative: a service is recorded only when a same-site link's href or
 * visible text names it and the destination page still mentions it. Contact
 * fields come from mailto:, /contact forms, and "board of trustees" pages.
 * Hours are weekday open/close from the library site, never IMLS weekly totals.
 * Null beats guessed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHoursFromPage } from "./parse-hours.mjs";
import {
  classifyServiceLink,
  extractDirector,
  extractLinks,
  hasForm,
  hoursGuessPaths,
  isBoardLink,
  isContactLink,
  isHoursLink,
  isHoursPath,
  mailtoAddresses,
  pickAdminEmail,
  sameProperty,
  stripTags,
} from "./site-facts.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = join(root, "data/nj-libraries.json");
const UA = "NostosSeed/0.1 (+https://github.com/jacobyoby/nostos)";
const TODAY = new Date().toISOString().slice(0, 10);
const TOP_SYSTEMS = 40;

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return { url: res.url, html: "", status: res.status };
  return { url: res.url, html: await res.text(), status: res.status };
}

function addService(row, name, evidenceUrl) {
  const services = Array.isArray(row.services) ? row.services : [];
  if (services.some((s) => s && s.name === name)) {
    row.services = services;
    return false;
  }
  services.push({ name, evidence_url: evidenceUrl, verified_on: TODAY });
  row.services = services;
  return true;
}

function setContact(row, key, value) {
  if (row[key] || !value) return false;
  row[key] = { value, verified_on: TODAY };
  return true;
}

function linkKind(link) {
  if (classifyServiceLink(link)) return "service";
  if (isBoardLink(link)) return "board";
  if (isContactLink(link)) return "contact";
  if (isHoursLink(link)) return "hours";
  return null;
}

async function pool(items, n, worker) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        try {
          await worker(items[idx]);
        } catch (err) {
          process.stdout.write(`fail ${items[idx].website} ${err.message}\n`);
        }
      }
    }),
  );
}

export async function seedFromSites(libraries, fetchPage = fetchHtml) {
  const bySystem = new Map();
  for (const row of libraries) {
    const list = bySystem.get(row.system_name) || [];
    list.push(row);
    bySystem.set(row.system_name, list);
  }
  const ranked = [...bySystem.entries()]
    .map(([name, rows]) => ({
      name,
      rows,
      website: rows.find((r) => r.website)?.website || null,
      n: rows.length,
    }))
    .filter((s) => s.website)
    .sort((a, b) => b.n - a.n);

  const top = ranked.slice(0, TOP_SYSTEMS);
  const topNames = new Set(top.map((s) => s.name));
  const targets = [];
  const seenSites = new Set();
  for (const s of ranked) {
    if (seenSites.has(s.website)) continue;
    seenSites.add(s.website);
    const centrals = s.rows.filter((r) => r.outlet_type === "central");
    targets.push({
      ...s,
      seedServices: topNames.has(s.name),
      seedHours: centrals.length === 1 && !centrals[0].hours,
    });
  }

  let servicesWrote = 0;
  let contactWrote = 0;
  let hoursWrote = 0;
  let sitesFetched = 0;

  async function handleSite(site) {
    const home = await fetchPage(site.website);
    if (!home.html || !sameProperty(site.website, home.url)) return;
    sitesFetched += 1;
    const links = extractLinks(home.html, home.url);
    const wanted = [];
    const seen = new Set();
    for (const link of links) {
      if (!sameProperty(site.website, link.href)) continue;
      const kind = linkKind(link);
      if (!kind) continue;
      if (kind === "service" && !site.seedServices) continue;
      const key = `${kind}|${link.href.split("#")[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      wanted.push({ ...link, kind, rule: classifyServiceLink(link) });
    }

    const facts = {
      services: [],
      board: null,
      contact: null,
      email: pickAdminEmail(mailtoAddresses(home.html), site.website),
      director: extractDirector(home.html),
      hours: null,
    };

    const cap = wanted.slice(0, site.seedServices ? 10 : 6);
    for (const link of cap) {
      try {
        const page = await fetchPage(link.href);
        if (!page.html || !sameProperty(site.website, page.url)) continue;
        const text = stripTags(page.html);
        if (link.kind === "service" && link.rule && link.rule.text.test(text)) {
          facts.services.push({ name: link.rule.name, url: page.url });
        }
        if (link.kind === "board" && /trustee|library board|governing/i.test(text)) {
          facts.board = page.url;
        }
        if (link.kind === "contact" && hasForm(page.html)) {
          facts.contact = page.url;
        }
        if (link.kind === "hours" && !facts.hours) {
          const slots = parseHoursFromPage(page.html);
          if (slots.length) facts.hours = { slots, source: page.url };
        }
        if (!facts.email) {
          facts.email = pickAdminEmail(mailtoAddresses(page.html), site.website);
        }
        if (!facts.director) facts.director = extractDirector(page.html);
      } catch {
        // skip this link
      }
    }

    if (!facts.hours && site.seedHours) {
      const slots = parseHoursFromPage(home.html);
      if (slots.length) facts.hours = { slots, source: home.url };
    }
    if (!facts.hours && site.seedHours) {
      for (const extra of hoursGuessPaths(site.website)) {
        try {
          const page = await fetchPage(extra);
          if (!page.html || !sameProperty(site.website, page.url) || !isHoursPath(page.url)) continue;
          const slots = parseHoursFromPage(page.html);
          if (slots.length) {
            facts.hours = { slots, source: page.url };
            break;
          }
        } catch {
          // next candidate
        }
      }
    }

    const centrals = site.rows.filter((r) => r.outlet_type === "central");
    for (const row of site.rows) {
      if (site.seedServices) {
        for (const svc of facts.services) {
          if (addService(row, svc.name, svc.url)) servicesWrote += 1;
        }
      }
      if (setContact(row, "admin_email", facts.email)) contactWrote += 1;
      if (setContact(row, "contact_form_url", facts.contact)) contactWrote += 1;
      if (setContact(row, "board_url", facts.board)) contactWrote += 1;
      if (setContact(row, "director", facts.director)) contactWrote += 1;
    }
    if (facts.hours && centrals.length === 1 && !centrals[0].hours) {
      centrals[0].hours = { days: facts.hours.slots, source_url: facts.hours.source, verified_on: TODAY };
      hoursWrote += 1;
    }
  }

  await pool(targets, 6, handleSite);
  return {
    systems_seeded: top.length,
    sites_fetched: sitesFetched,
    sites_targeted: targets.length,
    service_rows_updated: servicesWrote,
    contact_fields_set: contactWrote,
    extra_hours: hoursWrote,
  };
}

async function main() {
  const libraries = JSON.parse(readFileSync(dataPath, "utf8"));
  if (!Array.isArray(libraries)) throw new Error("nj-libraries.json must be an array");
  const summary = await seedFromSites(libraries);
  writeFileSync(dataPath, `${JSON.stringify(libraries, null, 1)}\n`);
  process.stdout.write(`${JSON.stringify({ ...summary, out: dataPath }, null, 1)}\n`);
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : "";
if (invoked === fileURLToPath(import.meta.url)) {
  await main();
}
