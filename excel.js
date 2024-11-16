const axios = require('axios');
const path = require('path');
const xlsx = require('xlsx');

async function cariKodeDiExcel(kode, ptz, chatId) {
    try {
        // Path file Excel
        const filePath = path.join(__dirname, 'Barcode All Modis.xlsx');
        const workbook = xlsx.readFile(filePath);

        let hasilDitemukan = []; // Array untuk menyimpan semua hasil pencarian

        // Iterasi melalui semua sheet dalam workbook
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }); // Membaca data tanpa header, kolom menggunakan indeks

            console.log(`Membaca sheet: ${sheetName}`);
            // Periksa apakah sheet memiliki data
            if (data.length === 0) {
                console.log(`Sheet ${sheetName} kosong, lewati.`);
                continue;
            }

            // Mencari PLU pada setiap sheet
            for (const row of data) {
                try {
                    // Cek apakah PLU ditemukan di salah satu kolom, hilangkan spasi ekstra
                    const pluIndex = row.findIndex(cell => cell && cell.toString().trim() === kode.toString().trim());

                    if (pluIndex !== -1) {
                        // Mengambil barcode dari kolom terakhir setelah PLU
                        const barcode = row[row.length - 1] || 'Tidak ada barcode'; // Kolom terakhir sebagai barcode

                        // Mengambil deskripsi yang ada di kolom setelah barcode (kolom sebelum barcode adalah nama item)
                        const deskripsi = row[row.length - 2] || 'Tidak ada deskripsi'; // Kolom sebelum barcode sebagai deskripsi

                        // Menyusun data hasil pencarian
                        hasilDitemukan.push({
                            sheetName,
                            plu: row[pluIndex] || 'Tidak ada PLU',
                            barcode,  // Menyimpan barcode dari kolom terakhir
                            deskripsi,  // Menyimpan deskripsi dari kolom sebelum barcode
                            modis: row[0] || 'Tidak ada informasi', // Kolom 0 (index 0) = MODIS
                            shelving: row[1] || 'Tidak ada informasi', // Kolom 1 (index 1) = SHELFING
                            baris: row[2] || 'Tidak ada informasi', // Kolom 2 (index 2) = BARIS
                        });
                    }
                } catch (err) {
                    console.error(`Kesalahan saat memproses baris: ${err.message}`);
                }
            }
        }

        // Jika data ditemukan, kirimkan semua hasil
        if (hasilDitemukan.length > 0) {
            for (const hasil of hasilDitemukan) {
                try {
                    // Menggunakan barcode untuk membuat URL gambar dengan kualitas lebih tinggi
                    const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${hasil.barcode}&code=Code128&format=Image&unit=Mm&size=100&dpi=300&rotation=0`;

                    console.log(`Mengakses URL: ${barcodeUrl}`);
                    const response = await axios.get(barcodeUrl, { responseType: 'arraybuffer' });

                    if (response.status === 200 && response.data.length > 0) {
                        const imageBuffer = Buffer.from(response.data, 'binary');
                        await ptz.sendMessage(chatId, {
                            image: imageBuffer,
                            caption: `Sheet: ${hasil.sheetName}\nPLU: ${hasil.plu}\nDeskripsi: ${hasil.deskripsi}\nModis: ${hasil.modis}\nShelving: ${hasil.shelving}\nBaris: ${hasil.baris}`,
                            mimetype: 'image/png'
                        });
                        console.log('Gambar berhasil dikirim.');
                    } else {
                        console.log('Gambar kosong dari API.');
                        await ptz.sendMessage(chatId, { text: `Gagal mengambil gambar barcode untuk PLU: ${hasil.plu} di sheet ${hasil.sheetName}.` });
                    }
                } catch (apiError) {
                    console.error('Kesalahan API:', apiError.message);
                    await ptz.sendMessage(chatId, { text: `Terjadi kesalahan saat mengakses API barcode untuk PLU: ${hasil.plu} di sheet ${hasil.sheetName}.` });
                }
            }
        } else {
            // Jika tidak ada data ditemukan
            console.log('PLU tidak ditemukan.');
            await ptz.sendMessage(chatId, { text: 'PLU tidak ditemukan dalam file Excel.' });
        }
    } catch (error) {
        console.error('Kesalahan:', error.message);
        await ptz.sendMessage(chatId, { text: 'Terjadi kesalahan dalam memproses permintaan Anda.' });
    }
}

module.exports = { cariKodeDiExcel };
