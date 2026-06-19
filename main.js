/* ============================================================
   MAIN.JS — NOVA Space Planning · CesiumJS Controller
   ============================================================ */

const { REGIONS, STORES } = window.PH_DATA;

/* ---------------------------------------------------------------
   CESIUM VIEWER SETUP
--------------------------------------------------------------- */
// Initialize Cesium viewer, turning off all default UI widgets for a clean dashboard look
const viewer = new Cesium.Viewer('cesiumContainer', {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    vrButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
    scene3DOnly: true,
    // Use CartoDB Dark Matter imagery for a cyberpunk aesthetic
    imageryProvider: new Cesium.UrlTemplateImageryProvider({
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        credit: '© CARTO'
    })
});

// Hide Cesium credit banner to keep the UI completely clean
viewer.cesiumWidget.creditContainer.style.display = 'none';

// Enable depth testing against terrain
viewer.scene.globe.depthTestAgainstTerrain = true;
// Enhance lighting
viewer.scene.globe.enableLighting = true;
viewer.scene.highDynamicRange = true;

/* ---------------------------------------------------------------
   CAMERA / NAVIGATION
--------------------------------------------------------------- */
const INITIAL_CAMERA_POS = {
    destination: Cesium.Cartesian3.fromDegrees(121.5, 9.5, 2500000), // Philippines overview
    orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(-75.0),
        roll: 0.0
    },
    duration: 2.5
};

// Start at overview
viewer.camera.flyTo(INITIAL_CAMERA_POS);

/* ---------------------------------------------------------------
   DATA MAPPING: RENDER STORE PINS AS GLOWING CYLINDERS
--------------------------------------------------------------- */
const storeEntities = {};

function getStatusColor(status) {
    if (status === 'approved') return Cesium.Color.fromCssColorString('#4ade80');
    if (status === 'pending') return Cesium.Color.fromCssColorString('#fbbf24');
    if (status === 'issue') return Cesium.Color.fromCssColorString('#f87171');
    return Cesium.Color.WHITE;
}

function buildStorePins() {
    STORES.forEach(store => {
        const color = getStatusColor(store.status);
        const height = store.footTraffic / 2; // Scale height by traffic volume

        const entity = viewer.entities.add({
            id: store.id,
            name: store.name,
            position: Cesium.Cartesian3.fromDegrees(store.lon, store.lat, height / 2),
            cylinder: {
                length: height,
                topRadius: 3000.0,
                bottomRadius: 3000.0,
                material: new Cesium.ColorMaterialProperty(color.withAlpha(0.7)),
                outline: true,
                outlineColor: color,
                outlineWidth: 2.0
            },
            description: `
                <div style="font-family: monospace;">
                    <strong>Region:</strong> ${store.region.toUpperCase()}<br>
                    <strong>Status:</strong> ${store.status.toUpperCase()}<br>
                    <strong>Traffic:</strong> ${store.footTraffic} / day
                </div>
            `
        });

        // Add a floating point light at the top of the cylinder for a cool glow effect
        viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(store.lon, store.lat, height + 1000),
            point: {
                pixelSize: 8,
                color: color,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 1,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1000000)
            }
        });

        storeEntities[store.id] = entity;
    });
}

buildStorePins();

/* ---------------------------------------------------------------
   UI BINDINGS & LOGIC
--------------------------------------------------------------- */
// Boot Sequence
setTimeout(() => {
    document.getElementById('boot-overlay').classList.add('hidden');
}, 2000);

// Clock
setInterval(() => {
    document.getElementById('clock').innerText = new Date().toLocaleTimeString('en-US', { hour12: false });
}, 1000);

// Calculate Stats
function updateStats(regionFilter = null) {
    let list = STORES;
    if (regionFilter) {
        list = STORES.filter(s => s.region === regionFilter || (regionFilter === 'luzon' && s.region === 'ncr'));
    }
    
    document.getElementById('stat-total').innerText = list.length;
    document.getElementById('stat-approved').innerText = list.filter(s => s.status === 'approved').length;
    document.getElementById('stat-pending').innerText = list.filter(s => s.status === 'pending').length;
    document.getElementById('stat-issue').innerText = list.filter(s => s.status === 'issue').length;
}
updateStats();

// Render Region List
const regionListEl = document.getElementById('region-list');
Object.values(REGIONS).forEach(region => {
    const el = document.createElement('div');
    el.className = 'region-row';
    el.innerHTML = `
        <div class="region-row-left">
            <div class="region-swatch" style="background: #${region.color.toString(16)}"></div>
            <span class="region-name">${region.name}</span>
        </div>
    `;
    el.addEventListener('click', () => {
        document.getElementById('dash-title').innerText = region.name;
        document.getElementById('dash-tag').innerText = region.id.toUpperCase();
        updateStats(region.id);
        
        // Fly to region
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(region.center.lon, region.center.lat, 800000),
            orientation: { heading: 0.0, pitch: Cesium.Math.toRadians(-60.0), roll: 0.0 },
            duration: 1.5
        });
    });
    regionListEl.appendChild(el);
});

// Reset view on breadcrumb click
document.getElementById('btn-philippines').addEventListener('click', () => {
    document.getElementById('dash-title').innerText = 'Philippines Overview';
    document.getElementById('dash-tag').innerText = 'NETWORK';
    updateStats();
    viewer.camera.flyTo(INITIAL_CAMERA_POS);
});

/* ---------------------------------------------------------------
   RAYCASTING / CLICKING STORE PINS
--------------------------------------------------------------- */
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
handler.setInputAction(function (movement) {
    const pickedObject = viewer.scene.pick(movement.position);
    
    if (Cesium.defined(pickedObject) && pickedObject.id) {
        const entity = pickedObject.id;
        // Fly to the specific store
        const carto = Cesium.Cartographic.fromCartesian(entity.position.getValue(viewer.clock.currentTime));
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height + 8000),
            orientation: { heading: 0.0, pitch: Cesium.Math.toRadians(-45.0), roll: 0.0 },
            duration: 1.5
        });
        
        console.log("Clicked store:", entity.name);
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);