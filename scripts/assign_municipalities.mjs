/**
 * Point-in-polygon each IMLS outlet against NJOGIS municipal boundaries.
 *
 *   node scripts/assign_municipalities.mjs [boundaries.geojson]
 *
 * Port of formapauperis tools/import-libraries.ts ray-casting. Writes
 * municipality_code onto data/imls-nj-outlets.json and data/nj-libraries.json.
 * Does not invent a code: outlets outside every polygon are listed and the
 * process exits 1 without writing.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_URL =
  "https://maps.nj.gov/arcgis/rest/services/Framework/Government_Boundaries/MapServer/2";
const QUERY =
  `${SOURCE_URL}/query?where=1%3D1&outFields=MUN_CODE,NAME,GNIS&outSR=4326&f=geojson&resultRecordCount=1000`;

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const [xi, yi] = a;
    const [xj, yj] = b;
    const crosses = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function inPolygon(lon, lat, rings) {
  const outer = rings[0];
  if (!outer) return false;
  if (!inRing(lon, lat, outer)) return false;
  return !rings.slice(1).some((hole) => inRing(lon, lat, hole));
}

function containingCode(lon, lat, features) {
  for (const f of features) {
    const g = f.geometry;
    if (!g) continue;
    const hit =
      g.type === "Polygon"
        ? inPolygon(lon, lat, g.coordinates)
        : g.type === "MultiPolygon"
          ? g.coordinates.some((poly) => inPolygon(lon, lat, poly))
          : false;
    if (hit) return String(f.properties.MUN_CODE);
  }
  return null;
}

async function loadGeo(pathArg) {
  if (pathArg) {
    return JSON.parse(readFileSync(pathArg, "utf8"));
  }
  const res = await fetch(QUERY, {
    headers: { "User-Agent": "NostosMunicipalities/0.1 (+https://github.com/jacobyoby/nostos)" },
  });
  if (!res.ok) throw new Error(`NJOGIS fetch failed: ${res.status}`);
  return res.json();
}

const geo = await loadGeo(process.argv[2]);
if (!geo || !Array.isArray(geo.features)) throw new Error("expected a FeatureCollection");
if (geo.features.length !== 564) {
  throw new Error(`boundaries: expected 564 municipalities, got ${geo.features.length}`);
}

const imlsPath = join(root, "data/imls-nj-outlets.json");
const libPath = join(root, "data/nj-libraries.json");
const metaPath = join(root, "data/imls-nj-outlets.meta.json");
const outlets = JSON.parse(readFileSync(imlsPath, "utf8"));
const libraries = JSON.parse(readFileSync(libPath, "utf8"));
const meta = JSON.parse(readFileSync(metaPath, "utf8"));

const outside = [];
const codes = new Map();
for (const o of outlets) {
  const code = containingCode(o.lon, o.lat, geo.features);
  const key = `${o.fscskey}-${o.fscs_seq}`;
  if (code == null) outside.push(`${o.outlet_name} (${o.lat}, ${o.lon})`);
  else {
    o.municipality_code = code;
    codes.set(key, code);
  }
}
if (outside.length) {
  process.stderr.write(
    `${outside.length} outlet(s) fall outside every municipal polygon; nothing written:\n  ${outside.join("\n  ")}\n`,
  );
  process.exit(1);
}

for (const row of libraries) {
  const key = `${row.fscskey}-${row.fscs_seq}`;
  row.municipality_code = codes.get(key) || row.municipality_code || null;
}

meta.boundaries_source_url = SOURCE_URL;
meta.boundaries_fetch_date = new Date().toISOString().slice(0, 10);
meta.boundaries_feature_count = geo.features.length;

writeFileSync(imlsPath, `${JSON.stringify(outlets, null, 1)}\n`);
writeFileSync(libPath, `${JSON.stringify(libraries, null, 1)}\n`);
writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
process.stdout.write(`assigned municipality_code on ${outlets.length}/449 outlets\n`);
