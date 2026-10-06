// ==========================================
// FILE: /js/utils/chat-trigger.js
// FUNGSI: Pemicu Penyerahan Bidding ke Modul Chat Handshake
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const btnSubmitClient = document.getElementById('btnSubmitClient');
    const btnCancelClient = document.getElementById('btnCancelClient');
    const clientFormOverlay = document.getElementById('client-form-overlay');

    if (btnCancelClient) {
        btnCancelClient.addEventListener('click', () => {
            if (clientFormOverlay) clientFormOverlay.classList.add('hidden');
        });
    }

    // --- SMART TIP ENGINE: LOGIKA INTERAKSI ---
    let nominalTipTerpilih = 0;
    const tipChips = document.querySelectorAll('.btn-tip-chip');
    const inputTipCustom = document.getElementById('inputTipCustom');

    function resetTipChips() {
        tipChips.forEach(chip => {
            chip.style.background = 'var(--card-bg-2)';
            chip.style.borderColor = 'var(--border-cyber)';
            chip.style.color = 'var(--text-main)';
        });
    }

    tipChips.forEach(chip => {
        chip.addEventListener('click', function() {
            if (this.style.color === 'var(--neon-gold)') {
                resetTipChips();
                nominalTipTerpilih = 0;
            } else {
                resetTipChips();
                this.style.background = 'rgba(212, 175, 55, 0.15)';
                this.style.borderColor = 'var(--neon-gold)';
                this.style.color = 'var(--neon-gold)';
                nominalTipTerpilih = parseInt(this.getAttribute('data-tip')) || 0;
                if (inputTipCustom) inputTipCustom.value = ''; 
            }
        });
    });

    if (inputTipCustom) {
        inputTipCustom.addEventListener('input', function() {
            resetTipChips();
            nominalTipTerpilih = parseInt(this.value) || 0;
        });
    }
    // ------------------------------------------

    if (btnSubmitClient) {
        btnSubmitClient.addEventListener('click', () => {
            const cName = document.getElementById('inputClientName').value.trim();
            const cWA = document.getElementById('inputClientWA').value.trim();

            if (cName.length < 3 || cWA.length < 9) {
                if (window.UIManager && window.UIManager.alert) {
                    window.UIManager.alert("Harap lengkapi Nama dan Nomor WhatsApp yang valid.");
                } else {
                    alert("Harap lengkapi Nama dan Nomor WhatsApp yang valid.");
                }
                return;
            }

            if (clientFormOverlay) clientFormOverlay.classList.add('hidden');
            
            const jastipInput = document.getElementById('inputJastipValue');
            window.BAGANTARA_JASTIP_VALUE = jastipInput ? (parseInt(jastipInput.value) || 0) : 0;
            
            // Ekstraksi Catatan & Kalkulasi Total Harga + Tip
            const catatanInput = document.getElementById('inputCatatanDriver');
            const teksCatatan = catatanInput ? catatanInput.value.trim() : "";
            
            const hargaAsli = window.BAGANTARA_FINAL_PRICE || 0;
            const hargaTawaranAkhir = hargaAsli + nominalTipTerpilih;

            // Merakit Payload Tiket Klien (Format Baru)
            const payloadTiket = {
                nama_klien: cName,
                wa_klien: cWA,
                catatan_tambahan: teksCatatan,
                tip_nominal: nominalTipTerpilih,
                layanan: window.BAGANTARA_SERVICE || 'RIDE',
                jarak_km: window.BAGANTARA_DISTANCE_KM || 0,
                harga_tawaran: hargaTawaranAkhir,
                harga_dasar: hargaAsli,
                pickup_coord: window.BAGANTARA_PICKUP_COORD || '',
                dropoff_coord: window.BAGANTARA_DROPOFF_COORD || '',
                belanjaan: window.BAGANTARA_SERVICE === 'JASTIP' ? (window.BAGANTARA_JASTIP_ITEMS || []) : null
            };

            // Validasi Eksekusi ke Modul Chat Handshake
            if (window.BAGANTARA_DRIVER && window.BAGANTARA_DRIVER.uid) {
                // 1. Kloning dan Tampilkan Template Chat ke Layar
                if (!document.getElementById('panel-komunikasi-utama')) {
                    const templateChat = document.getElementById('tpl-chat-panel');
                    const appContainer = document.getElementById('app-container') || document.body;
                    if (templateChat) {
                        const clone = templateChat.content.cloneNode(true);
                        appContainer.appendChild(clone);
                        
                        // Fungsi dasar menutup chat
                        const btnTutup = document.querySelector('.tpl-btn-tutup');
                        if (btnTutup) {
                            btnTutup.addEventListener('click', () => {
                                document.getElementById('panel-komunikasi-utama').remove();
                            });
                        }
                    }
                }

                // 2. Teruskan Data ke Modul ES6 (Jika terekspos)
                if (window.ChatHandshake && typeof window.ChatHandshake.ajukanTawaran === 'function') {
                    window.ChatHandshake.ajukanTawaran(window.BAGANTARA_DRIVER.uid, payloadTiket);
                } else {
                    console.warn("Fungsi window.ChatHandshake belum tersedia, namun UI chat berhasil dimunculkan.");
                }
            } else {
                if (window.UIManager && window.UIManager.alert) {
                    window.UIManager.alert("Silakan pilih pengemudi terlebih dahulu (UID tidak ditemukan).");
                } else {
                    alert("Silakan pilih pengemudi terlebih dahulu (UID tidak ditemukan).");
                }
            }
        });
    }
});
