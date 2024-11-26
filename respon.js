const { cariKodeDiExcel: cariKodeDiExcelV1 } = require('./barcodev1'); // Barcode v1
const { cariKodeDiExcel: cariKodeDiExcelV2 } = require('./barcodev2'); // Barcode v2
const { processMonitoringPriceTag } = require('./pluProcessor'); // Monitoring Price Tag

// Gunakan Set untuk memastikan hanya satu permintaan diproses sekaligus
const messageProcessing = new Set(); 

// Variabel untuk menyimpan pilihan fitur berdasarkan chatId
const fiturDipilih = {}; // Format: { chatId: "barcode_v1" }

// Fungsi untuk memproses pesan masuk
async function processMessage(mek, ptz) {
    const chatId = mek.key.remoteJid;
    const message = mek.message.conversation?.trim();

    // Cek apakah pesan sudah diproses untuk chat ini
    if (messageProcessing.has(chatId)) {
        console.log(`Pesan dari ${chatId} sedang diproses, abaikan permintaan.`);
        return;
    }

    // Tandai bahwa pesan sedang diproses
    console.log(`Memproses pesan untuk chatId: ${chatId}`);
    messageProcessing.add(chatId);

    try {
        // Cek apakah pesan adalah perintah untuk kembali ke menu utama
        if (message.toLowerCase() === "start") {
            await ptz.sendMessage(chatId, {
                text: `Silakan pilih fitur yang ingin digunakan:\n` +
                      `1. Barcode v1\n2. Barcode v2\n3. Monitoring Price Tag\n` +
                      `Kirim angka 1, 2, atau 3 untuk memilih.`
            });
            delete fiturDipilih[chatId]; // Hapus pilihan fitur sebelumnya
            return;
        }

        // Cek apakah pesan adalah perintah untuk memilih fitur
        if (["1", "2", "3"].includes(message)) {
            const pilihan = 
                message === "1" ? "barcode_v1" : 
                message === "2" ? "barcode_v2" : 
                "monitoring";
            
            fiturDipilih[chatId] = pilihan;
            await ptz.sendMessage(chatId, {
                text: `Fitur berhasil diatur: ${pilihan === "barcode_v1" ? "Barcode v1" : 
                                                pilihan === "barcode_v2" ? "Barcode v2" : 
                                                "Monitoring Price Tag"}.\n` +
                      `Silakan kirim daftar kode PLU untuk diproses.`
            });
            return;
        }

        // Jika belum memilih fitur, arahkan pengguna untuk memilih terlebih dahulu
        if (!fiturDipilih[chatId]) {
            await ptz.sendMessage(chatId, {
                text: `Silakan pilih fitur yang ingin digunakan:\n` +
                      `1. Barcode v1\n2. Barcode v2\n3. Monitoring Price Tag\n` +
                      `Kirim angka 1, 2, atau 3 untuk memilih.`
            });
            return;
        }

        // Pisahkan pesan menjadi daftar kode PLU
        const kodePLUs = message
            .split(/[\s,;]+/) // Pisahkan berdasarkan spasi, koma, atau titik koma
            .filter(kode => /^\d+$/.test(kode)); // Hanya ambil kode PLU yang valid (angka)

        if (kodePLUs.length === 0) {
            console.log(`Tidak ada kode PLU valid untuk chatId: ${chatId}`);
            await ptz.sendMessage(chatId, {
                text: "Tidak ada kode PLU valid yang ditemukan. Mohon kirim kode PLU dengan format angka yang benar."
            });
            return;
        }

        console.log(`Kode PLU yang diterima: ${kodePLUs}`);

        // Proses PLU berdasarkan fitur yang dipilih
        for (const kode of kodePLUs) {
            try {
                console.log(`Mencari kode PLU ${kode} untuk chatId: ${chatId} dengan fitur ${fiturDipilih[chatId]}`);

                // Pilih tindakan berdasarkan fitur
                if (fiturDipilih[chatId] === "monitoring") {
                    await processMonitoringPriceTag(kode, ptz, chatId);
                } else if (fiturDipilih[chatId] === "barcode_v1") {
                    await cariKodeDiExcelV1(kode, ptz, chatId); // Barcode v1
                } else if (fiturDipilih[chatId] === "barcode_v2") {
                    await cariKodeDiExcelV2(kode, ptz, chatId); // Barcode v2
                }
            } catch (err) {
                console.error(`Kesalahan saat memproses PLU ${kode}: ${err.message}`);
                await ptz.sendMessage(chatId, { text: `PLU ${kode}: Gagal diproses.` });
            }
        }
    } catch (error) {
        console.error('Error di processMessage:', error);
        await ptz.sendMessage(chatId, { text: "Terjadi kesalahan dalam memproses permintaan Anda." });
    } finally {
        console.log(`Selesai memproses pesan untuk chatId: ${chatId}`);
        messageProcessing.delete(chatId); // Hapus status sedang diproses
    }
}

module.exports = { processMessage };
