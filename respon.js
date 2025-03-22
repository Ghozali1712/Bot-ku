const { tambahData } = require('./barcodev1');
const { cariKodeDiExcelV2: pjr } = require('./barcodev2');
const { processMonitoringPriceTag } = require('./pluProcessor');
const { restartBot } = require('./restartBot');
const { tambahRak, tambahPLUkeRak, getRacks, pilihRak, hapusRak, prosesFormatPengiriman, prosesKirimPDF } = require('./rackManager');
const { proto } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const userState = {};

// Nomor admin dengan format WhatsApp
const ADMIN_NUMBER = "6285733818592@s.whatsapp.net";

// Fungsi untuk mengecek apakah user adalah admin
function isAdmin(userId) {
    return userId === ADMIN_NUMBER;
}

const MENU_TEXT = `📝 *MENU BOT*\n\nSilakan pilih fitur yang ingin digunakan:`;

// Base64 encoded small menu icon
const MENU_ICON = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABQODxIPDRQSEBIXFRQdHx4eHRoaHSQtJSAyVC08MTY3LjIyOkFTRjo6QjoyPkNOREZGS1NMTVlWVV5LWXGEX2n/2wBDARUXFx4aHR4eHUFBQWlra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2v/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

const FITUR_MAPPING = {
    "1": { fitur: "tambah_data", pesan: "✅ Fitur *Tambah Data* berhasil diatur.\n📌 Silakan kirim data sesuai format:\nPLU,BARCODE" },
    "2": { fitur: "pjr", pesan: "✅ Fitur *PJR* berhasil diatur.\n📌 Silakan kirim kode PLU yang ingin dicari barcode-nya." },
    "3": { fitur: "monitoring", pesan: "✅ Fitur *Monitoring Price Tag* berhasil diatur.\n📌 Kirim kode PLU yang ingin diubah jadi gambar." },
    "4": { fitur: "restart", pesan: "" },
    "5": { fitur: "tambah_rak", pesan: "✅ Fitur *Tambah Rak* berhasil diatur.\n📌 Silakan masukkan nama rak:" },
    "6": { fitur: "pilih_rak", pesan: "✅ Fitur *Pilih Rak* berhasil diatur.\n📌 Berikut adalah daftar rak Anda:" },
    "7": { fitur: "scan_banyak", pesan: "✅ Fitur *Scan Banyak* berhasil diatur.\n📌 Silakan kirim data sesuai format:\nPLU,QTY" }
};

// Daftar emoji reaksi dengan animasi
const REACTION_EMOJIS = [
    // Emoji statis
    '👍', '❤️', '😊', '🎉', '✨', '🌟', '💫', '💪', '👏', '🙌',
    '💯', '🔥', '⭐', '💝', '💖', '💕', '💗', '💓', '💞', '💟',
    // Emoji animasi
    '🎨', '🎭', '🎪', '🎯', '🎲', '🎸', '🎺', '🎻', '🎬', '🎮',
    '🎲', '🎯', '🎨', '🎭', '🎪', '🎯', '🎲', '🎸', '🎺', '🎻',
    // Emoji tambahan
    '🎯', '🎲', '🎨', '🎭', '🎪', '🎯', '🎲', '🎸', '🎺', '🎻',
    '🎯', '🎲', '🎨', '🎭', '🎪', '🎯', '🎲', '🎸', '🎺', '🎻'
];

// Fungsi untuk mengirim reaksi acak dengan animasi
async function sendRandomReaction(ptz, chatId, messageId) {
    if (!ptz || !chatId || !messageId) return;
    
    try {
        // Pilih 1 emoji secara acak
        const randomEmoji = REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
        
        // Kirim reaksi
        await ptz.sendMessage(chatId, {
            react: {
                text: randomEmoji,
                key: {
                    remoteJid: chatId,
                    fromMe: false,
                    participant: chatId,
                    id: messageId,
                    participant: chatId
                }
            }
        });

    } catch (error) {
        console.error('❌ Gagal mengirim reaksi:', error);
    }
}

