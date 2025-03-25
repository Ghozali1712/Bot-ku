const fs = require('fs');
const path = require('path');
const { cariKodeDiExcelV2 } = require('./barcodev2');
const PDFDocument = require('pdfkit');
const { generateBarcodePDF } = require('./pdfGenerator');
const { sendMessage, sendFile } = require('./messageUtils');
const { restartBot } = require('./restartBot');

const RACKS_FILE = './racks.json';
const TEMP_DIR = './temp';
const ADMIN_NUMBER = '6285733818592';

// Memastikan direktori temp ada
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

// Memastikan file racks.json ada
if (!fs.existsSync(RACKS_FILE)) {
    fs.writeFileSync(RACKS_FILE, JSON.stringify({}, null, 2));
}

// Inisialisasi racks dari file
let racks = {};
if (fs.existsSync(RACKS_FILE)) {
    racks = JSON.parse(fs.readFileSync(RACKS_FILE, 'utf8'));
}

// Fungsi untuk mengecek apakah user adalah admin
function isAdmin(userId) {
    return userId === ADMIN_NUMBER;
}

// Fungsi untuk menambah rak
async function tambahRak(userId, namaRak) {
    try {
        // Validasi input
        if (!userId || !namaRak) {
            return {
                success: false,
                message: '❌ Parameter tidak lengkap. Silakan masukkan nama rak.'
            };
        }

        // Baca data rak yang ada
        let racks = {};
        if (fs.existsSync(RACKS_FILE)) {
            racks = JSON.parse(fs.readFileSync(RACKS_FILE, 'utf8'));
        }
        
        // Inisialisasi array rak untuk user jika belum ada
        if (!racks[userId]) {
            racks[userId] = [];
        }

        // Cek apakah nama rak sudah ada
        const existingRack = racks[userId].find(rack => 
            rack.nama.toLowerCase() === namaRak.toLowerCase()
        );

        if (existingRack) {
            return {
                success: false,
                message: '⚠️ Nama rak sudah ada. Silakan gunakan nama lain.'
            };
        }

        // Format data rak baru
        const newRack = {
            id: `RAK${racks[userId].length + 1}`,
            nama: namaRak,
            pluList: [], // Array untuk menyimpan daftar PLU
            createdAt: new Date().toISOString()
        };

        // Tambahkan rak baru ke array
        racks[userId].push(newRack);

        // Simpan ke file
        fs.writeFileSync(RACKS_FILE, JSON.stringify(racks, null, 2));

        return {
            success: true,
            message: `✅ Rak berhasil ditambahkan:\nID: ${newRack.id}\nNama: ${newRack.nama}\n\n📝 Silakan kirim kode PLU yang akan disimpan di rak ini.\nKetik *selesai* jika sudah selesai menambahkan PLU.`,
            rack: newRack
        };
    } catch (error) {
        console.error('Error dalam tambahRak:', error);
        return {
            success: false,
            message: '❌ Gagal menambahkan rak. Silakan coba lagi.'
        };
    }
}

