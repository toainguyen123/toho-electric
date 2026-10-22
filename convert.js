// ============================================================
// CHUYỂN GOOGLE SHEETS → data/products.json + data/products.js
// NÂNG CẤP:
//  • ĐỌC CỘT THEO TÊN (dòng 1 của sheet) — xóa/thêm/sắp xếp lại cột trên
//    Sheets không làm lệch dữ liệu. Cột FLASH SALE xóa được luôn.
//  • HỢP NHẤT (merge) với product hiện có trong source thay vì ghi đè:
//    - Ưu tiên giá trị mới từ Sheet cho: name, price, image, category...
//    - FLASH SALE + MÔ TẢ (description) + SKU do trang admin quản lý →
//      giữ nguyên giá trị trong source khi Sheet bỏ trống/không có cột.
//    - Sản PHẨM chỉ có ở source (Đăng trong admin, hàng nhập LIOA) →
//      KHÔNG bị xóa khi "Cập nhật từ Sheets".
// Chạy: node convert.js
// ============================================================
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data');

const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQWm2p0bF1cb1jjEdiol9BUZzVnH53XEvwpj9DW9QfOmgmbgj9VIX-QqoXXA6QCP-YvPQQQDGOaVrEW/pub?gid=1881975737&single=true&output=csv';

function formatImageUrl(url) {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
    return url.trim();
}

function parseImageGallery(imageStr) {
    const urls = String(imageStr || '').split(/[,|]/).map(u => formatImageUrl(u.trim())).filter(Boolean);
    return urls.length > 0 ? urls : ['images/no-image.svg'];
}

function parseCategoryHierarchy(subCategoryStr) {
    const parts = String(subCategoryStr || '').split('/').map(s => s.trim());
    return { subCategory: parts[0] || '', childCategory: parts[1] || '' };
}

function parseCSV(text) {
    const lines = String(text || '').split(/\r\n|\n|\r/);
    const rows = [];
    for (const lineRaw of lines) {
        if (!lineRaw.trim()) continue;
        const row = [];
        let inQ = false, field = '';
        for (let i = 0; i < lineRaw.length; i++) {
            const c = lineRaw[i];
            if (c === '"') { inQ = !inQ; }
            else if (c === ',' && !inQ) { row.push(field.trim()); field = ''; }
            else field += c;
        }
        row.push(field.trim());
        rows.push(row);
    }
    return rows;
}

// Map các cột theo TÊN trong dòng tiêu đề (bất kể thứ tự)
function buildHeaderMap(headerRow) {
    const map = {};
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    headerRow.forEach((h, i) => { map[norm(h)] = i; });
    // Tên chuẩn trong sheet: id, name, category, subCategory, price, oldPrice,
    // image, badge, isFlashSale, stock, specs, soldCount, totalCount,
    // variant1, variant2, skuGroup
    const col = (names, fallbackIdx) => {
        for (const n of names) if (map[n] !== undefined) return map[n];
        return fallbackIdx;
    };
    return {
        id: col(['id', 'code'], 0),
        name: col(['name', 'ten'], 1),
        category: col(['category'], 2),
        subCategory: col(['subcategory'], 3),
        price: col(['price'], 4),
        oldPrice: col(['oldprice'], 5),
        image: col(['image'], 6),
        badge: col(['badge'], 7),
        isFlashSale: col(['isflashsale', 'flashsale', 'flash'], 8),
        stock: col(['stock'], 9),
        specs: col(['specs'], 10),
        soldCount: col(['soldcount'], 11),
        totalCount: col(['totalcount'], 12),
        variant1: col(['variant1'], 13),
        variant2: col(['variant2'], 14),
        skuGroup: col(['skugroup', 'sku'], 15)
    };
}

