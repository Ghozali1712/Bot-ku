const axios = require('axios');
const sharp = require('sharp'); // Import sharp untuk manipulasi gambar

// Fungsi untuk memproses kode PLU dalam fitur Monitoring Price Tag
async function processMonitoringPriceTag(kodePLU, ptz, chatId) {
    try {
        console.log(`Memproses PLU ${kodePLU} untuk fitur Monitoring Price Tag`);

        // URL API untuk mengambil gambar barcode langsung dengan format PNG
        const barcodeUrl = `https://barcodeapi.org/api/128/${kodePLU}`;

        // Mengirim permintaan HTTP untuk mendapatkan gambar sebagai arraybuffer
        const response = await axios.get(barcodeUrl, {
            responseType: 'arraybuffer',
            headers: {
                'Accept': 'image/png', // Pastikan menerima gambar PNG
            }
        });

        // Memastikan API mengembalikan gambar dengan data yang valid
        if (response.status === 200 && response.data.length > 0) {
            // Memeriksa apakah ukuran gambar cukup besar
            if (response.data.length < 100) {
                throw new Error('Gambar barcode terlalu kecil atau rusak.');
            }

            // Mengonversi data arraybuffer ke Buffer
            const imageBuffer = Buffer.from(response.data, 'binary');

            // Manipulasi gambar dengan sharp untuk menambahkan background
            const imageWithBackground = await sharp(imageBuffer)
                .resize({ width: 600 }) // Sesuaikan ukuran gambar (opsional)
                .extend({
                    top: 50, left: 50, bottom: 50, right: 50, // Menambahkan background di kiri atas dan bawah
                    background: { r: 255, g: 255, b: 255, alpha: 1 } // Warna putih (R, G, B)
                })
                .toBuffer(); // Menghasilkan buffer gambar yang telah dimodifikasi

            // Mengirimkan gambar yang telah dimodifikasi (dengan background) ke pengguna
            await ptz.sendMessage(chatId, {
                image: imageWithBackground,
                caption: `PLU: ${kodePLU}`,
                mimetype: 'image/png' // Menggunakan format PNG
            });

            console.log('Gambar barcode dengan background berhasil dikirim.');
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
