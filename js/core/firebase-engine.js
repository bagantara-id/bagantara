// ==========================================
// MESIN RADAR PENGEMUDI (ZERO-SOCKET & HYBRID CACHE) - FINAL
// ==========================================

const FIREBASE_RTDB_URL = "https://bagantara-core-default-rtdb.asia-southeast1.firebasedatabase.app";

// ==========================================
// ALGORITMA GEOHASH (EDGE NATIVE)
// ==========================================
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
const NEIGHBORS = {
    top: { even: "p0r21436x8zb9dcf5h7kjnmqesgutwvy", odd: "bc01fg45238967deuvhjyznpkmstqrwx" },
    bottom: { even: "14365h7k9dcfesgujnmqp0r2twvyx8zb", odd: "238967debc01fg45kmstqrwxuvhjyznp" },
    right: { even: "bc01fg45238967deuvhjyznpkmstqrwx", odd: "p0r21436x8zb9dcf5h7kjnmqesgutwvy" },
    left: { even: "238967debc01fg45kmstqrwxuvhjyznp", odd: "14365h7k9dcfesgujnmqp0r2twvyx8zb" }
};
const BORDERS = {
    top: { even: "prxz", odd: "bcfguvyz" },
    bottom: { even: "028b", odd: "0145hjnp" },
    right: { even: "bcfguvyz", odd: "prxz" },
    left: { even: "0145hjnp", odd: "028b" }
};

const GeohashEngine = {
    encode: function(lat, lon, precision = 6) {
        let idx = 0, bit = 0, evenBit = true, hash = "";
        let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
        while (hash.length < precision) {
            if (evenBit) {
                let lonMid = (lonMin + lonMax) / 2;
                if (lon >= lonMid) { idx = idx * 2 + 1; lonMin = lonMid; } else { idx = idx * 2; lonMax = lonMid; }
            } else {
                let latMid = (latMin + latMax) / 2;
                if (lat >= latMid) { idx = idx * 2 + 1; latMin = latMid; } else { idx = idx * 2; latMax = latMid; }
            }
            evenBit = !evenBit;
            if (++bit === 5) { hash += BASE32[idx]; bit = 0; idx = 0; }
        }
        return hash;
    },
    calculateAdjacent: function(hash, dir) {
        hash = hash.toLowerCase();
        const lastChr = hash.charAt(hash.length - 1);
        const type = (hash.length % 2) ? 'odd' : 'even';
        let base = hash.substring(0, hash.length - 1);
        if (BORDERS[dir][type].indexOf(lastChr) !== -1) {
            if (base === "") return "";
            base = this.calculateAdjacent(base, dir);
        }
        return base + BASE32[NEIGHBORS[dir][type].indexOf(lastChr)];
    },
    getNeighbors: function(hash) {
        const top = this.calculateAdjacent(hash, 'top');
        const bottom = this.calculateAdjacent(hash, 'bottom');
        const right = this.calculateAdjacent(hash, 'right');
        const left = this.calculateAdjacent(hash, 'left');
        return [
            hash, top, bottom, right, left,
            this.calculateAdjacent(top, 'left'), this.calculateAdjacent(top, 'right'),
            this.calculateAdjacent(bottom, 'left'), this.calculateAdjacent(bottom, 'right')
        ];
    }
};