// Fungsi untuk mengirim pesan dengan tombol
async function sendMessageWithButtons(ptz, chatId, message, isAdminUser = false) {
    if (!ptz || !chatId || !message) return;

    try {
        const buttons = [];
        const menuText = message + "\n\n";

        if (isAdminUser) {
            // Menu Admin
            buttons.push(
                { buttonId: 'id1', buttonText: { displayText: '1️⃣ Tambah Data' }, type: 1 },
                { buttonId: 'id2', buttonText: { displayText: '2️⃣ PJR' }, type: 1 },
                { buttonId: 'id3', buttonText: { displayText: '3️⃣ Monitoring Price Tag' }, type: 1 },
                { buttonId: 'id4', buttonText: { displayText: '4️⃣ Restart Bot' }, type: 1 },
                { buttonId: 'id5', buttonText: { displayText: '5️⃣ Tambah Rak' }, type: 1 },
                { buttonId: 'id6', buttonText: { displayText: '6️⃣ Pilih Rak' }, type: 1 },
                { buttonId: 'id7', buttonText: { displayText: '7️⃣ Scan Banyak' }, type: 1 }
            );

            const buttonMessage = {
                text: menuText +
                      `1️⃣ *Tambah Data*\n` +
                      `   _Menambahkan data PLU dan Barcode_\n\n` +
                      `2️⃣ *PJR*\n` +
                      `   _Mencari barcode dari kode PLU_\n\n` +
                      `3️⃣ *Monitoring Price Tag*\n` +
                      `   _Mengubah kode PLU jadi gambar_\n\n` +
                      `4️⃣ *Restart Bot*\n` +
                      `   _Memulai ulang bot_\n\n` +
                      `5️⃣ *Tambah Rak*\n` +
                      `   _Menambahkan rak baru_\n\n` +
                      `6️⃣ *Pilih Rak*\n` +
                      `   _Memilih rak yang tersedia_\n\n` +
                      `7️⃣ *Scan Banyak*\n` +
                      `   _Membuat barcode untuk scan banyak_`,
                footer: '© Bot-ku 2024',
                buttons: buttons,
                headerType: 1
            };

            await ptz.sendMessage(chatId, buttonMessage);
        } else {
            // Menu User
            buttons.push(
                { buttonId: 'id2', buttonText: { displayText: '1️⃣ PJR' }, type: 1 },
                { buttonId: 'id3', buttonText: { displayText: '2️⃣ Monitoring Price Tag' }, type: 1 },
                { buttonId: 'id5', buttonText: { displayText: '3️⃣ Tambah Rak' }, type: 1 },
                { buttonId: 'id6', buttonText: { displayText: '4️⃣ Pilih Rak' }, type: 1 },
                { buttonId: 'id7', buttonText: { displayText: '5️⃣ Scan Banyak' }, type: 1 }
            );

            const buttonMessage = {
                text: menuText +
                      `1️⃣ *PJR*\n` +
                      `   _Mencari barcode dari kode PLU_\n\n` +
                      `2️⃣ *Monitoring Price Tag*\n` +
                      `   _Mengubah kode PLU jadi gambar_\n\n` +
                      `3️⃣ *Tambah Rak*\n` +
                      `   _Menambahkan rak baru_\n\n` +
                      `4️⃣ *Pilih Rak*\n` +
                      `   _Memilih rak yang tersedia_\n\n` +
                      `5️⃣ *Scan Banyak*\n` +
                      `   _Membuat barcode untuk scan banyak_`,
                footer: '© Bot-ku 2024',
                buttons: buttons,
                headerType: 1
            };

            await ptz.sendMessage(chatId, buttonMessage);
        }
    } catch (error) {
        console.error('❌ Gagal mengirim pesan menu:', error);
        // Fallback ke menu teks jika tombol gagal
        const fallbackText = isAdminUser ? 
            message + "\n\n1️⃣ Ketik 1 untuk Tambah Data\n2️⃣ Ketik 2 untuk PJR\n3️⃣ Ketik 3 untuk Monitoring Price Tag\n4️⃣ Ketik 4 untuk Restart Bot\n5️⃣ Ketik 5 untuk Tambah Rak\n6️⃣ Ketik 6 untuk Pilih Rak\n7️⃣ Ketik 7 untuk Scan Banyak" :
            message + "\n\n1️⃣ Ketik 1 untuk PJR\n2️⃣ Ketik 2 untuk Monitoring Price Tag\n3️⃣ Ketik 3 untuk Tambah Rak\n4️⃣ Ketik 4 untuk Pilih Rak\n5️⃣ Ketik 5 untuk Scan Banyak";
        await sendMessage(ptz, chatId, fallbackText);
    }
}

