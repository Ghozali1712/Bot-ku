const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const sharp = require('sharp');

// Konversi mm ke points (1 mm = 2.83465 points)
const MM_TO_POINTS = 2.83465;

// Ukuran kertas dalam points (185mm x 106mm)
const PAGE_WIDTH = 185 * MM_TO_POINTS;  // 524.41 points
const PAGE_HEIGHT = 106 * MM_TO_POINTS; // 300.47 points

// Ukuran barcode dalam points (163mm x 71mm)
const BARCODE_WIDTH = 163 * MM_TO_POINTS;  // 462.05 points
const BARCODE_HEIGHT = 71 * MM_TO_POINTS;  // 201.26 points

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
        console.log('[PDF] Processing image with Sharp');
        // Proses gambar dengan Sharp sesuai dengan ukuran yang diminta (163mm x 71mm)
        const processedBuffer = await sharp(buffer)
            .resize({
                width: Math.round(BARCODE_WIDTH),
                height: Math.round(BARCODE_HEIGHT),
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .png() // Gunakan PNG untuk kualitas terbaik
            .toBuffer();
        console.log(`[PDF] Image processed successfully, buffer size: ${processedBuffer.length} bytes`);
        return processedBuffer;
    } catch (error) {
        console.error('[PDF] Error processing image:', error);
        throw error;
    }
}

// Fungsi untuk membuat PDF dengan barcode
async function generateBarcodePDF(buffers, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            console.log('[PDF] Starting PDF generation');
            
            // Validasi input
            if (!Array.isArray(buffers) || buffers.length === 0) {
                throw new Error('No valid buffers provided');
            }

            console.log(`[PDF] Processing ${buffers.length} barcode buffers`);

            // Ukuran dan margin yang disesuaikan (dalam points)
            const marginHorizontal = 11 * MM_TO_POINTS; // 11mm margin ((185-163)/2)
            const marginVertical = 17.5 * MM_TO_POINTS; // 17.5mm margin ((106-71)/2)

            // Buat dokumen PDF baru dengan ukuran kustom
            const doc = new PDFDocument({
                size: [PAGE_WIDTH, PAGE_HEIGHT], // Ukuran kertas 185mm x 106mm
                margins: {
                    top: marginVertical,
                    bottom: marginVertical,
                    left: marginHorizontal,
                    right: marginHorizontal
                },
                info: {
                    Title: 'Generated Barcodes',
                    Author: 'Bot-ku',
                    Subject: 'Barcode Collection',
                    Keywords: 'barcode, pdf, generated'
                }
            });

            // Buat write stream
            const writeStream = fs.createWriteStream(outputPath);

            // Handle error pada write stream
            writeStream.on('error', (error) => {
                console.error('[PDF] Error writing PDF file:', error);
                reject(error);
            });

            // Pipe dokumen ke write stream
            doc.pipe(writeStream);

            // Proses setiap buffer
            for (let i = 0; i < buffers.length; i++) {
                try {
                    console.log(`[PDF] Processing buffer ${i + 1} of ${buffers.length}`);
                    
                    // Validasi buffer
                    if (!Buffer.isBuffer(buffers[i]) || buffers[i].length === 0) {
                        console.error(`[PDF] Buffer ${i + 1} tidak valid`);
                        continue;
                    }

                    // Tambah halaman baru untuk setiap barcode kecuali halaman pertama
                    if (i > 0) {
                        doc.addPage({
                            size: [PAGE_WIDTH, PAGE_HEIGHT],
                            margins: {
                                top: marginVertical,
                                bottom: marginVertical,
                                left: marginHorizontal,
                                right: marginHorizontal
                            }
                        });
                    }

                    // Hitung posisi tengah
                    const xPos = (PAGE_WIDTH - BARCODE_WIDTH) / 2;
                    const yPos = (PAGE_HEIGHT - BARCODE_HEIGHT) / 2;

                    // Tambahkan gambar ke PDF
                    console.log(`[PDF] Adding image to PDF at position (${xPos}, ${yPos})`);
                    doc.image(buffers[i], xPos, yPos, {
                        width: BARCODE_WIDTH,
                        height: BARCODE_HEIGHT,
                        align: 'center',
                        valign: 'center'
                    });

                } catch (error) {
                    console.error(`[PDF] Error processing buffer ${i + 1}:`, error);
                }
            }

            // Selesaikan PDF
            console.log('[PDF] Finalizing PDF');
            doc.end();

            // Handle selesai menulis file
            writeStream.on('finish', () => {
                console.log(`[PDF] PDF successfully created: ${outputPath}`);
                resolve();
            });

        } catch (error) {
            console.error('[PDF] Error creating PDF:', error);
            reject(error);
        }
    });
}

module.exports = {
    generateBarcodePDF
}; 