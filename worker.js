const { parentPort } = require('worker_threads');
const bwipjs = require('bwip-js');

// Fungsi untuk membuat barcode dengan optimasi kecepatan
const generateBarcode = async (barcodeData) => {
    try {
        // Generate barcode dengan bwip-js
        const barcodeBuffer = await bwipjs.toBuffer({
            bcid: 'code128',          // Jenis barcode
            text: barcodeData,
            scale: 12,                // Meningkatkan skala dari 8 ke 12 untuk resolusi lebih tinggi
            height: 15,               // Meningkatkan tinggi dari 10 ke 15 untuk visibilitas lebih baik
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

// Fungsi untuk membuat barcode tanpa teks untuk fitur scan banyak
const generateBarcodeNoText = async (barcodeData) => {
    try {
        // Generate barcode dengan bwip-js tanpa teks
        const barcodeBuffer = await bwipjs.toBuffer({
            bcid: 'code128',          // Jenis barcode
            text: barcodeData,
            scale: 8,                 // Skala optimal untuk kejelasan
            height: 10,               // Tinggi lebih besar agar mudah dipindai
            includetext: false,       // Tidak menampilkan teks di bawah barcode
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
parentPort.on('message', async (message) => {
    try {
        let barcodeBuffer;
        // Check if message is an object with data and type
        if (typeof message === 'object' && message.data) {
            if (message.type === 'bulk') {
                barcodeBuffer = await generateBarcodeNoText(message.data);
            } else {
                barcodeBuffer = await generateBarcode(message.data);
            }
        } else {
            // Handle legacy format where message is just the barcode data
            barcodeBuffer = await generateBarcode(message);
        }
        parentPort.postMessage({ success: true, buffer: barcodeBuffer });
    } catch (error) {
        console.error('Error in worker:', error);
        parentPort.postMessage({ success: false, error: error.message });
    }
});
