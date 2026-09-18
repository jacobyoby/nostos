import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyAcceptedProposal,
  formatPhone,
  hoursStatus,
  makeProposal,
  outletKey,
  servicesOf,
  telHref,
} from "../../src/lib/nostos.js";

test("makeProposal rejects reviews and ratings", () => {
  const base = { outlet_key: "NJ0003-002", kind: "resource", value: "ISBN 123" };
  assert.equal(makeProposal(base).ok, true);
  assert.equal(makeProposal({ ...base, value: "5 stars" }).ok, false);
  assert.equal(makeProposal({ ...base, value: "★★★★★" }).ok, false);
  assert.equal(makeProposal({ ...base, kind: "review", value: "nice" }).ok, false);
  assert.equal(makeProposal({ ...base, kind: "service", value: "notary" }).ok, true);
  assert.equal(makeProposal({ ...base, kind: "service", value: "spa day" }).ok, false);
});

test("makeProposal rejects javascript evidence URLs", () => {
  const r = makeProposal({
    outlet_key: "NJ0003-002",
    kind: "hours",
    value: "Closed Monday",
    evidence_url: "javascript:alert(1)",
  });
  assert.equal(r.ok, false);
});

test("hoursStatus reports open now from structured hours", () => {
  const mondayMorning = new Date("2026-09-21T14:00:00Z"); // 10:00 America/New_York on a Monday
  const r = {
    hours: [{ day: "monday", open: "09:00", close: "17:00" }],
    hours_open_weekly: 40,
  };
  const status = hoursStatus(r, mondayMorning);
  assert.equal(status.kind, "open");
  assert.match(status.label, /Open now · closes 5:00 PM/);
});

test("hoursStatus does not treat IMLS weekly totals as a schedule", () => {
  const status = hoursStatus({ hours_open_weekly: 48 }, new Date());
  assert.equal(status.kind, "unpublished");
  assert.equal(status.label, "Hours not published");
});

test("formatPhone and telHref for NANP numbers", () => {
  assert.equal(formatPhone("2014202346"), "(201) 420-2346");
  assert.equal(formatPhone("1 (201) 420-2346"), "(201) 420-2346");
  assert.equal(formatPhone("ext. 12"), "ext. 12");
  assert.equal(telHref("2014202346"), "2014202346");
  assert.equal(telHref("not a phone"), null);
});

test("applyAcceptedProposal adds a service without reviews", () => {
  const next = applyAcceptedProposal(
    { fscskey: "NJ0003", fscs_seq: "002", services: [] },
    { kind: "service", value: "notary", evidence_url: "https://example.org/n", verified_on: "2026-09-18" },
  );
  assert.equal(servicesOf(next).length, 1);
  assert.equal(servicesOf(next)[0].name, "notary");
});

test("outletKey matches FSCS format", () => {
  assert.equal(outletKey({ fscskey: "NJ0003", fscs_seq: "002" }), "NJ0003-002");
});