// Fungsi untuk menambah PLU ke rak
async function tambahPLUkeRak(userId, rackId, pluInput) {
    try {
        // Validasi input
        if (!userId || !rackId || !pluInput) {
            return {
                success: false,
                message: '❌ Parameter tidak lengkap. Silakan coba lagi.'
            };
        }

        let racks = JSON.parse(fs.readFileSync(RACKS_FILE, 'utf8'));
        const userRacks = racks[userId] || [];
        const rackIndex = userRacks.findIndex(rack => rack.id === rackId);

        if (rackIndex === -1) {
            return {
                success: false,
                message: '❌ Rak tidak ditemukan.'
            };
        }

        // Pastikan pluList ada
        if (!userRacks[rackIndex].pluList) {
            userRacks[rackIndex].pluList = [];
        }

        // Split input berdasarkan koma atau baris baru
        const pluList = pluInput
            .split(/[,\n]/)
            .map(plu => plu.trim())
            .filter(plu => plu.length > 0);

        if (pluList.length === 0) {
            return {
                success: false,
                message: '⚠️ Format PLU tidak valid. Masukkan PLU yang dipisahkan dengan koma atau baris baru.'
            };
        }

        let addedPLUs = [];
        let duplicatePLUs = [];
        let invalidPLUs = [];

        // Proses setiap PLU
        for (const plu of pluList) {
            // Cek duplikasi
            if (userRacks[rackIndex].pluList.includes(plu)) {
                duplicatePLUs.push(plu);
                continue;
            }

            // Cek validitas PLU (bisa ditambahkan validasi tambahan di sini)
            if (plu.length < 3) {
                invalidPLUs.push(plu);
                continue;
            }

            // Tambahkan PLU ke rak
            userRacks[rackIndex].pluList.push(plu);
            addedPLUs.push(plu);
        }

        // Update file jika ada perubahan
        if (addedPLUs.length > 0) {
            racks[userId] = userRacks;
            fs.writeFileSync(RACKS_FILE, JSON.stringify(racks, null, 2));
        }

        // Buat pesan hasil
        let message = '';
        
        if (addedPLUs.length > 0) {
            message += `✅ ${addedPLUs.length} PLU berhasil ditambahkan ke ${userRacks[rackIndex].nama}:\n${addedPLUs.join(', ')}\n\n`;
        }
        
        if (duplicatePLUs.length > 0) {
            message += `⚠️ ${duplicatePLUs.length} PLU sudah ada di rak:\n${duplicatePLUs.join(', ')}\n\n`;
        }
        
        if (invalidPLUs.length > 0) {
            message += `❌ ${invalidPLUs.length} PLU tidak valid:\n${invalidPLUs.join(', ')}\n\n`;
        }

        // Tambahkan instruksi untuk langkah selanjutnya
        if (addedPLUs.length > 0) {
            message += `📝 Silakan kirim PLU lain atau ketik *selesai* untuk mengakhiri.`;
        } else {
            message += `⚠️ Tidak ada PLU yang berhasil ditambahkan.\nSilakan coba lagi dengan PLU yang valid atau ketik *selesai* untuk mengakhiri.`;
        }

        return {
            success: true,
            message: message
        };
    } catch (error) {
        console.error('Error dalam tambahPLUkeRak:', error);
        return {
            success: false,
            message: '❌ Gagal menambahkan PLU. Silakan coba lagi.'
        };
    }
}

// Fungsi untuk mendapatkan daftar rak
async function getRacks(userId) {
    try {
        if (!userId) {
            return {
                success: false,
                message: '❌ User ID tidak valid.'
            };
        }

        let racks = {};
        if (fs.existsSync(RACKS_FILE)) {
            racks = JSON.parse(fs.readFileSync(RACKS_FILE, 'utf8'));
        }

        const userRacks = racks[userId] || [];

        if (userRacks.length === 0) {
            return {
                success: false,
                message: '⚠️ Anda belum memiliki rak yang terdaftar.'
            };
        }

        const rackList = userRacks.map((rack, index) => {
            const safeRack = {
                id: rack.id || `RAK${index + 1}`,
                nama: rack.nama || 'Rak Tanpa Nama',
                pluList: Array.isArray(rack.pluList) ? rack.pluList : []
            };
            return `${index + 1}. *${safeRack.nama}*\n   🏷️ ID: ${safeRack.id}\n   📦 Jumlah PLU: ${safeRack.pluList.length}`;
        }).join('\n\n');

        // Menu berbeda untuk admin dan user
        let menuOptions = '';
        if (isAdmin(userId)) {
            menuOptions = `\n\n*Menu Admin:*\n` +
                `📝 _Ketik_ *tambah rak* _untuk menambah rak baru_\n` +
                `🔄 _Ketik_ *restart* _untuk me-restart bot_\n` +
                `📊 _Ketik_ *stats* _untuk melihat statistik_\n\n` +
                `*Menu Umum:*\n` +
                `📋 _Ketik nama rak untuk melihat isi rak_\n` +
                `🗑️ _Ketik_ *hapus#NAMA_RAK* _untuk menghapus rak_`;
        } else {
            menuOptions = `\n\n*Menu User:*\n` +
                `📋 _Ketik nama rak untuk melihat isi rak_\n` +
                `🗑️ _Ketik_ *hapus#NAMA_RAK* _untuk menghapus rak_`;
        }

        return {
            success: true,
            message: `📋 *DAFTAR RAK ANDA*\n\n${rackList}${menuOptions}`,
            racks: userRacks
        };
    } catch (error) {
        console.error('Error dalam getRacks:', error);
        return {
            success: false,
            message: '❌ Gagal mengambil daftar rak. Silakan coba lagi.'
        };
    }
}

