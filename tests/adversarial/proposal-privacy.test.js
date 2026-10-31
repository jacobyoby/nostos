import assert from "node:assert/strict";
import { test } from "node:test";
import { makeProposal, proposalIssueUrl } from "../../src/lib/nostos.js";

// Proposals become public GitHub issues, so nothing identifying the submitter may ride along.
test("a proposal never carries submitter contact into the public issue", () => {
  const r = makeProposal({
    outlet_key: "NJ0003-002",
    kind: "service",
    value: "notary",
    submitter_contact: "jane.doe@example.com",
  });
  assert.equal(r.ok, true);
  assert.equal("submitter_contact" in r.proposal, false);
  const url = decodeURIComponent(proposalIssueUrl(r.proposal));
  assert.doesNotMatch(url, /jane\.doe|example\.com|submitter/i);
});
