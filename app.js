
/* ===========================
   Konfigurasi wajib (ISI INI)
   =========================== */
const ION_ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YjQ4NTk0NS0wZmE5LTQ3ZWEtOTEzYy0xZTZhN2E4NmU5MTgiLCJpZCI6MjEzNjk3LCJpYXQiOjE3NjU4NzQxMzd9.rWDk_DtxtgruoJjwcQovfDqYAAUoBPUI531Bm7LvH8U";

// Asset dari Cesium ion:
// - 3D Buildings: 3D Tileset (Cesium3DTileset)
// - 2D Buildings: GeoJSON/TopoJSON (GeoJsonDataSource) atau 3D Tiles juga (jika 2D anda sebenarnya tiles)
const ION_ASSET_ID_BUILDINGS_3D = 4224210; // <-- ganti: contoh 123456
const ION_ASSET_ID_BUILDINGS_2D = 4224206; // <-- ganti: contoh 234567

/* ===========================
   Inisialisasi Cesium Viewer
   =========================== */
Cesium.Ion.defaultAccessToken = ION_ACCESS_TOKEN;

const statusEl = document.getElementById("status");
const setStatus = (msg) => { statusEl.textContent = msg; };

let viewer; // deklarasi global agar fungsi lain bisa mengakses

async function initViewer() {
  // Buat viewer terlebih dahulu menggunakan Ellipsoid (tanpa terrain)
  viewer = new Cesium.Viewer("cesiumContainer", {
    animation: false,
    timeline: false,
    geocoder: true,
    homeButton: true,
    sceneModePicker: true,
    navigationHelpButton: false,
    baseLayerPicker: false,
    selectionIndicator: true,
    infoBox: true,
    imageryProvider: new Cesium.OpenStreetMapImageryProvider({
      url: "https://tile.openstreetmap.org/"
    }),
    terrainProvider: new Cesium.EllipsoidTerrainProvider()
  });

  // Coba aktifkan terrain Cesium World Terrain (async)
  try {
    viewer.terrainProvider = await Cesium.createWorldTerrainAsync();
    setStatus("World Terrain berhasil dimuat dari Cesium ion.");
  } catch (err) {
    console.warn("Gagal memuat World Terrain, tetap pakai ellipsoid:", err);
    setStatus("World Terrain gagal dimuat, menggunakan terrain ellipsoid default.");
  }

  // Pengaturan pencahayaan dan bayangan
  viewer.scene.globe.enableLighting = true;
  viewer.shadows = true;
  viewer.scene.shadowMap.enabled = true;

  // Nonaktifkan double-click zoom agar nyaman untuk digitasi
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
    Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
  );

  // Fly ke area Terban
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      TERBAN_CENTER.lon,
      TERBAN_CENTER.lat,
      TERBAN_CENTER.height
    )
  });

  // Setelah viewer siap, load data ion
  loadIonLayers();
}

// Jalankan fungsi inisialisasi viewer
initViewer();


// Pusat Terban (zoom awal)
const TERBAN_CENTER = {
  lon: 110.3751182,
  lat: -7.7791734,
  height: 1500
};

// Basemap malam (gelap). Pastikan mematuhi terms penyedia tile.
const NIGHT_TILE_URL = "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png";

/* ===========================
   Inisialisasi Cesium Viewer
   =========================== */

viewer.scene.globe.enableLighting = true;
viewer.shadows = true;
viewer.scene.shadowMap.enabled = true;

// Disable default double-click zoom (agar nyaman untuk digitizing)
viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

// Zoom awal ke Terban
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(TERBAN_CENTER.lon, TERBAN_CENTER.lat, TERBAN_CENTER.height)
});

/* ===========================
   Basemap: Day / Night
   =========================== */
let dayLayer = viewer.imageryLayers.get(0);
let nightLayer = null;

function setDayBasemap() {
  if (nightLayer) viewer.imageryLayers.remove(nightLayer, false);
  nightLayer = null;
  if (!viewer.imageryLayers.contains(dayLayer)) viewer.imageryLayers.add(dayLayer, 0);
  dayLayer.show = true;
  setStatus("Basemap: OpenStreetMap (siang).");
}

function setNightBasemap() {
  if (!nightLayer) {
    nightLayer = viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({ url: NIGHT_TILE_URL }),
      0
    );
  }
  dayLayer.show = false;
  setStatus("Basemap: mode malam (gelap).");
}

/* ===========================
   Load Buildings 3D & 2D dari ion
   =========================== */
