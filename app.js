console.log("APP VERSION 20251223_2");

/* ===========================
   Konfigurasi
   =========================== */
const ION_ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YjQ4NTk0NS0wZmE5LTQ3ZWEtOTEzYy0xZTZhN2E4NmU5MTgiLCJpZCI6MjEzNjk3LCJpYXQiOjE3NjU4NzQxMzd9.rWDk_DtxtgruoJjwcQovfDqYAAUoBPUI531Bm7LvH8U";
const ION_ASSET_ID_BUILDINGS_3D = 4224210; // 3D Tiles
const ION_ASSET_ID_BUILDINGS_2D = 4224206; // GeoJSON

const TERBAN_CENTER = { lon: 110.3751182, lat: -7.7791734, height: 1500 };

/* ===========================
   Global
   =========================== */
Cesium.Ion.defaultAccessToken = ION_ACCESS_TOKEN;

const statusEl = document.getElementById("status");
const setStatus = (msg) => { statusEl.textContent = msg; };

let viewer;

let tileset3D = null;
let buildings2D = null;

let handler;
let mode = "none"; // none | line | area | sun
let points = [];
let tempPoint = null;
let drawEntity = null;
let pointEntities = [];
let resultLabel = null;

/* ===========================
   Init
   =========================== */
init().catch(err => {
  console.error(err);
  setStatus("Init gagal. Cek Console untuk detail error.");
});

async function init() {
  setStatus("Membuat viewer...");

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
    terrainProvider: new Cesium.EllipsoidTerrainProvider()
  });

  // PAKSA basemap OSM tampil (OSM-only)
  viewer.imageryLayers.removeAll(true);
  viewer.imageryLayers.addImageryProvider(
    new Cesium.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }),
    0
  );

  // optional: World Terrain (jika tersedia)
  try {
    if (typeof Cesium.createWorldTerrainAsync === "function") {
      viewer.terrainProvider = await Cesium.createWorldTerrainAsync();
    }
  } catch (e) {
    console.warn("WorldTerrain gagal, tetap ellipsoid:", e);
  }

  // Setup scene (biar OSM normal, lighting dimatikan)
  viewer.scene.globe.show = true;
  viewer.scene.globe.enableLighting = false;
  viewer.shadows = false;

  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
    Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
  );

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      TERBAN_CENTER.lon, TERBAN_CENTER.lat, TERBAN_CENTER.height
    )
  });

  // Load ion
  setStatus("Memuat layer Cesium ion...");
  await loadIonLayers();
   
async function applyTilesetHeightOffset(tileset, offsetMeters) {
  const bs = tileset.boundingSphere;
  const carto = Cesium.Cartographic.fromCartesian(bs.center);

  const surface = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height);
  const offset  = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height + offsetMeters);

  const translation = Cesium.Cartesian3.subtract(offset, surface, new Cesium.Cartesian3());
  tileset.modelMatrix = Cesium.Matrix4.fromTranslation(translation);
}

  // UI hooks
  document.getElementById("toggle3d").addEventListener("change", (e) => {
    if (tileset3D) tileset3D.show = e.target.checked;
  });
  document.getElementById("toggle2d").addEventListener("change", (e) => {
    if (buildings2D) buildings2D.show = e.target.checked;
  });

  document.getElementById("btnMeasureLine").addEventListener("click", startMeasureLine);
  document.getElementById("btnMeasureArea").addEventListener("click", startMeasureArea);
  document.getElementById("btnClear").addEventListener("click", clearDrawings);

  document.getElementById("btnNoon").addEventListener("click", setLocalNoonWIB);
  document.getElementById("btnSunDir").addEventListener("click", () => {
    mode = "sun";
    setStatus("Mode Sun Direction: klik 1 titik di peta.");
  });

  document.getElementById("btnLoadCollections").addEventListener("click", loadOgcCollections);
  document.getElementById("btnAddOgcLayer").addEventListener("click", addOgcLayer);

  // Handler input
  handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
  hookDrawingHandlers();

  setStatus("Viewer siap. Basemap OSM aktif. Layer ion dimuat.");
}

/* ===========================
   Ion layers
   =========================== */
