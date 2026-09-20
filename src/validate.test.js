const test = require("node:test");
const assert = require("node:assert/strict");
const V = require("./validate.js");

test("isValidOutlet accepts minimal valid", () => {
  assert.equal(V.isValidOutlet({ fscskey: "NJ0001", fscs_seq: "001", system_name: "X", outlet_name: "Y", outreach: { status: "todo", notes: null } }), null);
});

test("rejects missing required fields", () => {
  assert.match(V.isValidOutlet({ fscs_seq: "001", system_name: "X", outlet_name: "Y", outreach: { status: "todo" } }), /fscskey/);
  assert.match(V.isValidOutlet({ fscskey: "A", fscs_seq: "001", system_name: "X", outlet_name: "Y", outreach: { status: "bad" } }), /outreach\.status/);
});

test("validateAll rejects non-array and bad item", () => {
  assert.equal(V.validateAll({}).code, "VALIDATION_ERROR");
  const err = V.validateAll([{ fscskey: "A", fscs_seq: "001", system_name: "X", outlet_name: "Y", outreach: { status: "oops" } }]);
  assert.equal(err.code, "VALIDATION_ERROR");
  assert.match(err.message, /0:/);
});

test("validateAll accepts live data shape", () => {
  const data = require("../data/nj-libraries.json");
  const err = V.validateAll(data);
  assert.equal(err, null, err ? err.message : "should be valid");
});