async function convertSheetToJSON() {
    console.log('Đang lấy dữ liệu từ Google Sheets...');
    const res = await fetch(GOOGLE_SHEET_CSV_URL);
    const csvText = await res.text();
    const rows = parseCSV(csvText);
    if (!rows.length) throw new Error('Sheet trống');

    const H = buildHeaderMap(rows[0]);
    const cell = (cols, idx, def = '') => (idx >= 0 && cols[idx] !== undefined ? cols[idx] : def);

    // Dữ liệu hiện có trong source (merge giữ hàng admin tạo)
    let existing = [];
    try { existing = JSON.parse(fs.readFileSync(path.join(DATA, 'products.json'), 'utf8')); }
    catch { existing = []; }
    const byId = new Map(existing.map((p) => [String(p.id), p]));
    const seenSheetIds = new Set();

    let added = 0, updated = 0;
    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        if (!cols || cols.filter(Boolean).length === 0) continue;
        const rawId = cell(cols, H.id).trim() || `SP${i}`;
        // lọc dòng rác kiểu "Bảo quản: Nơi khô ráo"
        if (/^[A-Za-z0-9]/.test(rawId) === false && !rawId.startsWith('SP')) continue;
        seenSheetIds.add(String(rawId));

        const gallery = parseImageGallery(cell(cols, H.image));
        const catH = parseCategoryHierarchy(cell(cols, H.subCategory));
        const sheetData = {
            id: rawId,
            code: rawId,
            name: cell(cols, H.name).trim() || 'Sản phẩm',
            category: (cell(cols, H.category) || 'Khác').trim(),
            subCategory: catH.subCategory,
            childCategory: catH.childCategory,
            price: cell(cols, H.price) || '0',
            oldPrice: cell(cols, H.oldPrice) || '0',
            image: gallery[0],
            images: gallery,
            badge: cell(cols, H.badge),
            stock: cell(cols, H.stock) || 'Còn hàng',
            specs: cell(cols, H.specs) || 'Bảo hành chính hãng',
            soldCount: parseInt(cell(cols, H.soldCount)) || 5,
            totalCount: parseInt(cell(cols, H.totalCount)) || 20,
            variant1: cell(cols, H.variant1),
            variant2: cell(cols, H.variant2),
            skuGroup: cell(cols, H.skuGroup).trim() || rawId
        };
        const sheetFlashTrue = String(cell(cols, H.isFlashSale)).toUpperCase() === 'TRUE';

        const old = byId.get(String(rawId));
        if (old) {
            // Sheet mới hơn → cập nhật các trường dữ liệu chính
            Object.assign(old, sheetData);
            // FLASH SALE: sheet chỉ "TRUE" mới bật; bỏ trống/xóa cột → giữ giá trị admin đã đặt
            old.isFlashSale = sheetFlashTrue ? true : (old.isFlashSale === true);
            // description/sku: chỉ admin tạo → không bị sheet ghi đè (field không có trong sheetData)
            updated++;
        } else {
            sheetData.isFlashSale = sheetFlashTrue;
            sheetData.description = ''; // field do admin tạo; sheet không có cột này
            sheetData.sku = rawId;
            byId.set(String(rawId), sheetData);
            added++;
        }
    }

    // Danh sách cuối: toàn bộ (sheet + những hàng chỉ có ở source như hàng nhập LIOA/admin)
    const products = [...byId.values()].filter((p) => p && p.id && !String(p.id).includes('Bảo quản'));

    fs.writeFileSync(path.join(DATA, 'products.json'), JSON.stringify(products, null, 2), 'utf-8');
    const js = `window.PRODUCTS_DATA = ${JSON.stringify(products)};\nwindow.PRODUCTS_FALLBACK = window.PRODUCTS_DATA;`;
    fs.writeFileSync(path.join(DATA, 'products.js'), js, 'utf-8');

    const flashCount = products.filter((p) => p.isFlashSale === true).length;
    console.log(`✓ Sheet: cập nhật ${updated} sản phẩm có sẵn, thêm mới ${added} sản phẩm`);
    console.log(`✓ Tổng source: ${products.length} sản phẩm (giữ nguyên hàng do admin/LIOA tạo) — ${flashCount} đang Flash Sale`);
}

if (require.main === module) {
    convertSheetToJSON().catch(e => console.error('Lỗi:', e));
}
module.exports = { convertSheetToJSON, parseCSV, buildHeaderMap };