// Fungsi untuk memilih dan menampilkan isi rak
async function pilihRak(userId, namaRak, ptz) {
    try {
        if (!userId || !namaRak || !ptz) {
            console.error('Parameter tidak lengkap untuk pilihRak:', { userId, namaRak, ptz });
            return {
                success: false,
                message: '❌ Parameter tidak lengkap untuk memilih rak.'
            };
        }

        // Baca data rak
        let racks = {};
        try {
            if (fs.existsSync(RACKS_FILE)) {
                const fileContent = fs.readFileSync(RACKS_FILE, 'utf8');
                racks = JSON.parse(fileContent);
                console.log('Data rak yang dibaca:', JSON.stringify(racks, null, 2));
            } else {
                console.error('File racks.json tidak ditemukan');
                return {
                    success: false,
                    message: '❌ Data rak tidak ditemukan. Silakan tambah rak terlebih dahulu.'
                };
            }
        } catch (error) {
            console.error('Error membaca file racks.json:', error);
            return {
                success: false,
                message: '❌ Gagal membaca data rak. Silakan coba lagi.'
            };
        }

        // Pastikan user memiliki rak
        if (!racks[userId] || !Array.isArray(racks[userId])) {
            console.error('User tidak memiliki rak:', userId);
            return {
                success: false,
                message: '❌ Anda belum memiliki rak. Silakan tambah rak terlebih dahulu.'
            };
        }

        // Cari rak berdasarkan nama
        const userRacks = racks[userId];
        console.log('Mencari rak dengan nama:', namaRak);
        console.log('Daftar rak user:', JSON.stringify(userRacks, null, 2));
        
        // Normalisasi nama rak untuk pencarian
        const normalizedSearchName = namaRak.toLowerCase().trim();
        
        // Cari rak dengan pencarian yang lebih fleksibel
        const selectedRack = userRacks.find(rack => {
            if (!rack.nama) return false;
            const normalizedRackName = rack.nama.toLowerCase().trim();
            return normalizedRackName === normalizedSearchName || 
                   normalizedRackName.includes(normalizedSearchName) ||
                   normalizedSearchName.includes(normalizedRackName);
        });

        if (!selectedRack) {
            console.error('Rak tidak ditemukan:', {
                searchedName: namaRak,
                normalizedSearchName,
                availableRacks: userRacks.map(r => r.nama)
            });
            return {
                success: false,
                message: '⚠️ Rak tidak ditemukan. Silakan periksa nama rak yang Anda masukkan.'
            };
        }

        // Pastikan pluList ada dan valid
        if (!Array.isArray(selectedRack.pluList)) {
            console.log('Menginisialisasi pluList kosong untuk rak:', selectedRack.nama);
            selectedRack.pluList = [];
            // Update racks file
            racks[userId] = userRacks;
            fs.writeFileSync(RACKS_FILE, JSON.stringify(racks, null, 2));
        }

        if (selectedRack.pluList.length === 0) {
            console.log('Rak kosong:', selectedRack.nama);
            return {
                success: true,
                message: `📋 *${selectedRack.nama}*\n\n⚠️ Rak ini masih kosong.`
            };
        }

        console.log('Rak ditemukan:', JSON.stringify(selectedRack, null, 2));
        console.log('Jumlah PLU:', selectedRack.pluList.length);

        // Tampilkan daftar PLU dan opsi pengiriman dengan format titik
        const optionsMessage = `📋 *${selectedRack.nama}*\n\n*Daftar PLU:*\n${selectedRack.pluList.join(', ')}\n\n*Pilih format pengiriman:*\n1️⃣ Kirim langsung\n2️⃣ Kirim sebagai PDF\n\n_Balas dengan angka 1 atau 2_`;
        await sendMessage(ptz, userId, optionsMessage);

        return {
            success: true,
            message: '',
            rack: selectedRack,
            waitingForOption: true
        };
    } catch (error) {
        console.error('Error dalam pilihRak:', error);
        return {
            success: false,
            message: '❌ Gagal memproses rak. Silakan coba lagi.'
        };
    }
}

