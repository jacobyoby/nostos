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
  safeHttpUrl,
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
});

test("haversine Newark to Hoboken is about 5 miles", () => {
  const d = haversineMiles(40.7357, -74.1724, 40.7433, -74.0324);
  assert.ok(d > 4 && d < 8, d);
});

test("nearestLibraries never throws on adversarial filters", () => {
  for (const s of MALICIOUS_STRINGS) {
    const hits = nearestLibraries(libraries, 40.05, -74.05, {
      county: s,
      outletType: s,
      limit: 5,
    });
    assert.ok(Array.isArray(hits));
    assert.equal(hits.length, 0);
  }
});

test("filterDirectory survives malicious search terms", () => {
  for (const s of MALICIOUS_STRINGS) {
    const list = filterDirectory(libraries, { term: s });
    assert.ok(Array.isArray(list));
    assert.equal(list.length, 0);
  }
});

test("filterDirectory legal=no returns confirmed-negative programs", () => {
  const list = filterDirectory(libraries, { legal: "no" });
  assert.ok(list.length >= 100);
  assert.ok(list.every((r) => r.has_legal_help_program === false));
});

test("escapeHtml neutralizes HTML injection payloads", () => {
  for (const s of MALICIOUS_STRINGS) {
    const out = escapeHtml(s);
    assert.ok(!out.includes("<"), out);
    assert.ok(!out.includes(">"), out);
  }
});

test("safeHttpUrl allows only http(s) without whitespace", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(safeHttpUrl("file:///etc/passwd"), null);
  assert.equal(
    safeHttpUrl("http://acfpl.libguides.com/legal (legal forms/self-representation research guide)"),
    null,
  );
  assert.equal(safeHttpUrl("checked but source unreachable (fetch error)"), null);
  assert.equal(safeHttpUrl("https://example.com/path"), "https://example.com/path");
  assert.ok(safeHttpUrl("http://acfpl.org/")?.startsWith("http://acfpl.org/"));
});

test("resolveLocationQuery ZIP is exact 5-digit, not mashed ZIP+4", () => {
  const zip = resolveLocationQuery("08401", libraries);
  assert.ok(zip);
  assert.match(zip.label, /^ZIP 08401/);
  assert.equal(resolveLocationQuery("", libraries), null);
  assert.equal(resolveLocationQuery("99999", libraries), null);
  const mashed = [
    { zip: "084011234", lat: 39.36, lon: -74.42, city: "FAKE" },
    ...libraries,
  ];
  assert.equal(resolveLocationQuery("08401", mashed.filter((r) => r.zip === "084011234")), null);
});

test("resolveLocationQuery town matching is exact city, not substring", () => {
  const milford = resolveLocationQuery("Milford", libraries);
  assert.ok(milford);
  assert.match(milford.label, /^Milford/);
  assert.ok(!/New Milford/i.test(milford.label));
  assert.ok(milford.lat < 40.7, milford);

  const franklin = resolveLocationQuery("Franklin", libraries);
  assert.ok(franklin);
  assert.match(franklin.label, /^Franklin/);
  assert.ok(!/Franklin Lakes/i.test(franklin.label));
  assert.ok(!/Franklinville/i.test(franklin.label));

  const franklinLakes = resolveLocationQuery("Franklin Lakes", libraries);
  assert.ok(franklinLakes);
  assert.match(franklinLakes.label, /Franklin Lakes/i);

  assert.equal(resolveLocationQuery("New", libraries), null);
  assert.equal(resolveLocationQuery("1", libraries), null);
  assert.equal(resolveLocationQuery("a", libraries), null);
  assert.equal(resolveLocationQuery("Main", libraries), null);
});

test("resolveLocationQuery garbage does not throw", () => {
  for (const s of MALICIOUS_STRINGS) {
    const r = resolveLocationQuery(s, libraries);
    assert.equal(r, null);
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
