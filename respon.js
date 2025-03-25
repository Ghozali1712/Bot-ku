const { tambahData } = require('./barcodev1');
const { cariKodeDiExcelV2: pjr } = require('./barcodev2');
const { processMonitoringPriceTag } = require('./pluProcessor');
const { restartBot } = require('./restartBot');
const { tambahRak, tambahPLUkeRak, getRacks, pilihRak, hapusRak, prosesFormatPengiriman, prosesKirimPDF, sendAdminNotification, racks } = require('./rackManager');
const { generateBarcodePDF } = require('./pdfGenerator');
const { sendMessage } = require('./messageUtils');
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
const MENU_ICON = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABQODxIPDRQSEBIXFRQdHx4eHRoaHSQtJSAyVC08MTY3LjIyOkFTRjo6QjoyPkNOREZGS1NMTVlWVV5LWXGEX2n/2wBDARUXFx4aHR4eHUFBQWlra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2v/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

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
        const notFoundPLUs = [];
        const foundPLUs = [];

        for (const plu of pluList) {
            const result = await pjr(parseInt(plu, 10), ptz, chatId);
            if (result && result.success) {
                foundPLUs.push(plu);
            } else {
                notFoundPLUs.push(plu);
            }
        }

        // Kirim laporan ke admin jika ada PLU yang tidak ditemukan
        if (notFoundPLUs.length > 0) {
            const adminReport = `📊 *Laporan PLU Tidak Ditemukan (PJR)*\n\n` +
                `👤 User: ${chatId}\n` +
                `❌ PLU Tidak Ditemukan: ${notFoundPLUs.join(', ')}\n` +
                `✅ PLU Ditemukan: ${foundPLUs.length}\n` +
                `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}\n` +
                `📄 Total PLU: ${pluList.length}\n` +
                `📈 Persentase Gagal: ${((notFoundPLUs.length / pluList.length) * 100).toFixed(1)}%`;

            await sendAdminNotification(ptz, adminReport);
        }

        // Kirim ringkasan ke user
        const userReport = `📊 *Ringkasan Hasil PJR*\n\n` +
            `✅ PLU Ditemukan: ${foundPLUs.length}\n` +
            `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}\n` +
            `📄 Total PLU: ${pluList.length}\n` +
            `📈 Persentase Berhasil: ${((foundPLUs.length / pluList.length) * 100).toFixed(1)}%`;

        await sendMessage(ptz, chatId, userReport);
    } else if (message === '.2') {
        try {
            // Kirim pesan status awal
            await sendMessage(ptz, chatId, "⏳ Sedang memproses PDF...");

            // Kirim sebagai PDF
            const buffers = [];
            const notFoundPLUs = [];
            const foundPLUs = [];

            // Proses setiap PLU
            for (const plu of pluList) {
                try {
                    console.log(`[PJR] Processing PLU: ${plu}`);
                    const result = await pjr(parseInt(plu, 10), ptz, chatId, true);
                    
                    if (result && result.success && result.buffer) {
                        console.log(`[PJR] PLU ${plu} found, buffer size: ${result.buffer.length} bytes`);
                        foundPLUs.push(plu);
                        
                        // Pastikan buffer adalah Buffer
                        let validBuffer;
                        if (Buffer.isBuffer(result.buffer)) {
                            validBuffer = result.buffer;
                        } else if (typeof result.buffer === 'string') {
                            validBuffer = Buffer.from(result.buffer, 'base64');
                        } else {
                            console.error(`[PJR] Invalid buffer type for PLU ${plu}`);
                            notFoundPLUs.push(plu);
                            continue;
                        }

                        // Validasi ukuran buffer
                        if (validBuffer.length === 0) {
                            console.error(`[PJR] Empty buffer for PLU ${plu}`);
                            notFoundPLUs.push(plu);
                            continue;
                        }

                        buffers.push(validBuffer);
                        console.log(`[PJR] Added valid buffer for PLU ${plu}`);
                    } else {
                        console.log(`[PJR] PLU ${plu} not found or invalid result`);
                        notFoundPLUs.push(plu);
                    }
                } catch (error) {
                    console.error(`[PJR] Error processing PLU ${plu}:`, error);
                    notFoundPLUs.push(plu);
                }
            }

            if (buffers.length === 0) {
                console.log('[PJR] No valid buffers to create PDF');
                await sendMessage(ptz, chatId, "❌ Tidak ada barcode valid untuk dibuat PDF.");
                return;
            }

            console.log(`[PJR] Found ${buffers.length} valid buffers`);

            // Update status
            await sendMessage(ptz, chatId, "📦 Mengumpulkan barcode...");

            // Buat direktori output jika belum ada
            const outputDir = path.join(__dirname, 'output');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Update status
            await sendMessage(ptz, chatId, "📄 Membuat PDF...");

            // Generate PDF
            const pdfFileName = `PJR_${Date.now()}.pdf`;
            const outputPath = path.join(outputDir, pdfFileName);
            await generateBarcodePDF(buffers, outputPath);

            // Update status
            await sendMessage(ptz, chatId, "📤 Mengirim PDF...");

            // Tunggu sebentar untuk memastikan file sudah dibuat
            await new Promise(resolve => setTimeout(resolve, 2000));

            try {
                // Kirim PDF
                await ptz.sendMessage(chatId, {
                    document: fs.readFileSync(outputPath),
                    fileName: pdfFileName,
                    mimetype: 'application/pdf'
                });

                // Hapus file PDF setelah terkirim
                fs.unlinkSync(outputPath);

                // Kirim ringkasan hasil
                let summaryMessage = `📊 *Ringkasan Hasil PJR (PDF)*\n\n` +
                    `✅ PLU Ditemukan: ${foundPLUs.length}\n` +
                    `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}\n` +
                    `📄 Total PLU: ${pluList.length}\n` +
                    `📈 Persentase Berhasil: ${((foundPLUs.length / pluList.length) * 100).toFixed(1)}%`;

                if (notFoundPLUs.length > 0) {
                    summaryMessage += `\n\n⚠️ *PLU Tidak Ditemukan:*\n${notFoundPLUs.join(', ')}`;
                }

                await sendMessage(ptz, chatId, summaryMessage);

                // Kirim laporan ke admin jika ada PLU yang tidak ditemukan
                if (notFoundPLUs.length > 0) {
                    const adminReport = `📊 *Laporan PLU Tidak Ditemukan (PJR PDF)*\n\n` +
                        `👤 User: ${chatId}\n` +
                        `❌ PLU Tidak Ditemukan: ${notFoundPLUs.join(', ')}\n` +
                        `✅ PLU Ditemukan: ${foundPLUs.length}\n` +
                        `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}\n` +
                        `📄 Total PLU: ${pluList.length}\n` +
                        `📈 Persentase Gagal: ${((notFoundPLUs.length / pluList.length) * 100).toFixed(1)}%`;

                    await sendAdminNotification(ptz, adminReport);
                }
            } catch (error) {
                console.error('[PJR] Error sending PDF:', error);
                await sendMessage(ptz, chatId, "❌ Terjadi kesalahan saat mengirim PDF. Silakan coba lagi.");
            }
        } catch (error) {
            console.error('[PJR] Error in PDF processing:', error);
            await sendMessage(ptz, chatId, "❌ Terjadi kesalahan saat memproses PDF. Silakan coba lagi.");
        }
    } else {
        await sendMessage(ptz, chatId, "⚠️ Pilihan tidak valid. Silakan pilih .1 atau .2");
    }
}

