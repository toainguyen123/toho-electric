const fs = require('fs');

const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQWm2p0bF1cb1jjEdiol9BUZzVnH53XEvwpj9DW9QfOmgmbgj9VIX-QqoXXA6QCP-YvPQQQDGOaVrEW/pub?gid=1881975737&single=true&output=csv';

function formatImageUrl(url) {
    if (!url) return 'https://via.placeholder.com/300?text=No+Image';
    if (url.includes('drive.google.com')) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://lh3.googleusercontent.com/d/${match[1]}`;
        }
    }
    return url.trim();
}

function parseImageGallery(imageStr) {
    if (!imageStr) return ['https://via.placeholder.com/300?text=No+Image'];
    const urls = imageStr.split(/[,|]/).map(u => formatImageUrl(u.trim())).filter(u => u !== '');
    return urls.length > 0 ? urls : ['https://via.placeholder.com/300?text=No+Image'];
}

function parseCategoryHierarchy(subCategoryStr) {
    if (!subCategoryStr) return { subCategory: '', childCategory: '' };
    const parts = subCategoryStr.split('/').map(s => s.trim());
    return {
        subCategory: parts[0] || '',
        childCategory: parts[1] || ''
    };
}

function parseCSV(text) {
    if (!text || typeof text !== 'string') return [];
    let lines = text.split(/\r\n|\n|\r/);
    let result = [];
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        let row = [];
        let inQuotes = false;
        let field = '';
        for (let j = 0; j < line.length; j++) {
            let char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                row.push(field.trim());
                field = '';
            } else {
                field += char;
            }
        }
        row.push(field.trim());
        result.push(row);
    }
    return result;
}

async function convertSheetToJSON() {
    try {
        console.log("Đang lấy dữ liệu từ Google Sheets...");
        const res = await fetch(GOOGLE_SHEET_CSV_URL);
        const csvText = await res.text();
        const rows = parseCSV(csvText);

        const products = [];
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            if (cols && cols.length >= 4) {
                const rawId = cols[0].trim() || `SP${i}`;
                const gallery = parseImageGallery(cols[6] || '');
                const catHierarchy = parseCategoryHierarchy(cols[3] || '');
                const skuGroup = (cols[15] && cols[15].trim()) ? cols[15].trim() : rawId;

                products.push({
                    id: rawId,
                    code: rawId,
                    name: cols[1].trim() || 'Sản phẩm',
                    category: (cols[2] || 'Khác').trim(),
                    subCategory: catHierarchy.subCategory,
                    childCategory: catHierarchy.childCategory,
                    price: cols[4] || '0',
                    oldPrice: cols[5] || '0',
                    image: gallery[0],
                    images: gallery,
                    badge: cols[7] || '',
                    isFlashSale: (cols[8] || '').toUpperCase() === 'TRUE',
                    stock: cols[9] || 'Còn hàng',
                    specs: cols[10] || 'Bảo hành chính hãng',
                    soldCount: parseInt(cols[11]) || 5,
                    totalCount: parseInt(cols[12]) || 20,
                    variant1: cols[13] || '',
                    variant2: cols[14] || '',
                    skuGroup: skuGroup
                });
            }
        }

        fs.writeFileSync('data/products.json', JSON.stringify(products, null, 2), 'utf-8');
        // Bản JS cho chế độ mở file:// (trình duyệt chặn fetch Google Sheet) - nhúng thẳng biến
        fs.writeFileSync('data/products.js', 'window.PRODUCTS_FALLBACK = ' + JSON.stringify(products) + ';', 'utf-8');
        console.log(`Xuất thành công ${products.length} sản phẩm ra data/products.json + data/products.js!`);
    } catch (e) {
        console.error("Lỗi:", e);
    }
}

convertSheetToJSON();