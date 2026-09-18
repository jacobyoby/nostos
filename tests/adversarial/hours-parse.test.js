import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isCompleteEnough,
  parseHoursFromPage,
  parseOpeningHoursString,
  toHhmm,
} from "../../scripts/parse-hours.mjs";

test("toHhmm accepts 24h and 12h clocks", () => {
  assert.equal(toHhmm("09:00"), "09:00");
  assert.equal(toHhmm("9:00"), "09:00");
  assert.equal(toHhmm("20:00:00"), "20:00");
  assert.equal(toHhmm("8:00 PM"), "20:00");
  assert.equal(toHhmm("12:00 AM"), "00:00");
  assert.equal(toHhmm("12:30 PM"), "12:30");
  assert.equal(toHhmm("25:00"), null);
});

test("parseOpeningHoursString reads schema.org compact form", () => {
  const slots = parseOpeningHoursString(
    "Mo 10:00-20:00, Tu 10:00-20:00, We 10:00-20:00, Th 10:00-17:00, Fr 10:00-17:00, Sa 10:00-14:00, ",
  );
  assert.equal(slots.length, 6);
  assert.deepEqual(slots[0], { day: "monday", open: "10:00", close: "20:00" });
  assert.deepEqual(slots.at(-1), { day: "saturday", open: "10:00", close: "14:00" });
  assert.equal(isCompleteEnough(slots), true);
});

test("parseHoursFromPage prefers JSON-LD LocalBusiness openingHours", () => {
  const html = `<script type="application/ld+json">{"@type":"LocalBusiness","openingHours":"Mo 10:00-21:00, Tu 10:00-21:00, We 10:00-21:00, Th 10:00-21:00, Fr 10:00-18:00, Sa 10:00-17:00, Su 13:00-17:00"}</script>`;
  const slots = parseHoursFromPage(html);
  assert.equal(slots.length, 7);
  assert.deepEqual(slots.find((s) => s.day === "sunday"), { day: "sunday", open: "13:00", close: "17:00" });
});

test("parseHoursFromPage takes the first complete week on a multi-location page", () => {
  const html = `
    Pickup lockers Monday: Closed Tuesday: Closed Wednesday: Closed Thursday: Closed Friday: Closed Saturday: Closed Sunday: Closed
    Main Library Monday: 10 am – 8 pm Tuesday: 10 am – 8 pm Wednesday: 10 am – 8 pm Thursday: 10 am – 8 pm Friday: 10 am – 5 pm Saturday: 10 am – 5 pm Sunday: Closed
    Learning Center Monday: 10 am – 5 pm Tuesday: 10 am – 5 pm Wednesday: 10 am – 5 pm Thursday: 10 am – 5 pm Friday: 10 am – 5 pm Saturday: 10 am – 5 pm Sunday: Closed
  `;
  const slots = parseHoursFromPage(html);
  assert.deepEqual(
    slots.find((s) => s.day === "monday"),
    { day: "monday", open: "10:00", close: "20:00" },
  );
  assert.deepEqual(
    slots.find((s) => s.day === "friday"),
    { day: "friday", open: "10:00", close: "17:00" },
  );
});

test("parseHoursFromPage accepts a single visible week", () => {
  const html = `<p>Monday: 9:00 AM – 5:00 PM</p><p>Tuesday: 9:00 AM – 8:00 PM</p><p>Wednesday: 9:00 AM – 8:00 PM</p><p>Thursday: 9:00 AM – 5:00 PM</p><p>Friday: 9:00 AM – 5:00 PM</p><p>Saturday: Closed</p><p>Sunday: Closed</p>`;
  const slots = parseHoursFromPage(html);
  assert.equal(slots.length, 5);
  assert.deepEqual(slots[0], { day: "monday", open: "09:00", close: "17:00" });
});
