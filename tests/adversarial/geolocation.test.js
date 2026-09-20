import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getDevicePosition } from "../../src/lib/geolocation.js";

afterEach(() => {
  delete globalThis.Capacitor;
});

test("native Capacitor plugin is used when isNativePlatform is true", async () => {
  let called = false;
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    Plugins: {
      Geolocation: {
        getCurrentPosition: async () => {
          called = true;
          return { coords: { latitude: 40.74, longitude: -74.03 } };
        },
      },
    },
  };
  const pos = await getDevicePosition();
  assert.equal(called, true);
  assert.equal(pos.lat, 40.74);
  assert.equal(pos.lon, -74.03);
});

test("browser geolocation is used when Capacitor is not native", async () => {
  globalThis.Capacitor = { isNativePlatform: () => false };
  const original = navigator.geolocation;
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (ok) => ok({ coords: { latitude: 39.36, longitude: -74.42 } }),
    },
  });
  try {
    const pos = await getDevicePosition();
    assert.equal(pos.lat, 39.36);
    assert.equal(pos.lon, -74.42);
  } finally {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: original });
  }
});

test("browser geolocation deny tells the user to use ZIP or town", async () => {
  const original = navigator.geolocation;
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (_ok, err) => err({ code: 1, message: "denied" }),
    },
  });
  try {
    await assert.rejects(getDevicePosition(), /Location denied — use ZIP or town/i);
  } finally {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: original });
  }
});
