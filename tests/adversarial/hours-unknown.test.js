import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { hoursStatus, hoursWeek } from "../../src/lib/nostos.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const libraries = JSON.parse(readFileSync(join(root, "data/nj-libraries.json"), "utf8"));

// Only Monday and Saturday are listed; every other day is not covered by the data.
const partial = {
  hours: {
    days: [
      { day: "monday", open: "09:00", close: "17:00" },
      { day: "saturday", open: "10:00", close: "14:00" },
    ],
  },
};

test("hoursWeek renders an unlisted day as unknown, never Closed", () => {
  const week = Object.fromEntries(hoursWeek(partial).map((row) => [row.day, row]));
  assert.equal(week.tuesday.unknown, true);
  assert.doesNotMatch(week.tuesday.label, /closed/i);
  assert.match(week.tuesday.label, /Hours not listed/);
  assert.equal(week.monday.unknown, false);
  assert.equal(week.monday.label, "9:00 AM–5:00 PM");
});

test("hoursStatus shows neither open nor closed when today is unlisted", () => {
  const tuesdayNoon = new Date("2026-09-22T16:00:00Z"); // 12:00 America/New_York, Tuesday
  const status = hoursStatus(partial, tuesdayNoon);
  assert.equal(status.kind, "unknown");
  assert.doesNotMatch(status.label, /closed|open/i);
});

test("hoursStatus does not imply an unlisted day is closed when naming the next opening", () => {
  const saturdayNight = new Date("2026-09-27T02:00:00Z"); // 22:00 America/New_York, Saturday
  const status = hoursStatus(partial, saturdayNight);
  assert.equal(status.kind, "closed");
  assert.doesNotMatch(status.label, /monday/i);
});

test("no outlet in the data renders Closed for a day it does not list", () => {
  for (const r of libraries) {
    if (!r.hours) continue;
    const listed = new Set(r.hours.days.map((d) => d.day));
    for (const row of hoursWeek(r)) {
      if (!listed.has(row.day)) assert.doesNotMatch(row.label, /closed/i, `${r.outlet_name} ${row.day}`);
    }
  }
});