async function loadIonLayers() {
  try {
    if (ION_ASSET_ID_BUILDINGS_3D) {
      tileset3D = await Cesium.Cesium3DTileset.fromIonAssetId(ION_ASSET_ID_BUILDINGS_3D);
      viewer.scene.primitives.add(tileset3D);
    }

    if (ION_ASSET_ID_BUILDINGS_2D) {
      const res2D = await Cesium.IonResource.fromAssetId(ION_ASSET_ID_BUILDINGS_2D);
      buildings2D = await Cesium.GeoJsonDataSource.load(res2D, { clampToGround: true });
      viewer.dataSources.add(buildings2D);

      // styling footprint
      buildings2D.entities.values.forEach((e) => {
        if (e.polygon) {
          e.polygon.material = Cesium.Color.CYAN.withAlpha(0.25);
          e.polygon.outline = true;
          e.polygon.outlineColor = Cesium.Color.CYAN.withAlpha(0.9);
        }
      });
    }

    if (tileset3D) await viewer.zoomTo(tileset3D);
    else if (buildings2D) await viewer.zoomTo(buildings2D);

  } catch (err) {
    console.error(err);
    setStatus("Gagal memuat layer ion. Cek token/izin asset.");
  }
}

/* ===========================
   Picking utils
   =========================== */
function pickWorldPosition(screenPosition) {
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
   Measure tools
   =========================== */
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

  // hapus panah matahari
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
  setStatus("Ukur Panjang: klik untuk tambah titik, klik kanan untuk selesai.");
}

function startMeasureArea() {
  clearDrawings();
  mode = "area";
  setStatus("Ukur Luas: klik untuk tambah titik, klik kanan untuk selesai.");
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

function hookDrawingHandlers() {
  handler.setInputAction((click) => {
    const pos = pickWorldPosition(click.position);
    if (!Cesium.defined(pos)) return;

    if (mode === "line" || mode === "area") {
      points.push(pos);
      addPointMarker(pos);
      ensureDynamicEntity();
    } else if (mode === "sun") {
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
}

/* ===========================
   Sun direction (12:00 WIB)
   =========================== */
function setLocalNoonWIB() {
  const now = new Date();
  // 12:00 WIB = 05:00 UTC
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const noonUtc = new Date(Date.UTC(y, m, d, 5, 0, 0));

  viewer.clock.currentTime = Cesium.JulianDate.fromDate(noonUtc);
  viewer.clock.shouldAnimate = false;

  setStatus("Waktu diset ke 12:00 WIB.");
}

function drawSunArrowAtNoon(cartPos) {
  const [lon, lat] = cartesianToLonLat(cartPos);

  const now = new Date();
  const localNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

  const sun = SunCalc.getPosition(localNoon, lat, lon);
  const azDegFromSouth = Cesium.Math.toDegrees(sun.azimuth);
  const bearingFromNorth = (azDegFromSouth + 180 + 360) % 360;
  const altitudeDeg = Cesium.Math.toDegrees(sun.altitude);

  const start = turf.point([lon, lat]);
  const end = turf.destination(start, 0.2, bearingFromNorth, { units: "kilometers" }).geometry.coordinates;
  const endPos = Cesium.Cartesian3.fromDegrees(end[0], end[1], 0);

  viewer.entities.values
    .filter(e => e._isSunArrow)
    .forEach(e => viewer.entities.remove(e));

  const arrow = viewer.entities.add({
    polyline: { positions: [cartPos, endPos], width: 4 },
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

/* ===========================
   OGC API - Features
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
  if (!base) { setStatus("Isi Base URL OGC API terlebih dulu."); return; }

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
      setStatus("Tidak ada collections ditemukan.");
      return;
    }
    setStatus(`Collections loaded: ${collections.length} item.`);
  } catch (err) {
    console.error(err);
    setStatus("Gagal load collections (cek URL/CORS/format server).");
  }
}

async function addOgcLayer() {
  const base = normalizeBaseUrl(ogcBaseUrlEl.value);
  const collectionId = ogcCollectionsEl.value;
  if (!base || !collectionId) { setStatus("Base URL / Collection belum dipilih."); return; }

  try {
    const bbox = getCurrentViewBbox();
    const limit = 1000;

    const url = bbox
      ? `${base}/collections/${encodeURIComponent(collectionId)}/items?f=geojson&limit=${limit}&bbox=${bbox.join(",")}`
      : `${base}/collections/${encodeURIComponent(collectionId)}/items?f=geojson&limit=${limit}`;

    setStatus(`Memuat OGC layer: ${collectionId} ...`);

    const geojson = await fetch(url).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });

    const ds = await Cesium.GeoJsonDataSource.load(geojson, { clampToGround: true });
    viewer.dataSources.add(ds);
    await viewer.zoomTo(ds);

    setStatus(`OGC layer ditambahkan: ${collectionId}`);
  } catch (err) {
    console.error(err);
    setStatus("Gagal menambahkan OGC layer (CORS/paging/format geojson).");
  }
}
