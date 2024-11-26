const axios = require('axios');
const xlsx = require('xlsx');
const path = require('path');
const sharp = require('sharp');

// Fungsi untuk mencari PLU dan mengirimkan barcode
async function cariKodeDiExcel(kode, ptz, chatId) {
    if (!kode) {
        await ptz.sendMessage(chatId, { text: 'Kode PLU tidak valid.' });
        return;
    }

    try {
        // Path file Excel
        const filePath = path.join(__dirname, 'NJAJAL_IMAM.xlsx'); // Ganti dengan nama file sesuai
        const workbook = xlsx.readFile(filePath);
        const sheetNames = workbook.SheetNames;

        // Tampilkan nama sheet yang ditemukan
        console.log('\x1b[36m%s\x1b[0m', `Sheets: ${sheetNames.join(', ')}`);

        let hasil = null;
        let sheetName = null;

        // Loop untuk mencari PLU di setiap sheet
        for (const name of sheetNames) {
            const sheet = workbook.Sheets[name];
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

            console.log(`Mencari di Sheet: ${name}`);

            // Cari PLU di sheet ini
            hasil = data.find(row => row[0]?.toString().trim() === kode.toString().trim());
            if (hasil) {
                sheetName = name; // Simpan nama sheet tempat data ditemukan
                break;
            }
        }

        if (hasil) {
            const barcode = hasil[1]?.toString().trim(); // Ambil barcode dari kolom B (index 1)

            if (!barcode) {
                await ptz.sendMessage(chatId, { text: `Barcode tidak ditemukan untuk PLU: ${kode}` });
                return;
            }

            try {
                // URL API barcode
                const barcodeUrl = `https://barcodeapi.org/api/128/${encodeURIComponent(barcode)}`;

                console.log('\x1b[33m%s\x1b[0m', `Mengakses URL: ${barcodeUrl}`);
                const response = await axios.get(barcodeUrl, { responseType: 'json' });

                if (response.headers['content-type'].includes('application/json')) {
                    const errorResponse = response.data;

                    if (errorResponse.base64) {
                        const imageBuffer = Buffer.from(errorResponse.base64, 'base64');

                        // Mengubah resolusi gambar (misalnya 2000px untuk lebar gambar)
                        const imageWithBackground = await sharp(imageBuffer)
                            .resize({ width: 2000 }) // Menyesuaikan resolusi menjadi lebih tinggi, 2000px lebar
                            .sharpen() // Meningkatkan ketajaman gambar
                            .extend({
                                top: 50, left: 50, bottom: 50, right: 50, // Menambahkan padding
                                background: { r: 255, g: 255, b: 255, alpha: 1 } // Warna putih
                            })
                            .toBuffer();

                        // Kirim gambar ke pengguna dengan caption PLU saja
                        await ptz.sendMessage(chatId, {
                            image: imageWithBackground,
                            caption: `PLU: ${kode}`,
                            mimetype: 'image/png'
                        });
                        console.log('\x1b[32m%s\x1b[0m', 'Gambar berhasil dikirim.');
                    } else {
                        await ptz.sendMessage(chatId, { text: `Gagal mengambil gambar barcode untuk PLU: ${kode}` });
                    }
                } else {
                    console.log('\x1b[31m%s\x1b[0m', 'Tipe konten bukan JSON, gambar tidak diterima.');
                    await ptz.sendMessage(chatId, { text: `Gagal mengambil gambar barcode untuk PLU: ${kode}` });
                }
            } catch (apiError) {
                console.error('\x1b[31m%s\x1b[0m', `Kesalahan API: ${apiError.message}`);
                await ptz.sendMessage(chatId, { text: `Terjadi kesalahan saat mengakses API barcode untuk PLU: ${kode}.` });
            }
        } else {
            console.log('\x1b[31m%s\x1b[0m', `PLU ${kode} tidak ditemukan.`);
            await ptz.sendMessage(chatId, { text: `PLU ${kode} tidak ditemukan dalam file Excel.` });
        }
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Kesalahan: ${error.message}`);
        await ptz.sendMessage(chatId, { text: 'Terjadi kesalahan dalam memproses permintaan Anda.' });
    }
}

module.exports = { cariKodeDiExcel };
