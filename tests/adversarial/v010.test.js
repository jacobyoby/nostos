import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyAcceptedProposal,
  hoursStatus,
  makeProposal,
  outletKey,
  servicesOf,
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
  assert.match(status.label, /Open now/);
});

test("hoursStatus falls back to weekly hours", () => {
  const status = hoursStatus({ hours_open_weekly: 48 }, new Date());
  assert.equal(status.kind, "weekly");
  assert.equal(status.label, "48 h/wk");
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
