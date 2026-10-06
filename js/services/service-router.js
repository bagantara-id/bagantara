// ==========================================
// PENGATUR LALU LINTAS & SARAF INTI GLOBAL (SERVICE ROUTER V7.2)
// ARSITEKTUR: MODULAR ROUTING & REAL-TIME JSON FETCH (ZERO CACHE)
// ==========================================

window.ServiceRouter = {
    route: function(service) {
        console.log("[ServiceRouter] Menerima instruksi layanan:", service);
        window.BAGANTARA_SERVICE = service;
        
        // MANIPULASI VISUAL DASAR
        const mainHeader = document.getElementById('mainHeader');
        if (mainHeader) mainHeader.classList.add('hidden');

        const labelLayanan = document.getElementById('labelLayananPeta');
        if (labelLayanan) labelLayanan.innerText = service;

        const jastipFormGroup = document.getElementById('jastip-form-group');
        const inputJastipValue = document.getElementById('inputJastipValue');
        if (jastipFormGroup) jastipFormGroup.classList.add('hidden');
        if (inputJastipValue) inputJastipValue.value = '';

        // DISTRIBUSI JALUR MODULAR
        switch(service) {
            case 'RIDE': 
                if (window.FlowRide) window.FlowRide.init(); 
                break;
            case 'CAR': 
                if (window.FlowCar) window.FlowCar.init(); 
                break;
            case 'EXPRESS': 
                if (window.FlowExpress) window.FlowExpress.init(); 
                break;
            case 'JASTIP': 
                if (window.FlowJastip) window.FlowJastip.init(); 
                break;
            default: window.alert("Layanan belum tersedia.");
        }
    }
};

// ==========================================
// UTILITAS MURNI SPA & MANAJEMEN STATE
// ==========================================

// Pengikat Tombol Aman (Mencegah Memory Leak)
window.bindSafeButton = function(btnId, callback) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', callback);
};

window.SystemReset = function() {
    // PERISAI GLOBAL: Cegah reset state jika pengguna masih memiliki sesi chat aktif
    if (localStorage.getItem('bgt_active_chat')) return;

    console.log("[System] Mereset SPA ke state awal...");
    
    const mainHeader = document.getElementById('mainHeader');
    const bottomNav = document.getElementById('mainBottomNav');
    
    if (mainHeader) mainHeader.classList.remove('hidden');
    if (bottomNav) bottomNav.classList.remove('hidden');

    if (window.spaNavigateTo) window.spaNavigateTo('view-dashboard');

    // PROTEKSI DATA: Lewati pembersihan memori jika ada sesi chat aktif
    if (localStorage.getItem('bgt_active_chat')) return;

    // Bersihkan Memori
    window.BAGANTARA_SERVICE = null;
    window.BAGANTARA_ACTIVE_COORD = null;
    window.BAGANTARA_PICKUP_COORD = null;
    window.BAGANTARA_DROPOFF_COORD = null;
    window.BAGANTARA_MULTI_DROPOFFS = [];
    window.BAGANTARA_PICKUP_DETAIL = null;
    window.BAGANTARA_JASTIP_ITEMS = [];
    window.BAGANTARA_JASTIP_VALUE = 0;
    window.TEMPORARY_GEOCODE = null;

    // Bersihkan DOM UI
    const container = document.getElementById('jastipItemsContainer');
    if(container) container.innerHTML = '';
    
    document.querySelectorAll('input:not(.chat-input)').forEach(input => {
        if(input.type === 'text' || input.type === 'number' || input.type === 'tel') input.value = '';
        input.removeAttribute('readonly');
    });

    const sv = document.getElementById('view-search-route');
    if (sv) { sv.classList.remove('expanded-mode'); sv.classList.add('compact-mode'); }
    
    const stickyContinue = document.getElementById('stickyContinueArea');
    if (stickyContinue) stickyContinue.classList.add('hidden');
};