// Fungsi untuk mengirim pesan
async function sendMessage(ptz, chatId, message) {
    if (!ptz || !chatId || !message) return;

    try {
        await ptz.sendMessage(chatId, { text: message });
    } catch (error) {
        console.error('❌ Gagal mengirim pesan:', error);
    }
}

// Fungsi menangani input multi-line untuk Tambah Data
async function handleTambahData(chatId, message, ptz) {
    const entries = message.split('\n').map(line => line.trim()).filter(line => line);

    if (entries.length === 0) {
        const helpMessage = "⚠️ Format input salah.\n\n*Format yang benar:*\nPLU,BARCODE\n\n*Contoh:*\n12345,6789012345678";
        return await sendMessage(ptz, chatId, helpMessage);
    }

    const { berhasilDitambah, gagalDitambah } = tambahData(entries, './barcode.json');

    let responseMessage = "📊 *Hasil Penambahan Data*\n\n";
    if (berhasilDitambah.length) {
        responseMessage += "✅ *Berhasil ditambahkan:*\n" + berhasilDitambah.join('\n') + "\n\n";
    } else {
        responseMessage += "ℹ️ Tidak ada data baru.\n\n";
    }
    
    if (gagalDitambah.length) {
        responseMessage += "⚠️ *Gagal ditambahkan:*\n" + gagalDitambah.join('\n');
    }

    await sendMessage(ptz, chatId, responseMessage);
}

// Fungsi menangani PJR
async function handlePJR(chatId, message, ptz) {
    const kodePLUs = message.split(/[\s,;]+/).filter(kode => /^\d+$/.test(kode));
    if (kodePLUs.length === 0) {
        return await sendMessage(ptz, chatId, "⚠️ Format kode PLU tidak valid. Masukkan angka saja.");
    }

    // Simpan PLUs ke state untuk digunakan nanti
    userState[chatId].pluList = kodePLUs;
    
    // Tampilkan opsi pengiriman
    const optionsMessage = `📋 *Daftar PLU yang akan diproses:*\n${kodePLUs.join(', ')}\n\n*Pilih format pengiriman:*\n*.1* Kirim langsung\n*.2* Kirim sebagai PDF\n\n_Balas dengan .1 atau .2_`;
    userState[chatId].waitingForPJROption = true;
    await sendMessage(ptz, chatId, optionsMessage);
}

// Fungsi menangani Monitoring Price Tag
async function handleMonitoring(chatId, message, ptz) {
    const kodePLUs = message.split(/[\s,;]+/).filter(kode => /^\d+$/.test(kode));
    if (kodePLUs.length === 0) {
        return await sendMessage(ptz, chatId, "⚠️ Format kode PLU tidak valid. Masukkan angka saja.");
    }

    // Simpan PLUs ke state untuk digunakan nanti
    userState[chatId].pluList = kodePLUs;
    
    // Tampilkan opsi pengiriman
    const optionsMessage = `📋 *Daftar PLU yang akan diproses:*\n${kodePLUs.join(', ')}\n\n*Pilih format pengiriman:*\n*.1* Kirim langsung\n*.2* Kirim sebagai PDF\n\n_Balas dengan .1 atau .2_`;
    userState[chatId].waitingForMonitoringOption = true;
    await sendMessage(ptz, chatId, optionsMessage);
}