let tileset3D = null;
let buildings2D = null;

async function loadIonLayers() {
  try {
    // 3D Tiles
    if (ION_ASSET_ID_BUILDINGS_3D && ION_ASSET_ID_BUILDINGS_3D !== 0) {
      tileset3D = await Cesium.Cesium3DTileset.fromIonAssetId(ION_ASSET_ID_BUILDINGS_3D);
      viewer.scene.primitives.add(tileset3D);
    }

    // 2D (GeoJSON) dari ion
    if (ION_ASSET_ID_BUILDINGS_2D && ION_ASSET_ID_BUILDINGS_2D !== 0) {
      const res2D = await Cesium.IonResource.fromAssetId(ION_ASSET_ID_BUILDINGS_2D);
      buildings2D = await Cesium.GeoJsonDataSource.load(res2D, {
        clampToGround: true
      });

      // Styling sederhana untuk polygon footprint
      viewer.dataSources.add(buildings2D);
      buildings2D.entities.values.forEach((e) => {
        if (e.polygon) {
          e.polygon.material = Cesium.Color.CYAN.withAlpha(0.25);
          e.polygon.outline = true;
          e.polygon.outlineColor = Cesium.Color.CYAN.withAlpha(0.9);
        }
      });
    }

    // Fly to layer jika tersedia
    if (tileset3D) {
      await viewer.zoomTo(tileset3D);
    } else if (buildings2D) {
      await viewer.zoomTo(buildings2D);
    } else {
      setStatus("Layer ion belum dimuat: isi ION_ASSET_ID_BUILDINGS_3D / ION_ASSET_ID_BUILDINGS_2D di app.js.");
      return;
    }

    setStatus("Buildings 2D/3D berhasil dimuat dari Cesium ion.");
  } catch (err) {
    console.error(err);
    setStatus("Gagal memuat layer dari Cesium ion. Pastikan token valid, assetId benar, dan asset dapat diakses.");
  }
}
loadIonLayers();

/* ===========================
   Toggle 2D / 3D
   =========================== */
document.getElementById("toggle3d").addEventListener("change", (e) => {
  if (tileset3D) tileset3D.show = e.target.checked;
});

document.getElementById("toggle2d").addEventListener("change", (e) => {
  if (buildings2D) buildings2D.show = e.target.checked;
});

document.getElementById("btnDay").addEventListener("click", setDayBasemap);
document.getElementById("btnNight").addEventListener("click", setNightBasemap);

/* ===========================
   Util: ambil posisi di permukaan bumi/objek
   =========================== */
function pickWorldPosition(screenPosition) {
  // Prioritaskan pickPosition (bisa kena 3D tiles), fallback ke globe.pick
  if (viewer.scene.pickPositionSupported) {
    const p = viewer.scene.pickPosition(screenPosition);
    if (Cesium.defined(p)) return p;
  }
  const ray = viewer.camera.getPickRay(screenPosition);
  return viewer.scene.globe.pick(ray, viewer.scene);
}

function cartesianToLonLat(cart) {
  const c = Cesium.Cartographic.fromCartesian(cart);
  return [Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude)];
}

/* ===========================
   Measure: Line & Area (Turf)
   =========================== */
let handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
let mode = "none"; // none | line | area | sun
let points = [];
let tempPoint = null;
let drawEntity = null;
let pointEntities = [];
let resultLabel = null;

function clearDrawings() {
  points = [];
  tempPoint = null;
  mode = "none";

  if (drawEntity) viewer.entities.remove(drawEntity);
  drawEntity = null;

  if (resultLabel) viewer.entities.remove(resultLabel);
  resultLabel = null;

  pointEntities.forEach((pe) => viewer.entities.remove(pe));
  pointEntities = [];

  // hapus arrow sun (jika ada)
  viewer.entities.values
    .filter(e => e._isSunArrow)
    .forEach(e => viewer.entities.remove(e));

  setStatus("Clear selesai.");
}

function addPointMarker(pos) {
  const ent = viewer.entities.add({
    position: pos,
    point: { pixelSize: 8, outlineWidth: 2 }
  });
  pointEntities.push(ent);
}

function startMeasureLine() {
  clearDrawings();
  mode = "line";
  setStatus("Mode Ukur Panjang: klik untuk menambah titik, klik kanan untuk selesai.");
}

function startMeasureArea() {
  clearDrawings();
  mode = "area";
  setStatus("Mode Ukur Luas: klik untuk menambah titik, klik kanan untuk selesai.");
}