// ==========================================
// SARAF GLOBAL LISTENER
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const serviceCards = document.querySelectorAll('.service-card');
    serviceCards.forEach(card => {
        card.addEventListener('click', (e) => {
            const service = e.currentTarget.getAttribute('data-service');
            window.ServiceRouter.route(service);
        });
    });

    window.addEventListener('mapStopped', () => {
        const liveAddressTitle = document.getElementById('liveAddressTitle');
        if (liveAddressTitle) liveAddressTitle.innerText = window.TEMPORARY_GEOCODE || "Memindai Sinyal GPS...";
    });

    const btnBackMap = document.getElementById('btnBackMap');
    if (btnBackMap) {
        btnBackMap.addEventListener('click', () => {
            const service = window.BAGANTARA_SERVICE;
            if (['RIDE', 'CAR', 'EXPRESS'].includes(service) && window.FlowEngine) {
                window.FlowEngine.showSearchRoute();
            } else if (service === 'JASTIP' && window.FlowJastip) {
                window.spaNavigateTo('view-jastip-items');
            }
        });
    }

    const btnToggleNotes = document.getElementById('btnToggleNotes');
    if (btnToggleNotes) {
        btnToggleNotes.addEventListener('click', () => {
            const nc = document.getElementById('notesContainer');
            if(nc) {
                nc.classList.toggle('hidden');
                if (!nc.classList.contains('hidden')) {
                    const inputNotes = document.getElementById('inputInlineNotes');
                    if(inputNotes) inputNotes.focus();
                }
            }
        });
    }

    // Mengamankan State Paksaan ke Layanan Spesifik
    window.addEventListener('forceWizardState', (e) => {
        const state = e.detail;
        const srv = window.BAGANTARA_SERVICE;
        if(['RIDE', 'CAR', 'EXPRESS'].includes(srv) && window.FlowEngine) {
            window.FlowEngine.setManualState(state);
        }
    });

    // ==========================================
    // KALKULATOR TARIF DINAMIS (ZERO CACHE - MURNI DARI GITHUB FILES)
    // ==========================================
    window.addEventListener('priceCalculated', async (e) => {
        const distance = parseFloat(e.detail.distance) || 0;
        if (distance <= 0) {
            if (window.SystemReset) window.SystemReset();
            alert("Gagal menghitung rute. Titik tidak valid.");
            return;
        }
        
        window.BAGANTARA_DISTANCE_KM = distance; 
        const service = window.BAGANTARA_SERVICE || 'RIDE';
        
        try {
            // FUNGSI FETCH RELATIF AMAN (PERBAIKAN BUG SUBFOLDER & RP 0)
            const fetchJsonFresh = async (relativePath) => {
                try {
                    // Menambahkan parameter nocache langsung ke string (Aman untuk Subfolder)
                    const separator = relativePath.includes('?') ? '&' : '?';
                    const freshUrl = `${relativePath}${separator}nocache=${new Date().getTime()}`;
                    
                    const res = await fetch(freshUrl);
                    if (!res.ok) throw new Error(`HTTP_ERROR_${res.status}`);
                    return await res.json();
                } catch (error) {
                    throw new Error(`GAGAL_BACA_FILE: ${relativePath} | Detail: ${error.message}`);
                }
            };

            // Menarik Data Segar Secara Real-Time (Tanpa Memori Cache)
            const [resTariff, resPeak, resZones] = await Promise.allSettled([
                fetchJsonFresh('./data/tariffs.json'),
                fetchJsonFresh('./data/peak-hours.json'),
                fetchJsonFresh('./data/zones.json')
            ]);
            
            if (resTariff.status === 'rejected') throw new Error(resTariff.reason.message);
            if (resZones.status === 'rejected') throw new Error(resZones.reason.message);
            
            const tariffData = resTariff.value;
            const zoneData = resZones.value;
            const peakData = (resPeak.status === 'fulfilled') ? resPeak.value : { zones: {} };

            // 1. IDENTIFIKASI ZONA AKTIF
            let activeZone = window.BAGANTARA_ACTIVE_ZONE_ID; 

            if (window.BAGANTARA_PICKUP_COORD && zoneData && zoneData.active_zones) {
                const getHaversine = (lat1, lon1, lat2, lon2) => {
                    const R = 6371; 
                    const dLat = (lat2 - lat1) * Math.PI / 180;
                    const dLon = (lon2 - lon1) * Math.PI / 180;
                    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
                              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                              Math.sin(dLon/2) * Math.sin(dLon/2);
                    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
                };

                const [pLat, pLng] = window.BAGANTARA_PICKUP_COORD.split(',').map(Number);
                let foundZone = null;

                for (const z of zoneData.active_zones) {
                    if (z.is_open && z.center && z.center.lat && z.center.lng) {
                        const dist = getHaversine(pLat, pLng, z.center.lat, z.center.lng);
                        if (dist <= (z.radius_km || 15)) {
                            foundZone = z.zone_id;
                            break;
                        }
                    }
                }
                
                if (foundZone) {
                    activeZone = foundZone;
                    window.BAGANTARA_ACTIVE_ZONE_ID = foundZone; 
                }
            }

            if (!activeZone) throw new Error("LOKASI_LUAR_ZONA");

            // 2. EKSTRAKSI TARIF BERBASIS ZONA (ENTERPRISE)
            const zoneTariffs = tariffData.zones || {};
            const currentZoneRules = zoneTariffs[activeZone];
            
            if (!currentZoneRules) {
                console.error(`Tarif untuk zona ${activeZone} tidak ditemukan di tariffs.json`);
                throw new Error("TARIF_KOSONG");
            }
            
            const rules = currentZoneRules[service];
            if (!rules) throw new Error("LAYANAN_KOSONG");

            let baseCalculatedPrice = 0;
            const minDist = rules.min_distance_km || 0;
            
            if (distance <= minDist) {
                baseCalculatedPrice = rules.base_price || 0;
            } else {
                baseCalculatedPrice = (rules.base_price || 0) + ((distance - minDist) * (rules.price_per_km || 0));
            }

            // Penambahan Biaya Multi-Stop Jastip
            if (service === 'JASTIP' && window.BAGANTARA_MULTI_DROPOFFS) {
                const totalTitik = window.BAGANTARA_MULTI_DROPOFFS.filter(m => m !== null && m !== undefined).length;
                if (totalTitik > 1) {
                    baseCalculatedPrice += ((totalTitik - 1) * (rules.multi_stop_fee || 5000));
                }
            }

            // 3. KALKULASI JAM SIBUK
            let multiplier = 1.0;
            let flatMarkup = 0;
            let ruleNameActive = "";

            const zonePeak = (peakData && peakData.zones) ? peakData.zones[activeZone] : null;
            if (zonePeak && zonePeak.is_active && Array.isArray(zonePeak.rules)) {
                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();

                for (const rule of zonePeak.rules) {
                    if (!rule.start_time || !rule.end_time) continue;
                    const [startH, startM] = rule.start_time.split(':').map(Number);
                    const [endH, endM] = rule.end_time.split(':').map(Number);
                    const startTotal = startH * 60 + startM;
                    const endTotal = endH * 60 + endM;

                    let isMatch = false;
                    if (startTotal <= endTotal) {
                        isMatch = (currentMinutes >= startTotal && currentMinutes <= endTotal);
                    } else {
                        isMatch = (currentMinutes >= startTotal || currentMinutes <= endTotal);
                    }

                    if (isMatch) {
                        multiplier = rule.multiplier_factor || 1.0;
                        flatMarkup = rule.markup_flat || 0;
                        ruleNameActive = rule.name;
                        break; 
                    }
                }
            }

            // 4. HASIL AKHIR (PEMBULATAN RP 100)
            let finalPriceRaw = (baseCalculatedPrice * multiplier) + flatMarkup;
            window.BAGANTARA_FINAL_PRICE = Math.ceil(finalPriceRaw / 100) * 100; 
            
            const formatHarga = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(window.BAGANTARA_FINAL_PRICE);
            
            const priceValueEl = document.getElementById('priceValue');
            if (priceValueEl) {
                let badgeSibuk = ruleNameActive ? `<br><span style="font-size: 0.55rem; color: #ef4444; border: 1px solid #ef4444; padding: 2px 4px; border-radius: 4px; margin-top: 4px; display: inline-block;">${ruleNameActive.toUpperCase()} AKTIF</span>` : "";
                priceValueEl.innerHTML = `${formatHarga} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-left: 8px;">(${distance.toFixed(1)} KM)</span>${badgeSibuk}`;
            }

        } catch (err) {
            console.error("[Tariff Engine Error]", err);
            if (window.SystemReset) window.SystemReset();
            
            let pesanError = "Gagal memproses data.";
            if (err.message === "LOKASI_LUAR_ZONA") pesanError = "Titik penjemputan berada di luar zona operasional yang aktif.";
            else if (err.message === "TARIF_KOSONG") pesanError = `Struktur tarif untuk wilayah Anda belum dikonfigurasi di tariffs.json.`;
            else if (err.message === "LAYANAN_KOSONG") pesanError = `Layanan '${service}' tidak tersedia di wilayah ini.`;
            else if (err.message.includes("GAGAL_BACA_FILE")) pesanError = `Koneksi file gagal (Pastikan file ada di folder data):\n${err.message}`;

            alert(`[DEBUG] ${pesanError}`); 
        }
    });
});

// Utilitas Paksaan (Bypass Reset)
window.resetWizard = function() { window.SystemReset(); };