// Fungsi untuk memproses pilihan format pengiriman PJR
async function handlePJRFormatSelection(chatId, message, ptz) {
    if (!userState[chatId].pluList) {
        return await sendMessage(ptz, chatId, "⚠️ Tidak ada daftar PLU yang akan diproses.");
    }

    const pluList = userState[chatId].pluList;
    delete userState[chatId].waitingForPJROption;
    delete userState[chatId].pluList;

    if (message === '.1') {
        // Kirim langsung
        for (const plu of pluList) {
            await pjr(parseInt(plu, 10), ptz, chatId);
        }
    } else if (message === '.2') {
        // Kirim sebagai PDF
        const selectedRack = {
            nama: 'PJR_Result',
            pluList: pluList
        };
        await prosesKirimPDF(chatId, selectedRack, ptz);
    } else {
        return await sendMessage(ptz, chatId, '⚠️ Pilihan tidak valid. Silakan pilih *.1* untuk kirim langsung atau *.2* untuk kirim PDF.');
    }
}

// Fungsi untuk memproses pilihan format pengiriman Monitoring
async function handleMonitoringFormatSelection(chatId, message, ptz) {
    if (!userState[chatId].pluList) {
        return await sendMessage(ptz, chatId, "⚠️ Tidak ada daftar PLU yang akan diproses.");
    }

    const pluList = userState[chatId].pluList;
    delete userState[chatId].waitingForMonitoringOption;
    delete userState[chatId].pluList;

    if (message === '.1') {
        // Kirim langsung
        for (const plu of pluList) {
            await processMonitoringPriceTag(plu, ptz, chatId);
        }
    } else if (message === '.2') {
        // Kirim sebagai PDF
        const selectedRack = {
            nama: 'Monitoring_Result',
            pluList: pluList
        };
        await prosesKirimPDF(chatId, selectedRack, ptz);
    } else {
        return await sendMessage(ptz, chatId, '⚠️ Pilihan tidak valid. Silakan pilih *.1* untuk kirim langsung atau *.2* untuk kirim PDF.');
    }
}

// Fungsi menangani Tambah Rak
async function handleTambahRak(chatId, message, ptz) {
    // Jika user belum memiliki state tambah_rak
    if (!userState[chatId].currentRack) {
        const result = await tambahRak(chatId, message);
        if (result.success) {
            userState[chatId].currentRack = result.rack.id;
            userState[chatId].status = "menambah_plu";
        }
        return await sendMessage(ptz, chatId, result.message);
    }
    
    // Jika user sedang menambahkan PLU
    if (userState[chatId].status === "menambah_plu") {
        if (message.toLowerCase() === 'selesai') {
            delete userState[chatId].currentRack;
            userState[chatId].status = "menu";
            return await sendMessageWithButtons(ptz, chatId, "✅ Selesai menambahkan PLU ke rak.\n\n" + MENU_TEXT);
        }

        const result = await tambahPLUkeRak(chatId, userState[chatId].currentRack, message);
        return await sendMessage(ptz, chatId, result.message);
    }
}

// Fungsi menangani Pilih Rak
async function handlePilihRak(chatId, message, ptz) {
    // Jika user sedang menunggu pilihan format
    if (userState[chatId].waitingForOption && userState[chatId].selectedRack) {
        if (message === '.1' || message === '.2') {
            const option = message.replace('.', ''); // Hapus titik untuk mendapatkan angka saja
            const result = await prosesFormatPengiriman(chatId, userState[chatId].selectedRack, option, ptz);
            // Reset state setelah selesai
            delete userState[chatId].waitingForOption;
            delete userState[chatId].selectedRack;
            return await sendMessage(ptz, chatId, result.message);
        } else {
            return await sendMessage(ptz, chatId, '⚠️ Pilihan tidak valid. Silakan pilih *.1* untuk kirim langsung atau *.2* untuk kirim PDF.');
        }
    }

    // Jika perintah list, tampilkan daftar rak
    if (message.toLowerCase() === 'list') {
        const result = await getRacks(chatId);
        return await sendMessage(ptz, chatId, result.message);
    }

    // Jika perintah hapus rak
    if (message.toLowerCase().startsWith('hapus#')) {
        const namaRak = message.split('#')[1];
        if (!namaRak) {
            return await sendMessage(ptz, chatId, '⚠️ Format salah. Gunakan format: *hapus#NAMA_RAK*');
        }
        const result = await hapusRak(chatId, namaRak);
        if (result.success) {
            // Tampilkan daftar rak setelah menghapus
            const rackList = await getRacks(chatId);
            return await sendMessage(ptz, chatId, result.message + '\n\n' + (rackList.success ? rackList.message : ''));
        }
        return await sendMessage(ptz, chatId, result.message);
    }

    // Jika memilih rak untuk melihat isi
    const result = await pilihRak(chatId, message, ptz);
    if (result.success && result.waitingForOption) {
        // Simpan state untuk menunggu pilihan format
        userState[chatId].waitingForOption = true;
        userState[chatId].selectedRack = result.rack;
    }
    if (result.message) {
        return await sendMessage(ptz, chatId, result.message);
    }
}

