import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("Capacitor Android project exists with geolocation permission", () => {
  const manifest = join(root, "android/app/src/main/AndroidManifest.xml");
  assert.ok(existsSync(manifest), "android manifest missing — run npm run cap:sync");
  const xml = readFileSync(manifest, "utf8");
  assert.match(xml, /ACCESS_COARSE_LOCATION|ACCESS_FINE_LOCATION/);
});

test("Capacitor iOS project exists with location usage string", () => {
  const plist = join(root, "ios/App/App/Info.plist");
  assert.ok(existsSync(plist), "ios Info.plist missing — run npm run cap:sync");
  const xml = readFileSync(plist, "utf8");
  assert.match(xml, /NSLocationWhenInUseUsageDescription/);
});

test("www bundle includes data and shared library", () => {
  assert.ok(existsSync(join(root, "www/index.html")));
  assert.ok(existsSync(join(root, "www/data/nj-libraries.json")));
  assert.ok(existsSync(join(root, "www/lib/nostos.js")));
});
