// ==========================================
// MESIN MODULAR: JASTIP (ALUR BELANJA PRESISI)
// ==========================================

window.FlowJastip = {
    init: function() {
        console.log("[FlowJastip] Mesin Diaktifkan");
        window.BAGANTARA_JASTIP_STORE = null;
        window.BAGANTARA_JASTIP_ITEMS = [];
        this.showStoreSearch();
        this.setupSearchEngine(); 
    },

    setupSearchEngine: function() {
        const inputStore = document.getElementById('inputJastipStore');
        const btnClear = document.getElementById('btnClearJastipStore');
        let searchTimeout = null;

        if (inputStore && btnClear) {
            inputStore.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                btnClear.style.display = query.length > 0 ? 'block' : 'none';
                
                if (query.length < 3) {
                    document.getElementById('jastipStoreResults').classList.add('hidden');
                    return;
                }
                
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(async () => {
                    let lat = null, lng = null;
                    if (window.BAGANTARA_ACTIVE_COORD) {
                        lat = window.BAGANTARA_ACTIVE_COORD.lat;
                        lng = window.BAGANTARA_ACTIVE_COORD.lng;
                    }
                    
                    // Integrasi ke API Geocoder Terpusat
                    const features = await window.GeocoderAPI.search(query, lat, lng);
                    
                    // Delegasi render ke UIManager murni (Tanpa InnerHTML)
                    window.UIManager.renderSearchResults('jastipStoreResults', features, (title, fLat, fLng) => {
                        inputStore.value = title;
                        window.BAGANTARA_ACTIVE_COORD = { lat: fLat, lng: fLng };
                        window.TEMPORARY_GEOCODE = title;
                        this.showStoreMap();
                    });
                }, 600);
            });

            btnClear.addEventListener('click', () => {
                inputStore.value = '';
                btnClear.style.display = 'none';
                document.getElementById('jastipStoreResults').classList.add('hidden');
                inputStore.focus();
            });
        }
    },

    // FASE 1: Layar Pencarian Toko
    showStoreSearch: function() {
        window.spaNavigateTo('view-jastip-search');
        const nav = document.getElementById('mainBottomNav');
        if (nav) nav.classList.add('hidden');
        
        document.getElementById('btnGlobalBack').style.display = 'none';
        window.bindSafeButton('btnBackJastipSearch', () => { if (window.SystemReset) window.SystemReset(); });
        window.bindSafeButton('btnJastipMap', () => { this.showStoreMap(); });
    },

    // FASE 2: Kunci Lokasi Toko di Peta
    showStoreMap: function() {
        window.spaNavigateTo('view-map');
        const nav = document.getElementById('mainBottomNav');
        if (nav) nav.classList.add('hidden'); 

        window.dispatchEvent(new CustomEvent('wizardState', { detail: 'JASTIP_STORE' }));
        
        document.getElementById('inlineAddressPanel').style.display = 'flex';
        document.getElementById('priceArea').classList.add('hidden');
        
        const btnNext = document.getElementById('btnWizardNext');
        btnNext.className = 'btn-primary w-full pulse-attention step-jastip-store';
        btnNext.setAttribute('data-step', 'JASTIP_STORE');
        
        window.bindSafeButton('btnWizardNext', () => {
            const notes = document.getElementById('inputInlineNotes').value || "-";
            if (!window.BAGANTARA_ACTIVE_COORD) {
                window.alert("Sistem sedang memindai koordinat, mohon tunggu sebentar.");
                return;
            }
            window.BAGANTARA_JASTIP_STORE = {
                lat: window.BAGANTARA_ACTIVE_COORD.lat.toFixed(6),
                lng: window.BAGANTARA_ACTIVE_COORD.lng.toFixed(6),
                address: window.TEMPORARY_GEOCODE,
                notes: notes
            };
            this.showItemization(); 
        });

        window.bindSafeButton('btnBackMap', () => { this.showStoreSearch(); });
    },

    // FASE 3: Delegasi ke UI Jastip (Barang)
    showItemization: function() {
        window.spaNavigateTo('view-jastip-items');
        document.getElementById('btnGlobalBack').style.display = 'block';
        
        const storeTitle = document.getElementById('jastipStoreNameTitle');
        if (storeTitle && window.BAGANTARA_JASTIP_STORE) storeTitle.innerText = window.BAGANTARA_JASTIP_STORE.address;

        if (window.UIJastip) window.UIJastip.init();

        window.bindSafeButton('btnJastipProceed', () => {
            const items = window.UIJastip.extractData();
            if (items.length === 0) {
                window.alert("Harap masukkan minimal 1 barang dengan nama dan estimasi harga yang valid.");
                return;
            }
            window.BAGANTARA_JASTIP_ITEMS = items; 
            this.showDropoffMap();
        });

        window.bindSafeButton('btnGlobalBack', () => { this.showStoreMap(); });
    },

    // FASE 4: Penentuan Titik Pengantaran
    showDropoffMap: function() {
        window.spaNavigateTo('view-map');
        window.dispatchEvent(new CustomEvent('wizardState', { detail: 'DROPOFF_PIN' }));
        
        document.getElementById('inlineAddressPanel').style.display = 'flex';
        document.getElementById('priceArea').classList.add('hidden');
        document.getElementById('inputInlineNotes').value = ''; 

        const btnNext = document.getElementById('btnWizardNext');
        btnNext.className = 'btn-primary w-full pulse-attention step-jastip-dropoff';
        btnNext.setAttribute('data-step', 'JASTIP_DROPOFF');
        
        window.bindSafeButton('btnWizardNext', () => {
            const notes = document.getElementById('inputInlineNotes').value || "-";
            if (!window.BAGANTARA_ACTIVE_COORD) { window.alert("Sistem memindai koordinat..."); return; }
            
            window.BAGANTARA_DROPOFF_COORD = `${window.BAGANTARA_ACTIVE_COORD.lat.toFixed(6)},${window.BAGANTARA_ACTIVE_COORD.lng.toFixed(6)}`;
            window.BAGANTARA_MULTI_DROPOFFS = [{ 
                lat: window.BAGANTARA_ACTIVE_COORD.lat, 
                lng: window.BAGANTARA_ACTIVE_COORD.lng, 
                name: window.TEMPORARY_GEOCODE,
                notes: notes
            }];
            this.showFinal(); 
        });

        window.bindSafeButton('btnBackMap', () => { this.showItemization(); });
    },

    showFinal: function() {
        if (window.BAGANTARA_JASTIP_STORE) {
            window.BAGANTARA_PICKUP_COORD = `${window.BAGANTARA_JASTIP_STORE.lat},${window.BAGANTARA_JASTIP_STORE.lng}`;
        }

        document.getElementById('wizardInstruction').innerText = window.BAGANTARA_PRELOCKED_DRIVER ? 'KONFIRMASI DRIVER TERPILIH' : 'KONFIRMASI JASTIP';
        document.getElementById('priceArea').classList.remove('hidden');
        document.getElementById('inlineAddressPanel').style.display = 'none';

        const btnNext = document.getElementById('btnWizardNext');
        btnNext.className = 'btn-primary w-full step-final';
        btnNext.setAttribute('data-step', 'FINAL');
        
        window.bindSafeButton('btnWizardNext', () => {
            if (navigator.vibrate) navigator.vibrate(50);
            
            // Integrasi ke UIManager Global
            window.alert("Transaksi akan dilanjutkan melalui WhatsApp Pengemudi. BAGANTARA murni beroperasi sebagai platform perantara gratis tanpa komisi.<br><br><b>Segala kesepakatan, transaksi, dan risiko yang timbul sepenuhnya menjadi tanggung jawab Penumpang dan Pengemudi.</b>");
            
            const btnCloseAlert = document.getElementById('btn-close-alert');
            btnCloseAlert.addEventListener('click', function proceedToDrivers() {
                btnNext.setAttribute('data-step', 'LOADING');
                
                const eksekusiLanjutan = () => {
                    window.BAGANTARA_CUSTOM_WA_PAYLOAD = window.FlowJastip.generateWhatsAppPayload();
                    window.spaNavigateTo('view-drivers');
                    if (window.AegisEngine) window.AegisEngine.renderMitraList('JASTIP', window.BAGANTARA_FINAL_PRICE);
                };

                const cekHargaBerkala = (percobaan = 0) => {
                    if (window.BAGANTARA_FINAL_PRICE && window.BAGANTARA_FINAL_PRICE > 0) {
                        eksekusiLanjutan();
                    } else if (percobaan < 20) {
                        setTimeout(() => cekHargaBerkala(percobaan + 1), 500);
                    } else {
                        btnNext.setAttribute('data-step', 'FINAL');
                        if (window.UIManager) window.UIManager.alert("Kalkulasi tarif memakan waktu terlalu lama akibat lambatnya koneksi. Silakan coba lagi.");
                    }
                };
                
                cekHargaBerkala();
                
                btnCloseAlert.removeEventListener('click', proceedToDrivers);
            }, { once: true }); // Mencegah penumpukan event
        });

        window.dispatchEvent(new CustomEvent('wizardState', { detail: 'CALCULATE' }));
        window.addEventListener('priceCalculated', this.overrideJastipPriceDisplay, { once: true });
    },

    overrideJastipPriceDisplay: function() {
        const priceValueEl = document.getElementById('priceValue');
        if (priceValueEl) {
            const ongkir = window.BAGANTARA_FINAL_PRICE || 0;
            const belanja = window.BAGANTARA_JASTIP_VALUE || 0;
            const totalSemua = ongkir + belanja;
            
            const formatHarga = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalSemua);
            priceValueEl.innerHTML = `${formatHarga} <br><span style="font-size: 0.65rem; color: var(--text-muted); font-weight: normal; margin-top: 4px; display: inline-block;">(Belanja: Rp${belanja.toLocaleString('id-ID')} + Ongkir: Rp${ongkir.toLocaleString('id-ID')})</span>`;
        }
    },

    generateWhatsAppPayload: function() {
        const store = window.BAGANTARA_JASTIP_STORE;
        const drop = window.BAGANTARA_MULTI_DROPOFFS ? window.BAGANTARA_MULTI_DROPOFFS[0] : null;
        const items = window.BAGANTARA_JASTIP_ITEMS || [];
        const ongkir = window.BAGANTARA_FINAL_PRICE || 0;
        const belanja = window.BAGANTARA_JASTIP_VALUE || 0;
        const total = ongkir + belanja;

        let itemList = "";
        items.forEach((item, index) => {
            itemList += `> ${index+1}. ${item.name} (${item.qty}x) - Rp${(item.price * item.qty).toLocaleString('id-ID')}\n`;
            if (item.notes) itemList += `  *Catatan: ${item.notes}*\n`;
        });

        let mapLink = (store && drop) ? `https://www.google.com/maps/dir/?api=1&origin=${store.lat},${store.lng}&destination=${drop.lat},${drop.lng}&travelmode=driving` : "";

        return `*🚨 ORDER JASTIP MASUK (BAGANTARA)*\n\n` +
            `*🏪 LOKASI TOKO:*\n${store ? store.address : '-'}\n` +
            `${store && store.notes !== '-' && store.notes !== '' ? `(Patokan: ${store.notes})\n` : ''}\n` +
            `*📍 LOKASI PENGANTARAN:*\n${drop ? drop.name : '-'}\n` +
            `${drop && drop.notes !== '-' && drop.notes !== '' ? `(Patokan: ${drop.notes})\n` : ''}\n` +
            `*🛍️ RINCIAN BELANJA:*\n${itemList}\n` +
            `*💰 ESTIMASI BIAYA:*\n` +
            `- Total Belanja: Rp${belanja.toLocaleString('id-ID')}\n` +
            `- Ongkos Kirim: Rp${ongkir.toLocaleString('id-ID')}\n` +
            `*TOTAL DIBAYAR: Rp${total.toLocaleString('id-ID')}*\n\n` +
            `*🗺️ RUTE MAPS LANGSUNG:*\n${mapLink}\n\n` +
            `_Apakah Anda bersedia mengambil order Jastip ini? Balas pesan ini untuk konfirmasi._`;
    }
};

window.addEventListener('jastipUIUpdated', () => {
    if (!window.UIJastip) return;
    const items = window.UIJastip.extractData();
    let totalItems = 0; let grandTotal = 0;
    items.forEach(i => { totalItems += i.qty; grandTotal += i.subtotal; });
    window.BAGANTARA_JASTIP_VALUE = grandTotal;
    
    const stickyCheckout = document.getElementById('stickyJastipCheckout');
    const elItemCount = document.getElementById('jastipItemCount');
    const elGrandTotal = document.getElementById('jastipGrandTotal');

    if (stickyCheckout && elItemCount && elGrandTotal) {
        if (totalItems > 0 && grandTotal > 0) {
            stickyCheckout.style.display = 'flex';
            elItemCount.innerText = `${totalItems} Item Belanjaan`;
            elGrandTotal.innerText = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(grandTotal);
        } else {
            stickyCheckout.style.display = 'none';
        }
    }
});
