import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  escapeHtml,
  filterDirectory,
  haversineMiles,
  nearestLibraries,
  resolveLocationQuery,
} from "../../src/lib/nostos.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const libraries = JSON.parse(readFileSync(join(root, "data/nj-libraries.json"), "utf8"));

const MALICIOUS_STRINGS = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "'; DROP TABLE libraries;--",
  "\u0000hidden",
  "🇺🇸".repeat(500),
  "A".repeat(100_000),
  "\u202e\u202d",
  "{{7*7}}",
  "${7*7}",
  "<svg/onload=alert(1)>",
];

test("haversine rejects non-finite coordinates", () => {
  assert.equal(haversineMiles(NaN, 0, 0, 0), Number.POSITIVE_INFINITY);
  assert.equal(haversineMiles(0, Infinity, 0, 0), Number.POSITIVE_INFINITY);
  assert.equal(haversineMiles(90, 0, -90, 180), haversineMiles(90, 0, -90, 180));
});

test("nearestLibraries never throws on adversarial filters", () => {
  for (const s of MALICIOUS_STRINGS) {
    const hits = nearestLibraries(libraries, 40.05, -74.05, {
      county: s,
      outletType: s,
      limit: 5,
    });
    assert.ok(Array.isArray(hits));
    for (const h of hits) {
      assert.ok(Number.isFinite(h.distanceMi));
      assert.ok(h.distanceMi >= 0);
    }
  }
});

test("filterDirectory survives malicious search terms", () => {
  for (const s of MALICIOUS_STRINGS) {
    const list = filterDirectory(libraries, { term: s });
    assert.ok(Array.isArray(list));
    assert.ok(list.length <= libraries.length);
  }
});

test("escapeHtml neutralizes HTML injection payloads", () => {
  for (const s of MALICIOUS_STRINGS) {
    const out = escapeHtml(s);
    assert.ok(!out.includes("<"), out);
    assert.ok(!out.includes(">"), out);
  }
});

test("resolveLocationQuery handles ZIP and garbage", () => {
  const zip = resolveLocationQuery("08401", libraries);
  assert.ok(zip);
  assert.ok(Number.isFinite(zip.lat));

  assert.equal(resolveLocationQuery("", libraries), null);
  assert.equal(resolveLocationQuery("99999", libraries), null);

  for (const s of MALICIOUS_STRINGS) {
    const r = resolveLocationQuery(s, libraries);
    if (r) {
      assert.ok(Number.isFinite(r.lat));
      assert.ok(Number.isFinite(r.lon));
    }
  }
});

test("nearestLibraries sorted and capped", () => {
  const hits = nearestLibraries(libraries, 40.7357, -74.1724, { limit: 10 });
  assert.equal(hits.length, 10);
  for (let i = 1; i < hits.length; i++) {
    assert.ok(hits[i - 1].distanceMi <= hits[i].distanceMi);
  }
});

test("property: distance from point to self is ~0", () => {
  const r = libraries.find((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
  assert.ok(r);
  const d = haversineMiles(r.lat, r.lon, r.lat, r.lon);
  assert.ok(d < 0.001);
});
