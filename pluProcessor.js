const bwipjs = require('bwip-js');
const { cariKodeDiExcelV2: pjr } = require('./barcodev2');

/**
 * Fungsi untuk memproses kode PLU dan mengonversinya menjadi gambar
 * @param {string} kodePLU - Kode PLU yang akan diproses
 * @param {object} ptz - Objek WhatsApp (Baileys)
 * @param {string} chatId - ID chat pengguna
 * @param {boolean} isPDF - Apakah ini untuk pembuatan PDF
 */
async function processMonitoringPriceTag(kodePLU, ptz, chatId, isPDF = false) {
    try {
        console.log(`Memulai pencarian untuk PLU: ${kodePLU}`);
        
        // Cari PLU di database
        const result = await pjr(parseInt(kodePLU, 10), ptz, chatId);
        
        if (!result || !result.success) {
            console.log(`PLU ${kodePLU} tidak ditemukan di database`);
            return { 
                success: false, 
                message: `Tidak ditemukan barcode untuk PLU: ${kodePLU}` 
            };
        }

        // Konversi PLU ke string
        const pluString = kodePLU.toString();

        // Hasilkan gambar barcode dari PLU menggunakan bwip-js
        const barcodeBuffer = await bwipjs.toBuffer({
            bcid: 'code128',           // Jenis barcode
            text: pluString,           // Data barcode (PLU)
            scale: 20,                 // Meningkatkan skala dari 15 ke 20 untuk resolusi lebih tinggi
            height: 20,                // Meningkatkan tinggi dari 15 ke 20 untuk visibilitas lebih baik
            includetext: true,         // Teks ditambahkan di bawah barcode
            textxalign: 'center',      // Teks di tengah
            textsize: 20,              // Meningkatkan ukuran teks dari 18 ke 20
            textmargin: 10,            // Jarak teks dengan barcode
            paddingwidth: 20,          // Memperlebar sisi kanan dan kiri
            paddingheight: 10,         // Memperlebar sisi atas dan bawah
            backgroundcolor: 'FFFFFF', // Latar belakang putih
            foregroundcolor: '000000', // Garis hitam
        });

        // Jika ini untuk PDF, tidak perlu kirim gambar
        if (!isPDF) {
            // Kirim gambar barcode ke WhatsApp
            await ptz.sendMessage(chatId, {
                image: barcodeBuffer,
                caption: `PLU: ${pluString}`,
                mimetype: 'image/png', // Format PNG
            });
        }

        console.log(`Gambar barcode untuk PLU ${pluString} berhasil dibuat.`);
        return { success: true, buffer: barcodeBuffer };
    } catch (error) {
        console.error('Kesalahan saat memproses PLU:', error.message);
        if (!isPDF) {
            await ptz.sendMessage(chatId, { text: `Terjadi kesalahan dalam memproses PLU: ${kodePLU}.` });
        }
        return { success: false, message: error.message };
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
