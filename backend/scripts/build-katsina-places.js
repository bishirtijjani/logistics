/**
 * Build the local Katsina places index used by the maps autocomplete.
 *
 * Sources (all open / self-authored - no bulk storage of Google content):
 *   1. Wards   - official Katsina wards w/ coordinates (open gov dataset).
 *   2. OSM      - named places (towns/villages/suburbs/neighbourhoods) inside
 *                 the Katsina admin area, via Overpass (ODbL, attribution kept).
 *   3. Curated  - common Katsina-city neighbourhood names (authored here). No
 *                 coordinates stored; they are resolved LIVE on selection by the
 *                 maps service (geocoding), so we never persist Google content.
 *
 * Output: src/data/katsina-places.json (committed; the runtime only reads it).
 * Run:    node scripts/build-katsina-places.js
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const OUT = path.resolve(__dirname, "../src/data/katsina-places.json");
const WARDS_URL =
  "https://raw.githubusercontent.com/temikeezy/nigeria-geojson-data/main/data/wards.json";

const UA = "logistics-katsina-index/1.0 (+https://)";

const getJSON = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": UA } }, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(new Error(`bad JSON from ${url}: ${d.slice(0, 120)}`));
          }
        });
      })
      .on("error", reject);
  });

const postOverpass = (query) =>
  new Promise((resolve, reject) => {
    const data = "data=" + encodeURIComponent(query);
    const req = https.request(
      {
        hostname: "overpass-api.de",
        path: "/api/interpreter",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(data),
          "User-Agent": UA,
        },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(new Error(`bad Overpass JSON: ${d.slice(0, 120)}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });

// Normalised key for de-duplication (lowercase, strip punctuation/quotes/ward
// A/B suffixes and collapse whitespace).
const normKey = (name) =>
  name
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/\s+[ab]$/i, "") // drop trailing subdivision marker after a space: "yashe a" -> "yashe"
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Curated common Katsina-CITY neighbourhood / area names. Open data misses
// these; coordinates are resolved live on selection. Keep this list editable -
// adding a line here makes that name an instant suggestion immediately.
const CURATED = [
  "Kofar Sauri",
  "Kofar Kaura",
  "Kofar Marusa",
  "Kofar Guga",
  "Kofar Durbi",
  "Kofar Yandaka",
  "Kofar Soro",
  "Kofar Kwaya",
  "GRA",
  "Low Cost",
  "Filin Samji",
  "Sabon Gari",
  "Rafindadi",
  "Shinkafi",
  "Kangiwa",
  "Kambarawa",
  "Wanke",
  "Nagogo Road",
  "IBB Way",
  "Dutsinma Road",
  "Daura Road",
  "Kano Road",
  "Yan Awaki",
  "Layout",
];

(async () => {
  const byKey = new Map();
  const add = (entry) => {
    const key = normKey(entry.name);
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, entry);
    else {
      // Prefer an entry that has coordinates.
      const cur = byKey.get(key);
      if (cur.lat == null && entry.lat != null) byKey.set(key, entry);
    }
  };

  // 1) Wards
  console.log("Fetching wards...");
  const wards = await getJSON(WARDS_URL);
  let wardCount = 0;
  for (const w of wards) {
    if ((w.State || "").toLowerCase() !== "katsina") continue;
    if (!w.Ward) continue;
    add({
      // Strip a trailing ward subdivision marker (" A", " B", " 'A'") - require a
      // SPACE before it and don't be case-insensitive, so real names ending in a
      // or b ("Tudun Wada", "Dabai") are left intact.
      name: w.Ward.replace(/\s+['"]?[AB]['"]?$/, "").trim() || w.Ward,
      type: "ward",
      lga: w.LGA || null,
      lat: typeof w.Latitude === "number" ? w.Latitude : null,
      lng: typeof w.Longitude === "number" ? w.Longitude : null,
      source: "wards",
    });
    wardCount++;
  }
  console.log(`  wards (Katsina): ${wardCount}`);

  // 2) OSM named places
  console.log("Querying OSM (Overpass)...");
  const q = [
    "[out:json][timeout:120];",
    'area["name"="Katsina"]["admin_level"="4"]->.a;',
    '( node["place"~"city|town|village|suburb|neighbourhood|quarter|hamlet"]["name"](area.a); );',
    "out tags center;",
  ].join("\n");
  const osm = await postOverpass(q);
  let osmCount = 0;
  for (const el of osm.elements || []) {
    const name = el.tags && el.tags.name;
    if (!name) continue;
    const lat = el.lat ?? el.center?.lat ?? null;
    const lng = el.lon ?? el.center?.lon ?? null;
    add({ name, type: el.tags.place || "place", lga: null, lat, lng, source: "osm" });
    osmCount++;
  }
  console.log(`  osm places: ${osmCount}`);

  // 3) Curated neighbourhoods (no stored coords - resolved live on selection)
  for (const name of CURATED) {
    add({ name, type: "neighbourhood", lga: null, lat: null, lng: null, source: "curated" });
  }
  console.log(`  curated: ${CURATED.length}`);

  // Finalise: stable id, sort by name.
  const places = [...byKey.values()]
    .map((e, i) => ({
      id: normKey(e.name).replace(/ /g, "-") || `p${i}`,
      name: e.name,
      type: e.type,
      lga: e.lga,
      lat: e.lat,
      lng: e.lng,
      source: e.source,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        _note:
          "Local Katsina places index for maps autocomplete. Built by scripts/build-katsina-places.js. Wards: open gov data. OSM: ODbL (c) OpenStreetMap contributors. Curated: authored; coords resolved live.",
        builtAt: new Date().toISOString(),
        count: places.length,
        places,
      },
      null,
      0,
    ),
  );
  console.log(`Wrote ${places.length} unique places -> ${OUT}`);
})().catch((e) => {
  console.error("build failed:", e.message);
  process.exit(1);
});
