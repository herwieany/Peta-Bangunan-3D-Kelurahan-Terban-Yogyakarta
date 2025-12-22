// app.js
// Template WebGIS sederhana yang mengambil data dari Cesium ion

// ===== 1. Konfigurasi token & Asset ID =====
Cesium.Ion.defaultAccessToken = 'yJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwNTY2Y2Y1Ni02YWUyLTQ1OWQtODcyYi1lZGM5OTJhOWI1OWQiLCJpZCI6MjEzNjk3LCJpYXQiOjE3NjU4NjA2NzF9.37HTp-nTHxNr4umeQruV45iHJnaxmJsS94B_yUIdm28';

// Ganti dengan Asset ID 3D Tiles (misalnya bangunan 3D Terban)
const ASSET_ID_3D = 4224210;   // contoh, ganti angka ini

// (Opsional) Asset ID data vektor 2D (GeoJSON) dari Cesium ion
const ASSET_ID_2D = 4224206;   // kalau tidak ada, bisa dikosongkan atau diabaikan

// ===== 2. Inisialisasi viewer =====
const viewer = new Cesium.Viewer('cesiumContainer', {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  sceneMode: Cesium.SceneMode.SCENE3D,
  animation: false,
  timeline: false,
  geocoder: false,
  homeButton: true,
  sceneModePicker: true,
  baseLayerPicker: false,   // kita atur basemap sendiri di bawah
  navigationHelpButton: false,
  fullscreenButton: true
});

// Ganti basemap: gunakan gaya "ROAD" (bukan citra satelit)
(async () => {
  viewer.imageryLayers.removeAll();
  const roadImagery = await Cesium.createWorldImageryAsync({
    style: Cesium.IonWorldImageryStyle.ROAD
  });
  viewer.imageryLayers.addImageryProvider(roadImagery);
})();

// Pencahayaan globe untuk efek siang–malam (kalau digunakan nanti)
viewer.scene.globe.enableLighting = true;

// DOM elemen untuk UI
const statusEl = document.getElementById('status');
const modeLabelEl = document.getElementById('mode-label');
const btn3d = document.getElementById('btn3d');
const btn2d = document.getElementById('btn2d');
const btnZoomData = document.getElementById('btnZoomData');
const btnHome = document.getElementById('btnHome');

// Variabel global untuk tileset dan data 2D
let tileset3D = null;
let dataSource2D = null;
let defaultBoundingSphere = null; // untuk zoom ke data

// ===== 3. Memuat data dari Cesium ion =====
async function loadData() {
  // 3D Tiles terlebih dahulu
  try {
    statusEl.textContent = 'Memuat 3D Tiles dari Cesium ion…';
    tileset3D = await Cesium.Cesium3DTileset.fromIonAssetId(ASSET_ID_3D);
    viewer.scene.primitives.add(tileset3D);

    // Hitung bounding sphere dan langsung zoom ke area data
    defaultBoundingSphere = tileset3D.boundingSphere;
    viewer.camera.flyToBoundingSphere(defaultBoundingSphere, {
      duration: 0.0,
      offset: new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(-35.0),
        Cesium.Math.toRadians(-40.0),
        defaultBoundingSphere.radius * 2.5
      )
    });

    statusEl.textContent = '3D Tiles berhasil dimuat. Memuat data 2D (jika tersedia)…';
  } catch (error) {
    console.error('Gagal memuat 3D Tiles:', error);
    statusEl.textContent = 'Gagal memuat 3D Tiles. Periksa Asset ID 3D dan token.';
    return;
  }

  // Data GeoJSON 2D (opsional)
  if (!ASSET_ID_2D) {
    statusEl.textContent = '3D Tiles siap digunakan.';
    return;
  }

  try {
    dataSource2D = await Cesium.GeoJsonDataSource.fromIonAssetId(ASSET_ID_2D);
    viewer.dataSources.add(dataSource2D);

    // Styling sederhana agar kontras di atas basemap
    const entities = dataSource2D.entities.values;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.polygon) {
        e.polygon.material = Cesium.Color.fromCssColorString('#60a5fa').withAlpha(0.5);
        e.polygon.outline = true;
        e.polygon.outlineColor = Cesium.Color.fromCssColorString('#1d4ed8');
      }
      if (e.polyline) {
        e.polyline.width = 2;
        e.polyline.material = Cesium.Color.fromCssColorString('#2563eb');
      }
      if (e.point) {
        e.point.pixelSize = 7;
        e.point.color = Cesium.Color.fromCssColorString('#f97316');
        e.point.outlineColor = Cesium.Color.WHITE;
        e.point.outlineWidth = 1;
      }
    }

    statusEl.textContent = 'Data 3D dan 2D berhasil dimuat. Silakan eksplor peta.';
  } catch (error) {
    console.warn('3D berhasil, tetapi gagal memuat GeoJSON 2D:', error);
    statusEl.textContent = '3D siap. Data 2D tidak berhasil dimuat (cek Asset ID 2D).';
  }
}

loadData();

// ===== 4. Interaksi tombol UI =====

function setModeButton(active) {
  if (active === '3D') {
    btn3d.classList.add('btn-active');
    btn2d.classList.remove('btn-active');
    modeLabelEl.textContent = '3D';
  } else {
    btn2d.classList.add('btn-active');
    btn3d.classList.remove('btn-active');
    modeLabelEl.textContent = '2D';
  }
}

// Ubah mode tampilan
btn3d.addEventListener('click', () => {
  viewer.scene.morphTo3D(1.0);
  setModeButton('3D');
});

btn2d.addEventListener('click', () => {
  viewer.scene.morphTo2D(1.0);
  setModeButton('2D');
});

// Zoom ke area data
btnZoomData.addEventListener('click', () => {
  if (defaultBoundingSphere) {
    viewer.camera.flyToBoundingSphere(defaultBoundingSphere, {
      duration: 1.0,
      offset: new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(-35.0),
        Cesium.Math.toRadians(-40.0),
        defaultBoundingSphere.radius * 2.5
      )
    });
  } else if (tileset3D) {
    const bs = tileset3D.boundingSphere;
    viewer.camera.flyToBoundingSphere(bs);
  }
});

// Zoom ke globe default (home)
btnHome.addEventListener('click', () => {
  viewer.camera.flyHome(1.5);
});