function ensureDynamicEntity() {
  if (mode === "line" && !drawEntity) {
    drawEntity = viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const arr = points.slice();
          if (tempPoint) arr.push(tempPoint);
          return arr;
        }, false),
        width: 3
      }
    });
  }
  if (mode === "area" && !drawEntity) {
    drawEntity = viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.CallbackProperty(() => {
          const arr = points.slice();
          if (tempPoint) arr.push(tempPoint);
          return new Cesium.PolygonHierarchy(arr);
        }, false),
        material: Cesium.Color.YELLOW.withAlpha(0.25),
        outline: true,
        outlineColor: Cesium.Color.YELLOW.withAlpha(0.9)
      }
    });
  }
}

function finalizeMeasurement() {
  if (points.length < (mode === "line" ? 2 : 3)) {
    setStatus("Titik belum cukup untuk menghitung.");
    return;
  }

  const coords = points.map(cartesianToLonLat);

  if (mode === "line") {
    const line = turf.lineString(coords);
    const km = turf.length(line, { units: "kilometers" });
    const meters = km * 1000;

    const last = points[points.length - 1];
    resultLabel = viewer.entities.add({
      position: last,
      label: {
        text: `Panjang: ${meters.toFixed(2)} m`,
        showBackground: true,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -12)
      }
    });

    setStatus(`Hasil: Panjang = ${meters.toFixed(2)} m`);
  }

  if (mode === "area") {
    // pastikan polygon tertutup untuk Turf
    const ring = coords.concat([coords[0]]);
    const poly = turf.polygon([ring]);
    const areaM2 = turf.area(poly);

    const centroid = turf.centroid(poly).geometry.coordinates;
    const centroidPos = Cesium.Cartesian3.fromDegrees(centroid[0], centroid[1], 0);

    resultLabel = viewer.entities.add({
      position: centroidPos,
      label: {
        text: `Luas: ${areaM2.toFixed(2)} m²`,
        showBackground: true,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -12)
      }
    });

    setStatus(`Hasil: Luas = ${areaM2.toFixed(2)} m²`);
  }

  mode = "none";
  tempPoint = null;
}

