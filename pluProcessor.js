const bwipjs = require('bwip-js');

/**
 * Fungsi untuk memproses kode PLU dan mengonversinya menjadi gambar
 * @param {string} kodePLU - Kode PLU yang akan diproses
 * @param {object} ptz - Objek WhatsApp (Baileys)
 * @param {string} chatId - ID chat pengguna
 */
async function processMonitoringPriceTag(kodePLU, ptz, chatId) {
    try {
        console.log(`Memproses PLU ${kodePLU} untuk fitur Monitoring Price Tag`);

        // Hasilkan gambar barcode dari PLU menggunakan bwip-js
        const barcodeBuffer = await bwipjs.toBuffer({
            bcid: 'code128',           // Jenis barcode
            text: kodePLU,             // Data barcode (PLU)
            scale: 15,                 // Meningkatkan skala untuk membuat barcode lebih lebar
            height: 15,                // Menurunkan tinggi barcode
            includetext: true,         // Teks ditambahkan di bawah barcode
            textxalign: 'center',      // Teks di tengah
            textsize: 18,              // Ukuran teks lebih besar
            textmargin: 10,            // Jarak teks dengan barcode
            paddingwidth: 20,          // Memperlebar sisi kanan dan kiri
            paddingheight: 10,         // Memperlebar sisi atas dan bawah
            backgroundcolor: 'FFFFFF', // Latar belakang putih
            foregroundcolor: '000000', // Garis hitam
        });

        // Kirim gambar barcode ke WhatsApp
        await ptz.sendMessage(chatId, {
            image: barcodeBuffer,
            caption: `PLU: ${kodePLU}`,
            mimetype: 'image/png', // Format PNG
        });

        console.log(`Gambar barcode untuk PLU ${kodePLU} berhasil dikirim.`);
    } catch (error) {
        console.error('Kesalahan saat memproses PLU:', error.message);
        await ptz.sendMessage(chatId, { text: `Terjadi kesalahan dalam memproses PLU: ${kodePLU}.` });
    }
}

/**
 * Fungsi untuk memproses pesan masuk dan menangani beberapa PLU
 * @param {object} mek - Pesan yang diterima
 * @param {object} ptz - Objek WhatsApp (Baileys)
 */
async function processMessage(mek, ptz) {
    const chatId = mek.key.remoteJid;
    const message = mek.message?.conversation?.trim();

    if (!message) {
        console.log(`Pesan kosong atau tidak valid untuk chatId: ${chatId}`);
        await ptz.sendMessage(chatId, { text: "Pesan tidak valid atau kosong." });
        return;
    }

    // Pisahkan kode PLU berdasarkan koma, spasi, atau baris baru
    const kodePLUs = message
        .split(/[\s,;\n]+/)        // Pisahkan berdasarkan spasi, koma, titik koma, atau baris baru
        .filter(kode => /^\d+$/.test(kode)); // Hanya ambil kode PLU yang valid (angka)

    if (kodePLUs.length === 0) {
        console.log(`Tidak ada kode PLU valid untuk chatId: ${chatId}`);
        await ptz.sendMessage(chatId, { text: "Tidak ada kode PLU valid yang ditemukan. Mohon kirim kode PLU dengan format angka yang benar." });
        return;
    }

    console.log(`Kode PLU yang diterima: ${kodePLUs}`);

    // Proses setiap PLU yang diterima
    for (const kode of kodePLUs) {
        try {
            console.log(`Mencari kode PLU ${kode} untuk chatId: ${chatId}`);
            // Panggil fungsi untuk memproses PLU
            await processMonitoringPriceTag(kode, ptz, chatId);
        } catch (err) {
            console.error(`Kesalahan saat memproses PLU ${kode}: ${err.message}`);
            await ptz.sendMessage(chatId, { text: `PLU ${kode}: Gagal diproses.` });
        }
    }
}

module.exports = { processMessage, processMonitoringPriceTag };
