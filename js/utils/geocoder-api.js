// ==========================================
// MESIN GEOCODER TUNGGAL (PHOTON API)
// ==========================================

window.GeocoderAPI = {
    _reverseCache: null, 
    
    _getHaversineDistance: function(lat1, lon1, lat2, lon2) {
        const R = 6371; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    },

    search: async function(query, lat = null, lng = null) {
        if (!query || query.trim().length < 3) return [];
        
        try {
            let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
            if (lat !== null && lng !== null) {
                url += `&lon=${lng}&lat=${lat}&location_bias_scale=0.1`; 
            }
            const res = await fetch(url);
            if (!res.ok) throw new Error("Gagal merespons API");
            
            const data = await res.json();
            return data.features || [];
        } catch (err) {
            console.error("[GeocoderAPI] Koneksi Pemetaan Gagal:", err);
            return [];
        }
    },

    reverseGeocode: async function(lat, lng) {
        // MEMOIZATION ANTI-BLOKIR: Gunakan cache jika pergeseran < 10 meter (0.01 KM)
        if (this._reverseCache) {
            const distance = this._getHaversineDistance(lat, lng, this._reverseCache.lat, this._reverseCache.lng);
            if (distance <= 0.01) return this._reverseCache.address;
        }

        try {
            const url = `https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("API Reverse Error");
            const data = await res.json();
            
            let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            if (data.features && data.features.length > 0) {
                const p = data.features[0].properties;
                address = p.name || p.street || p.city || address;
            }
            
            this._reverseCache = { lat: lat, lng: lng, address: address };
            return address;
        } catch (e) {
            return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
    }
};
