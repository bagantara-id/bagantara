// ==========================================
// MESIN ALUR TERPUSAT (RIDE, CAR, EXPRESS)
// ==========================================

window.FlowEngine = {
    init: function() {
        console.log(`[FlowEngine] Mesin aktif untuk layanan: ${window.BAGANTARA_SERVICE}`);
        this.showSearchRoute();
    },

    setManualState: function(state) {
        if (state === 'DROPOFF_PIN') this.showDropoffMap();
        if (state === 'PICKUP') this.showPickupMap();
    },

    showSearchRoute: function() {
        window.spaNavigateTo('view-search-route');
        document.getElementById('btnGlobalBack').style.display = 'block';
        document.getElementById('mainBottomNav').classList.add('hidden');
        
        const sv = document.getElementById('view-search-route');
        if (sv) { sv.classList.remove('compact-mode'); sv.classList.add('expanded-mode'); }

        window.bindSafeButton('btnProceedToPickup', () => {
            const inputDrop1 = document.getElementById('inputSearchDropoff1');
            if (!window.BAGANTARA_DROPOFF_COORD || !inputDrop1.hasAttribute('readonly')) {
                window.alert("Harap kunci minimal 1 lokasi tujuan terlebih dahulu.");
                return;
            }
            if (!window.BAGANTARA_PICKUP_COORD) {
                window.alert("Lokasi penjemputan belum ditentukan.");
                return;
            }
            this.showPickupMap(); 
        });

        if (window.UIManager && window.UIManager.checkFormReady) window.UIManager.checkFormReady();

        window.bindSafeButton('btnGlobalBack', () => { 
            if (window.SystemReset) window.SystemReset(); 
        });

        // PERBAIKAN: Menghidupkan tombol ikon Peta (Map) untuk Pilih Lokasi Jemput
        window.bindSafeButton('btnMapPickup', () => {
            this.setManualState('PICKUP');
        });

        // PERBAIKAN: Menghidupkan tombol ikon Peta (Map) untuk Pilih Tujuan
        window.bindSafeButton('btnSelectViaMap', () => {
            this.setManualState('DROPOFF_PIN');
        });

        // INJEKSI BARU: Menghidupkan tombol "Tambah Tujuan Lain" (Multi-Stop)
        window.bindSafeButton('btnAddStop', () => {
            if (window.UIManager && window.UIManager.addMultiStop) {
                window.UIManager.addMultiStop(
                    'routeInputsArea',
                    'btnAddStop',
                    (inputId) => window.UIManager.unlockSearchField(inputId), // Callback Unlock
                    (idx) => { // Callback Peta
                        window.BAGANTARA_MAP_TARGET_INDEX = idx;
                        this.setManualState('DROPOFF_PIN');
                    },
                    (idx) => { // Callback Hapus
                        if (window.BAGANTARA_MULTI_DROPOFFS) window.BAGANTARA_MULTI_DROPOFFS[idx - 1] = null;
                        if (window.UIManager.checkFormReady) window.UIManager.checkFormReady();
                    }
                );
            }
        });

        // INJEKSI BARU: Menghidupkan fitur Expand Catatan (Ikon Pensil)
        window.bindSafeButton('btnNotePickup', () => {
            const area = document.getElementById('noteAreaPickup');
            if (area) {
                area.classList.toggle('hidden');
                if (!area.classList.contains('hidden')) document.getElementById('inputNotesPickup').focus();
            }
        });

        window.bindSafeButton('btnNoteDropoff', () => {
            const area = document.getElementById('noteAreaDropoff');
            if (area) {
                area.classList.toggle('hidden');
                if (!area.classList.contains('hidden')) document.getElementById('inputSearchNotes').focus();
            }
        });

        window.dispatchEvent(new CustomEvent('wizardState', { detail: 'SEARCH_ROUTE' }));
    },

    showDropoffMap: function() {
        window.spaNavigateTo('view-map');
        document.getElementById('wizardInstruction').innerText = 'TUJUAN';
        document.getElementById('inlineAddressPanel').style.display = 'flex';
        document.getElementById('priceArea').classList.add('hidden');
        document.getElementById('notesContainer').classList.remove('hidden');
        
        const btnNotes = document.getElementById('btnToggleNotes');
        if(btnNotes) btnNotes.style.display = 'none';

        // PENERAPAN SEPARATION OF CONCERNS: Pengaturan teks dan ikon diserahkan ke CSS
        const btnNext = document.getElementById('btnWizardNext');
        btnNext.className = 'btn-primary w-full pulse-attention step-dropoff';
        btnNext.setAttribute('data-step', 'DROPOFF'); 

        window.bindSafeButton('btnWizardNext', () => {
            const center = window.BAGANTARA_ACTIVE_COORD;
            if (center) {
                const targetIdx = window.BAGANTARA_MAP_TARGET_INDEX || 1;
                const coordStr = `${center.lat.toFixed(6)},${center.lng.toFixed(6)}`;
                
                if (targetIdx === 1) window.BAGANTARA_DROPOFF_COORD = coordStr;
                if (!window.BAGANTARA_MULTI_DROPOFFS) window.BAGANTARA_MULTI_DROPOFFS = [];
                window.BAGANTARA_MULTI_DROPOFFS[targetIdx - 1] = { lat: center.lat, lng: center.lng, name: window.TEMPORARY_GEOCODE };
                
                const input = document.getElementById(`inputSearchDropoff${targetIdx}`);
                if (input) { 
                    input.value = window.TEMPORARY_GEOCODE; 
                    if (window.UIManager && window.UIManager.lockSearchField) window.UIManager.lockSearchField(`inputSearchDropoff${targetIdx}`); 
                }
            }
            this.showPickupMap();
        });

        window.bindSafeButton('btnGlobalBack', () => { this.showSearchRoute(); });
        window.dispatchEvent(new CustomEvent('wizardState', { detail: 'DROPOFF_PIN' }));
    },

    showPickupMap: function() {
        window.spaNavigateTo('view-map');
        document.getElementById('wizardInstruction').innerText = (window.BAGANTARA_SERVICE === 'EXPRESS') ? 'AMBIL BARANG' : 'JEMPUT';
        document.getElementById('inlineAddressPanel').style.display = 'flex';
        document.getElementById('priceArea').classList.add('hidden');
        document.getElementById('notesContainer').classList.remove('hidden');
        
        const btnNotes = document.getElementById('btnToggleNotes');
        if(btnNotes) btnNotes.style.display = 'block';

        const btnNext = document.getElementById('btnWizardNext');
        btnNext.className = 'btn-primary w-full pulse-attention step-pickup';
        btnNext.setAttribute('data-step', (window.BAGANTARA_SERVICE === 'EXPRESS') ? 'PICKUP_EXPRESS' : 'PICKUP');

        window.bindSafeButton('btnWizardNext', () => {
            const notes = document.getElementById('inputInlineNotes').value || "-";
            if (window.BAGANTARA_ACTIVE_COORD) {
                window.BAGANTARA_PICKUP_COORD = `${window.BAGANTARA_ACTIVE_COORD.lat.toFixed(6)},${window.BAGANTARA_ACTIVE_COORD.lng.toFixed(6)}`;
            }
            
            // Simpan catatan sementara, untuk EXPRESS akan digabung nanti
            window.BAGANTARA_PICKUP_DETAIL = { kec: window.TEMPORARY_GEOCODE, patokan: notes, patokan_awal: notes };
            
            const input = document.getElementById('inputSearchPickup');
            if (input) {
                input.value = window.TEMPORARY_GEOCODE;
                if (window.UIManager && window.UIManager.lockSearchField) window.UIManager.lockSearchField('inputSearchPickup');
            }
            
            // PERCABANGAN LOGIKA BERDASARKAN LAYANAN
            if (window.BAGANTARA_SERVICE === 'EXPRESS') {
                this.showExpressDetails();
            } else {
                this.showFinal();
            }
        });

        window.bindSafeButton('btnGlobalBack', () => { this.showDropoffMap(); });
        window.dispatchEvent(new CustomEvent('wizardState', { detail: 'PICKUP' }));
    },

    showExpressDetails: function() {
        window.spaNavigateTo('view-express-details');
        
        window.bindSafeButton('btnExpressProceed', () => {
            const item = document.getElementById('expressItemName').value.trim();
            const recName = document.getElementById('expressReceiverName').value.trim();
            const recPhone = document.getElementById('expressReceiverPhone').value.trim();
            
            if(!item || !recName) {
                window.alert("Rincian barang dan Nama Penerima wajib diisi demi keamanan logistik.");
                return;
            }

            const notes = window.BAGANTARA_PICKUP_DETAIL.patokan_awal;
            window.BAGANTARA_PICKUP_DETAIL.patokan = `Detail: ${item} | Penerima: ${recName} (${recPhone}) | Lokasi: ${notes}`;
            
            this.showFinal();
        });

        window.bindSafeButton('btnGlobalBack', () => { this.showPickupMap(); });
    },

    showFinal: function() {
        window.spaNavigateTo('view-map');
        document.getElementById('wizardInstruction').innerText = 'KONFIRMASI';
        document.getElementById('priceArea').classList.remove('hidden');
        document.getElementById('inlineAddressPanel').style.display = 'none';

        const btnNext = document.getElementById('btnWizardNext');
        btnNext.className = 'btn-primary w-full step-final';
        btnNext.setAttribute('data-step', 'FINAL');

        window.bindSafeButton('btnWizardNext', () => {
            if (navigator.vibrate) navigator.vibrate(50);
            btnNext.setAttribute('data-step', 'LOADING'); // CSS merender loading text
            
            const eksekusiLanjutan = () => {
                window.spaNavigateTo('view-drivers');
                if (window.AegisEngine) window.AegisEngine.renderMitraList(window.BAGANTARA_SERVICE, window.BAGANTARA_FINAL_PRICE);
            };

            const cekHargaBerkala = (percobaan = 0) => {
                if (window.BAGANTARA_FINAL_PRICE && window.BAGANTARA_FINAL_PRICE > 0) {
                    eksekusiLanjutan();
                } else if (percobaan < 20) {
                    setTimeout(() => cekHargaBerkala(percobaan + 1), 500); // Polling per 500ms (Maks 10 detik)
                } else {
                    btnNext.setAttribute('data-step', 'FINAL');
                    if (window.UIManager) window.UIManager.alert("Kalkulasi tarif memakan waktu terlalu lama akibat lambatnya koneksi. Silakan coba lagi.");
                }
            };
            
            cekHargaBerkala();
        });

        window.dispatchEvent(new CustomEvent('wizardState', { detail: 'CALCULATE' }));
    }
};
