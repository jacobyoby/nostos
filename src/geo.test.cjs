const test = require("node:test");
const assert = require("node:assert/strict");

// RED: geo.js does not exist yet — this test must fail until GREEN.
let geo;
try {
  geo = require("./geo.cjs");
} catch (e) {
  test("geo module exists (RED — should fail before implementation)", () => {
    assert.fail(`geo.js not implemented yet: ${e.message}`);
  });
}

// If module loads, run real assertions (GREEN)
if (geo) {
  test("haversine: same point is 0 km", () => {
    assert.equal(geo.haversine(40.0, -74.0, 40.0, -74.0), 0);
  });

  test("haversine: known distance Atlantic City to Trenton ~ 78km", () => {
    // AC 39.36,-74.42 to Trenton 40.22,-74.76 ~ 100km great-circle; tolerance 5km
    const d = geo.haversine(39.3622, -74.4280, 40.2200, -74.7699);
    assert.ok(d > 75 && d < 110, `expected ~78-100km got ${d}`);
  });

  test("haversine: returns null for missing coords", () => {
    assert.equal(geo.haversine(null, -74, 40, -74), null);
    assert.equal(geo.haversine(40, null, 40, -74), null);
  });

  test("sortByDistance: sorts outlets by distance, nulls last", () => {
    const outlets = [
      { fscskey: "a", lat: 39.0, lon: -74.0 },
      { fscskey: "b", lat: null, lon: null },
      { fscskey: "c", lat: 40.0, lon: -74.0 },
    ];
    const sorted = geo.sortByDistance(outlets, 39.1, -74.0);
    assert.equal(sorted[0].fscskey, "a");
    assert.equal(sorted[1].fscskey, "c");
    assert.equal(sorted[2].fscskey, "b");
  });

  test("sortByDistance: does not mutate input", () => {
    const outlets = [{ fscskey: "a", lat: 39, lon: -74 }];
    const copy = [...outlets];
    geo.sortByDistance(outlets, 40, -74);
    assert.deepEqual(outlets, copy);
  });
}