handler.setInputAction((click) => {
  const pos = pickWorldPosition(click.position);
  if (!Cesium.defined(pos)) return;

  if (mode === "line" || mode === "area") {
    points.push(pos);
    addPointMarker(pos);
    ensureDynamicEntity();
  } else if (mode === "sun") {
    // sun arrow: klik 1 titik saja
    drawSunArrowAtNoon(pos);
    mode = "none";
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

handler.setInputAction((movement) => {
  if (mode !== "line" && mode !== "area") return;
  const pos = pickWorldPosition(movement.endPosition);
  if (!Cesium.defined(pos)) return;
  tempPoint = pos;
  ensureDynamicEntity();
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

handler.setInputAction(() => {
  if (mode === "line" || mode === "area") {
    finalizeMeasurement();
  }
}, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

document.getElementById("btnMeasureLine").addEventListener("click", startMeasureLine);
document.getElementById("btnMeasureArea").addEventListener("click", startMeasureArea);
document.getElementById("btnClear").addEventListener("click", clearDrawings);

/* ===========================
   Sun direction at local noon (WIB)
   - Set jam 12:00 WIB untuk rendering lighting/shadows
   - Klik titik -> gambar panah arah azimuth matahari
   =========================== */
function setLocalNoonWIB() {
  const now = new Date();
  // WIB = UTC+7 -> local 12:00 WIB = 05:00 UTC
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();

  const noonUtc = new Date(Date.UTC(y, m, d, 5, 0, 0)); // 12:00 WIB
  viewer.clock.currentTime = Cesium.JulianDate.fromDate(noonUtc);
  viewer.clock.shouldAnimate = false;

  setStatus(`Waktu diset ke 12:00 WIB (render lighting/shadows).`);
}

function drawSunArrowAtNoon(cartPos) {
  const [lon, lat] = cartesianToLonLat(cartPos);

  // Noon WIB untuk tanggal hari ini (lokal)
  const now = new Date();
  const localNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

  // SunCalc: azimuth rad (0 = selatan, + ke barat)
  const sun = SunCalc.getPosition(localNoon, lat, lon);
  const azDegFromSouth = Cesium.Math.toDegrees(sun.azimuth);
  const bearingFromNorth = (azDegFromSouth + 180 + 360) % 360; // konversi ke bearing 0..360 dari utara
  const altitudeDeg = Cesium.Math.toDegrees(sun.altitude);

  // Buat panah 200 meter mengikuti bearing
  const start = turf.point([lon, lat]);
  const end = turf.destination(start, 0.2, bearingFromNorth, { units: "kilometers" }).geometry.coordinates;

  const endPos = Cesium.Cartesian3.fromDegrees(end[0], end[1], 0);

  // Hapus panah lama (jika ada)
  viewer.entities.values
    .filter(e => e._isSunArrow)
    .forEach(e => viewer.entities.remove(e));

  const arrow = viewer.entities.add({
    polyline: {
      positions: [cartPos, endPos],
      width: 4
    },
    label: {
      text: `Sun azimuth: ${bearingFromNorth.toFixed(1)}° | elev: ${altitudeDeg.toFixed(1)}°`,
      showBackground: true,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -14)
    }
  });
  arrow._isSunArrow = true;

  setStatus(`Arah matahari (12:00 WIB): azimuth ${bearingFromNorth.toFixed(1)}°, elev ${altitudeDeg.toFixed(1)}°.`);
}

document.getElementById("btnNoon").addEventListener("click", setLocalNoonWIB);
document.getElementById("btnSunDir").addEventListener("click", () => {
  mode = "sun";
  setStatus("Mode Sun Direction: klik 1 titik di peta untuk menampilkan panah arah sinar matahari jam 12:00 WIB.");
});

/* ===========================
   OGC API - Features
   - Load collections: GET {base}/collections?f=json
   - Add layer: GET {base}/collections/{id}/items?f=geojson&limit=...&bbox=...
   =========================== */
const ogcBaseUrlEl = document.getElementById("ogcBaseUrl");
const ogcCollectionsEl = document.getElementById("ogcCollections");

function normalizeBaseUrl(url) {
  return (url || "").trim().replace(/\/+$/, "");
}

function getCurrentViewBbox() {
  const rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
  if (!rect) return null;

  const west = Cesium.Math.toDegrees(rect.west);
  const south = Cesium.Math.toDegrees(rect.south);
  const east = Cesium.Math.toDegrees(rect.east);
  const north = Cesium.Math.toDegrees(rect.north);
  return [west, south, east, north];
}

async function loadOgcCollections() {
  const base = normalizeBaseUrl(ogcBaseUrlEl.value);
  if (!base) {
    setStatus("Isi Base URL OGC API terlebih dulu.");
    return;
  }

  try {
    setStatus("Mengambil daftar collections...");
    const url = `${base}/collections?f=json`;
    const json = await fetch(url).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });

    const collections = json.collections || [];
    ogcCollectionsEl.innerHTML = "";

    collections.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.title ? `${c.title} (${c.id})` : c.id;
      ogcCollectionsEl.appendChild(opt);
    });

    if (collections.length === 0) {
      setStatus("Tidak ada collections ditemukan (atau format respons berbeda).");
      return;
    }

    setStatus(`Collections loaded: ${collections.length} item.`);
  } catch (err) {
    console.error(err);
    setStatus("Gagal load collections. Cek URL, CORS, atau format OGC API server.");
  }
}

async function addOgcLayer() {
  const base = normalizeBaseUrl(ogcBaseUrlEl.value);
  const collectionId = ogcCollectionsEl.value;
  if (!base || !collectionId) {
    setStatus("Base URL / Collection belum dipilih.");
    return;
  }

  try {
    const bbox = getCurrentViewBbox();
    const limit = 1000;

    // Banyak server OGC API mendukung bbox & limit
    const url = bbox
      ? `${base}/collections/${encodeURIComponent(collectionId)}/items?f=geojson&limit=${limit}&bbox=${bbox.join(",")}`
      : `${base}/collections/${encodeURIComponent(collectionId)}/items?f=geojson&limit=${limit}`;

    setStatus(`Memuat OGC layer: ${collectionId} ...`);

    const geojson = await fetch(url).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });

    const ds = await Cesium.GeoJsonDataSource.load(geojson, {
      clampToGround: true
    });
    viewer.dataSources.add(ds);
    await viewer.zoomTo(ds);

    setStatus(`OGC layer ditambahkan: ${collectionId}`);
  } catch (err) {
    console.error(err);
    setStatus("Gagal menambahkan OGC layer. Kemungkinan: CORS, paging besar, atau server tidak mendukung f=geojson.");
  }
}

document.getElementById("btnLoadCollections").addEventListener("click", loadOgcCollections);
document.getElementById("btnAddOgcLayer").addEventListener("click", addOgcLayer);
