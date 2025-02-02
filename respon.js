const { tambahData } = require('./barcodev1');
const { cariKodeDiExcelV2: pjr } = require('./barcodev2');
const { processMonitoringPriceTag } = require('./pluProcessor');
const { restartBot } = require('./restartBot');

const userState = {};

const MENU_TEXT = `📝Silakan pilih fitur yang ingin digunakan:
1️⃣ Tambah Data
2️⃣ PJR
3️⃣ Monitoring Price Tag
4️⃣ Restart Bot
📌 Pilih 1-4 atau ketik "menu" atau "start" untuk kembali.`;

const FITUR_MAPPING = {
    "1": { fitur: "tambah_data", pesan: "✅ Fitur *Tambah Data* berhasil diatur.\n📌 Silakan kirim data sesuai kebutuhan fitur." },
    "2": { fitur: "pjr", pesan: "✅ Fitur *PJR* berhasil diatur.\n📌 Silakan kirim kode PLU yang ingin dicari barcode-nya." },
    "3": { fitur: "monitoring", pesan: "✅ Fitur *Monitoring Price Tag* berhasil diatur.\n📌 Kirim kode PLU yang ingin diubah jadi gambar." },
    "4": { fitur: "restart", pesan: "" }
};

// Fungsi untuk mengirim pesan
async function sendMessage(ptz, chatId, message) {
    if (!ptz || !chatId || !message) return;

    try {
        await ptz.sendMessage(chatId, { text: message });
    } catch (error) {
        console.error('❌ Gagal mengirim pesan:', error);
    }
}

// Fungsi menangani input multi-line untuk Tambah Data
async function handleTambahData(chatId, message, ptz) {
    const entries = message.split('\n').map(line => line.trim()).filter(line => line);

    if (entries.length === 0) {
        return await sendMessage(ptz, chatId, "⚠️ Format input salah. Gunakan format: PLU,BARCODE (contoh: 12345,6789012345678)");
    }

    const { berhasilDitambah, gagalDitambah } = tambahData(entries, './barcode.json');

    let responseMessage = "✅ Data berhasil ditambahkan:\n";
    responseMessage += berhasilDitambah.length ? berhasilDitambah.join('\n') : "Tidak ada data baru.";
    
    if (gagalDitambah.length) {
        responseMessage += "\n⚠️ Data gagal ditambahkan (mungkin sudah ada atau format salah):\n";
        responseMessage += gagalDitambah.join('\n');
    }

    await sendMessage(ptz, chatId, responseMessage);
}

// Fungsi menangani PJR
async function handlePJR(chatId, message, ptz) {
    const kodePLUs = message.split(/[\s,;]+/).filter(kode => /^\d+$/.test(kode));
    for (const kode of kodePLUs) {
        await pjr(parseInt(kode, 10), ptz, chatId);
    }
}

// Fungsi menangani Monitoring Price Tag
async function handleMonitoring(chatId, message, ptz) {
    const kodePLUs = message.split(/[\s,;]+/).filter(kode => /^\d+$/.test(kode));
    for (const kode of kodePLUs) {
        await processMonitoringPriceTag(kode, ptz, chatId);
    }
}

// Fungsi memproses pesan masuk
async function processMessage(mek, ptz) {
    const chatId = mek.key.remoteJid;
    const message = mek.message.conversation?.trim();

    if (!message) return;

    try {
        if (["start", "menu"].includes(message.toLowerCase())) {
            userState[chatId] = { status: "menu" };
            return await sendMessage(ptz, chatId, MENU_TEXT);
        }

        if (!userState[chatId]) return;

        switch (userState[chatId].status) {
            case "menu":
                const fitur = FITUR_MAPPING[message];
                if (!fitur) return;

                userState[chatId] = { fitur: fitur.fitur, status: "siap" };

                if (fitur.fitur === "restart") {
                    return await restartBot(ptz, chatId);
                }

                return await sendMessage(ptz, chatId, fitur.pesan);

            case "siap":
                switch (userState[chatId].fitur) {
                    case "tambah_data":
                        return await handleTambahData(chatId, message, ptz);
                    case "pjr":
                        return await handlePJR(chatId, message, ptz);
                    case "monitoring":
                        return await handleMonitoring(chatId, message, ptz);
                    default:
                        return await sendMessage(ptz, chatId, "⚠️ Fitur tidak dikenali.");
                }

            default:
                return await sendMessage(ptz, chatId, "⚠️ Status tidak valid.");
        }
    } catch (error) {
        console.error('❌ Error di processMessage:', error);
        await sendMessage(ptz, chatId, "⚠️ Terjadi kesalahan dalam memproses permintaan Anda.");
    }
}

module.exports = { processMessage };
