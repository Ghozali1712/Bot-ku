const { parentPort } = require('worker_threads');
const bwipjs = require('bwip-js');

// Fungsi untuk membuat barcode dengan optimasi kecepatan
const generateBarcode = async (barcodeData) => {
    try {
        // Generate barcode dengan bwip-js
        const barcodeBuffer = await bwipjs.toBuffer({
            bcid: 'code128',          // Jenis barcode
            text: barcodeData,
            scale: 8,                 // Skala optimal untuk kejelasan
            height: 10,               // Tinggi lebih besar agar mudah dipindai
            includetext: true,        // Tampilkan teks di bawah barcode
            textxalign: 'center',     // Posisikan teks di tengah
            backgroundcolor: 'FFFFFF', // Latar belakang putih
            foregroundcolor: '000000', // Garis hitam
            paddingwidth: 15,         // Padding untuk visibilitas lebih baik
            paddingheight: 15
        });
        return barcodeBuffer;
    } catch (error) {
        throw new Error(`Gagal membuat barcode: ${error.message}`);
    }
};

// Mendengarkan pesan dari main thread
parentPort.on('message', async (barcodeData) => {
    try {
        const barcodeBuffer = await generateBarcode(barcodeData);
        parentPort.postMessage({ success: true, buffer: barcodeBuffer });
    } catch (error) {
        console.error('Error in worker:', error);
        parentPort.postMessage({ success: false, error: error.message });
    }
});