// Fungsi untuk memproses barcode dan mengirim langsung
async function prosesKirimLangsung(userId, selectedRack, ptz) {
    try {
        const processingMsg = `_Memproses ${selectedRack.pluList.length} barcode..._`;
        await sendMessage(ptz, userId, processingMsg);

        const notFoundPLUs = [];
        const foundPLUs = [];

        for (const plu of selectedRack.pluList) {
            try {
                const result = await cariKodeDiExcelV2(plu, ptz, userId);
                if (result && result.success) {
                    foundPLUs.push(plu);
                } else {
                    notFoundPLUs.push(plu);
                }
            } catch (error) {
                console.error(`Error saat memproses PLU ${plu}:`, error);
                notFoundPLUs.push(plu);
            }
        }

        // Kirim laporan ke admin jika ada PLU yang tidak ditemukan
        if (notFoundPLUs.length > 0) {
            const adminReport = `📊 *Laporan PLU Tidak Ditemukan*\n\n` +
                `👤 User: ${userId}\n` +
                `📦 Rak: ${selectedRack.nama}\n` +
                `❌ PLU Tidak Ditemukan: ${notFoundPLUs.join(', ')}\n` +
                `✅ PLU Ditemukan: ${foundPLUs.length}\n` +
                `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}`;

            await sendAdminNotification(ptz, adminReport);
        }

        return {
            success: true,
            message: notFoundPLUs.length > 0 ? 
                `✅ Barcode berhasil dikirim!\n\n⚠️ PLU yang tidak ditemukan:\n${notFoundPLUs.join(', ')}` :
                '✅ Semua barcode berhasil dikirim!'
        };
    } catch (error) {
        console.error('Error dalam prosesKirimLangsung:', error);
        return {
            success: false,
            message: '❌ Gagal mengirim barcode. Silakan coba lagi.'
        };
    }
}

// Fungsi untuk mengirim notifikasi ke admin
async function sendAdminNotification(ptz, message) {
    try {
        // Pastikan format nomor admin benar (dengan @s.whatsapp.net)
        const adminNumber = ADMIN_NUMBER.includes('@s.whatsapp.net') ? 
            ADMIN_NUMBER : 
            `${ADMIN_NUMBER}@s.whatsapp.net`;
            
        await sendMessage(ptz, adminNumber, message);
        return true;
    } catch (error) {
        console.error('Error sending admin notification:', error);
        return false;
    }
}

