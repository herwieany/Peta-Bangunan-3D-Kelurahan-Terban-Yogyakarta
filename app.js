// Konfigurasi Aplikasi Cesium Ion Viewer
document.addEventListener('DOMContentLoaded', function() {
    // Default Cesium Ion Access Token (gunakan token Anda sendiri)
    let cesiumAccessToken = '';
    
    // Inisialisasi variabel viewer
    let viewer = null;
    let is2DMode = false;
    let currentLocation = 'jakarta';
    
    // Data lokasi dengan koordinat
    const locations = {
        jakarta: { lat: -6.2088, lon: 106.8456, alt: 1000, heading: 0, pitch: -30 },
        bali: { lat: -8.4095, lon: 115.1889, alt: 5000, heading: 0, pitch: -30 },
        yogyakarta: { lat: -7.7956, lon: 110.3695, alt: 2000, heading: 0, pitch: -30 },
        surabaya: { lat: -7.2575, lon: 112.7521, alt: 1000, heading: 0, pitch: -30 },
        newyork: { lat: 40.7128, lon: -74.0060, alt: 5000, heading: 0, pitch: -30 },
        tokyo: { lat: 35.6762, lon: 139.6503, alt: 5000, heading: 0, pitch: -30 },
        paris: { lat: 48.8566, lon: 2.3522, alt: 5000, heading: 0, pitch: -30 },
        sydney: { lat: -33.8688, lon: 151.2093, alt: 5000, heading: 0, pitch: -30 }
    };
    
    // Elemen DOM
    const tokenInput = document.getElementById('token-input');
    const toggleTokenBtn = document.getElementById('toggle-token');
    const applyTokenBtn = document.getElementById('apply-token');
    const viewModeSelect = document.getElementById('view-mode');
    const locationSelect = document.getElementById('location-select');
    const toggle2d3dBtn = document.getElementById('toggle-2d3d');
    const resetViewBtn = document.getElementById('reset-view');
    const flyHomeBtn = document.getElementById('fly-home');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const compassBtn = document.getElementById('compass');
    const latValue = document.getElementById('lat-value');
    const lonValue = document.getElementById('lon-value');
    const altValue = document.getElementById('alt-value');
    const viewStatus = document.getElementById('view-status');
    const fpsCounter = document.getElementById('fps-counter');
    const loadingProgress = document.getElementById('loading-progress');
    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.querySelector('.progress-text');
    const layerItems = document.querySelectorAll('.layer-item');
    
    // Event Listeners
    toggleTokenBtn.addEventListener('click', toggleTokenVisibility);
    applyTokenBtn.addEventListener('click', initializeCesiumViewer);
    viewModeSelect.addEventListener('change', changeViewMode);
    locationSelect.addEventListener('change', flyToLocation);
    toggle2d3dBtn.addEventListener('click', toggle2D3D);
    resetViewBtn.addEventListener('click', resetView);
    flyHomeBtn.addEventListener('click', flyHome);
    zoomInBtn.addEventListener('click', zoomIn);
    zoomOutBtn.addEventListener('click', zoomOut);
    compassBtn.addEventListener('click', resetCompass);
    
    // Event listeners untuk layer selection
    layerItems.forEach(item => {
        item.addEventListener('click', function() {
            const layerType = this.getAttribute('data-layer');
            toggleLayer(layerType, this);
        });
    });
    
    // Fungsi untuk toggle visibilitas token
    function toggleTokenVisibility() {
        const type = tokenInput.getAttribute('type');
        const newType = type === 'password' ? 'text' : 'password';
        tokenInput.setAttribute('type', newType);
        
        const icon = toggleTokenBtn.querySelector('i');
        icon.className = newType === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
    }
    
    // Fungsi untuk inisialisasi Cesium Viewer
    function initializeCesiumViewer() {
        // Ambil token dari input
        cesiumAccessToken = tokenInput.value.trim();
        
        if (!cesiumAccessToken) {
            alert('Silakan masukkan token akses Cesium Ion');
            return;
        }
        
        // Set Cesium Ion access token
        Cesium.Ion.defaultAccessToken = cesiumAccessToken;
        
        // Tampilkan loading progress
        showLoadingProgress(true);
        
        // Hancurkan viewer sebelumnya jika ada
        if (viewer && !viewer.isDestroyed()) {
            viewer.destroy();
        }
        
        // Inisialisasi viewer Cesium
        try {
            viewer = new Cesium.Viewer('cesium-container', {
                baseLayerPicker: false,
                geocoder: false,
                homeButton: false,
                sceneModePicker: false,
                navigationHelpButton: false,
                animation: false,
                timeline: false,
                fullscreenButton: false,
                infoBox: false,
                selectionIndicator: false,
                shadows: true,
                terrainShadows: Cesium.ShadowMode.ENABLED,
                shouldAnimate: true,
                scene3DOnly: false,
                imageryProvider: new Cesium.BingMapsImageryProvider({
                    url: 'https://dev.virtualearth.net',
                    key: Cesium.BingMapsApi.getKey() || 'YOUR_BING_MAPS_KEY', // Ganti dengan Bing Maps key Anda
                    mapStyle: Cesium.BingMapsStyle.AERIAL
                }),
                terrainProvider: Cesium.createWorldTerrain({
                    requestWaterMask: true,
                    requestVertexNormals: true
                })
            });
            
            // Tambahkan 3D buildings dari Cesium Ion
            const buildingTileset = viewer.scene.primitives.add(
                new Cesium.Cesium3DTileset({
                    url: Cesium.IonResource.fromAssetId(96188), // Cesium OSM Buildings asset ID
                    maximumScreenSpaceError: 2,
                    maximumNumberOfLoadedTiles: 1000,
                    shadows: Cesium.ShadowMode.ENABLED
                })
            );
            
            // Setup event handlers setelah viewer siap
            setupViewerEventHandlers();
            
            // Terbang ke lokasi default
            flyToLocation();
            
            // Update status
            viewStatus.textContent = 'Mode: 3D Globe';
            
            // Setup FPS counter
            setupFPSCounter();
            
            // Sembunyikan loading progress
            setTimeout(() => {
                showLoadingProgress(false);
            }, 1500);
            
        } catch (error) {
            console.error('Error initializing Cesium viewer:', error);
            alert('Gagal menginisialisasi viewer. Periksa token dan koneksi internet Anda.');
            showLoadingProgress(false);
        }
    }
    
    // Setup event handlers untuk viewer
    function setupViewerEventHandlers() {
        if (!viewer) return;
        
        // Update posisi kamera secara real-time
        viewer.scene.postRender.addEventListener(function() {
            if (viewer.camera) {
                const cartographic = Cesium.Cartographic.fromCartesian(viewer.camera.position);
                const lat = Cesium.Math.toDegrees(cartographic.latitude).toFixed(4);
                const lon = Cesium.Math.toDegrees(cartographic.longitude).toFixed(4);
                const alt = Math.max(0, cartographic.height).toFixed(0);
                
                latValue.textContent = `${lat}°`;
                lonValue.textContent = `${lon}°`;
                altValue.textContent = `${alt} m`;
            }
        });
        
        // Handle loading progress
        viewer.scene.globe.tileLoadProgressEvent.addEventListener(function(progress) {
            const total = viewer.scene.globe.tilesLoaded + progress;
            if (total > 0) {
                const percent = Math.min(100, Math.round((viewer.scene.globe.tilesLoaded / total) * 100));
                updateLoadingProgress(percent);
            }
        });
    }
    
    // Fungsi untuk mengubah mode tampilan
    function changeViewMode() {
        if (!viewer) return;
        
        const mode = viewModeSelect.value;
        
        switch(mode) {
            case '2D':
                viewer.scene.mode = Cesium.SceneMode.SCENE2D;
                viewStatus.textContent = 'Mode: 2D Map';
                is2DMode = true;
                break;
            case '3D':
                viewer.scene.mode = Cesium.SceneMode.SCENE3D;
                viewStatus.textContent = 'Mode: 3D Globe';
                is2DMode = false;
                break;
            case 'columbus':
                viewer.scene.mode = Cesium.SceneMode.COLUMBUS_VIEW;
                viewStatus.textContent = 'Mode: Columbus View';
                is2DMode = false;
                break;
        }
    }
    
    // Fungsi untuk terbang ke lokasi yang dipilih
    function flyToLocation() {
        if (!viewer) return;
        
        currentLocation = locationSelect.value;
        const location = locations[currentLocation];
        
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(location.lon, location.lat, location.alt),
            orientation: {
                heading: Cesium.Math.toRadians(location.heading),
                pitch: Cesium.Math.toRadians(location.pitch),
                roll: 0.0
            },
            duration: 2.0,
            complete: function() {
                console.log(`Terbang ke ${currentLocation} selesai`);
            }
        });
    }
    
    // Fungsi untuk toggle antara mode 2D dan 3D
    function toggle2D3D() {
        if (!viewer) return;
        
        if (is2DMode) {
            viewer.scene.mode = Cesium.SceneMode.SCENE3D;
            viewStatus.textContent = 'Mode: 3D Globe';
            is2DMode = false;
            viewModeSelect.value = '3D';
        } else {
            viewer.scene.mode = Cesium.SceneMode.SCENE2D;
            viewStatus.textContent = 'Mode: 2D Map';
            is2DMode = true;
            viewModeSelect.value = '2D';
        }
    }
    
    // Fungsi untuk reset view
    function resetView() {
        if (!viewer) return;
        
        viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
            orientation: {
                heading: 0,
                pitch: -Cesium.Math.PI_OVER_TWO,
                roll: 0
            }
        });
    }
    
    // Fungsi untuk terbang ke home (lokasi default)
    function flyHome() {
        if (!viewer) return;
        
        viewer.camera.flyHome(2.0);
    }
    
    // Fungsi untuk zoom in
    function zoomIn() {
        if (!viewer) return;
        
        const camera = viewer.camera;
        const distance = Cesium.Cartesian3.distance(camera.position, camera.positionWC);
        const moveAmount = distance * 0.5;
        
        camera.moveForward(moveAmount);
    }
    
    // Fungsi untuk zoom out
    function zoomOut() {
        if (!viewer) return;
        
        const camera = viewer.camera;
        const distance = Cesium.Cartesian3.distance(camera.position, camera.positionWC);
        const moveAmount = distance * 0.5;
        
        camera.moveBackward(moveAmount);
    }
    
    // Fungsi untuk reset kompas (heading)
    function resetCompass() {
        if (!viewer) return;
        
        viewer.camera.setView({
            orientation: {
                heading: 0,
                pitch: viewer.camera.pitch,
                roll: 0
            }
        });
    }
    
    // Fungsi untuk toggle layer
    function toggleLayer(layerType, element) {
        if (!viewer) return;
        
        // Hapus class active dari semua layer items
        layerItems.forEach(item => {
            item.classList.remove('active');
        });
        
        // Tambah class active ke layer yang dipilih
        element.classList.add('active');
        
        // Update layer berdasarkan tipe
        switch(layerType) {
            case 'bing':
                viewer.imageryLayers.removeAll();
                viewer.imageryLayers.addImageryProvider(new Cesium.BingMapsImageryProvider({
                    url: 'https://dev.virtualearth.net',
                    key: Cesium.BingMapsApi.getKey() || 'YOUR_BING_MAPS_KEY',
                    mapStyle: Cesium.BingMapsStyle.AERIAL
                }));
                break;
                
            case 'osm':
                viewer.imageryLayers.removeAll();
                viewer.imageryLayers.addImageryProvider(new Cesium.OpenStreetMapImageryProvider({
                    url: 'https://tile.openstreetmap.org/'
                }));
                break;
                
            case 'terrain':
                // Cesium World Terrain sudah diatur sebagai default
                viewer.terrainProvider = Cesium.createWorldTerrain({
                    requestWaterMask: true,
                    requestVertexNormals: true
                });
                break;
                
            case 'buildings':
                // Toggle 3D buildings
                const tilesets = viewer.scene.primitives._primitives;
                tilesets.forEach(tileset => {
                    if (tileset instanceof Cesium.Cesium3DTileset) {
                        tileset.show = !tileset.show;
                    }
                });
                break;
        }
    }
    
    // Fungsi untuk menampilkan/menyembunyikan loading progress
    function showLoadingProgress(show) {
        if (show) {
            loadingProgress.style.display = 'block';
            updateLoadingProgress(0);
        } else {
            loadingProgress.style.display = 'none';
        }
    }
    
    // Fungsi untuk update loading progress
    function updateLoadingProgress(percent) {
        if (progressBar && progressText) {
            progressBar.style.width = `${percent}%`;
            progressText.textContent = percent === 100 ? 'Siap!' : `Loading... ${percent}%`;
        }
    }
    
    // Setup FPS counter
    function setupFPSCounter() {
        if (!viewer) return;
        
        let frameCount = 0;
        let lastTime = performance.now();
        
        viewer.scene.postRender.addEventListener(function() {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                fpsCounter.textContent = `FPS: ${fps}`;
                
                frameCount = 0;
                lastTime = currentTime;
            }
        });
    }
    
    // Inisialisasi default dengan token contoh
    // Catatan: Ganti dengan token Cesium Ion Anda sendiri
    const defaultToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YjQ4NTk0NS0wZmE5LTQ3ZWEtOTEzYy0xZTZhN2E4NmU5MTgiLCJpZCI6MjEzNjk3LCJpYXQiOjE3NjU4NzQxMzd9.rWDk_DtxtgruoJjwcQovfDqYAAUoBPUI531Bm7LvH8U';
    tokenInput.value = defaultToken;
    
    // Inisialisasi viewer saat halaman dimuat
    setTimeout(() => {
        initializeCesiumViewer();
    }, 500);
});
