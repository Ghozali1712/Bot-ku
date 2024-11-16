const { default: makeWASocket, useMultiFileAuthState, makeInMemoryStore, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { processMessage } = require('./respon');

// Buat store untuk menyimpan data secara sementara
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

// Fungsi utama bot
async function startBotz() {
    const { state, saveCreds } = await useMultiFileAuthState('session');

    const ptz = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
    });

    // Ikat store ke socket event
    store.bind(ptz.ev);

    // Event untuk menangani pesan masuk
    ptz.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return; // Hindari pesan dari diri sendiri

            console.log("Pesan baru diterima:", mek.message);

            await processMessage(mek, ptz); // Proses pesan dan kirimkan respon jika ada
        } catch (err) {
            console.error("Terjadi kesalahan di messages.upsert:", err);
        }
    });

    // Event untuk menangani update koneksi
    ptz.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.error('Bot terputus:', lastDisconnect?.error);

            if (shouldReconnect) {
                console.log('Mencoba menyambung kembali dalam 5 detik...');
                setTimeout(startBotz, 5000); // Tunggu 5 detik sebelum mencoba reconnect
            } else {
                console.error('Bot terputus secara permanen. Silakan periksa konfigurasi.');
            }
        } else if (connection === 'open') {
            console.log('[Connected] Bot terhubung ke WhatsApp dengan ID:', JSON.stringify(ptz.user.id, null, 2));
        }
    });

    // Simpan kredensial jika ada perubahan
    ptz.ev.on('creds.update', saveCreds);
}

// Menjalankan bot
startBotz().catch(console.error);
