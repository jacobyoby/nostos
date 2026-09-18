import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { safeHttpUrl, SERVICE_NAMES } from "../src/lib/nostos.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function load(rel) {
  const path = join(root, rel);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    errors.push(`${rel}: ${err.message}`);
    return null;
  }
}

function requireArray(rel) {
  const data = load(rel);
  if (data == null) return [];
  if (!Array.isArray(data)) {
    errors.push(`${rel}: expected array`);
    return [];
  }
  return data;
}

const libraries = requireArray("data/nj-libraries.json");
if (libraries.length !== 449) errors.push(`nj-libraries.json: expected 449 outlets, got ${libraries.length}`);
if (libraries.some((r) => !/^\d{4}$/.test(String(r.municipality_code || "")))) {
  errors.push("nj-libraries.json: every outlet needs a 4-digit municipality_code");
}

for (const [i, r] of libraries.entries()) {
  const loc = `outlet[${i}] ${r.fscskey}-${r.fscs_seq}`;
  if (!r.fscskey || !r.fscs_seq) errors.push(`${loc}: missing FSCS key`);
  if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) errors.push(`${loc}: missing coordinates`);
  if (r.website != null && !safeHttpUrl(r.website)) errors.push(`${loc}: website is not http(s): ${r.website}`);
  if (r.services != null) {
    if (!Array.isArray(r.services)) errors.push(`${loc}: services must be array or null`);
    else {
      for (const s of r.services) {
        if (!s || typeof s.name !== "string") errors.push(`${loc}: service missing name`);
        else if (!SERVICE_NAMES.includes(s.name) && !s.name.startsWith("other:")) {
          errors.push(`${loc}: unknown service ${s.name}`);
        }
        if (s.evidence_url != null && !safeHttpUrl(s.evidence_url)) {
          errors.push(`${loc}: service evidence is not http(s)`);
        }
      }
    }
  }
  if (r.hours != null) {
    const days = Array.isArray(r.hours) ? r.hours : r.hours.days;
    if (!Array.isArray(days)) errors.push(`${loc}: hours must be an array or {days, source_url, verified_on}`);
    else {
      for (const slot of days) {
        if (!slot || typeof slot.day !== "string" || typeof slot.open !== "string" || typeof slot.close !== "string") {
          errors.push(`${loc}: hours slot needs day, open, close`);
        }
      }
      if (!Array.isArray(r.hours) && r.hours.source_url != null && !safeHttpUrl(r.hours.source_url)) {
        errors.push(`${loc}: hours source_url is not http(s)`);
      }
    }
  }
}

requireArray("data/imls-nj-outlets.json");
requireArray("data/njsl-systems.json");
requireArray("data/proposals/accepted.json");
requireArray("data/proposals/rejected.json");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`ok: ${libraries.length} outlets, websites http(s) or null, services schema valid`);
