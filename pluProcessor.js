const axios = require('axios');

// Fungsi untuk memproses kode PLU dalam fitur Monitoring Price Tag
async function processMonitoringPriceTag(kodePLU, ptz, chatId) {
    try {
        console.log(`Memproses PLU ${kodePLU} untuk fitur Monitoring Price Tag`);

        // URL API untuk mengambil gambar barcode dengan ukuran yang jelas untuk pemindaian
        const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${kodePLU}&code=Code128&format=Image&unit=Mm&size=150&dpi=300&rotation=0`;
        const response = await axios.get(barcodeUrl, { responseType: 'arraybuffer' });

        // Memastikan API mengembalikan gambar dengan data yang valid
        if (response.status === 200 && response.data.length > 0) {
            const imageBuffer = Buffer.from(response.data, 'binary');
            
            // Mengirimkan gambar yang lebih jelas ke pengguna
            await ptz.sendMessage(chatId, {
                image: imageBuffer,
                caption: `PLU: ${kodePLU}`,
                mimetype: 'image/png'
            });

            console.log('Gambar barcode yang jelas berhasil dikirim.');
        } else {
            console.log('Gambar kosong dari API.');
            await ptz.sendMessage(chatId, { text: `Gagal mengambil gambar barcode untuk PLU: ${kodePLU}.` });
        }
    } catch (error) {
        console.error('Kesalahan saat memproses PLU:', error.message);
        await ptz.sendMessage(chatId, { text: `Terjadi kesalahan dalam memproses PLU: ${kodePLU}.` });
    }
}

// Fungsi untuk memproses pesan masuk dan menangani beberapa PLU
async function processMessage(mek, ptz) {
    const chatId = mek.key.remoteJid;
    const message = mek.message.conversation?.trim();

    // Pisahkan kode PLU berdasarkan koma atau baris baru
    const kodePLUs = message
        .split(/[\s,;\n]+/) // Pisahkan berdasarkan spasi, koma, titik koma, atau baris baru
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
            // Panggil fungsi untuk memproses PLU dengan fitur Monitoring Price Tag
            await processMonitoringPriceTag(kode, ptz, chatId);
        } catch (err) {
            console.error(`Kesalahan saat memproses PLU ${kode}: ${err.message}`);
            await ptz.sendMessage(chatId, { text: `PLU ${kode}: Gagal diproses.` });
        }
    }
}

module.exports = { processMessage, processMonitoringPriceTag };
