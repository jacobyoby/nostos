import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("Android debug APK builds", () => {
  const apk = join(root, "android/app/build/outputs/apk/debug/app-debug.apk");
  assert.ok(existsSync(apk), "run npm run android:assemble to produce app-debug.apk");
});