window.AegisEngine = {
    sanitizeText: function(text) {
        if (!text) return "";
        let clean = text.trim();
        clean = clean.replace(/(https?:\/\/(?!res\.cloudinary\.com)[^\s]+|www\.[^\s]+|\b\w+\.(com|id|me|net|org)\b)/gi, '[TAUTAN DIBLOKIR]');
        const badWords = ['anjing', 'bangsat', 'babi', 'kontol', 'memek', 'penipu', 'bajingan']; 
        const regexBad = new RegExp(`\\b(${badWords.join('|')})\\b`, 'gi');
        return clean.replace(regexBad, '***');
    },

    extractNumber: function(text) {
        if (!text) return 0;
        const numStr = text.toString().replace(/[^0-9]/g, '');
        return numStr ? parseInt(numStr, 10) : 0;
    },

    validateWA: function(text) {
        if (!text) return null;
        let numStr = text.toString().replace(/[^0-9]/g, '');
        if (numStr.startsWith('0')) numStr = '62' + numStr.substring(1);
        if (numStr.length < 10 || !numStr.startsWith('62')) return null;
        return numStr;
    },

    calculateDistance: function(lat1, lon1, lat2, lon2) {
        const R = 6371; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; 
    },

    getFirebaseDriversByGeohash: async function(lat, lng) {
        const centerHash = GeohashEngine.encode(lat, lng, 5);
        const neighborHashes = GeohashEngine.getNeighbors(centerHash);
        let allDrivers = {};

        const fetchPromises = neighborHashes.map(hash => {
            const orderBy = encodeURIComponent('"status/geohash"');
            const startAt = encodeURIComponent('"' + hash + '"');
            const endAt = encodeURIComponent('"' + hash + '\uf8ff"'); 
            const url = `${FIREBASE_RTDB_URL}/drivers.json?orderBy=${orderBy}&startAt=${startAt}&endAt=${endAt}`;
            return fetch(url).then(res => res.json()).catch(() => null);
        });

        const results = await Promise.all(fetchPromises);
        results.forEach(boxData => {
            if (boxData && typeof boxData === 'object') {
                Object.assign(allDrivers, boxData);
            }
        });

        return allDrivers;
    },

    // ==========================================
    // HYBRID CACHING SYSTEM (FIRESTORE)
    // ==========================================
    fetchFirestoreDriver: async function(uid) {
        const cacheKey = `bgn_driver_${uid}`;
        const cachedData = sessionStorage.getItem(cacheKey);
        const CACHE_EXPIRY_MS = 600000; // Umur Cache 10 Menit
        const waktuSekarang = Date.now();
        
        if (cachedData) {
            try {
                const parsedCache = JSON.parse(cachedData);
                if (parsedCache._timestamp && (waktuSekarang - parsedCache._timestamp < CACHE_EXPIRY_MS)) {
                    return parsedCache.data;
                }
            } catch (e) {}
            sessionStorage.removeItem(cacheKey);
        }

        try {
            const fsUrl = `https://firestore.googleapis.com/v1/projects/bagantara-core/databases/(default)/documents/drivers/${uid}`;
            const res = await fetch(fsUrl);
            if (!res.ok) return null;
            const data = await res.json();
            if (!data.fields) return null;

            const getStr = (f) => f ? f.stringValue || "" : "";
            const getNum = (f) => f ? (f.integerValue ? parseInt(f.integerValue) : parseFloat(f.doubleValue || 0)) : 0;
            const getArr = (f) => f && f.arrayValue && f.arrayValue.values ? f.arrayValue.values.map(v => v.stringValue) : [];

            const pf = data.fields.profile ? data.fields.profile.mapValue.fields : {};
            const sf = data.fields.settings ? data.fields.settings.mapValue.fields : {};
            const af = data.fields.admin_status ? data.fields.admin_status.mapValue.fields : {};

            const finalData = {
                profile: { nama: getStr(pf.nama), plat: getStr(pf.plat), wa: getStr(pf.wa), fotoUrl: getStr(pf.fotoUrl), kendaraan: getStr(pf.kendaraan) },
                settings: { layanan: getArr(sf.layanan), tarif: getNum(sf.tarif), radius: getNum(sf.radius), info: getStr(sf.info) },
                admin_status: { isApproved: af.isApproved ? af.isApproved.booleanValue : false, isBanned: af.isBanned ? af.isBanned.booleanValue : false }
            };

            sessionStorage.setItem(cacheKey, JSON.stringify({ data: finalData, _timestamp: waktuSekarang }));
            return finalData;
        } catch(e) { return null; }
    },

    scanPengemudi: async function(targetService, routePrice) {
        try {
            let keranjang1 = []; 
            let keranjang2 = []; 

            let pickupLat = null, pickupLng = null;
            if (window.BAGANTARA_PICKUP_COORD) {
                const parts = window.BAGANTARA_PICKUP_COORD.split(',');
                pickupLat = parseFloat(parts[0]); pickupLng = parseFloat(parts[1]);
            }

            if (!pickupLat || !pickupLng) return { lolosMutlak: [], zonaBoost: [] };

            const firebaseDrivers = await this.getFirebaseDriversByGeohash(pickupLat, pickupLng);
            const driverUids = Object.keys(firebaseDrivers);
            const waktuSekarangServer = Date.now();

            for (let i = 0; i < driverUids.length; i++) {
                const uid = driverUids[i];
                const rtdbData = firebaseDrivers[uid];
                const statusData = rtdbData.status || {};

                const isModeAktif = statusData.mode === 'aktif';
                const isModeMangkal = statusData.mode === 'standby';
                const isWaktuMangkalValid = statusData.expiresAt && (statusData.expiresAt > waktuSekarangServer);
                const isValidStatus = statusData.isOnline === true && (isModeAktif || (isModeMangkal && isWaktuMangkalValid));
                if (!isValidStatus) continue; 

                const latPengemudi = parseFloat(statusData.lat);
                const lngPengemudi = parseFloat(statusData.lng);
                if (isNaN(latPengemudi) || isNaN(lngPengemudi)) continue;

                const fsDriver = await this.fetchFirestoreDriver(uid);
                if (!fsDriver || fsDriver.admin_status.isBanned === true || fsDriver.admin_status.isApproved === false) continue;

                const profile = fsDriver.profile;
                const settings = fsDriver.settings;

                const wa = this.validateWA(profile.wa);
                if (!wa) continue;

                const layananList = settings.layanan.join(",").toUpperCase();
                if (!layananList.includes(targetService.toUpperCase())) continue;

                const jarakKePenumpang = this.calculateDistance(pickupLat, pickupLng, latPengemudi, lngPengemudi);
                const batasRadius = settings.radius ? parseFloat(settings.radius) : 3.0; 
                if (jarakKePenumpang > batasRadius) continue; 

                let fotoProfile = profile.fotoUrl ? profile.fotoUrl.trim() : '';
                if (!fotoProfile.startsWith('http')) fotoProfile = './assets/icon-192.png';
                
                const tarifMin = settings.tarif ? parseInt(settings.tarif) : 0;

                // PERBAIKAN UTAMA: Menyertakan uid ke dalam objek driverData[span_2](start_span)[span_2](end_span)
                const driverData = { 
                    uid: uid,
                    nama: this.sanitizeText(profile.nama), 
                    wa: wa, 
                    plat: this.sanitizeText(profile.plat), 
                    info: this.sanitizeText(settings.info || "-"), 
                    tarifMin: tarifMin, 
                    fotoProfile: fotoProfile, 
                    jarakAktual: jarakKePenumpang 
                };

                if (routePrice >= tarifMin) {
                    keranjang1.push(driverData);
                } else {
                    const selisihTarif = tarifMin - routePrice;
                    if (selisihTarif > 0 && selisihTarif <= 5000) {
                        driverData.selisihBoost = selisihTarif;
                        keranjang2.push(driverData);
                    }
                }
            }
            
            keranjang1.sort((a, b) => a.jarakAktual - b.jarakAktual);
            keranjang2.sort((a, b) => a.jarakAktual - b.jarakAktual);
            
            return { lolosMutlak: keranjang1, zonaBoost: keranjang2 };
        } catch (err) { 
            return { lolosMutlak: [], zonaBoost: [] }; 
        }
    },

    // ==========================================
    // PURE DOM NODE CLONING & UID BINDING
    // ==========================================
    _cetakKartuPengemudi: function(driversArray, containerEl) {
        containerEl.innerHTML = '';
        const template = document.getElementById('tpl-driver-card');
        if (!template) return;

        driversArray.forEach(d => {
            const clone = template.content.cloneNode(true);
            
            const imgEl = clone.querySelector('.tpl-foto');
            if (imgEl) imgEl.src = d.fotoProfile;
            
            const namaEl = clone.querySelector('.tpl-nama');
            if (namaEl) namaEl.textContent = d.nama;
            
            const platEl = clone.querySelector('.tpl-plat');
            if (platEl) platEl.textContent = d.plat;
            
            const jarakEl = clone.querySelector('.tpl-jarak');
            if (jarakEl) jarakEl.textContent = d.jarakAktual.toFixed(1);
            
            const infoEl = clone.querySelector('.tpl-info');
            if (infoEl && d.info && d.info !== "-") {
                infoEl.textContent = `"${d.info}"`;
                infoEl.style.display = 'block';
            }
            
            const btnPilih = clone.querySelector('.tpl-btn-pilih');
            if (btnPilih) {
                // PERBAIKAN UTAMA: Menyimpan uid ke dalam memori window.BAGANTARA_DRIVER[span_3](start_span)[span_3](end_span)
                btnPilih.addEventListener('click', () => {
                    window.BAGANTARA_DRIVER = { 
                        uid: d.uid, 
                        nama: d.nama, 
                        wa: d.wa 
                    };
                    const overlay = document.getElementById('client-form-overlay');
                    if (overlay) overlay.classList.remove('hidden');
                });
            }
            
            containerEl.appendChild(clone);
        });
    },

    renderMitraList: async function(targetService, routePrice) {
        const container = document.getElementById('driverListContainer');
        if (!container) return;

        let k1_LolosMutlak = [];
        let k2_ZonaBoost = [];

        // --- INJEKSI FASE 4: PRE-LOCK BYPASS (JALUR PINTAS) ---
        if (window.BAGANTARA_PRELOCKED_DRIVER) {
            const pd = window.BAGANTARA_PRELOCKED_DRIVER;
            // Validasi Silang: Pastikan driver melayani jenis pesanan ini
            const fsDriver = await this.fetchFirestoreDriver(pd.uid);
            let layananValid = false;
            
            if (fsDriver && fsDriver.settings && fsDriver.settings.layanan) {
                const layananList = fsDriver.settings.layanan.join(",").toUpperCase();
                if (layananList.includes(targetService.toUpperCase())) layananValid = true;
            }

            if (layananValid) {
                const driverData = {
                    uid: pd.uid,
                    nama: pd.nama,
                    wa: pd.wa,
                    plat: fsDriver.profile.plat || "-",
                    info: pd.info,
                    tarifMin: pd.tarifMin,
                    fotoProfile: pd.fotoProfile,
                    jarakAktual: window.BAGANTARA_DISTANCE_KM || 0 // Jarak rute, bukan jarak jemput
                };

                // Filter Harga / Boost
                if (routePrice >= pd.tarifMin) {
                    k1_LolosMutlak.push(driverData);
                } else {
                    const selisih = pd.tarifMin - routePrice;
                    if (selisih > 0 && selisih <= 5000) {
                        driverData.selisihBoost = selisih;
                        k2_ZonaBoost.push(driverData);
                    }
                }
            } else {
                // Jika driver motor tapi pelanggan memaksa pesan mobil
                if(window.UIManager && window.UIManager.alert) {
                    window.UIManager.alert(`Maaf, Driver <b>${pd.nama}</b> tidak melayani pesanan <b>${targetService}</b>. Sistem akan otomatis beralih ke radar publik.`);
                } else {
                    alert(`Maaf, Driver ${pd.nama} tidak melayani pesanan ${targetService}. Sistem beralih ke radar otomatis.`);
                }
            }
            
            // Hancurkan kunci setelah digunakan agar pesanan berikutnya kembali normal
            window.BAGANTARA_PRELOCKED_DRIVER = null; 
        }

        // JIKA KUNCI KOSONG / GAGAL VALIDASI -> LAKUKAN SCANNING 360 DERAJAT NORMAL
        if (k1_LolosMutlak.length === 0 && k2_ZonaBoost.length === 0) {
            const dataScan = await this.scanPengemudi(targetService, routePrice);
            k1_LolosMutlak = dataScan.lolosMutlak;
            k2_ZonaBoost = dataScan.zonaBoost;
        }
        // ------------------------------------------------------

        container.innerHTML = ''; 

        if (k1_LolosMutlak.length > 0) {
            this._cetakKartuPengemudi(k1_LolosMutlak, container);
        } else if (k2_ZonaBoost.length > 0) {
            let maxBoost = 0;
            k2_ZonaBoost.forEach(d => { if (d.selisihBoost > maxBoost) maxBoost = d.selisihBoost; });
            
            const formatBoost = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(maxBoost);
            const templateBoost = document.getElementById('tpl-boost-card');
            
            if (templateBoost) {
                const clone = templateBoost.content.cloneNode(true);
                
                clone.querySelector('.tpl-boost-count').textContent = k2_ZonaBoost.length;
                clone.querySelector('.tpl-boost-price').textContent = formatBoost;
                
                const btnSetuju = clone.querySelector('.tpl-btn-setuju');
                btnSetuju.addEventListener('click', () => {
                    window.BAGANTARA_FINAL_PRICE += maxBoost;
                    const priceValueEl = document.getElementById('priceValue');
                    if (priceValueEl) {
                        const formatBaru = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(window.BAGANTARA_FINAL_PRICE);
                        priceValueEl.textContent = `${formatBaru} (Boost Aktif)`;
                    }
                    // Memastikan array k2_ZonaBoost membawa data driver dengan UID yang valid
                    this._cetakKartuPengemudi(k2_ZonaBoost, container);
                });

                const btnTolak = clone.querySelector('.tpl-btn-tolak');
                btnTolak.addEventListener('click', () => {
                    if (window.SystemReset) window.SystemReset();
                });
                
                container.appendChild(clone);
            }
        } else {
            const templateEmpty = document.getElementById('tpl-empty-drivers');
            if (templateEmpty) {
                container.appendChild(templateEmpty.content.cloneNode(true));
            }
        }
    }
};
