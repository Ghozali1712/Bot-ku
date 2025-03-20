const fs = require('fs');
const path = require('path');
const { cariKodeDiExcelV2 } = require('./barcodev2');
const PDFDocument = require('pdfkit');
const { generateBarcodesPDF } = require('./pdfGenerator');

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
            return {
                success: false,
                message: '❌ Parameter tidak lengkap untuk memilih rak.'
            };
        }

        let racks = {};
        if (fs.existsSync(RACKS_FILE)) {
            racks = JSON.parse(fs.readFileSync(RACKS_FILE, 'utf8'));
        }

        const userRacks = racks[userId] || [];
        const selectedRack = userRacks.find(rack => 
            rack.nama && rack.nama.toLowerCase() === namaRak.toLowerCase()
        );

        if (!selectedRack) {
            return {
                success: false,
                message: '⚠️ Rak tidak ditemukan. Silakan periksa nama rak yang Anda masukkan.'
            };
        }

        // Pastikan pluList ada dan valid
        if (!Array.isArray(selectedRack.pluList)) {
            selectedRack.pluList = [];
            // Update racks file
            racks[userId] = userRacks;
            fs.writeFileSync(RACKS_FILE, JSON.stringify(racks, null, 2));
        }

        if (selectedRack.pluList.length === 0) {
            return {
                success: true,
                message: `📋 *${selectedRack.nama}*\n\n⚠️ Rak ini masih kosong.`
            };
        }

        // Tampilkan daftar PLU dan opsi pengiriman dengan format titik
        const optionsMessage = `📋 *${selectedRack.nama}*\n\n*Daftar PLU:*\n${selectedRack.pluList.join(', ')}\n\n*Pilih format pengiriman:*\n*.1* Kirim langsung\n*.2* Kirim sebagai PDF\n\n_Balas dengan .1 atau .2_`;
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

        for (const plu of selectedRack.pluList) {
            try {
                await cariKodeDiExcelV2(plu, ptz, userId);
            } catch (error) {
                console.error(`Error saat memproses PLU ${plu}:`, error);
            }
        }

        return {
            success: true,
            message: ''
        };
    } catch (error) {
        console.error('Error dalam prosesKirimLangsung:', error);
        return {
            success: false,
            message: '❌ Gagal mengirim barcode. Silakan coba lagi.'
        };
    }
}

// Helper function untuk mengirim pesan dengan retry mechanism
async function sendMessage(ptz, chatId, message, maxRetries = 3) {
    let retryCount = 0;
    while (retryCount < maxRetries) {
        try {
            if (!ptz.user) {
                throw new Error('WhatsApp connection not ready');
            }
            
            await ptz.sendMessage(chatId, { text: message });
            return true;
        } catch (error) {
            console.error(`Attempt ${retryCount + 1}/${maxRetries} failed:`, error.message);
            retryCount++;
            
            if (error.message.includes('Connection Closed') || error.message.includes('not ready')) {
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }
            
            if (retryCount === maxRetries) {
                console.error('Failed to send message after max retries:', error);
                throw new Error(`Gagal mengirim pesan setelah ${maxRetries} percobaan`);
            }
        }
    }
    return false;
}

