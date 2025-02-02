const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const bwipjs = require('bwip-js');
const barcodeCache = new Map();

// Memuat data barcode dari file JSON
const barcodeData = JSON.parse(fs.readFileSync('./barcode.json', 'utf-8')).barcodesheet;

/**
 * Fungsi untuk membuat barcode menggunakan worker thread
 */
function createBarcodeWithWorker(barcodeData) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, 'worker.js'));

        worker.on('message', (message) => {
            if (message.success) {
                resolve(message.buffer);
            } else {
                reject(message.error);
            }
        });

        worker.on('error', (error) => reject(error));

        worker.postMessage(barcodeData);
    });
}

/**
 * Fungsi untuk mencari barcode dan mengirimkan hasilnya
 * @param {string | number} kode - Kode PLU atau kata kunci barcode
 * @param {object} ptz - Objek WhatsApp (Baileys)
 * @param {string} chatId - ID chat pengguna
 */
async function cariKodeDiExcelV2(kode, ptz, chatId) {
    try {
        console.log(`Memulai pencarian untuk PLU: ${kode}`);
        const kodeStr = kode.toString();

        // Mencari barcode berdasarkan PLU atau kata kunci
        const hasil = barcodeData.filter(item =>
            item.plu.toString() === kodeStr || item.barcode.toLowerCase().includes(kodeStr.toLowerCase())
        );

        console.log(`Hasil pencarian: ${JSON.stringify(hasil)}`);

        if (hasil.length > 0) {
            for (const item of hasil) {
                try {
                    // Cek cache untuk barcode
                    if (barcodeCache.has(item.barcode)) {
                        console.log(`Barcode untuk ${item.barcode} sudah ada di cache.`);
                    } else {
                        // Menggunakan worker thread untuk mempercepat pembuatan barcode
                        const barcodeBuffer = await createBarcodeWithWorker(item.barcode);
                        barcodeCache.set(item.barcode, barcodeBuffer); // Simpan ke cache

                        console.log(`Barcode untuk ${item.barcode} berhasil dibuat dan disimpan ke cache.`);
                    }

                    const barcodeBuffer = barcodeCache.get(item.barcode);

                    // Simpan buffer ke file sementara
                    const filePath = path.join(__dirname, 'barcode.png');
                    fs.writeFileSync(filePath, barcodeBuffer);

                    // Kirim gambar sebagai file
                    await ptz.sendMessage(chatId, {
                        image: { url: filePath },
                        caption: `🔍 Hasil Pencarian:\n🎯 *PLU:* ${item.plu}\n📦 *Barcode:* ${item.barcode}`,
                    });

                    // Hapus file sementara
                    fs.unlinkSync(filePath);
                    console.log(`Gambar barcode untuk PLU ${item.plu} berhasil dikirim sebagai file.`);
                } catch (workerError) {
                    console.error('Gagal mengirim gambar barcode:', workerError);
                    await ptz.sendMessage(chatId, { text: 'Terjadi kesalahan dalam pembuatan barcode.' });
                }
            }
        } else {
            await ptz.sendMessage(chatId, { text: `PLU atau barcode dengan kata kunci "${kode}" tidak ditemukan.` });
        }
    } catch (error) {
        console.error(`Kesalahan saat mencari barcode untuk "${kode}":`, error);
        await ptz.sendMessage(chatId, { text: `Terjadi kesalahan saat mencari barcode untuk "${kode}".` });
    }
}

module.exports = { cariKodeDiExcelV2 };
