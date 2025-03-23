const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');

// Fungsi helper untuk mengirim pesan dengan retry
async function sendMessage(ptz, chatId, text) {
    if (!ptz || !chatId || !text) {
        console.error('Parameter tidak lengkap untuk sendMessage');
        return;
    }

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Pastikan text adalah string
            const messageText = String(text);
            
            // Kirim pesan
            await ptz.sendMessage(chatId, { text: messageText });
            return;
        } catch (error) {
            console.error(`Attempt ${attempt}/${maxRetries} failed:`, error);
            lastError = error;
            
            // Tunggu sebentar sebelum mencoba lagi
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    console.error('Failed to send message after max retries:', lastError);
    throw new Error('Gagal mengirim pesan setelah 3 percobaan');
}

// Fungsi helper untuk mengirim file dengan retry
async function sendFile(ptz, chatId, filePath, caption = '') {
    if (!ptz || !chatId || !filePath) {
        console.error('Parameter tidak lengkap untuk sendFile');
        return;
    }

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Baca file sebagai buffer
            const fileBuffer = fs.readFileSync(filePath);
            
            // Kirim file menggunakan buffer
            await ptz.sendMessage(chatId, {
                document: fileBuffer,
                mimetype: 'application/pdf',
                fileName: filePath.split('/').pop(),
                caption: caption
            });
            return;
        } catch (error) {
            console.error(`Attempt ${attempt}/${maxRetries} failed:`, error);
            lastError = error;
            
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    console.error('Failed to send file after max retries:', lastError);
    throw new Error('Gagal mengirim file setelah 3 percobaan');
}

module.exports = { sendMessage, sendFile }; 