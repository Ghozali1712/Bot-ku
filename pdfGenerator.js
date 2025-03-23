const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const sharp = require('sharp');

// Konversi mm ke points (1 mm = 2.83465 points)
const MM_TO_POINTS = 2.83465;

// Fungsi untuk membuat barcode menggunakan worker thread
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

// Fungsi untuk memproses gambar dengan Sharp
async function processImage(buffer) {
    try {
        // Proses gambar dengan Sharp
        const processedBuffer = await sharp(buffer)
            .resize(461, 200, { // Ukuran dalam points (162.9mm x 70.6mm)
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .jpeg({ 
                quality: 100,  // Meningkatkan kualitas JPEG ke maksimum
                mozjpeg: true  // Menggunakan mozjpeg untuk kompresi yang lebih baik
            })
            .toBuffer();
        return processedBuffer;
    } catch (error) {
        console.error('Error processing image:', error);
        throw error;
    }
}

// Fungsi untuk membuat PDF dengan barcode
async function generateBarcodePDF(buffers, outputPath) {
    const doc = new PDFDocument({
        size: [521.8, 299.9], // 184.1mm x 105.8mm
        margin: 0
    });

    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    // Proses setiap buffer
    for (let i = 0; i < buffers.length; i++) {
        console.log(`Memproses buffer ${i + 1} dari ${buffers.length}`);
        const buffer = buffers[i];
        
        if (buffer) {
            try {
                // Proses gambar menggunakan Sharp
                const processedBuffer = await processImage(buffer);
                
                // Hitung posisi untuk menempatkan gambar di tengah halaman
                const pageWidth = 521.8;  // Lebar halaman dalam points
                const pageHeight = 299.9; // Tinggi halaman dalam points
                const imageWidth = 461;    // Lebar gambar dalam points
                const imageHeight = 200;   // Tinggi gambar dalam points
                
                // Hitung posisi x dan y untuk memastikan gambar berada di tengah
                const x = (pageWidth - imageWidth) / 2;
                const y = (pageHeight - imageHeight) / 2;
                
                // Tambahkan gambar ke PDF dengan posisi yang dihitung
                doc.image(processedBuffer, x, y, {
                    width: imageWidth,
                    height: imageHeight
                });
                
                // Tambahkan halaman baru jika bukan item terakhir
                if (i < buffers.length - 1) {
                    doc.addPage();
                }
            } catch (error) {
                console.error(`Error processing buffer ${i + 1}:`, error);
            }
        }
    }

    doc.end();
    console.log(`PDF berhasil dibuat: ${outputPath}`);
}

module.exports = { generateBarcodePDF }; 