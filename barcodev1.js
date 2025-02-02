const fs = require('fs');

function tambahData(entries, filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify({ barcodesheet: [] }, null, 4));
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        let berhasilDitambah = [];
        let gagalDitambah = [];

        entries.forEach(entry => {
            const [plu, barcode] = entry.split(',').map(e => e.trim());

            if (!plu || !barcode || !/^\d+$/.test(plu) || !/^\d{13}$/.test(barcode)) {
                gagalDitambah.push(entry);
                return;
            }

            const dataSudahAda = data.barcodesheet.some(item => item.plu === plu || item.barcode === barcode);
            if (dataSudahAda) {
                gagalDitambah.push(entry);
                return;
            }

            data.barcodesheet.push({ plu, barcode });
            berhasilDitambah.push(entry);
        });

        fs.writeFileSync(filePath, JSON.stringify(data, null, 4));

        return { berhasilDitambah, gagalDitambah };
    } catch (err) {
        console.error(`Gagal menambah data: ${err.message}`);
        throw new Error('Kesalahan saat memproses file JSON.');
    }
}

module.exports = { tambahData };
