import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("iOS Xcode project references bundled www assets", () => {
  const pbx = join(root, "ios/App/App.xcodeproj/project.pbxproj");
  assert.ok(existsSync(pbx));
  const text = readFileSync(pbx, "utf8");
  assert.match(text, /public in Resources/);
});

test("iOS AppDelegate loads Capacitor bridge", () => {
  const delegate = join(root, "ios/App/App/AppDelegate.swift");
  assert.ok(existsSync(delegate));
  const swift = readFileSync(delegate, "utf8");
  assert.match(swift, /CAPBridgeViewController|ApplicationDelegateProxy/);
});
