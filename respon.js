const { processMonitoringPriceTag } = require('./pluProcessor');  // Pastikan fungsi diimpor

const { cariKodeDiExcel } = require('./excel');
const messageProcessing = new Set(); // Gunakan Set untuk memastikan hanya satu permintaan diproses sekaligus

// Variabel untuk menyimpan pilihan fitur berdasarkan chatId
const fiturDipilih = {}; // Format: { chatId: "pjr" }

// Fungsi untuk memproses pesan masuk
async function processMessage(mek, ptz) {
    const chatId = mek.key.remoteJid;
    const message = mek.message.conversation?.trim();

    // Cek apakah pesan sudah diproses untuk chat ini
    if (messageProcessing.has(chatId)) {
        console.log(`Pesan dari ${chatId} sedang diproses, abaikan permintaan.`);
        return; // Abaikan jika sudah diproses
    }

    // Tandai bahwa pesan sedang diproses
    console.log(`Memproses pesan untuk chatId: ${chatId}`);
    messageProcessing.add(chatId);

    try {
        // Cek apakah pesan adalah perintah untuk kembali ke menu utama (start)
        if (message.toLowerCase() === "start") {
            // Menampilkan kembali submenu meskipun sudah memilih fitur sebelumnya
            await ptz.sendMessage(chatId, {
                text: `Silakan pilih fitur yang ingin digunakan:\n1. PLU ke Barcode (pjr)\n2. Ubah PLU jadi Gambar (Monitoring Price Tag)\nKirim angka 1 atau 2 untuk memilih.`
            });
            // Menghapus pilihan fitur sebelumnya agar pengguna bisa memilih ulang
            delete fiturDipilih[chatId];
            return;
        }

        // Cek apakah pesan adalah perintah untuk memilih fitur
        if (message === "1" || message === "2") {
            const pilihan = message === "1" ? "pjr" : "monitoring";
            fiturDipilih[chatId] = pilihan;
            await ptz.sendMessage(chatId, {
                text: `Fitur berhasil diatur: ${pilihan === "pjr" ? "PLU ke Barcode" : "Ubah PLU jadi Gambar (Monitoring Price Tag)"}.\nSilakan kirim daftar kode PLU untuk diproses.`
            });
            return;
        }

        // Jika belum memilih fitur, arahkan pengguna untuk memilih fitur terlebih dahulu
        if (!fiturDipilih[chatId]) {
            await ptz.sendMessage(chatId, {
                text: `Silakan pilih fitur yang ingin digunakan:\n1. PLU ke Barcode (pjr)\n2. Ubah PLU jadi Gambar (Monitoring Price Tag)\nKirim angka 1 atau 2 untuk memilih.`
            });
            return;
        }

        // Pisahkan pesan menjadi daftar kode PLU
        const kodePLUs = message
            .split(/[\s,;]+/) // Pisahkan berdasarkan spasi, koma, atau titik koma
            .filter(kode => /^\d+$/.test(kode)); // Hanya ambil kode PLU yang valid (angka)

        if (kodePLUs.length === 0) {
            console.log(`Tidak ada kode PLU valid untuk chatId: ${chatId}`);
            await ptz.sendMessage(chatId, { text: "Tidak ada kode PLU valid yang ditemukan. Mohon kirim kode PLU dengan format angka yang benar." });
            return;
        }

        console.log(`Kode PLU yang diterima: ${kodePLUs}`);

        // Proses PLU berdasarkan fitur yang dipilih
        for (const kode of kodePLUs) {
            try {
                console.log(`Mencari kode PLU ${kode} untuk chatId: ${chatId} dengan fitur ${fiturDipilih[chatId]}`);

                // Pilih tindakan berdasarkan fitur
                if (fiturDipilih[chatId] === "monitoring") {
                    await processMonitoringPriceTag(kode, ptz, chatId);  // Memanggil fungsi Monitoring Price Tag
                } else if (fiturDipilih[chatId] === "pjr") {
                    await cariKodeDiExcel(kode, ptz, chatId); // Proses PLU ke Barcode
                }
            } catch (err) {
                console.error(`Kesalahan saat memproses PLU ${kode}: ${err.message}`);
                // Kirim pesan kesalahan hanya untuk kode yang gagal
                await ptz.sendMessage(chatId, { text: `PLU ${kode}: Gagal diproses.` });
            }
        }
    } catch (error) {
        console.error('Error di processMessage:', error);
        await ptz.sendMessage(chatId, { text: "Terjadi kesalahan dalam memproses permintaan Anda." });
    } finally {
        // Hapus status sedang diproses setelah selesai
        console.log(`Selesai memproses pesan untuk chatId: ${chatId}`);
        messageProcessing.delete(chatId);
    }
}

module.exports = { processMessage };  // Menyediakan fungsi untuk digunakan oleh file lain