// Fungsi untuk memproses pengiriman PDF
async function prosesKirimPDF(chatId, selectedRack, ptz) {
    try {
        // Kirim pesan sedang memproses menggunakan sendMessage utility
        await sendMessage(ptz, chatId, "⏳ Sedang memproses PDF...");

        // Buat direktori output jika belum ada
        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Dapatkan buffer untuk setiap PLU
        const bufferResults = await Promise.all(
            selectedRack.pluList.map(async (plu) => {
                const result = await cariKodeDiExcelV2(parseInt(plu, 10), ptz, chatId, true);
                if (!result || !result.success || !result.buffer) {
                    console.error(`Gagal mendapatkan buffer untuk PLU ${plu}:`, result);
                    return { plu, success: false };
                }
                return { plu, success: true, buffer: result.buffer };
            })
        );

        // Filter buffer yang valid dan catat PLU yang tidak ditemukan
        const validBuffers = bufferResults.filter(result => result.success).map(result => result.buffer);
        const notFoundPLUs = bufferResults.filter(result => !result.success).map(result => result.plu);
        const foundPLUs = bufferResults.filter(result => result.success).map(result => result.plu);
        
        if (validBuffers.length === 0) {
            return { success: false, message: "❌ Tidak ada barcode valid untuk dibuat PDF." };
        }

        // Generate PDF dengan nama rak
        let outputPath = path.join(outputDir, `${selectedRack.nama}_${Date.now()}.pdf`);
        
        try {
            // Pastikan direktori output ada
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Generate PDF
            await generateBarcodePDF(validBuffers, outputPath);
            
            // Tunggu sebentar untuk memastikan file sudah dibuat
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Cek apakah file ada dan memiliki ukuran yang valid
            if (!fs.existsSync(outputPath)) {
                throw new Error("PDF file was not created");
            }

            const fileStats = fs.statSync(outputPath);
            if (fileStats.size === 0) {
                throw new Error("PDF file is empty");
            }

            // Kirim PDF menggunakan format yang sama dengan PJR
            await ptz.sendMessage(chatId, {
                document: fs.readFileSync(outputPath),
                fileName: `${selectedRack.nama}_${Date.now()}.pdf`,
                mimetype: 'application/pdf'
            });

            // Hapus file PDF setelah terkirim
            fs.unlinkSync(outputPath);

            // Kirim ringkasan hasil ke user
            let summaryMessage = `📊 *Ringkasan Hasil Rak ${selectedRack.nama} (PDF)*\n\n` +
                `✅ PLU Ditemukan: ${foundPLUs.length}\n` +
                `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}\n` +
                `📄 Total PLU: ${selectedRack.pluList.length}\n` +
                `📈 Persentase Berhasil: ${((foundPLUs.length / selectedRack.pluList.length) * 100).toFixed(1)}%`;

            if (notFoundPLUs.length > 0) {
                summaryMessage += `\n\n⚠️ *PLU Tidak Ditemukan:*\n${notFoundPLUs.join(', ')}`;
            }

            await sendMessage(ptz, chatId, summaryMessage);

            // Kirim laporan ke admin jika ada PLU yang tidak ditemukan
            if (notFoundPLUs.length > 0) {
                let adminReport = `📊 *Laporan PLU Tidak Ditemukan (Rak ${selectedRack.nama} PDF)*\n\n` +
                    `👤 User: ${chatId}\n` +
                    `❌ PLU Tidak Ditemukan: ${notFoundPLUs.join(', ')}\n` +
                    `✅ PLU Ditemukan: ${foundPLUs.length}\n` +
                    `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}\n` +
                    `📄 Total PLU: ${selectedRack.pluList.length}\n` +
                    `📈 Persentase Gagal: ${((notFoundPLUs.length / selectedRack.pluList.length) * 100).toFixed(1)}%`;

                await sendAdminNotification(ptz, adminReport);
            }

            return { success: true, message: `✅ Selesai mengirim PDF untuk rak ${selectedRack.nama}` };
        } catch (error) {
            console.error('Error saat membuat atau mengirim PDF:', error);
            // Hapus file PDF jika ada error
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
            return { 
                success: false, 
                message: "❌ Gagal membuat PDF. Silakan coba lagi atau pilih format pengiriman langsung." 
            };
        }

    } catch (error) {
        console.error('Error dalam prosesKirimPDF:', error);
        return { 
            success: false, 
            message: "❌ Terjadi kesalahan saat memproses PDF: " + error.message 
        };
    }
}