// Fungsi untuk menangani scan banyak
async function handleScanBanyak(chatId, message, ptz) {
    // Format yang diharapkan: PLU,QTY
    const parts = message.split(',');
    if (parts.length !== 2) {
        return await sendMessage(ptz, chatId, "⚠️ Format tidak valid. Gunakan format: PLU,QTY\nContoh: 12345,5");
    }

    const [plu, qty] = parts;
    
    // Validasi input
    if (!/^\d+$/.test(plu) || !/^\d+$/.test(qty)) {
        return await sendMessage(ptz, chatId, "⚠️ Format tidak valid. PLU dan QTY harus berupa angka");
    }

    try {
        // Buat barcode dengan format B/PLU/00/QTY
        const barcodeData = `B${plu}00${qty}`;
        
        // Kirim ke worker thread dengan type 'bulk'
        const { Worker } = require('worker_threads');
        const worker = new Worker('./worker.js');
        
        worker.postMessage({ data: barcodeData, type: 'bulk' });
        
        worker.on('message', async (result) => {
            if (result.success) {
                // Simpan buffer ke file sementara
                const fs = require('fs');
                const path = require('path');
                const tempPath = path.join(__dirname, 'temp_barcode.png');
                
                try {
                    fs.writeFileSync(tempPath, result.buffer);
                    
                    // Kirim gambar dari file
                    await ptz.sendMessage(chatId, {
                        image: fs.readFileSync(tempPath),
                        caption: `✅ Barcode untuk PLU: ${plu} dengan QTY: ${qty}`
                    });
                    
                    // Hapus file sementara
                    fs.unlinkSync(tempPath);
                } catch (error) {
                    console.error('Error handling image:', error);
                    await sendMessage(ptz, chatId, `❌ Gagal mengirim gambar: ${error.message}`);
                }
            } else {
                await sendMessage(ptz, chatId, `❌ Gagal membuat barcode: ${result.error}`);
            }
            worker.terminate();
        });
        
        worker.on('error', async (error) => {
            await sendMessage(ptz, chatId, `❌ Terjadi kesalahan: ${error.message}`);
            worker.terminate();
        });
    } catch (error) {
        await sendMessage(ptz, chatId, `❌ Terjadi kesalahan: ${error.message}`);
    }
}

