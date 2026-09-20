const test = require("node:test");
const assert = require("node:assert/strict");
const Flags = require("./flags.cjs");

test("safe defaults: all flags off", () => {
  assert.equal(Flags.isEnabled("nearest", { search: "", storage: {} }), false);
  assert.equal(Flags.isEnabled("community_input", { search: "", storage: {} }), false);
  assert.equal(Flags.isEnabled("unknown_flag", { search: "", storage: {} }), false);
});

test("unknown flag never enabled even via query", () => {
  // only known flags are enumerable; unknown returns false regardless
  assert.equal(Flags.isEnabled("bogus", { search: "?flags=bogus", storage: {} }), false);
});

test("query ?flags enables known flag", () => {
  assert.equal(Flags.isEnabled("nearest", { search: "?flags=nearest", storage: {} }), true);
  assert.equal(Flags.isEnabled("nearest", { search: "?flags=nearest,community_input", storage: {} }), true);
});

test("query ?enable_<flag>=1 enables", () => {
  assert.equal(Flags.isEnabled("nearest", { search: "?enable_nearest=1", storage: {} }), true);
  assert.equal(Flags.isEnabled("nearest", { search: "?enable_nearest=true", storage: {} }), true);
});

test("query disable overrides storage", () => {
  assert.equal(Flags.isEnabled("nearest", { search: "?disable_nearest=1", storage: { nearest: true } }), false);
  assert.equal(Flags.isEnabled("nearest", { search: "?flags=nearest", storage: {} }), true);
  // query wins over storage
  assert.equal(Flags.isEnabled("nearest", { search: "?flags=nearest", storage: { nearest: false } }), true);
});

test("storage enables when no query", () => {
  assert.equal(Flags.isEnabled("nearest", { search: "", storage: { nearest: true } }), true);
});

test("allFlags respects priority", () => {
  const all = Flags.allFlags({ search: "?flags=nearest", storage: {} });
  assert.equal(all.nearest, true);
  assert.equal(all.community_input, false);
});

test("parseQuery case-insensitive and trims", () => {
  const q = Flags._parseQuery("?flags= Nearest , COMMUNITY_input ");
  assert.equal(q.nearest, true);
  assert.equal(q.community_input, true);
});