// Fungsi untuk memproses pilihan format pengiriman
async function prosesFormatPengiriman(chatId, rack, format, ptz) {
    try {
        if (!rack || !rack.pluList || rack.pluList.length === 0) {
            return { success: false, message: '❌ Rak tidak memiliki PLU.' };
        }

        if (format === '1') {
            // Kirim langsung
            const notFoundPLUs = [];
            const foundPLUs = [];

            for (const plu of rack.pluList) {
                const result = await cariKodeDiExcelV2(parseInt(plu, 10), ptz, chatId);
                if (result && result.success) {
                    foundPLUs.push(plu);
                } else {
                    notFoundPLUs.push(plu);
                }
            }

            // Kirim ringkasan hasil
            const summaryMessage = `📊 *Ringkasan Hasil Rak ${rack.nama}*\n\n` +
                `✅ PLU Ditemukan: ${foundPLUs.length}\n` +
                `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}\n` +
                `📄 Total PLU: ${rack.pluList.length}\n` +
                `📈 Persentase Berhasil: ${((foundPLUs.length / rack.pluList.length) * 100).toFixed(1)}%`;

            if (notFoundPLUs.length > 0) {
                summaryMessage += `\n\n⚠️ *PLU Tidak Ditemukan:*\n${notFoundPLUs.join(', ')}`;
            }

            await sendMessage(ptz, chatId, summaryMessage);

            // Kirim laporan ke admin jika ada PLU yang tidak ditemukan
            if (notFoundPLUs.length > 0) {
                const adminReport = `📊 *Laporan PLU Tidak Ditemukan (Rak ${rack.nama})*\n\n` +
                    `👤 User: ${chatId}\n` +
                    `❌ PLU Tidak Ditemukan: ${notFoundPLUs.join(', ')}\n` +
                    `✅ PLU Ditemukan: ${foundPLUs.length}\n` +
                    `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}\n` +
                    `📄 Total PLU: ${rack.pluList.length}\n` +
                    `📈 Persentase Gagal: ${((notFoundPLUs.length / rack.pluList.length) * 100).toFixed(1)}%`;

                await sendAdminNotification(ptz, adminReport);
            }

            return { success: true, message: `✅ Selesai mengirim barcode untuk rak ${rack.nama}` };
        } else if (format === '2') {
            return await prosesKirimPDF(chatId, rack, ptz);
        } else {
            return { success: false, message: '❌ Format tidak valid. Silakan pilih 1 atau 2.' };
        }
    } catch (error) {
        console.error('Error di prosesFormatPengiriman:', error);
        return { success: false, message: '❌ Terjadi kesalahan saat memproses format pengiriman.' };
    }
}

// Fungsi untuk menghapus rak
async function hapusRak(userId, namaRak) {
    try {
        let racks = {};
        if (fs.existsSync(RACKS_FILE)) {
            racks = JSON.parse(fs.readFileSync(RACKS_FILE, 'utf8'));
        }

        const userRacks = racks[userId] || [];
        const rackIndex = userRacks.findIndex(rack => rack.nama.toLowerCase() === namaRak.toLowerCase());

        if (rackIndex === -1) {
            return {
                success: false,
                message: '⚠️ Rak tidak ditemukan. Silakan periksa nama rak yang Anda masukkan.'
            };
        }

        const deletedRack = userRacks[rackIndex];
        userRacks.splice(rackIndex, 1);
        racks[userId] = userRacks;
        fs.writeFileSync(RACKS_FILE, JSON.stringify(racks, null, 2));

        return {
            success: true,
            message: `✅ Rak *${deletedRack.nama}* berhasil dihapus.\n\n📋 *Info Rak:*\n🏷️ ID: ${deletedRack.id}\n📦 Jumlah PLU: ${deletedRack.pluList?.length || 0}`
        };
    } catch (error) {
        console.error('Error dalam hapusRak:', error);
        return {
            success: false,
            message: '❌ Gagal menghapus rak. Silakan coba lagi.'
        };
    }
}