// Fungsi memproses pesan masuk
async function processMessage(mek, ptz) {
    const chatId = mek.key.remoteJid;
    const userId = mek.key.participant || chatId;
    let message = '';

    if (mek.message?.conversation) {
        message = mek.message.conversation.trim();
    } else if (mek.message?.buttonsResponseMessage) {
        const buttonId = mek.message.buttonsResponseMessage.selectedButtonId;
        message = buttonId?.replace('id', '') || '';
    }

    if (!message) return;

    // Kirim reaksi acak ke pesan user
    try {
        await sendRandomReaction(ptz, chatId, mek.key.id);
    } catch (error) {
        console.error('❌ Gagal mengirim reaksi:', error);
    }

    const isMenuCommand = ["start", "menu", "/start", "/menu", "📝 *MENU BOT*"].includes(message.toLowerCase());
    const isAdminUser = isAdmin(userId);

    try {
        if (isMenuCommand) {
            userState[chatId] = { status: "menu", isAdmin: isAdminUser };
            return await sendMessageWithButtons(ptz, chatId, MENU_TEXT, isAdminUser);
        }

        // Jika tidak ada state, tampilkan menu
        if (!userState[chatId]) {
            userState[chatId] = { status: "menu", isAdmin: isAdminUser };
            return await sendMessageWithButtons(ptz, chatId, MENU_TEXT, isAdminUser);
        }

        // Handle menu selection
        let selectedFeature;
        if (isAdminUser) {
            // Mapping untuk admin
            selectedFeature = Object.entries(FITUR_MAPPING).find(([key, value]) => 
                message === key || message === value.fitur || message === `id${key}`
            );
        } else {
            // Mapping untuk user biasa
            const userMapping = {
                "1": FITUR_MAPPING["2"], // PJR
                "2": FITUR_MAPPING["3"], // Monitoring
                "3": FITUR_MAPPING["5"], // Tambah Rak
                "4": FITUR_MAPPING["6"],  // Pilih Rak
                "5": FITUR_MAPPING["7"]   // Scan Banyak
            };
            selectedFeature = Object.entries(userMapping).find(([key, value]) => 
                message === key || message === value.fitur || message === `id${key}`
            );
        }

        if (selectedFeature) {
            const [key, value] = selectedFeature;
            
            // Cek akses admin untuk fitur tertentu
            if ((value.fitur === "restart" || value.fitur === "tambah_data") && !isAdminUser) {
                return await sendMessage(ptz, chatId, "⚠️ Maaf, fitur ini hanya tersedia untuk admin.");
            }
            
            if (value.fitur === "restart") {
                return await restartBot(ptz, chatId);
            }

            if (value.fitur === "pilih_rak") {
                userState[chatId] = { fitur: value.fitur, status: "siap", isAdmin: isAdminUser };
                const rackList = await getRacks(chatId);
                return await sendMessage(ptz, chatId, rackList.message);
            }

            userState[chatId] = { fitur: value.fitur, status: "siap", isAdmin: isAdminUser };
            return await sendMessage(ptz, chatId, value.pesan);
        }

        // Handle feature-specific actions
        if (userState[chatId].status === "siap" || userState[chatId].status === "menambah_plu") {
            if (userState[chatId].waitingForPJROption) {
                return await handlePJRFormatSelection(chatId, message, ptz);
            }
            if (userState[chatId].waitingForMonitoringOption) {
                return await handleMonitoringFormatSelection(chatId, message, ptz);
            }
            switch (userState[chatId].fitur) {
                case "tambah_data":
                    if (!isAdminUser) {
                        return await sendMessage(ptz, chatId, "⚠️ Maaf, fitur ini hanya tersedia untuk admin.");
                    }
                    return await handleTambahData(chatId, message, ptz);
                case "pjr":
                    return await handlePJR(chatId, message, ptz);
                case "monitoring":
                    return await handleMonitoring(chatId, message, ptz);
                case "tambah_rak":
                    return await handleTambahRak(chatId, message, ptz);
                case "pilih_rak":
                    return await handlePilihRak(chatId, message, ptz);
                case "scan_banyak":
                    return await handleScanBanyak(chatId, message, ptz);
                default:
                    userState[chatId] = { status: "menu", isAdmin: isAdminUser };
                    return await sendMessageWithButtons(ptz, chatId, "⚠️ Fitur tidak dikenali.\n\n" + MENU_TEXT, isAdminUser);
            }
        }

        // Default fallback to menu
        userState[chatId] = { status: "menu", isAdmin: isAdminUser };
        return await sendMessageWithButtons(ptz, chatId, "⚠️ Pilihan tidak valid.\n\n" + MENU_TEXT, isAdminUser);

    } catch (error) {
        console.error('❌ Error di processMessage:', error);
        await sendMessage(ptz, chatId, "⚠️ Terjadi kesalahan dalam memproses permintaan Anda. Ketik 'menu' untuk kembali ke menu utama.");
    }
}

module.exports = { processMessage };
