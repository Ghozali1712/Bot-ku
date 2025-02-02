const { parentPort } = require('worker_threads');
const bwipjs = require('bwip-js');

// Fungsi untuk membuat barcode dengan optimasi kecepatan
const generateBarcode = async (barcodeData) => {
    return bwipjs.toBuffer({
        bcid: 'code128',        // Jenis barcode
        text: barcodeData,      // Data barcode
        scale: 15,               // Resolusi lebih kecil untuk kecepatan
        height: 10,             // Tinggi barcode dikurangi agar lebih ringan
        includetext: false,     // Menyembunyikan teks
        backgroundcolor: 'FFFFFF', // Latar belakang putih
        foregroundcolor: '000000', // Barcode hitam
        paddingwidth: 5,        // Padding kiri dan kanan lebih besar
        paddingheight: 5        // Padding atas dan bawah lebih besar
    });
};

// Mendengarkan pesan dari main thread
parentPort.on('message', async (barcodeData) => {
    try {
        const barcodeBuffer = await generateBarcode(barcodeData);
        parentPort.postMessage({ success: true, buffer: barcodeBuffer });
    } catch (error) {
        parentPort.postMessage({ success: false, error: error.message });
    }
});
