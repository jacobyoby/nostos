// geo.js — pure distance helpers for nearest-library feature.
// Sources: Math https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math
//          Geolocation (future) https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition
// Small, testable, no I/O — unit tests (pyramid base). Pure functions.
(function (global) {
  const R_KM = 6371;

  function toRad(d) {
    return d * Math.PI / 180;
  }

  function haversine(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const a1 = Number(lat1), o1 = Number(lon1), a2 = Number(lat2), o2 = Number(lon2);
    if (!Number.isFinite(a1) || !Number.isFinite(o1) || !Number.isFinite(a2) || !Number.isFinite(o2)) return null;
    const dLat = toRad(a2 - a1);
    const dLon = toRad(o2 - o1);
    const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLon / 2);
    const h = s1 * s1 + Math.cos(toRad(a1)) * Math.cos(toRad(a2)) * s2 * s2;
    return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function sortByDistance(outlets, lat, lon) {
    // Returns new array sorted by distance; outlets with missing coords last; does not mutate input.
    const withD = outlets.map((o) => ({ o, d: haversine(lat, lon, o.lat, o.lon) }));
    withD.sort((a, b) => {
      if (a.d == null && b.d == null) return 0;
      if (a.d == null) return 1;
      if (b.d == null) return -1;
      return a.d - b.d;
    });
    return withD.map((x) => x.o);
  }

  const api = { haversine, sortByDistance, R_KM };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.Geo = api;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
