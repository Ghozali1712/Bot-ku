const { default: makeWASocket, useMultiFileAuthState, makeInMemoryStore, DisconnectReason, jidDecode, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { processMessage } = require('./respon');
const fs = require('fs');
const readline = require('readline');
const PhoneNumber = require('awesome-phonenumber');
const chalk = require('chalk');

// Buat store untuk menyimpan data secara sementara
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

// Fungsi untuk meminta input dari user
const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => { rl.question(text, resolve) });
};

// Fungsi untuk mencetak log dengan warna
const logSuccess = (message) => console.log(chalk.green(`[🟢 SUCCESS] ${message}`));
const logInfo = (message) => console.log(chalk.blue(`[🔵 INFO] ${message}`));
const logProcessing = (message) => console.log(chalk.yellow(`[🔧 PROCESSING] ${message}`));
const logReconnecting = (message) => console.log(chalk.hex('#FFA500')(`[🟠 RECONNECTING] ${message}`));
const logWarning = (message) => console.log(chalk.yellow(`[🟡 WARNING] ${message}`));
const logError = (message) => console.error(chalk.red(`[🔴 ERROR] ${message}`));

// Fungsi utama bot
async function startBotz() {
    const { state, saveCreds } = await useMultiFileAuthState('session');

    const ptz = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        connectTimeoutMs: 60000, // Tunggu 60 detik untuk koneksi
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000, // Interval untuk menjaga koneksi tetap hidup
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: true,
        markOnlineOnConnect: true,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    // Ikat store ke socket event
    store.bind(ptz.ev);

    // Event untuk menangani pesan masuk
    ptz.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return; // Hindari pesan dari diri sendiri

            logInfo("Pesan baru diterima:");
            logProcessing(`Pesan: ${mek.message}`);

            await processMessage(mek, ptz); // Proses pesan dan kirimkan respon jika ada
        } catch (err) {
            logError(`Terjadi kesalahan di messages.upsert: ${err}`);
        }
    });

    // Event untuk menangani update koneksi
    ptz.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            logSuccess(`[CONNECTED] Bot terhubung ke WhatsApp dengan ID: ${ptz.user ? ptz.user.id : 'Tidak ada ID'}`);
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            logError('Bot terputus:', lastDisconnect?.error);

            if (shouldReconnect) {
                let delay = 5000; // Mulai dengan delay 5 detik
                logReconnecting(`Bot terputus, mencoba menyambung kembali dalam ${delay / 1000} detik...`);
                setTimeout(startBotz, delay);
            } else {
                logError('Bot terputus secara permanen. Silakan periksa konfigurasi.');
            }
        }
    });

    // Jika kredensial belum terdaftar
    if (!ptz.authState.creds.registered) {
        const phoneNumber = await question('Masukkan Nomor Anda dengan format 62 :\n');
        let code = await ptz.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        logInfo(`Kode Pairing : ${code}`);
    }

    // Simpan kredensial jika ada perubahan
    ptz.ev.on('creds.update', saveCreds);

    // Setting untuk decoding JID
    ptz.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {};
            return decode.user && decode.server && decode.user + '@' + decode.server || jid;
        } else return jid;
    };

    ptz.getName = async (jid, withoutContact = false) => {
        const id = ptz.decodeJid(jid);
        let v;
        if (id.endsWith("@g.us")) {
            v = store.contacts[id] || {};
            if (!(v.name || v.subject)) v = ptz.groupMetadata(id) || {};
            return v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international');
        } else {
            v = id === '0@s.whatsapp.net' ? { id, name: 'WhatsApp' } :
                id === ptz.decodeJid(ptz.user.id) ? ptz.user : (store.contacts[id] || {});
            return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international');
        }
    };

    // Menjalankan bot
    if (ptz.user && ptz.user.id) {
        logSuccess(`[CONNECTED] Bot terhubung ke WhatsApp dengan ID: ${ptz.user.id}`);
    } else {
        logWarning('[Warning] Bot belum terhubung dengan ID.');
    }

    return ptz;
}

// Menjalankan bot
startBotz().catch((err) => {
    logError(`Terjadi kesalahan saat menjalankan bot: ${err}`);
    process.exit(1); // Keluar jika terjadi error pada saat menjalankan bot
});
