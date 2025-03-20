const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const barcodeCache = new Map();

// Definisikan path untuk file dan direktori
const BARCODE_FILE = './barcode.json';
const CACHE_DIR = './cache';

// Memastikan direktori cache ada
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR);
}

// Memuat data barcode dari file JSON
const barcodeData = JSON.parse(fs.readFileSync(BARCODE_FILE, 'utf-8')).barcodesheet;

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
async function cariKodeDiExcelV2(plu, ptz, chatId, isPdfMode = false) {
    try {
        console.log(`Memulai pencarian untuk PLU: ${plu}`);
        
        // Cari PLU yang sesuai
        const hasil = barcodeData.filter(item => item.plu.toString() === plu.toString());
        console.log('Hasil pencarian:', hasil);

        if (hasil.length === 0) {
            if (!isPdfMode) {
                await ptz.sendMessage(chatId, { text: `❌ Tidak ditemukan barcode untuk PLU: ${plu}` });
            }
            return { success: false, message: `Tidak ditemukan barcode untuk PLU: ${plu}` };
        }

        const barcode = hasil[0].barcode;
        
        // Cek apakah barcode sudah ada di cache
        const cachePath = path.join(CACHE_DIR, `${barcode}.png`);
        let imageBuffer;

        if (fs.existsSync(cachePath)) {
            console.log(`Barcode untuk ${barcode} sudah ada di cache.`);
            imageBuffer = fs.readFileSync(cachePath);
        } else {
            // Generate barcode baru menggunakan worker
            try {
                imageBuffer = await createBarcodeWithWorker(barcode);
                // Simpan ke cache
                fs.writeFileSync(cachePath, imageBuffer);
                console.log(`Barcode untuk ${barcode} berhasil dibuat dengan worker dan disimpan ke cache.`);
            } catch (workerError) {
                console.error('Error saat membuat barcode dengan worker:', workerError);
                throw new Error(`Gagal membuat barcode: ${workerError.message}`);
            }
        }

        if (isPdfMode) {
            return { success: true, buffer: imageBuffer };
        }

        // Kirim gambar sebagai file dengan buffer yang valid
        const tempFilePath = path.join(CACHE_DIR, `temp_${barcode}.png`);
        fs.writeFileSync(tempFilePath, imageBuffer);

        await ptz.sendMessage(chatId, {
            image: { url: tempFilePath },
            caption: `🏷️ *Barcode untuk PLU ${plu}*\n📊 Kode: ${barcode}`,
            mimetype: 'image/png'
        });

        // Hapus file temporary
        fs.unlinkSync(tempFilePath);
        
        console.log(`Gambar barcode untuk PLU ${plu} berhasil dikirim sebagai file.`);
        return { success: true, message: 'Barcode berhasil dikirim' };

    } catch (error) {
        console.error('Error dalam cariKodeDiExcelV2:', error);
        if (!isPdfMode) {
            await ptz.sendMessage(chatId, { text: `❌ Terjadi kesalahan saat memproses PLU: ${plu}` });
        }
        return { success: false, message: error.message };
    }
}

module.exports = { cariKodeDiExcelV2 };
