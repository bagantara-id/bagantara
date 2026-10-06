// ==========================================
// MESIN MODULAR: RIDE (OJEK MOTOR)
// ARSITEKTUR: PURE DOM, SINGLE RESPONSIBILITY
// ==========================================

window.FlowRide = {
    init: function() {
        console.log("[FlowRide] Mesin Ojek Aktif");
        this.showSearchRoute();
    },

    setManualState: function(state) {
        if (state === 'DROPOFF_PIN') this.showDropoffMap();
        if (state === 'PICKUP') this.showPickupMap();
    },

    showSearchRoute: function() {
        window.spaNavigateTo('view-search-route');
        
        const btnBack = document.getElementById('btnGlobalBack');
        const nav = document.getElementById('mainBottomNav');
        if (btnBack) btnBack.style.display = 'block';
        if (nav) nav.classList.add('hidden');
        
        const sv = document.getElementById('view-search-route');
        if (sv) { 
            sv.classList.remove('compact-mode'); 
            sv.classList.add('expanded-mode'); 
        }

        window.bindSafeButton('btnProceedToPickup', () => {
            const inputDrop1 = document.getElementById('inputSearchDropoff1');
            if (!window.BAGANTARA_DROPOFF_COORD || (inputDrop1 && !inputDrop1.hasAttribute('readonly'))) {
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

        // --- INJEKSI SARAF TOMBOL UI PENCARIAN ---
        window.bindSafeButton('btnMapPickup', () => { this.setManualState('PICKUP'); });
        window.bindSafeButton('btnSelectViaMap', () => { this.setManualState('DROPOFF_PIN'); });

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

        window.bindSafeButton('btnAddStop', () => {
            if (window.UIManager && window.UIManager.addMultiStop) {
                window.UIManager.addMultiStop(
                    'routeInputsArea', 'btnAddStop',
                    (inputId) => window.UIManager.unlockSearchField(inputId),
                    (idx) => { window.BAGANTARA_MAP_TARGET_INDEX = idx; this.setManualState('DROPOFF_PIN'); },
                    (idx) => { 
                        if (window.BAGANTARA_MULTI_DROPOFFS) window.BAGANTARA_MULTI_DROPOFFS[idx - 1] = null;
                        if (window.UIManager.checkFormReady) window.UIManager.checkFormReady();
                    }
                );
            }
        });
        // -----------------------------------------

        window.dispatchEvent(new CustomEvent('wizardState', { detail: 'SEARCH_ROUTE' }));
    },

    showDropoffMap: function() {
        window.spaNavigateTo('view-map');
        
        const inst = document.getElementById('wizardInstruction');
        if (inst) inst.textContent = 'TUJUAN';
        
        document.getElementById('inlineAddressPanel').style.display = 'flex';
        document.getElementById('priceArea').classList.add('hidden');
        document.getElementById('notesContainer').classList.remove('hidden');
        
        const btnNotes = document.getElementById('btnToggleNotes');
        if(btnNotes) btnNotes.style.display = 'none';

        // ZERO HTML INJECTION: Menggunakan Data Attribute untuk CSS Styling[span_0](start_span)[span_0](end_span)
        const btnNext = document.getElementById('btnWizardNext');
        btnNext.className = 'btn-primary w-full pulse-attention';
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
        
        const inst = document.getElementById('wizardInstruction');
        if (inst) inst.textContent = 'JEMPUT';
        
        document.getElementById('inlineAddressPanel').style.display = 'flex';
        document.getElementById('priceArea').classList.add('hidden');
        document.getElementById('notesContainer').classList.remove('hidden');
        
        const btnNotes = document.getElementById('btnToggleNotes');
        if(btnNotes) btnNotes.style.display = 'block';

        const btnNext = document.getElementById('btnWizardNext');
        btnNext.className = 'btn-primary w-full pulse-attention';
        btnNext.setAttribute('data-step', 'PICKUP');

        window.bindSafeButton('btnWizardNext', () => {
            const inputNotes = document.getElementById('inputInlineNotes');
            const notes = inputNotes ? (inputNotes.value || "-") : "-";
            
            if (window.BAGANTARA_ACTIVE_COORD) {
                window.BAGANTARA_PICKUP_COORD = `${window.BAGANTARA_ACTIVE_COORD.lat.toFixed(6)},${window.BAGANTARA_ACTIVE_COORD.lng.toFixed(6)}`;
            }
            window.BAGANTARA_PICKUP_DETAIL = { kec: window.TEMPORARY_GEOCODE, patokan: notes };
            
            const input = document.getElementById('inputSearchPickup');
            if (input) {
                input.value = window.TEMPORARY_GEOCODE;
                if (window.UIManager && window.UIManager.lockSearchField) window.UIManager.lockSearchField('inputSearchPickup');
            }
            
            this.showFinal();
        });

        window.bindSafeButton('btnGlobalBack', () => { this.showDropoffMap(); });
        window.dispatchEvent(new CustomEvent('wizardState', { detail: 'PICKUP' }));
    },

    showFinal: function() {
        const inst = document.getElementById('wizardInstruction');
        if (inst) inst.textContent = window.BAGANTARA_PRELOCKED_DRIVER ? 'KONFIRMASI DRIVER TERPILIH' : 'KONFIRMASI';
        
        document.getElementById('priceArea').classList.remove('hidden');
        document.getElementById('inlineAddressPanel').style.display = 'none';

        const btnNext = document.getElementById('btnWizardNext');
        btnNext.className = 'btn-primary w-full';
        btnNext.setAttribute('data-step', 'FINAL');

        window.bindSafeButton('btnWizardNext', () => {
            if (navigator.vibrate) navigator.vibrate(50);
            
            // Transmutasi Visual Loading (CSS)
            btnNext.setAttribute('data-step', 'LOADING');
            
            const eksekusiLanjutan = () => {
                // --- KOREKSI LOGIKA: SUPER BYPASS ---
                if (window.BAGANTARA_PRELOCKED_DRIVER) {
                    // SINKRONISASI UID: Transfer memori Pre-Lock ke variabel Eksekutor Chat
                    window.BAGANTARA_DRIVER = window.BAGANTARA_PRELOCKED_DRIVER;
                    
                    // LOMPATI RADAR! Langsung buka form identitas (Nama & WA)
                    const formOverlay = document.getElementById('client-form-overlay');
                    if (formOverlay) formOverlay.classList.remove('hidden');
                } else {
                    // ALUR NORMAL (Jika tidak ada driver yang di-lock)
                    window.spaNavigateTo('view-drivers');
                    if (window.AegisEngine) window.AegisEngine.renderMitraList('RIDE', window.BAGANTARA_FINAL_PRICE);
                }
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
        });

        window.dispatchEvent(new CustomEvent('wizardState', { detail: 'CALCULATE' }));
    }
};
