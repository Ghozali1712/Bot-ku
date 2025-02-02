const { exec } = require('child_process');

// Fungsi untuk merestart bot menggunakan pm2
async function restartBot(ptz, chatId) {
    try {
        // Kirim pesan bahwa bot sedang di-restart
        await ptz.sendMessage(chatId, { text: "♻️ Bot sedang di-restart. Silakan tunggu 5 detik..." });

        console.log("♻️ Memulai ulang bot dengan pm2...");

        // Tunggu 5 detik sebelum memberi tahu pengguna bahwa bot sudah siap untuk dipakai
        setTimeout(async () => {
            // Kirim notifikasi setelah 5 detik
            await ptz.sendMessage(chatId, {
                text: "🕒 5 detik telah berlalu! Sekarang Anda bisa memulai kembali dengan mengetik *menu* atau *start*."
            });

            // Restart bot menggunakan pm2
            exec('pm2 restart botApp', (error, stdout, stderr) => {
                if (error) {
                    console.error(`Kesalahan saat restart bot dengan pm2: ${error.message}`);
                    return;
                }
                console.log(`Bot berhasil di-restart:\n${stdout}`);
            });

            // Akhiri proses saat ini setelah proses baru dimulai
            process.exit(0); // Menyelesaikan proses yang ada dan memulai ulang bot

        }, 5000); // Tunggu 5 detik sebelum memberikan notifikasi

    } catch (error) {
        console.error(`Kesalahan saat mencoba restart bot: ${error.message}`);
        await ptz.sendMessage(chatId, { text: "⚠️ Terjadi kesalahan saat mencoba restart bot." });
    }
}

module.exports = { restartBot };
