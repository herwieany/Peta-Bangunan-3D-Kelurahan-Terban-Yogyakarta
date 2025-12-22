console.log("APP VERSION 20251223_1");

/* ===========================
   Konfigurasi
   =========================== */
const ION_ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YjQ4NTk0NS0wZmE5LTQ3ZWEtOTEzYy0xZTZhN2E4NmU5MTgiLCJpZCI6MjEzNjk3LCJpYXQiOjE3NjU4NzQxMzd9.rWDk_DtxtgruoJjwcQovfDqYAAUoBPUI531Bm7LvH8U";
const ION_ASSET_ID_BUILDINGS_3D = 4224210;
const ION_ASSET_ID_BUILDINGS_2D = 4224206;

const TERBAN_CENTER = {
  lon: 110.3751182,
  lat: -7.7791734,
  height: 1500
};


/* ===========================
   Global refs
   =========================== */
Cesium.Ion.defaultAccessToken = ION_ACCESS_TOKEN;

const statusEl = document.getElementById("status");
const setStatus = (msg) => { statusEl.textContent = msg; };

let viewer;

let tileset3D = null;
let buildings2D = null;

let handler; // akan dibuat setelah viewer siap

/* ===========================
   Init
   =========================== */
init().catch(err => {
  console.error(err);
  setStatus("Init gagal. Cek Console untuk detail error.");
});

async function init() {
  // 1) Buat viewer (JANGAN pakai createWorldTerrain())
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

  // 2) Optional: World Terrain versi baru (async)
  try {
    if (typeof Cesium.createWorldTerrainAsync === "function") {
      viewer.terrainProvider = await Cesium.createWorldTerrainAsync();
    }
  } catch (e) {
    console.warn("WorldTerrain gagal, tetap ellipsoid:", e);
  }

  // 3) Setup scene
  viewer.scene.globe.enableLighting = true;
  viewer.shadows = true;
  viewer.scene.shadowMap.enabled = true;

  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
    Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
  );

  // 4) Fly to Terban
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      TERBAN_CENTER.lon, TERBAN_CENTER.lat, TERBAN_CENTER.height
    )
  });

  // 5) Hook UI setelah viewer siap

  document.getElementById("toggle3d").addEventListener("change", (e) => {
    if (tileset3D) tileset3D.show = e.target.checked;
  });
  document.getElementById("toggle2d").addEventListener("change", (e) => {
    if (buildings2D) buildings2D.show = e.target.checked;
  });

  // 6) Load ion layers
  await loadIonLayers();

  // 7) Baru buat handler kalau viewer sudah ada
  handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

  setStatus("Viewer siap dan layer ion dimuat.");
}

/* ===========================
   Basemap
   =========================== */
function setDayBasemap() {
  if (!viewer) return;
  if (nightLayer) viewer.imageryLayers.remove(nightLayer, false);
  nightLayer = null;
  dayLayer.show = true;
  setStatus("Basemap: OpenStreetMap (siang).");
}

function setNightBasemap() {
  if (!viewer) return;
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
   Load ion
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
    }

    if (tileset3D) await viewer.zoomTo(tileset3D);
    else if (buildings2D) await viewer.zoomTo(buildings2D);

  } catch (err) {
    console.error(err);
    setStatus("Gagal memuat layer ion (cek token/izin asset).");
  }
}
