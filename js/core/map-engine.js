// ==========================================
// MESIN PEMETAAN GLOBAL (NAVIGASI KLIEN & RADAR MITRA)
// ARSITEKTUR: SINGLE ENGINE, PURE DOM CLONING, MEMORY SAFE
// ==========================================

window.MapEngine = {
    // State Instansi Memori
    mainMap: null,
    mitraMap: null,
    wizardLayer: null,
    mitraLayer: null,
    osrmAbortController: null,
    
    // State Navigasi
    activeMode: 'DROPOFF',
    pickupCoords: null,
    dropoffCoords: null,
    
    // State Mitra
    mitraConfigCache: null,
    
    // Node Elemen DOM Pin Statis
    pinElements: {
        container: document.createElement('div'),
        label: document.createElement('div'),
        marker: document.createElement('div'),
        shadow: document.createElement('div')
    },

    init: function() {
        this.setupEventListeners();
    },

    setupEventListeners: function() {
        window.addEventListener('wizardState', (e) => this.handleWizardState(e.detail));
        window.addEventListener('initMitraMapEvent', () => this.initMitraMap());
        
        const btnMyGPS = document.getElementById('btnMyGPS');
        if (btnMyGPS) {
            btnMyGPS.addEventListener('click', () => {
                if (navigator.geolocation && this.mainMap) {
                    navigator.geolocation.getCurrentPosition((pos) => {
                        this.mainMap.flyTo([pos.coords.latitude, pos.coords.longitude], 17, { duration: 1 });
                    });
                }
            });
        }

        const btnRefresh = document.getElementById('btnRefreshMitraMap');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => {
                const icon = btnRefresh.querySelector('i');
                if(icon) icon.classList.add('fa-spin');
                this.loadMitraData().finally(() => {
                    if(icon) icon.classList.remove('fa-spin');
                });
            });
        }
    },

    // ==========================================
    // 1. MESIN NAVIGASI UTAMA (KLIEN)
    // ==========================================
    initMainMap: function() {
        if (this.mainMap) {
            const center = this.mainMap.getCenter();
            window.BAGANTARA_ACTIVE_COORD = { lat: center.lat, lng: center.lng };
            setTimeout(() => { this.mainMap.invalidateSize(); }, 100);
            return; 
        }

        const mapContainer = document.getElementById('map-container');
        if (!mapContainer) return;

        this.mainMap = L.map('map-container', { zoomControl: false, attributionControl: false }).setView([-7.768851, 112.196443], 15);
        window.BAGANTARA_ACTIVE_COORD = { lat: -7.768851, lng: 112.196443 };

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this.mainMap);
        this.wizardLayer = L.featureGroup().addTo(this.mainMap);

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                this.mainMap.flyTo([pos.coords.latitude, pos.coords.longitude], 16);
                window.BAGANTARA_ACTIVE_COORD = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            }, () => {});
        }

        this.setupCenterPin(mapContainer);
    },

    setupCenterPin: function(mapContainer) {
        this.pinElements.container.className = 'center-pin-container';
        this.pinElements.label.className = 'pin-label';
        this.pinElements.marker.className = 'css-pin-marker';
        this.pinElements.shadow.className = 'pin-shadow-base';
        
        this.pinElements.container.appendChild(this.pinElements.label);
        this.pinElements.container.appendChild(this.pinElements.shadow);
        this.pinElements.container.appendChild(this.pinElements.marker);
        mapContainer.appendChild(this.pinElements.container);

        this.updatePinVisual(this.activeMode);

        let mapMoveTimeout = null;

        this.mainMap.on('movestart', () => {
            mapContainer.classList.add('map-is-moving');
            this.pinElements.label.innerText = "MEMINDAI KOORDINAT...";
            window.dispatchEvent(new Event('mapIsMoving')); 
        });

        this.mainMap.on('moveend', () => {
            mapContainer.classList.remove('map-is-moving');
            window.dispatchEvent(new Event('mapStopped')); 
            if (navigator.vibrate) navigator.vibrate(40); 

            const center = this.mainMap.getCenter();
            window.BAGANTARA_ACTIVE_COORD = { lat: center.lat, lng: center.lng };
            this.updatePinVisual(this.activeMode); 
            
            let isLockedBySearch = false;
            if (window.LOCKED_SEARCH_COORD && window.LOCKED_SEARCH_TEXT) {
                const distanceShifted = this.getHaversineDistance(center.lat, center.lng, window.LOCKED_SEARCH_COORD.lat, window.LOCKED_SEARCH_COORD.lng);
                if (distanceShifted <= 0.05) isLockedBySearch = true;
            }
            
            clearTimeout(mapMoveTimeout);
            mapMoveTimeout = setTimeout(() => {
                if (isLockedBySearch) {
                    window.TEMPORARY_GEOCODE = window.LOCKED_SEARCH_TEXT;
                    const liveAddress = document.getElementById('liveAddressTitle');
                    if (liveAddress) liveAddress.innerText = window.TEMPORARY_GEOCODE;
                } else {
                    window.LOCKED_SEARCH_TEXT = null;
                    window.LOCKED_SEARCH_COORD = null;
                    this.fetchAddressForForm(center.lat, center.lng);
                }
            }, 800);
            
            if (this.activeMode === 'DROPOFF') this.dropoffCoords = center;
            else if (this.activeMode === 'PICKUP' || this.activeMode === 'JASTIP_STORE') this.pickupCoords = center;
        });
    },

    updatePinVisual: function(mode) {
        const mapContainer = document.getElementById('map-container');
        const pinTypeIcon = document.getElementById('pinTypeIcon');
        const inputInlineNotes = document.getElementById('inputInlineNotes');
        const service = window.BAGANTARA_SERVICE || 'RIDE';
        
        let labelDropoff = 'TUJUAN (GESER)';
        let labelPickup = 'JEMPUT (GESER)';
        let placeholderNotes = 'Ketik patokan akurat...';

        if (service === 'JASTIP') {
            if (mode === 'JASTIP_STORE') {
                labelPickup = 'LOKASI TOKO (GESER)';
                placeholderNotes = 'Detail alamat toko / patokan...';
            } else {
                labelDropoff = 'LOKASI PENGANTARAN (GESER)';
                placeholderNotes = 'Detail patokan pengantaran...';
            }
        } else if (service === 'EXPRESS') {
            labelPickup = 'AMBIL BARANG (GESER)';
            labelDropoff = 'TUJUAN PENGIRIMAN';
            placeholderNotes = 'Detail barang & kontak penerima...';
        } else if (service === 'CAR') {
            placeholderNotes = 'Patokan, jumlah org, & brg bawaan...';
        }

        if (mode === 'DROPOFF') {
            this.pinElements.label.innerText = labelDropoff;
            this.pinElements.label.style.borderColor = '#ef4444'; 
            this.pinElements.label.style.color = '#ef4444';
            mapContainer.classList.remove('pickup-mode', 'jastip-store-mode'); 
            if(pinTypeIcon) { pinTypeIcon.className = 'fa-solid fa-location-dot'; pinTypeIcon.style.color = '#ef4444'; }
            this.pinElements.marker.style.background = '#ef4444';
            this.pinElements.marker.style.boxShadow = '0 0 10px #ef4444';
        } else if (mode === 'JASTIP_STORE') {
            this.pinElements.label.innerText = labelPickup; 
            this.pinElements.label.style.borderColor = '#3b82f6'; 
            this.pinElements.label.style.color = '#3b82f6';
            mapContainer.classList.remove('pickup-mode');
            mapContainer.classList.add('jastip-store-mode'); 
            if(pinTypeIcon) { pinTypeIcon.className = 'fa-solid fa-store'; pinTypeIcon.style.color = '#3b82f6'; }
            this.pinElements.marker.style.background = '#3b82f6';
            this.pinElements.marker.style.boxShadow = '0 0 10px #3b82f6';
        } else {
            this.pinElements.label.innerText = labelPickup;
            this.pinElements.label.style.borderColor = '#bd8c11'; 
            this.pinElements.label.style.color = '#bd8c11';
            mapContainer.classList.remove('jastip-store-mode');
            mapContainer.classList.add('pickup-mode'); 
            if(pinTypeIcon) { pinTypeIcon.className = 'fa-solid fa-location-crosshairs'; pinTypeIcon.style.color = '#bd8c11'; }
            this.pinElements.marker.style.background = '#bd8c11';
            this.pinElements.marker.style.boxShadow = '0 0 10px #bd8c11';
        }
        
        if (inputInlineNotes) inputInlineNotes.placeholder = placeholderNotes;
    },

    dropStaticMarker: function(mode, coords, indexLabel = '') {
        const pinColor = mode === 'PICKUP' ? '#bd8c11' : '#ef4444'; 
        const labelHtml = indexLabel ? `<div style="position: absolute; top: -20px; left: 16px; transform: translateX(-50%); background: rgba(0,0,0,0.85); border: 1px solid #bd8c11; border-radius: 12px; padding: 2px 8px; color: #bd8c11; font-weight: 900; font-size: 12px; font-family: 'Space Grotesk', sans-serif; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.8); pointer-events: none; white-space: nowrap;">${indexLabel}</div>` : '';
        
        // Pengecualian API Leaflet yang menuntut HTML string pada L.divIcon
        const customIcon = L.divIcon({
            className: 'static-css-icon',
            html: `
                <div style="position:relative; width: 32px; height: 40px;">
                    <div class="pin-shadow-base"></div>
                    <div class="css-pin-marker" style="background: ${pinColor}; border-color: #fff; animation: none; box-shadow: 0 0 8px ${pinColor};"></div>
                    ${labelHtml}
                </div>
            `,
            iconSize: [32, 40], iconAnchor: [16, 38] 
        });

        L.marker([coords.lat, coords.lng], { icon: customIcon }).addTo(this.wizardLayer);
    },

    handleWizardState: function(state) {
        this.initMainMap();

        if (this.wizardLayer) this.wizardLayer.clearLayers();
        if (this.osrmAbortController) { this.osrmAbortController.abort(); this.osrmAbortController = null; }

        if (state === 'DROPOFF_PIN') {
            this.activeMode = 'DROPOFF';
            this.pinElements.container.style.display = 'flex';
            this.updatePinVisual('DROPOFF');
            
            const targetIdx = window.BAGANTARA_MAP_TARGET_INDEX || 1;
            let existingCoord = null;
            
            const multi = window.BAGANTARA_MULTI_DROPOFFS || [];
            multi.forEach((m, idx) => {
                if (m && (idx + 1) !== targetIdx && !isNaN(parseFloat(m.lat)) && !isNaN(parseFloat(m.lng))) {
                    this.dropStaticMarker('DROPOFF', { lat: parseFloat(m.lat), lng: parseFloat(m.lng) }, (idx + 1).toString());
                }
            });
            
            if (targetIdx === 1 && window.BAGANTARA_DROPOFF_COORD) existingCoord = window.BAGANTARA_DROPOFF_COORD;
            else if (multi && multi[targetIdx - 1]) existingCoord = `${multi[targetIdx - 1].lat},${multi[targetIdx - 1].lng}`;
            
            this.flyToCoordinate(existingCoord);
        } 
        else if (state === 'PICKUP' || state === 'JASTIP_STORE') {
            this.activeMode = state;
            this.pinElements.container.style.display = 'flex';
            this.updatePinVisual(state); 
            
            const multi = window.BAGANTARA_MULTI_DROPOFFS || [];
            if (multi.length > 0) {
                multi.forEach((m, idx) => {
                    if (m && !isNaN(parseFloat(m.lat)) && !isNaN(parseFloat(m.lng))) {
                        this.dropStaticMarker('DROPOFF', { lat: parseFloat(m.lat), lng: parseFloat(m.lng) }, (idx + 1).toString());
                    }
                });
            } else if (window.BAGANTARA_DROPOFF_COORD) {
                const [lat, lng] = window.BAGANTARA_DROPOFF_COORD.split(',');
                if (!isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
                    this.dropStaticMarker('DROPOFF', { lat: parseFloat(lat), lng: parseFloat(lng) }, "1");
                }
            }
            
            setTimeout(() => { this.mainMap.invalidateSize(); }, 100);
            this.flyToCoordinate(window.BAGANTARA_PICKUP_COORD);
        }
        else if (state === 'CALCULATE') {
            this.pinElements.container.style.display = 'none';
            
            let finalPickup = null;
            if (window.BAGANTARA_PICKUP_COORD) {
                const [lat, lng] = window.BAGANTARA_PICKUP_COORD.split(',');
                if (!isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
                    finalPickup = { lat: parseFloat(lat), lng: parseFloat(lng) };
                    this.dropStaticMarker('PICKUP', finalPickup);
                }
            }

            const multi = window.BAGANTARA_MULTI_DROPOFFS || [];
            if (multi.length > 0) {
                multi.forEach((m, idx) => {
                    if (m && !isNaN(parseFloat(m.lat)) && !isNaN(parseFloat(m.lng))) {
                        this.dropStaticMarker('DROPOFF', { lat: parseFloat(m.lat), lng: parseFloat(m.lng) }, (idx + 1).toString());
                    }
                });
            } else if (window.BAGANTARA_DROPOFF_COORD) {
                const [lat, lng] = window.BAGANTARA_DROPOFF_COORD.split(',');
                if (!isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
                    this.dropStaticMarker('DROPOFF', { lat: parseFloat(lat), lng: parseFloat(lng) }, "1");
                }
            }
            
            if (finalPickup) this.calculatePrecisionRouteMulti(finalPickup);
        }
    },

    flyToCoordinate: function(coordStr) {
        if (coordStr) {
            const [lat, lng] = coordStr.split(',');
            if (!isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
                this.mainMap.flyTo([parseFloat(lat), parseFloat(lng)], 16, { duration: 0.5 });
            }
        } else if (navigator.geolocation && !this.dropoffCoords) {
            navigator.geolocation.getCurrentPosition((pos) => { 
                this.mainMap.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { duration: 0.5 }); 
            });
        }
    },

    fetchAddressForForm: async function(lat, lng) {
        window.TEMPORARY_GEOCODE = "Menyinkronkan data...";
        try {
            // PERBAIKAN MUTLAK: Menggunakan GeocoderAPI terpusat (Photon) agar terhindar dari Banned IP Nominatim
            if (window.GeocoderAPI) {
                const address = await window.GeocoderAPI.reverseGeocode(lat, lng);
                window.TEMPORARY_GEOCODE = address;
            } else {
                window.TEMPORARY_GEOCODE = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            }
        } catch (error) {
            window.TEMPORARY_GEOCODE = "Gagal memuat detail wilayah.";
        }
        
        const liveAddress = document.getElementById('liveAddressTitle');
        if (liveAddress) liveAddress.innerText = window.TEMPORARY_GEOCODE;
    },

    getHaversineDistance: function(lat1, lon1, lat2, lon2) {
        const R = 6371; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    },

    calculatePrecisionRouteMulti: function(startPoint) {
        if (this._routeTimeout) clearTimeout(this._routeTimeout);
        
        // DEBOUNCE ANTI-BLOKIR (800ms)
        this._routeTimeout = setTimeout(async () => {
            const multi = window.BAGANTARA_MULTI_DROPOFFS || [];
            let segments = [startPoint];
            
            if (multi.length > 0) {
                multi.forEach(m => { 
                    if(m && !isNaN(parseFloat(m.lat)) && !isNaN(parseFloat(m.lng))) segments.push({ lat: parseFloat(m.lat), lng: parseFloat(m.lng) }); 
                });
            } else if (window.BAGANTARA_DROPOFF_COORD) {
                const [lat, lng] = window.BAGANTARA_DROPOFF_COORD.split(',');
                if (!isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) segments.push({ lat: parseFloat(lat), lng: parseFloat(lng) });
            }
            
            if (segments.length < 2) return;

            let coordStrs = segments.map(s => `${s.lng},${s.lat}`);
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordStrs.join(';')}?overview=full&geometries=geojson`;
            
            let fallbackDistance = 0;
            for (let i = 0; i < segments.length - 1; i++) {
                fallbackDistance += this.getHaversineDistance(segments[i].lat, segments[i].lng, segments[i+1].lat, segments[i+1].lng);
            }
            fallbackDistance = fallbackDistance * 1.30; 

            let finalDistanceKm = 0;
            if (this.osrmAbortController) { this.osrmAbortController.abort(); }
            this.osrmAbortController = new AbortController();

            try {
                const response = await fetch(osrmUrl, { signal: this.osrmAbortController.signal });
                const data = await response.json();

                if (data.code === 'Ok') {
                    const route = data.routes[0];
                    const compensatedOsrm = (route.distance / 1000) * 1.15;
                    finalDistanceKm = (compensatedOsrm > fallbackDistance * 2) ? fallbackDistance : compensatedOsrm;

                    L.geoJSON(route.geometry, { style: { color: 'var(--route-line, #3b82f6)', weight: 6, opacity: 0.9 } }).addTo(this.wizardLayer);
                    setTimeout(() => { if (this.wizardLayer) this.mainMap.fitBounds(this.wizardLayer.getBounds(), { padding: [40, 40] }); }, 500);
                }
            } catch (error) {
                if (error.name === 'AbortError') return; 
                finalDistanceKm = fallbackDistance;
            }

            finalDistanceKm = parseFloat(finalDistanceKm.toFixed(2));
            window.dispatchEvent(new CustomEvent('priceCalculated', { detail: { distance: finalDistanceKm } }));
        }, 800); 
    },

    // ==========================================
    // 2. MESIN RADAR MITRA (BGN-RD)
    // ==========================================
    fetchMitraConfig: async function() {
        if (this.mitraConfigCache) return this.mitraConfigCache;
        try {
            const res = await fetch(`./data/bgn-rd.json?v=${new Date().getTime()}`);
            this.mitraConfigCache = await res.json();
            return this.mitraConfigCache;
        } catch (e) {
            return { radar_aktif: true, radius_km: 10 }; 
        }
    },

    initMitraMap: function() {
        if (this.mitraMap) {
            setTimeout(() => { this.mitraMap.invalidateSize(); }, 200);
            return;
        }

        const container = document.getElementById('mitra-map-container');
        if (!container) return;

        this.mitraMap = L.map('mitra-map-container', { zoomControl: false, attributionControl: false }).setView([-7.768851, 112.196443], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this.mitraMap);
        this.mitraLayer = L.featureGroup().addTo(this.mitraMap);

        const updateMapFilter = () => {
            const pane = document.querySelector('#mitra-map-container .leaflet-tile-pane');
            if (pane) pane.style.filter = !document.body.classList.contains('light-mode') ? 'invert(90%) grayscale(20%) sepia(20%) hue-rotate(195deg) saturate(350%) brightness(85%) contrast(110%)' : 'none';
        };
        
        this.mitraMap.on('load', updateMapFilter);
        setTimeout(updateMapFilter, 300);

        this.loadMitraData();
    },

    loadMitraData: async function() {
        const statusText = document.getElementById('mitraMapStatusText');
        if (statusText) statusText.innerText = "MEMUAT DATA...";

        const config = await this.fetchMitraConfig();
        if (!config.radar_aktif) {
            if (statusText) statusText.innerText = "FITUR NONAKTIF";
            return;
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                
                this.mitraMap.flyTo([lat, lng], 14, { duration: 1 });
                this.mitraLayer.clearLayers();

                const userIcon = L.divIcon({
                    className: 'custom-user-pin',
                    html: `<div style="width:14px; height:14px; background:#ef4444; border-radius:50%; border:2px solid #fff; box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`,
                    iconSize: [14, 14], iconAnchor: [7, 7]
                });
                // PERBAIKAN PERFORMA: Hilangkan bindPopup "Lokasi Anda" yang berat & buat titik user non-interaktif
                L.marker([lat, lng], { icon: userIcon, interactive: false }).addTo(this.mitraLayer);

                // Integrasi dengan Engine RTDB Caching
                if (window.AegisEngine && window.AegisEngine.getFirebaseDriversByGeohash) {
                    const rtdbDrivers = await window.AegisEngine.getFirebaseDriversByGeohash(lat, lng);
                    
                    Object.keys(rtdbDrivers).forEach(uid => {
                        const data = rtdbDrivers[uid];
                        const status = data.status || {};
                        const waktuSekarang = Date.now();
                        const isWaktuValid = !status.expiresAt || status.expiresAt > waktuSekarang;

                        if (status.isOnline && status.lat && status.lng && isWaktuValid) {
                            const dLat = parseFloat(status.lat);
                            const dLng = parseFloat(status.lng);
                            const radiusBatas = parseFloat(config.radius_km || 10);
                            const jarak = this.getHaversineDistance(lat, lng, dLat, dLng);
                            
                            if (jarak <= radiusBatas) this.plotMitraPin(uid, dLat, dLng);
                        }
                    });
                }
                if (statusText) statusText.innerText = "bgn-rd";
            }, () => {
                if (statusText) statusText.innerText = "GPS DITOLAK";
            });
        }
    },

    // PURE DOM CLONING: Meniadakan Injeksi HTML String di Popup Mitra
    plotMitraPin: function(uid, lat, lng) {
        const driverIcon = L.divIcon({
            className: 'driver-pin',
            html: `
                <div style="position:relative; width: 36px; height: 36px;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--void-black); border: 2px solid var(--neon-gold); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                        <i class="fa-solid fa-motorcycle text-gold" style="font-size: 14px;"></i>
                    </div>
                </div>
            `,
            iconSize: [36, 36], iconAnchor: [18, 18]
        });

        // Injeksi TAHAP 2: Menyimpan UID agar marker bisa dikendalikan oleh filter Hibrida
        const marker = L.marker([lat, lng], { icon: driverIcon, driverUid: uid }).addTo(this.mitraLayer);
        const popupContentNode = document.createElement('div');
        
        const tplLoading = document.getElementById('tpl-mitra-popup-loading');
        if (tplLoading) popupContentNode.appendChild(tplLoading.content.cloneNode(true));
        
        // Penambahan minWidth sejak awal agar Leaflet tidak kaget saat data masuk (Dipersempit untuk Micro-Card)
        marker.bindPopup(popupContentNode, { closeButton: false, offset: [0, -10], minWidth: 160 });

        marker.on('popupopen', async () => {
            // Reset ke status loading murni secara DOM
            popupContentNode.innerHTML = ''; 
            if (tplLoading) popupContentNode.appendChild(tplLoading.content.cloneNode(true));

            // Penarikan data dari Firestore yang sudah dilindungi oleh Hybrid Cache Sesi 2.3
            if (window.AegisEngine && window.AegisEngine.fetchFirestoreDriver) {
                const fsData = await window.AegisEngine.fetchFirestoreDriver(uid);
                popupContentNode.innerHTML = ''; // Bersihkan node aman
                
                if (fsData && fsData.settings) {
                    const tplPopup = document.getElementById('tpl-mitra-popup');
                    if (tplPopup) {
                        const clone = tplPopup.content.cloneNode(true);
                        
                        const tarif = fsData.settings.tarif || 0;
                        const arrayLayanan = fsData.settings.layanan || [];
                        const batasJarak = fsData.settings.radius || 3.0;
                        const infoAgenda = fsData.settings.info && fsData.settings.info.trim() !== "" ? fsData.settings.info : "Tidak ada catatan khusus.";
                        
                        const strLayanan = arrayLayanan.join(" ").toUpperCase();
                        let spesifikasiDriver = "DRIVER";
                        if (strLayanan.includes("CAR")) spesifikasiDriver = "DRIVER MOBIL";
                        else if (strLayanan.includes("RIDE") || strLayanan.includes("EXPRESS") || strLayanan.includes("JASTIP")) spesifikasiDriver = "DRIVER MOTOR";
                        
                        clone.querySelector('.tpl-driver-type').textContent = spesifikasiDriver;
                        
                        // Menampilkan Merk Kendaraan (Tanpa Plat Nomor)
                        const elKendaraan = clone.querySelector('.tpl-kendaraan');
                        if (elKendaraan) elKendaraan.textContent = fsData.profile.kendaraan || 'Kendaraan Standar';
                        
                        clone.querySelector('.tpl-layanan').textContent = arrayLayanan.join(", ") || "Tidak ditentukan";
                        clone.querySelector('.tpl-radius').textContent = `Radius ${batasJarak} KM`;
                        clone.querySelector('.tpl-info-agenda').textContent = `"${infoAgenda}"`;
                        clone.querySelector('.tpl-tarif').textContent = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(tarif);
                        
                        // --- INJEKSI FASE 3: SMART MATCHMAKING ENGINE ---
                        const statusEl = clone.querySelector('.tpl-feasibility-status');
                        const btnPrelock = clone.querySelector('.tpl-btn-prelock');
                        
                        // Ekstraksi Lokasi GPS User (Fallback ke titik tengah peta jika lambat)
                        let userLat = 0, userLng = 0;
                        if (navigator.geolocation) {
                            try {
                                const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {timeout: 3000}));
                                userLat = pos.coords.latitude; 
                                userLng = pos.coords.longitude;
                            } catch(e) {
                                const center = this.mitraMap.getCenter();
                                userLat = center.lat; 
                                userLng = center.lng;
                            }
                        } else {
                            const center = this.mitraMap.getCenter();
                            userLat = center.lat; 
                            userLng = center.lng;
                        }

                        // Kalkulasi Jarak Tarik Lurus (Haversine)
                        const jarakAktual = this.getHaversineDistance(userLat, userLng, lat, lng);
                        
                        if (jarakAktual <= batasJarak) {
                            // 🟢 JANGKAUAN AMAN
                            statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
                            statusEl.style.color = '#059669';
                            statusEl.style.border = '1px solid rgba(16, 185, 129, 0.3)';
                            statusEl.innerHTML = `🟢 Jangkauan Aman (${jarakAktual.toFixed(1)} KM)`;
                            
                            btnPrelock.style.display = 'block';
                            btnPrelock.addEventListener('click', () => {
                                // Simpan Kunci Pre-Lock di Memori Global
                                window.BAGANTARA_PRELOCKED_DRIVER = {
                                    uid: uid,
                                    nama: fsData.profile.nama || 'Driver',
                                    wa: fsData.profile.wa || '',
                                    fotoProfile: fsData.profile.fotoUrl || './assets/icon-192.png',
                                    tarifMin: tarif,
                                    info: infoAgenda,
                                    kendaraan: fsData.profile.kendaraan || 'Kendaraan Standar' // TAHAP 2: Merk Motor
                                };
                                
                                // --- KOREKSI LOGIKA: AUTO-ROUTING LAYANAN ---
                                if (window.SystemReset) window.SystemReset(); 
                                
                                const layananDriver = fsData.settings.layanan || [];
                                if (layananDriver.length === 1) {
                                    // Jika layanan cuma 1, LANGSUNG tembak ke setting alamat melalui Router Resmi
                                    const srv = layananDriver[0].toUpperCase();
                                    
                                    if (window.ServiceRouter) {
                                        window.ServiceRouter.route(srv); // Ini akan menghidupkan label "LAYANAN: RIDE"
                                    } else {
                                        window.spaNavigateTo('view-dashboard'); // Fallback aman
                                    }
                                    
                                    if (window.UIManager) window.UIManager.alert(`Driver <b>${window.BAGANTARA_PRELOCKED_DRIVER.nama}</b> dikunci untuk layanan <b>${srv}</b>.<br><br>Silakan tentukan titik jemput dan tujuan Anda.`);
                                } else {
                                    // Jika punya >1 layanan, kembalikan ke dashboard untuk milih layanan
                                    window.spaNavigateTo('view-dashboard');
                                    if (window.UIManager) window.UIManager.alert(`Driver <b>${window.BAGANTARA_PRELOCKED_DRIVER.nama}</b> dikunci.<br><br>Driver ini melayani beberapa jenis pesanan. Silakan pilih layanan di bawah ini.`);
                                }
                            });
                        } else {
                            // 🔴 DI LUAR RADIUS
                            statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
                            statusEl.style.color = '#ef4444';
                            statusEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                            statusEl.innerHTML = `🔴 Di Luar Radius (${jarakAktual.toFixed(1)} KM)`;
                            btnPrelock.style.display = 'none';
                        }

                        // --- INJEKSI TAHAP 2: LOGIKA 30 MENIT (STALE DRIVER) ---
                        try {
                            // Tarik Timestamp presisi dari RTDB menggunakan REST API
                            const rtdbRes = await fetch(`https://bagantara-core-default-rtdb.asia-southeast1.firebasedatabase.app/drivers/${uid}/status/timestamp.json`);
                            const rtdbTimestamp = await rtdbRes.json();
                            
                            if (rtdbTimestamp) {
                                const selisihWaktu = Date.now() - rtdbTimestamp; // Kalkulasi usia koordinat
                                const staleEl = clone.querySelector('.tpl-stale-warning');
                                const btnManualWa = clone.querySelector('.tpl-btn-manual-wa');
                                
                                // Jika selisih waktu > 30 Menit (1.800.000 milidetik)
                                if (selisihWaktu > 1800000) {
                                    if (staleEl) staleEl.style.display = 'block';
                                    if (btnPrelock) btnPrelock.style.display = 'none'; // Matikan tombol order sistem
                                    statusEl.style.display = 'none'; // Sembunyikan indikator jarak
                                    
                                    if (btnManualWa && fsData.profile.wa) {
                                        btnManualWa.style.display = 'block';
                                        btnManualWa.addEventListener('click', () => {
                                            window.open(`https://wa.me/${fsData.profile.wa}?text=Halo,%20apakah%20Anda%20masih%20aktif%20menerima%20pesanan%20Bagantara?`, '_blank');
                                        });
                                    }
                                }
                            }
                        } catch(e) {
                            console.warn("Gagal mengecek timestamp:", e);
                        }
                        // ------------------------------------------------

                        popupContentNode.appendChild(clone);
                        
                        // PAKSA LEAFLET KALKULASI ULANG DIMENSI SETELAH DOM BERUBAH
                        setTimeout(() => {
                            if (marker.getPopup()) marker.getPopup().update();
                        }, 50);
                    }
                } else {
                    const errorDiv = document.createElement('div');
                    errorDiv.style.cssText = "font-family:Outfit; font-size: 12px; text-align:center;";
                    errorDiv.textContent = "Info tidak tersedia.";
                    popupContentNode.appendChild(errorDiv);
                }
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.MapEngine.init();
});

