// ==========================================
// MANAJER UI PUSAT (ALERT, PWA, & SEARCH UI DOM)
// ==========================================

window.UIManager = {
    // 1. MESIN TEMPLATE RENDERER (PENCARIAN ALAMAT)
    renderSearchResults: function(containerId, features, onSelectCallback) {
        const container = document.getElementById(containerId);
        const template = document.getElementById('tpl-search-result');
        if (!container || !template) return;

        container.innerHTML = '';
        if (features.length === 0) {
            container.innerHTML = `
                <div class="text-center" style="padding: 15px;">
                    <i class="fa-solid fa-map-location-dot mb-2 text-xl" style="color: #ef4444;"></i>
                    <div class="text-xs text-muted" style="line-height: 1.4;">Alamat tidak terdeteksi.<br>Gunakan opsi <b>Pilih lewat peta</b>.</div>
                </div>`;
            container.classList.remove('hidden');
            return;
        }

        features.forEach(item => {
            const props = item.properties;
            const lat = item.geometry.coordinates[1];
            const lon = item.geometry.coordinates[0];
            
            const title = props.name || props.street || props.city || "Lokasi Tak Bernama";
            const subtitle = [props.city, props.state, props.country].filter(Boolean).join(', ');

            const clone = template.content.cloneNode(true);
            const wrapper = clone.querySelector('.search-result-item');
            
            clone.querySelector('.tpl-title').textContent = title;
            clone.querySelector('.tpl-subtitle').textContent = subtitle.substring(0, 40) + '...';
            
            wrapper.addEventListener('click', () => {
                container.classList.add('hidden');
                if (typeof onSelectCallback === 'function') onSelectCallback(title, lat, lon);
            });
            
            container.appendChild(clone);
        });
        container.classList.remove('hidden');
    },

    // 2. MESIN TEMPLATE RENDERER (MULTI-STOP)
    stopCount: 1,
    addMultiStop: function(routeInputsAreaId, btnAddStopId, unlockCallback, mapTriggerCallback, removeCallback) {
        if (this.stopCount >= 3) return;
        this.stopCount++;
        const currentCount = this.stopCount;
        
        const container = document.getElementById(routeInputsAreaId);
        const template = document.getElementById('tpl-multi-stop');
        const btnAdd = document.getElementById(btnAddStopId);
        if (!container || !template) return;

        const clone = template.content.cloneNode(true);
        const row = clone.querySelector('.route-row-inline');
        row.id = `rowDropoff${currentCount}`;

        const input = clone.querySelector('.tpl-input');
        input.id = `inputSearchDropoff${currentCount}`;
        input.setAttribute('data-index', currentCount);
        
        const btnClear = clone.querySelector('.tpl-btn-clear');
        btnClear.addEventListener('click', (e) => {
            e.preventDefault();
            if(unlockCallback) unlockCallback(input.id);
        });

        const btnMap = clone.querySelector('.tpl-btn-map');
        btnMap.addEventListener('click', () => mapTriggerCallback(currentCount));

        const btnRemove = clone.querySelector('.tpl-btn-remove');
        btnRemove.addEventListener('click', () => {
            row.remove();
            this.stopCount--;
            if(btnAdd) btnAdd.style.display = 'flex';
            if(removeCallback) removeCallback(currentCount);
        });

        container.appendChild(clone);
        if (this.stopCount >= 3 && btnAdd) btnAdd.style.display = 'none';
        
        return input; // Mengembalikan input untuk dipasang event listener search di Flow Engine
    },

    // 3. SISTEM GEMBOK INPUT (LOCK FIELD)
    checkFormReady: function() {
        const btn = document.getElementById('stickyContinueArea');
        const drop1 = document.getElementById('inputSearchDropoff1');
        const pickup = document.getElementById('inputSearchPickup');
        if (btn && drop1 && pickup) {
            if (drop1.hasAttribute('readonly') && pickup.hasAttribute('readonly')) {
                btn.classList.remove('hidden');
            } else {
                btn.classList.add('hidden');
            }
        }
    },

    lockSearchField: function(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        input.setAttribute('readonly', 'true');
        input.style.color = 'var(--text-main)';
        input.style.fontWeight = 'bold';
        
        const iconContainer = input.closest('.route-row-inline').querySelector('.icon-point i');
        if (iconContainer) {
            if (!input.dataset.origIcon) input.dataset.origIcon = iconContainer.className;
            if (inputId === 'inputSearchPickup') {
                iconContainer.className = 'fa-solid fa-arrow-up';
                iconContainer.style.color = 'var(--neon-green)';
            } else {
                iconContainer.className = 'fa-solid fa-arrow-down';
                iconContainer.style.color = '#ef4444';
            }
        }
        
        const clearBtn = input.nextElementSibling;
        if (clearBtn && clearBtn.classList.contains('btn-clear-input')) clearBtn.style.display = 'block';
        this.checkFormReady();
    },

    unlockSearchField: function(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        input.removeAttribute('readonly');
        input.value = '';
        input.style.color = '';
        input.style.fontWeight = '';
        
        const iconContainer = input.closest('.route-row-inline').querySelector('.icon-point i');
        if (iconContainer && input.dataset.origIcon) iconContainer.className = input.dataset.origIcon;
        
        const clearBtn = input.nextElementSibling;
        if (clearBtn) clearBtn.style.display = 'none';
        
        // Membersihkan Memory Koordinat
        if (inputId === 'inputSearchPickup') window.BAGANTARA_PICKUP_COORD = null;
        else if (inputId === 'inputSearchDropoff1') {
            window.BAGANTARA_DROPOFF_COORD = null;
            if (window.BAGANTARA_MULTI_DROPOFFS) window.BAGANTARA_MULTI_DROPOFFS[0] = null;
        } else {
            const idx = parseInt(input.getAttribute('data-index')) - 1;
            if (window.BAGANTARA_MULTI_DROPOFFS) window.BAGANTARA_MULTI_DROPOFFS[idx] = null;
        }
        
        this.checkFormReady();
        input.focus();
    },

    // 4. PEMUSNAHAN ALERT & KONTROL HEADER BAWAAN PERANGKAT
    initGlobalControls: function() {
        window.alert = function(message) {
            const alertBox = document.getElementById('cyber-alert');
            const alertMsg = document.getElementById('cyber-alert-msg');
            if (alertBox && alertMsg) {
                alertMsg.innerHTML = message; // Alert teks sistem diperbolehkan (bukan struktur HTML utama)
                alertBox.classList.remove('hidden');
            }
        };

        const closeAlertBtn = document.getElementById('btn-close-alert');
        if (closeAlertBtn) closeAlertBtn.addEventListener('click', () => document.getElementById('cyber-alert').classList.add('hidden'));

        // Header Transparan saat Peta Digeser
        const header = document.getElementById('mainHeader');
        window.addEventListener('mapIsMoving', () => { if (header) header.style.transform = 'translateY(-150%)'; });
        window.addEventListener('mapStopped', () => { if (header) header.style.transform = 'translateY(0)'; });

        // Pengaman Keyboard Virtual Inline Notes
        const inputInlineNotes = document.getElementById('inputInlineNotes');
        if (inputInlineNotes) {
            inputInlineNotes.addEventListener('focus', () => {
                setTimeout(() => inputInlineNotes.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
            });
            inputInlineNotes.addEventListener('blur', () => window.scrollTo(0, 0));
        }

        // Ekspansi Layar Dua Tahap (Two-Step Form)
        const inputSearchDropoff1 = document.getElementById('inputSearchDropoff1');
        const viewSearchRoute = document.getElementById('view-search-route');
        if (inputSearchDropoff1 && viewSearchRoute) {
            inputSearchDropoff1.addEventListener('focus', () => {
                if (viewSearchRoute.classList.contains('compact-mode')) {
                    viewSearchRoute.classList.remove('compact-mode');
                    viewSearchRoute.classList.add('expanded-mode');
                }
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.UIManager.initGlobalControls();
    
    // Inisiasi Tombol Bersihkan Bawaan
    document.querySelectorAll('.btn-clear-input').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const inputTarget = this.previousElementSibling;
            if (inputTarget) window.UIManager.unlockSearchField(inputTarget.id);
        });
    });
});
