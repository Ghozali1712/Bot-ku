const axios = require('axios');
const sharp = require('sharp'); // Import sharp untuk manipulasi gambar
const path = require('path');
const xlsx = require('xlsx');
const chalk = require('chalk');

/**
 * Cari kode PLU di file Excel dan kirimkan hasilnya.
 */
async function cariKodeDiExcel(kode, ptz, chatId) {
    if (!kode) {
        await ptz.sendMessage(chatId, { text: 'Kode PLU tidak valid.' });
        return;
    }

    console.log(chalk.blue('\n=== Mulai Pencarian PLU ==='));

    try {
        // Path file Excel
        const filePath = path.join(__dirname, 'Barcode All Modis.xlsx');
        const workbook = xlsx.readFile(filePath);

        console.log(chalk.green(`📖 Membuka file: ${filePath}`));

        let hasilDitemukan = []; // Array untuk menyimpan semua hasil pencarian

        // Iterasi melalui semua sheet dalam workbook
        for (const sheetName of workbook.SheetNames) {
            console.log(chalk.yellow(`🔍 Membaca sheet: ${sheetName}`));

            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

            if (!data || data.length === 0) {
                console.log(chalk.red(`⚠️  Sheet ${sheetName} kosong, melewati.`));
                continue;
            }

            // Mencari PLU pada setiap sheet
            for (const row of data) {
                const pluIndex = row.findIndex(cell => cell && cell.toString().trim() === kode.toString().trim());
                if (pluIndex !== -1) {
                    hasilDitemukan.push({
                        sheetName,
                        plu: row[pluIndex] || 'Tidak ada PLU',
                        barcode: row[row.length - 1] || 'Tidak ada barcode',
                        deskripsi: row[row.length - 2] || 'Tidak ada deskripsi',
                        modis: row[0] || 'Tidak ada informasi',
                        shelving: row[1] || 'Tidak ada informasi',
                        baris: row[2] || 'Tidak ada informasi',
                    });
                }
            }
        }

        if (hasilDitemukan.length > 0) {
            console.log(chalk.green(`✅ PLU ditemukan: ${hasilDitemukan.length} hasil.`));
            for (const hasil of hasilDitemukan) {
                console.log(chalk.cyan(`\n📄 Hasil dari sheet ${hasil.sheetName}:`));
                console.table(hasil);
                await kirimBarcode(ptz, chatId, hasil); // Mengirim gambar barcode
            }
        } else {
            console.log(chalk.red('❌ PLU tidak ditemukan.'));
            await ptz.sendMessage(chatId, { text: 'PLU tidak ditemukan dalam file Excel.' });
        }
    } catch (error) {
        console.error(chalk.red(`❌ Kesalahan: ${error.message}`));
        await ptz.sendMessage(chatId, { text: 'Terjadi kesalahan dalam memproses permintaan Anda.' });
    }

    console.log(chalk.blue('\n=== Pencarian PLU Selesai ==='));
}

/**
 * Mengambil gambar barcode dan mengirimkan hasilnya ke pengguna.
 */
async function kirimBarcode(ptz, chatId, hasil) {
    const barcodeUrl = `https://barcodeapi.org/api/128/${encodeURIComponent(hasil.barcode)}`;
    console.log(chalk.magenta(`\n🌐 Mengakses API: ${barcodeUrl}`));

    try {
        const response = await axios.get(barcodeUrl, { responseType: 'json' }); // Mendapatkan JSON
        const contentType = response.headers['content-type'];

        // Log tipe konten dan periksa apakah itu gambar
        console.log('Tipe konten yang diterima:', contentType);

        // Jika API memberi respons dalam format JSON, periksa isi JSON tersebut
        if (contentType.includes('application/json')) {
            console.log(chalk.red('Konten bukan gambar PNG, respons JSON diterima.'));
            if (response.data && response.data.base64) {
                // Jika ada base64 gambar dalam respons, proses base64
                const imageBuffer = Buffer.from(response.data.base64, 'base64');
                const imageWithBackground = await sharp(imageBuffer)
                    .resize({ width: 600 }) // Sesuaikan ukuran gambar
                    .extend({
                        top: 50, left: 50, bottom: 50, right: 50,
                        background: { r: 255, g: 255, b: 255, alpha: 1 } // Warna putih
                    })
                    .toBuffer(); // Menghasilkan buffer gambar yang telah dimodifikasi

                console.log(chalk.green('✅ Gambar barcode berhasil diunduh dan diproses.'));

                // Mengirim gambar barcode dengan background ke pengguna
                await ptz.sendMessage(chatId, {
                    image: imageWithBackground,
                    caption: `PLU: ${hasil.plu}\nDeskripsi: ${hasil.deskripsi}\nModis: ${hasil.modis}\nShelving: ${hasil.shelving}\nBaris: ${hasil.baris}`, // Menghapus Sheet
                    mimetype: 'image/png',
                });
                console.log(chalk.green('📤 Gambar barcode berhasil dikirim.'));
            } else {
                console.log(chalk.red('❌ Tidak ada base64 dalam respons JSON.'));
                await ptz.sendMessage(chatId, { text: `Gagal mengambil gambar barcode untuk PLU: ${hasil.plu}.` });
            }
        } else {
            console.log(chalk.red('❌ Tipe konten bukan JSON atau gambar PNG.'));
            await ptz.sendMessage(chatId, { text: `Gagal mengambil gambar barcode untuk PLU: ${hasil.plu}.` });
        }
    } catch (error) {
        console.error(chalk.red(`❌ Kesalahan API barcode untuk PLU ${hasil.plu}: ${error.message}`));
        await ptz.sendMessage(chatId, { text: `Gagal mengambil gambar barcode untuk PLU: ${hasil.plu}.` });
    }
}

module.exports = { cariKodeDiExcel };