/* ==========================================
   SMART RADAR 2.0 - HYBRID ENGINE FILTER
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
    window.BAGANTARA_RADAR_FILTER = 'ALL';
    window.BAGANTARA_DRIVER_CACHE = window.BAGANTARA_DRIVER_CACHE || {};

    const filterChips = document.querySelectorAll('.radar-chip');
    filterChips.forEach(chip => {
        chip.addEventListener('click', async (e) => {
            // Ubah UI Aktif
            filterChips.forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            window.BAGANTARA_RADAR_FILTER = e.target.getAttribute('data-filter');
            
            // Eksekusi filter pada setiap marker di peta
            if(window.MapEngine && window.MapEngine.mitraLayer) {
                window.MapEngine.mitraLayer.eachLayer(async (marker) => {
                    const uid = marker.options.driverUid;
                    if(!uid) return;
                    
                    let layananList = [];
                    // Hibrida: Tarik layanan dari memori cache atau Firestore
                    if(window.BAGANTARA_DRIVER_CACHE[uid]) {
                        layananList = window.BAGANTARA_DRIVER_CACHE[uid].layanan || [];
                    } else if(window.AegisEngine) {
                        try {
                            const fsData = await window.AegisEngine.fetchFirestoreDriver(uid);
                            if(fsData && fsData.settings) {
                                layananList = fsData.settings.layanan || [];
                                window.BAGANTARA_DRIVER_CACHE[uid] = { layanan: layananList };
                            }
                        } catch(err) { console.warn(err); }
                    }
                    
                    // Logika Pencocokan
                    const targetFilter = window.BAGANTARA_RADAR_FILTER;
                    const isMatch = targetFilter === 'ALL' || layananList.map(l => l.toUpperCase()).includes(targetFilter);
                    
                    // Mengontrol Visibilitas Marker (Opacity)
                    if(isMatch) {
                        marker.setOpacity(1); 
                        marker.options.interactive = true; // Bisa diklik
                    } else {
                        marker.setOpacity(0);
                        marker.options.interactive = false; // Tembus klik
                    }
                });
            }
        });
    });
    
    // Mesin Pencari Alamat Pelanggan (One-Time Execution Anti-Spam API)
    if(navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const el = document.getElementById('radarUserAddress');
            
            // PERBAIKAN MUTLAK: Geocoder terpusat anti-spam
            if(el && window.GeocoderAPI) {
                const address = await window.GeocoderAPI.reverseGeocode(lat, lng);
                el.textContent = address;
            } else if(el) {
                el.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            }
        }, null, {enableHighAccuracy: true, timeout: 5000, maximumAge: 60000});
    }
});
