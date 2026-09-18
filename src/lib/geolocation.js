/**
 * Resolve device position via Capacitor on native, else the browser Geolocation API.
 * @returns {Promise<{ lat: number; lon: number }>}
 */
export async function getDevicePosition() {
  const cap = globalThis.Capacitor;
  if (cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) {
    const plugin = cap.Plugins && cap.Plugins.Geolocation;
    if (plugin && typeof plugin.getCurrentPosition === "function") {
      const pos = await plugin.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 15000,
      });
      return { lat: pos.coords.latitude, lon: pos.coords.longitude };
    }
  }

  if (!navigator.geolocation) {
    throw new Error("Geolocation not available in this browser.");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => reject(new Error("Location denied — use ZIP or town instead.")),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  });
}
