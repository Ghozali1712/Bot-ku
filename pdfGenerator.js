const PDFDocument = require('pdfkit');
const fs = require('fs');
const bwipjs = require('bwip-js');

async function generateBarcodesPDF(pluList, outputPath) {
    return new Promise(async (resolve, reject) => {
        try {
            // Buat dokumen PDF baru dengan ukuran A4
            const doc = new PDFDocument({ 
                size: 'A4',
                margin: 20 // Margin 20mm di semua sisi
            });
            const output = fs.createWriteStream(outputPath);
            doc.pipe(output);

            // Hitung lebar maksimum untuk barcode
            const pageWidth = doc.page.width;
            const maxBarcodeWidth = pageWidth - 40; // 40mm untuk margin kiri dan kanan

            let yPosition = 40; // Posisi awal di PDF
            const spacing = 80; // Jarak antar barcode

            for (const plu of pluList) {
                try {
                    // Generate barcode sebagai buffer gambar
                    const pngBuffer = await bwipjs.toBuffer({
                        bcid: 'code128',
                        text: plu.toString(),
                        scale: 3,
                        height: 15,
                        includetext: true,
                        textxalign: 'center',
                    });

                    // Simpan barcode sementara ke file gambar
                    const barcodePath = `temp_${plu}.png`;
                    fs.writeFileSync(barcodePath, pngBuffer);

                    // Tambahkan teks PLU
                    doc.fontSize(10).text(`PLU: ${plu}`, 20, yPosition);

                    // Tambahkan gambar barcode dengan lebar maksimum
                    doc.image(barcodePath, 20, yPosition + 15, {
                        width: maxBarcodeWidth,
                        height: 40
                    });

                    // Hapus file temporary
                    fs.unlinkSync(barcodePath);

                    // Update posisi Y untuk barcode berikutnya
                    yPosition += spacing;

                    // Jika posisi Y mendekati akhir halaman, buat halaman baru
                    if (yPosition > 700) {
                        doc.addPage();
                        yPosition = 40;
                    }

                } catch (err) {
                    console.error(`Error generating barcode for PLU ${plu}:`, err);
                    // Lanjutkan ke PLU berikutnya jika ada error
                    continue;
                }
            }

            // Selesaikan dokumen
            doc.end();
            output.on('finish', () => {
                resolve(outputPath);
            });
            output.on('error', (err) => {
                reject(err);
            });

        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { generateBarcodesPDF }; 