// Fungsi untuk memproses pesan admin
async function processAdminCommand(message, userId, ptz) {
    if (!isAdmin(userId)) {
        return {
            success: false,
            message: '❌ Anda tidak memiliki akses ke perintah ini.'
        };
    }

    const command = message.toLowerCase();
    
    if (command === 'restart') {
        try {
            await sendMessage(ptz, userId, '_Memulai proses restart bot..._');
            // Tambahkan logika restart bot di sini
            return {
                success: true,
                message: '✅ Bot akan di-restart dalam beberapa detik.'
            };
        } catch (error) {
            return {
                success: false,
                message: '❌ Gagal melakukan restart bot.'
            };
        }
    } else if (command === 'stats') {
        try {
            let racks = {};
            if (fs.existsSync(RACKS_FILE)) {
                racks = JSON.parse(fs.readFileSync(RACKS_FILE, 'utf8'));
            }

            let totalRacks = 0;
            let totalPLUs = 0;
            let totalUsers = 0;

            for (const userId in racks) {
                totalUsers++;
                const userRacks = racks[userId];
                totalRacks += userRacks.length;
                userRacks.forEach(rack => {
                    totalPLUs += rack.pluList.length;
                });
            }

            const statsMessage = `📊 *Statistik Sistem*\n\n` +
                `👥 Total User: ${totalUsers}\n` +
                `📦 Total Rak: ${totalRacks}\n` +
                `🏷️ Total PLU: ${totalPLUs}\n` +
                `📈 Rata-rata PLU per Rak: ${(totalPLUs / totalRacks).toFixed(1)}`;

            await sendMessage(ptz, userId, statsMessage);
            return {
                success: true,
                message: ''
            };
        } catch (error) {
            return {
                success: false,
                message: '❌ Gagal mengambil statistik.'
            };
        }
    }

    return {
        success: false,
        message: '❌ Perintah admin tidak valid.'
    };
}

// Fungsi untuk memvalidasi perintah
function isValidCommand(message) {
    // Cek apakah pesan adalah pilihan format pengiriman (.1 atau .2)
    if (/^\.(1|2)$/.test(message)) {
        return true;
    }

    const validCommands = [
        'tambah rak',
        'restart',
        'stats',
        'selesai'
    ];

    // Cek apakah pesan adalah perintah yang valid
    const isCommand = validCommands.some(cmd => 
        message.toLowerCase().startsWith(cmd.toLowerCase())
    );

    // Cek apakah pesan adalah nama rak (untuk melihat isi rak)
    const isRackName = message.length > 0 && !message.startsWith('.');

    // Cek apakah pesan adalah perintah hapus
    const isDeleteCommand = message.toLowerCase().startsWith('hapus#');

    return isCommand || isRackName || isDeleteCommand;
}

// Fungsi untuk memproses pesan
async function processMessage(message, userId, ptz) {
    try {
        // Jika pesan bukan perintah yang valid, abaikan
        if (!isValidCommand(message)) {
            return {
                success: true,
                message: '',
                ignore: true
            };
        }

        // Proses perintah admin
        if (isAdmin(userId)) {
            const adminResult = await processAdminCommand(message, userId, ptz);
            if (adminResult.success) {
                return adminResult;
            }
        }

        // Proses pilihan format pengiriman (.1 atau .2)
        if (/^\.(1|2)$/.test(message)) {
            const option = message.substring(1);
            return {
                success: true,
                message: '',
                waitingForFormatOption: true,
                option: option
            };
        }

        // Proses perintah tambah rak
        if (message.toLowerCase() === 'tambah rak') {
            if (!isAdmin(userId)) {
                return {
                    success: false,
                    message: '❌ Anda tidak memiliki akses ke perintah ini.'
                };
            }
            return {
                success: true,
                message: '📝 Silakan masukkan nama rak yang ingin ditambahkan:',
                waitingForRackName: true
            };
        }

        // Proses perintah hapus rak
        if (message.toLowerCase().startsWith('hapus#')) {
            const namaRak = message.substring(6);
            return await hapusRak(userId, namaRak);
        }

        // Proses melihat isi rak (jika pesan adalah nama rak)
        return await pilihRak(userId, message, ptz);

    } catch (error) {
        console.error('Error dalam processMessage:', error);
        return {
            success: false,
            message: '❌ Gagal memproses pesan. Silakan coba lagi.'
        };
    }
}

module.exports = {
    tambahRak,
    tambahPLUkeRak,
    getRacks,
    pilihRak,
    hapusRak,
    prosesFormatPengiriman,
    prosesKirimPDF,
    isAdmin,
    processAdminCommand,
    processMessage,
    isValidCommand,
    sendAdminNotification,
    racks
};