// Fungsi untuk mengirim file dengan retry mechanism
async function sendFile(ptz, chatId, fileData, maxRetries = 3) {
    let retryCount = 0;
    while (retryCount < maxRetries) {
        try {
            if (!ptz.user) {
                throw new Error('WhatsApp connection not ready');
            }

            await ptz.sendMessage(chatId, fileData);
            return true;
        } catch (error) {
            console.error(`Attempt ${retryCount + 1}/${maxRetries} failed:`, error.message);
            retryCount++;
            
            if (error.message.includes('Connection Closed') || error.message.includes('not ready')) {
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }
            
            if (retryCount === maxRetries) {
                console.error('Failed to send file after max retries:', error);
                throw new Error(`Gagal mengirim file setelah ${maxRetries} percobaan`);
            }
        }
    }
    return false;
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

// Fungsi untuk membuat dan mengirim PDF
async function prosesKirimPDF(chatId, selectedRack, ptz) {
    try {
        // Kirim pesan processing
        await sendMessage(ptz, chatId, `_Memproses ${selectedRack.pluList.length} PLU..._`);

        const notFoundPLUs = [];
        const validPLUs = [];

        // Proses PLU untuk mendapatkan barcode
        for (const plu of selectedRack.pluList) {
            try {
                const barcodeResult = await cariKodeDiExcelV2(plu, ptz, chatId, true);
                if (!barcodeResult.success) {
                    notFoundPLUs.push(plu);
                } else {
                    validPLUs.push({
                        plu,
                        buffer: barcodeResult.buffer
                    });
                }
            } catch (error) {
                console.error(`Error saat memproses PLU ${plu}:`, error);
                notFoundPLUs.push(plu);
            }
        }

        // Kirim pesan PLU yang tidak ditemukan jika ada
        if (notFoundPLUs.length > 0) {
            const notFoundMessage = `⚠️ *PLU tidak ditemukan:*\n${notFoundPLUs.join(', ')}`;
            await sendMessage(ptz, chatId, notFoundMessage);

            // Kirim notifikasi ke admin
            const adminMessage = `🚨 *Laporan PLU Tidak Ditemukan*\n\n` +
                `👤 User: ${chatId}\n` +
                `📦 Rak: ${selectedRack.nama}\n` +
                `❌ PLU Tidak Ditemukan: ${notFoundPLUs.length}\n` +
                `📝 Daftar PLU:\n${notFoundPLUs.join(', ')}`;
            
            await sendAdminNotification(ptz, adminMessage);
        }

        // Jika tidak ada PLU valid, hentikan proses
        if (validPLUs.length === 0) {
            return {
                success: false,
                message: '❌ Tidak ada barcode yang dapat dibuat karena semua PLU tidak ditemukan.'
            };
        }

        await sendMessage(ptz, chatId, `_Membuat PDF untuk ${validPLUs.length} barcode..._`);

        // Buat nama file PDF yang unik
        const timestamp = new Date().getTime();
        const pdfPath = `./temp/${selectedRack.nama}_${timestamp}.pdf`;

        // Pastikan direktori temp ada
        if (!fs.existsSync('./temp')) {
            fs.mkdirSync('./temp');
        }

        // Buat dokumen PDF baru dengan ukuran A4
        const doc = new PDFDocument({ 
            size: 'A4',
            margin: 20 // Margin 20mm di semua sisi
        });
        const output = fs.createWriteStream(pdfPath);
        doc.pipe(output);

        // Hitung lebar maksimum untuk barcode
        const pageWidth = doc.page.width;
        const maxBarcodeWidth = pageWidth - 40; // 40mm untuk margin kiri dan kanan

        let yPosition = 40; // Posisi awal di PDF
        const spacing = 120; // Jarak antar barcode diperbesar

        // Proses semua barcode
        for (const pluData of validPLUs) {
            try {
                // Simpan buffer ke file temporary
                const tempImagePath = `temp_${pluData.plu}.png`;
                fs.writeFileSync(tempImagePath, pluData.buffer);

                // Tambahkan gambar barcode dengan lebar maksimum dan tinggi yang lebih besar
                doc.image(tempImagePath, 20, yPosition, {
                    width: maxBarcodeWidth,
                    height: 60 // Tinggi barcode diperbesar
                });

                // Hapus file temporary
                fs.unlinkSync(tempImagePath);

                // Update posisi Y untuk barcode berikutnya
                yPosition += spacing;

                // Jika posisi Y mendekati akhir halaman, buat halaman baru
                if (yPosition > 700) {
                    doc.addPage();
                    yPosition = 40;
                }

            } catch (err) {
                console.error(`Error saat menambahkan barcode ke PDF: ${err}`);
            }
        }

        // Finalisasi PDF
        doc.end();

        // Tunggu sampai PDF selesai dibuat
        await new Promise((resolve, reject) => {
            output.on('finish', resolve);
            output.on('error', reject);
        });

        // Kirim PDF
        await ptz.sendMessage(chatId, {
            document: fs.readFileSync(pdfPath),
            fileName: `${selectedRack.nama}.pdf`,
            mimetype: 'application/pdf'
        });

        // Hapus file temporary
        fs.unlinkSync(pdfPath);

        // Kirim ringkasan
        const summaryMessage = `✅ *Proses Selesai*\n` +
            `📊 Total PLU: ${selectedRack.pluList.length}\n` +
            `✓ Berhasil: ${validPLUs.length}\n` +
            `❌ Gagal: ${notFoundPLUs.length}`;
        await sendMessage(ptz, chatId, summaryMessage);

        return { success: true, message: "✅ PDF berhasil dikirim!" };
    } catch (error) {
        console.error('❌ Error saat membuat PDF:', error);
        return { success: false, message: "❌ Gagal membuat PDF. Silakan coba lagi." };
    }
}

// Fungsi untuk memproses pilihan format pengiriman
async function prosesFormatPengiriman(userId, selectedRack, option, ptz) {
    try {
        switch (option) {
            case '1':
                return await prosesKirimLangsung(userId, selectedRack, ptz);
            case '2':
                return await prosesKirimPDF(userId, selectedRack, ptz);
            default:
                return {
                    success: false,
                    message: '❌ Pilihan tidak valid. Silakan pilih 1 atau 2.'
                };
        }
    } catch (error) {
        console.error('Error dalam prosesFormatPengiriman:', error);
        return {
            success: false,
            message: '❌ Gagal memproses pilihan. Silakan coba lagi.'
        };
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

            const statsMessage = `📊 *STATISTIK BOT*\n\n` +
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

    // Cek apakah pesan adalah pilihan format pengiriman (.1 atau .2)
    const isFormatChoice = /^\.(1|2)$/.test(message);

    return isCommand || isRackName || isDeleteCommand || isFormatChoice;
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

        // Proses pilihan format pengiriman
        if (/^\.(1|2)$/.test(message)) {
            const option = message.substring(1);
            return {
                success: true,
                message: '',
                waitingForFormatOption: true,
                option: option
            };
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
    sendAdminNotification
}; 