// Fungsi untuk memproses pilihan format pengiriman Monitoring
async function handleMonitoringFormatSelection(chatId, message, pluList, ptz) {
    try {
        if (message === '.1') {
            // Kirim langsung
            let foundPLUs = [];
            let notFoundPLUs = [];
            
            for (const plu of pluList) {
                const result = await pjr(parseInt(plu, 10), ptz, chatId, true);
                if (result && result.success && result.buffer) {
                    foundPLUs.push(plu);
                    await ptz.sendMessage(chatId, { photo: result.buffer });
                } else {
                    notFoundPLUs.push(plu);
                }
            }

            // Kirim ringkasan hasil
            let summaryMessage = `📊 *Ringkasan Hasil Monitoring Price Tag*\n\n` +
                `✅ PLU Ditemukan: ${foundPLUs.length}\n` +
                `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}\n` +
                `📄 Total PLU: ${pluList.length}\n` +
                `📈 Persentase Berhasil: ${((foundPLUs.length / pluList.length) * 100).toFixed(1)}%`;

            if (notFoundPLUs.length > 0) {
                summaryMessage += `\n\n⚠️ *PLU Tidak Ditemukan:*\n${notFoundPLUs.join(', ')}`;
            }

            await sendMessage(ptz, chatId, summaryMessage);

            // Kirim laporan ke admin jika ada PLU yang tidak ditemukan
            if (notFoundPLUs.length > 0) {
                let adminReport = `📊 *Laporan PLU Tidak Ditemukan (Monitoring Price Tag)*\n\n` +
                    `👤 User: ${chatId}\n` +
                    `❌ PLU Tidak Ditemukan: ${notFoundPLUs.join(', ')}\n` +
                    `✅ PLU Ditemukan: ${foundPLUs.length}\n` +
                    `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}\n` +
                    `📄 Total PLU: ${pluList.length}\n` +
                    `📈 Persentase Gagal: ${((notFoundPLUs.length / pluList.length) * 100).toFixed(1)}%`;

                await sendAdminNotification(ptz, adminReport);
            }
        } else if (message === '.2') {
            try {
                // Kirim pesan status awal
                await sendMessage(ptz, chatId, "⏳ Sedang memproses PDF...");

                // Kirim sebagai PDF
                let foundPLUs = [];
                let notFoundPLUs = [];
                let validBuffers = [];

                // Proses setiap PLU
                for (const plu of pluList) {
                    try {
                        const result = await pjr(parseInt(plu, 10), ptz, chatId, true);
                        if (result && result.success && result.buffer) {
                            foundPLUs.push(plu);
                            // Pastikan buffer adalah Buffer
                            const buffer = Buffer.isBuffer(result.buffer) ? result.buffer : Buffer.from(result.buffer);
                            validBuffers.push(buffer);
                        } else {
                            notFoundPLUs.push(plu);
                        }
                    } catch (error) {
                        console.error(`Error processing PLU ${plu}:`, error);
                        notFoundPLUs.push(plu);
                    }
                }

                if (validBuffers.length === 0) {
                    await sendMessage(ptz, chatId, "❌ Tidak ada barcode valid untuk dibuat PDF.");
                    return;
                }

                // Update status
                await sendMessage(ptz, chatId, "📦 Mengumpulkan barcode...");

                // Buat direktori output jika belum ada
                const outputDir = path.join(__dirname, 'output');
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                // Update status
                await sendMessage(ptz, chatId, "📄 Membuat PDF...");

                // Generate PDF
                const outputPath = path.join(outputDir, `Monitoring_${Date.now()}.pdf`);
                await generateBarcodePDF(validBuffers, outputPath);

                // Update status
                await sendMessage(ptz, chatId, "📤 Mengirim PDF...");

                // Tunggu sebentar untuk memastikan file sudah dibuat
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Kirim PDF
                await ptz.sendMessage(chatId, {
                    document: fs.readFileSync(outputPath),
                    fileName: `Monitoring_${Date.now()}.pdf`,
                    mimetype: 'application/pdf'
                });

                // Hapus file PDF setelah terkirim
                fs.unlinkSync(outputPath);

                // Kirim ringkasan hasil
                let summaryMessage = `📊 *Ringkasan Hasil Monitoring Price Tag (PDF)*\n\n` +
                    `✅ PLU Ditemukan: ${foundPLUs.length}\n` +
                    `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}\n` +
                    `📄 Total PLU: ${pluList.length}\n` +
                    `📈 Persentase Berhasil: ${((foundPLUs.length / pluList.length) * 100).toFixed(1)}%`;

                if (notFoundPLUs.length > 0) {
                    summaryMessage += `\n\n⚠️ *PLU Tidak Ditemukan:*\n${notFoundPLUs.join(', ')}`;
                }

                await sendMessage(ptz, chatId, summaryMessage);

                // Kirim laporan ke admin jika ada PLU yang tidak ditemukan
                if (notFoundPLUs.length > 0) {
                    let adminReport = `📊 *Laporan PLU Tidak Ditemukan (Monitoring Price Tag PDF)*\n\n` +
                        `👤 User: ${chatId}\n` +
                        `❌ PLU Tidak Ditemukan: ${notFoundPLUs.join(', ')}\n` +
                        `✅ PLU Ditemukan: ${foundPLUs.length}\n` +
                        `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}\n` +
                        `📄 Total PLU: ${pluList.length}\n` +
                        `📈 Persentase Gagal: ${((notFoundPLUs.length / pluList.length) * 100).toFixed(1)}%`;

                        await sendAdminNotification(ptz, adminReport);
                }
            } catch (error) {
                console.error('Error in PDF processing:', error);
                await sendMessage(ptz, chatId, "❌ Terjadi kesalahan saat memproses PDF. Silakan coba lagi.");
            }
        } else {
            await sendMessage(ptz, chatId, "⚠️ Pilihan tidak valid. Silakan pilih .1 atau .2");
        }
    } catch (error) {
        console.error('Error in handleMonitoringFormatSelection:', error);
        await sendMessage(ptz, chatId, "❌ Terjadi kesalahan saat memproses format pengiriman.");
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
    try {
        // Dapatkan daftar rak untuk user ini
        const userRacks = racks[chatId] || [];
        
        if (userRacks.length === 0) {
            return await sendMessage(ptz, chatId, "❌ Anda belum memiliki rak. Silakan tambah rak terlebih dahulu.");
        }

        const selectedRack = userRacks.find(rack => rack.nama === message);
        if (!selectedRack) {
            return await sendMessage(ptz, chatId, "❌ Rak tidak ditemukan. Silakan pilih rak yang tersedia.");
        }

        // Tampilkan daftar PLU dan pilihan format pengiriman
        const optionsMessage = `📋 *Daftar PLU yang akan diproses:*\n${selectedRack.pluList.join(', ')}\n\n` +
                             `*Pilih format pengiriman:*\n` +
                             `*.1* Kirim langsung\n` +
                             `*.2* Kirim sebagai PDF\n\n` +
                             `_Balas dengan .1 atau .2_`;

        await sendMessage(ptz, chatId, optionsMessage);

        // Simpan rak yang dipilih ke state user
        userState[chatId] = {
            ...userState[chatId],
            selectedRack: selectedRack,
            waitingForFormatSelection: true
        };
    } catch (error) {
        console.error('Error di handlePilihRak:', error);
        await sendMessage(ptz, chatId, "❌ Terjadi kesalahan saat memilih rak. Silakan coba lagi.");
    }
}

// Fungsi untuk menangani callback query dari tombol format pengiriman
async function handleFormatSelectionCallback(chatId, format, ptz) {
    try {
        // Dapatkan state user
        const userState = userState[chatId];
        if (!userState || !userState.selectedRack || !userState.waitingForFormatSelection) {
            return await sendMessage(ptz, chatId, "❌ Silakan pilih rak terlebih dahulu.");
        }

        const selectedRack = userState.selectedRack;

        // Hapus state format selection
        delete userState.waitingForFormatSelection;
        delete userState.selectedRack;

        if (format === '.1') {
            // Kirim langsung
            let foundPLUs = [];
            let notFoundPLUs = [];
            
            // Update status
            await sendMessage(ptz, chatId, "⏳ Memproses barcode...");
            
            for (const plu of selectedRack.pluList) {
                const result = await pjr(parseInt(plu, 10), ptz, chatId, true);
                if (result && result.success && result.buffer) {
                    foundPLUs.push(plu);
                    await ptz.sendMessage(chatId, { photo: result.buffer });
                } else {
                    notFoundPLUs.push(plu);
                }
            }

            // Kirim ringkasan hasil
            let summaryMessage = `📊 *Ringkasan Hasil Rak ${selectedRack.nama}*\n\n` +
                `✅ PLU Ditemukan: ${foundPLUs.length}\n` +
                `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}\n` +
                `📄 Total PLU: ${selectedRack.pluList.length}\n` +
                `📈 Persentase Berhasil: ${((foundPLUs.length / selectedRack.pluList.length) * 100).toFixed(1)}%`;

            if (notFoundPLUs.length > 0) {
                summaryMessage += `\n\n⚠️ *PLU Tidak Ditemukan:*\n${notFoundPLUs.join(', ')}`;
            }

            await sendMessage(ptz, chatId, summaryMessage);

            // Kirim laporan ke admin jika ada PLU yang tidak ditemukan
            if (notFoundPLUs.length > 0) {
                const adminReport = `📊 *Laporan PLU Tidak Ditemukan (Rak ${selectedRack.nama})*\n\n` +
                    `👤 User: ${chatId}\n` +
                    `❌ PLU Tidak Ditemukan: ${notFoundPLUs.join(', ')}\n` +
                    `✅ PLU Ditemukan: ${foundPLUs.length}\n` +
                    `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}\n` +
                    `📄 Total PLU: ${selectedRack.pluList.length}\n` +
                    `📈 Persentase Gagal: ${((notFoundPLUs.length / selectedRack.pluList.length) * 100).toFixed(1)}%`;

                await sendAdminNotification(ptz, adminReport);
            }
        } else if (format === '.2') {
            try {
                // Kirim pesan status awal
                await sendMessage(ptz, chatId, "⏳ Sedang memproses PDF...");

                let foundPLUs = [];
                let notFoundPLUs = [];
                let validBuffers = [];

                // Proses setiap PLU
                for (const plu of selectedRack.pluList) {
                    try {
                        const result = await pjr(parseInt(plu, 10), ptz, chatId, true);
                        if (result && result.success && result.buffer) {
                            foundPLUs.push(plu);
                            // Pastikan buffer adalah Buffer
                            const buffer = Buffer.isBuffer(result.buffer) ? result.buffer : Buffer.from(result.buffer);
                            validBuffers.push(buffer);
                        } else {
                            notFoundPLUs.push(plu);
                        }
                    } catch (error) {
                        console.error(`Error processing PLU ${plu}:`, error);
                        notFoundPLUs.push(plu);
                    }
                }

                if (validBuffers.length === 0) {
                    await sendMessage(ptz, chatId, "❌ Tidak ada barcode valid untuk dibuat PDF.");
                    return;
                }

                // Update status
                await sendMessage(ptz, chatId, "📦 Mengumpulkan barcode...");

                // Buat direktori output jika belum ada
                const outputDir = path.join(__dirname, 'output');
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                // Update status
                await sendMessage(ptz, chatId, "📄 Membuat PDF...");

                // Generate PDF
                const pdfFileName = `${selectedRack.nama}_${Date.now()}.pdf`;
                const outputPath = path.join(outputDir, pdfFileName);
                await generateBarcodePDF(validBuffers, outputPath);

                // Update status
                await sendMessage(ptz, chatId, "📤 Mengirim PDF...");

                // Tunggu sebentar untuk memastikan file sudah dibuat
                await new Promise(resolve => setTimeout(resolve, 2000));

                try {
                    // Kirim PDF
                    await ptz.sendMessage(chatId, {
                        document: fs.readFileSync(outputPath),
                        fileName: pdfFileName,
                        mimetype: 'application/pdf'
                    });

                    // Hapus file PDF setelah terkirim
                    fs.unlinkSync(outputPath);

                    // Kirim ringkasan hasil
                    let summaryMessage = `📊 *Ringkasan Hasil Rak ${selectedRack.nama} (PDF)*\n\n` +
                        `✅ PLU Ditemukan: ${foundPLUs.length}\n` +
                        `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}\n` +
                        `📄 Total PLU: ${selectedRack.pluList.length}\n` +
                        `📈 Persentase Berhasil: ${((foundPLUs.length / selectedRack.pluList.length) * 100).toFixed(1)}%`;

                    if (notFoundPLUs.length > 0) {
                        summaryMessage += `\n\n⚠️ *PLU Tidak Ditemukan:*\n${notFoundPLUs.join(', ')}`;
                    }

                    await sendMessage(ptz, chatId, summaryMessage);

                    // Kirim laporan ke admin jika ada PLU yang tidak ditemukan
                    if (notFoundPLUs.length > 0) {
                        const adminReport = `📊 *Laporan PLU Tidak Ditemukan (Rak ${selectedRack.nama} PDF)*\n\n` +
                            `👤 User: ${chatId}\n` +
                            `❌ PLU Tidak Ditemukan: ${notFoundPLUs.join(', ')}\n` +
                            `✅ PLU Ditemukan: ${foundPLUs.length}\n` +
                            `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}\n` +
                            `📄 Total PLU: ${selectedRack.pluList.length}\n` +
                            `📈 Persentase Gagal: ${((notFoundPLUs.length / selectedRack.pluList.length) * 100).toFixed(1)}%`;

                            await sendAdminNotification(ptz, adminReport);
                    }
                } catch (error) {
                    console.error('[Rak] Error sending PDF:', error);
                    await sendMessage(ptz, chatId, "❌ Terjadi kesalahan saat mengirim PDF. Silakan coba lagi.");
                }
            } catch (error) {
                console.error('Error in PDF processing:', error);
                await sendMessage(ptz, chatId, "❌ Terjadi kesalahan saat memproses PDF. Silakan coba lagi.");
            }
        } else {
            await sendMessage(ptz, chatId, "⚠️ Pilihan tidak valid. Silakan pilih .1 atau .2");
        }
    } catch (error) {
        console.error('Error di handleFormatSelectionCallback:', error);
        await sendMessage(ptz, chatId, "❌ Terjadi kesalahan saat memproses format pengiriman.");
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
        
        // Pastikan data dikirim dalam format yang benar
        worker.postMessage({
            type: 'bulk',
            data: barcodeData
        });
        
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
            if (userState[chatId].waitingForFormatSelection) {
                const selectedRack = userState[chatId].selectedRack;
                if (!selectedRack) {
                    return await sendMessage(ptz, chatId, "⚠️ Tidak ada rak yang dipilih. Silakan pilih rak terlebih dahulu.");
                }
                const option = message.substring(1);
                const result = await prosesFormatPengiriman(chatId, selectedRack, option, ptz);
                delete userState[chatId].waitingForFormatSelection;
                delete userState[chatId].selectedRack;
                return result;
            }
            if (userState[chatId].waitingForPJROption) {
                return await handlePJRFormatSelection(chatId, message, ptz);
            }
            if (userState[chatId].waitingForMonitoringOption) {
                const pluList = userState[chatId].pluList;
                delete userState[chatId].waitingForMonitoringOption;
                delete userState[chatId].pluList;
                return await handleMonitoringFormatSelection(chatId, message, pluList, ptz);
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
