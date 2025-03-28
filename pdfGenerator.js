const PDFDocument = require('pdfkit');
const fs = require('fs');
const bwipjs = require('bwip-js');

async function generateBarcodesPDF(pluList, outputPath) {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ autoFirstPage: false }); 
            const output = fs.createWriteStream(outputPath);
            doc.pipe(output);

            for (const plu of pluList) {
                try {
                    // Generate barcode sebagai buffer gambar
                    const pngBuffer = await bwipjs.toBuffer({
                        bcid: 'code128',
                        text: plu.toString(),
                        scale: 5,  // Skala diperbesar agar barcode lebih besar
                        height: 80, // Tinggi barcode
                        includetext: true,
                        textxalign: 'center',
                    });

                    // Tentukan ukuran halaman yang lebih kecil, sedikit lebih besar dari barcode
                    const pageWidth = 250;  // Lebar halaman (diperbesar sedikit dari barcode)
                    const pageHeight = 150; // Tinggi halaman

                    // Tambahkan halaman baru untuk setiap barcode
                    doc.addPage({ size: [pageWidth, pageHeight] });

                    // Tambahkan teks PLU di tengah halaman
                    doc.fontSize(14).text(`PLU: ${plu}`, { align: 'center' });

                    // Tambahkan gambar barcode di tengah halaman
                    doc.image(pngBuffer, (pageWidth - 200) / 2, 50, { width: 200 });

                } catch (err) {
                    console.error(`Gagal membuat barcode untuk PLU ${plu}:`, err);
                }
            }

            // Selesaikan dokumen
            doc.end();
            output.on('finish', () => resolve());
        } catch (err) {
            reject(err);
        }
    });
}

// Contoh penggunaan
generateBarcodesPDF([20129175, 20129174, 20071759], 'output.pdf')
    .then(() => console.log('PDF berhasil dibuat'))
    .catch(console.error);
