const categoryBannerMap = {
    "Ổ CẮM ĐIỆN": "images/opt/category-o-cam-dien.webp",
    "DÂY ĐIỆN": "images/opt/category-day-dien.webp",
    "ỔN ÁP": "images/opt/category-thiet-bi-dien.webp",
    "BIẾN ÁP": "images/opt/category-thiet-bi-dien.webp",
    "THIẾT BỊ ĐIỆN": "images/opt/category-thiet-bi-dien.webp"
};
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQWm2p0bF1cb1jjEdiol9BUZzVnH53XEvwpj9DW9QfOmgmbgj9VIX-QqoXXA6QCP-YvPQQQDGOaVrEW/pub?gid=1881975737&single=true&output=csv';
const GOOGLE_SHEET_POLICY_CSV_URL = ''; // (đã tắt) bài viết chỉ quản lý từ Admin cục bộ
const GOOGLE_SHEET_DEVICES_CSV_URL = ''; // (để trống = dùng 8 thiết bị mặc định; dán link Sheet csv vào nếu muốn nạp danh sách riêng)
const GOOGLE_SHEET_COUPON_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTwd1vDetlRkcIJlVh_kJSPjOkelKivMYZ_t6F_6lj6B9DJZwq9qCcf1Bqv6C8JQ50lOUKwqWaMBuuL/pub?gid=242716168&single=true&output=csv'; 

// === ĐƯỜNG DẪN GOOGLE SHEET THIẾT BỊ CÔNG SUẤT ===
// BẠN DÁN LINK CSV SHEETS THIẾT BỊ CỦA BẠN VÀO DÒNG DƯỚI DÂY:

const SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzth1uAlb4AaxDKmi_Wb0RDdfTPU7ZaqDx6epOz4SRFZeBBYPIWqx2HtsSta479mzLW/exec';
// Web App của sheet ĐƠN HÀNG (ghi đơn tự động vào Google Sheet) — dán URL sau khi Deploy
const ORDER_SHEET_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbycNEhdFYiPke9U7-stHw6OQQdSvHlAeCNMCf4GAphEHRQsCbbenh1fKtXbQtvqBMiyog/exec';

// CẤU HÌNH EMAILJS KHÔNG ĐỔI
const EMAILJS_SERVICE_ID = 'service_w02rs0l';
const EMAILJS_TEMPLATE_ID = 'template_fgyf3nz';

let products = [];
let filteredProducts = [];
let cart = [];
let recentlyViewed = [];
let selectedVariant = ''; 
let currentDetailProduct = null;
let policiesMap = {};

let couponsList = [];
let appliedCoupon = null;
let isFlying = false;

// DANH SÁCH THIẾT BỊ CHO MÁY TÍNH CÔNG SUẤT
let deviceList = [];
let selectedDevices = {};

// --- TIỆN ÍCH XỬ LÝ HÌNH ẢNH & GIÁ ---
// Ảnh lỗi cho sạch: dùng file local thay vì dịch vụ placeholder ngoài (tránh thêm chậm/lỗi)
const IMG_PLACEHOLDER = 'images/no-image.svg';

// Ảnh Google Drive thi thoảng bị từ chối khi tải hàng loạt → thử lại 1 lần sau 1.2s,
// hỏng hẳn mới thay bằng ảnh dự phòng (tránh khiếm khuyết "không đầy đủ" từ người dùng thấy)
window.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement)) return;
  const src = String(img.currentSrc || img.src || '');
  if (!/googleusercontent|drive\.google/.test(src)) return;
  if (img.dataset.retried) { if (!img.src.includes('no-image')) img.src = IMG_PLACEHOLDER; return; }
  img.dataset.retried = '1';
  setTimeout(() => { img.src = IMG_PLACEHOLDER; setTimeout(() => { img.src = src; }, 30); }, 1200);
}, true);

// chống lặp vô hạn khi placeholder cũng lỗi
function imgFallback(el) {
    if (el && !el.dataset.fbk) {
        el.dataset.fbk = '1';
        el.src = IMG_PLACEHOLDER;
    }
}
window.imgFallback = imgFallback;

// Vá ký tự quý ớt khi nhét text vào attribute HTML (dấu nháy, dấu < ...)
function sanitizeAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/'/g, '&#39;');
}
window.sanitizeAttr = sanitizeAttr;

// Chèn tham số kích thước googleusercontent để tải nhẹ hơn (thay vì bản gốc to hàng chục MB)
function googleImageSized(url, width) {
    // LƯU Ý: các file Drive của TOHO KHÔNG nhận tham số =w... (thử =w500/=w600/thumbnail đều lỗi)
    // → trả về URL góc, chỉ khi ảnh đó là ảnh Drive dùng chung (lh3) có khả năng resize mới ghim tham số
    return url.replace(/=[^=]*$/, '');
}

function formatImageUrl(url) {
    if (!url) return IMG_PLACEHOLDER;
    let u = String(url).trim();
    if (u.includes('drive.google.com')) {
        const match = u.match(/\/d\/([a-zA-Z0-9_-]+)/) || u.match(/id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            u = `https://lh3.googleusercontent.com/d/${match[1]}`;
        }
    }
    if (/lh([0-9]+)\.googleusercontent\.com/.test(u)) {
        // Ưu tiên ảnh đã tải cục bộ (tools/download-images.js làm kho ảnh riêng, khỏi bị Drive throttle)
        const localMap = window.LOCAL_IMAGES;
        if (localMap) {
            const m = u.match(/\/d\/([A-Za-z0-9_-]{20,})/);
            if (m && localMap[m[1]]) return localMap[m[1]];
        }
        return googleImageSized(u, 800);
    }
    return u;
}

// Dùng cho ảnh nhỏ (thumbnail giỏ hàng, ảnh trong thư viện góc)
function smallImageUrl(url, width = 200) {
    const u = formatImageUrl(url);
    if (/=w\d+$/.test(u)) return u.replace(/=w\d+$/, '=w' + width);
    return u;
}

function parseImageGallery(imageStr) {
    if (!imageStr) return [IMG_PLACEHOLDER];
    const urls = imageStr.split(/[,|]/).map(u => formatImageUrl(u.trim())).filter(u => u !== '');
    return urls.length > 0 ? urls : [IMG_PLACEHOLDER];
}

function parsePrice(val) {
    if (!val) return 0;
    let str = String(val).trim();
    let cleanStr = str.replace(/[^0-9]/g, '');
    return parseInt(cleanStr, 10) || 0;
}

function formatVND(amount, fallbackAmount = 0) {
    let val = parsePrice(amount);
    if (val <= 0 && fallbackAmount) {
        val = parsePrice(fallbackAmount);
    }
    if (val <= 0) return 'Liên hệ';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

// Giá Flash Sale: nếu sản phẩm đang sale và có giá tùy chỉnh (flashPrice)
// hợp lệ (nhỏ hơn giá gốc) → trả về giá sale, nếu không trả về 0
function getFlashSalePrice(p) {
    if (!p || !p.isFlashSale || p.flashPrice === undefined || p.flashPrice === null || p.flashPrice === '') return 0;
    const fp = parsePrice(p.flashPrice);
    const base = parsePrice(p.price);
    if (fp <= 0) return 0;
    if (base > 0 && fp >= base) return 0;
    return fp;
}

// --- LƯỢT BÁN HIỂN THỊ (thật + ảo): nếu admin không điền "bán ảo" thì tự động 50–100 ---
// Số tự sinh ổn định theo mã sản phẩm (không nhảy loạn mỗi lần tải)
function pseudoSeed(s) {
    let h = 0; const str = String(s || '');
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100000007;
    return h;
}
function autoVirtualSold(id) { return 50 + (pseudoSeed(id) % 51); }      // 50 → 100
function autoVirtualStock(id) { return 10 + (pseudoSeed(id) % 41); }     // 10 → 50

function getSoldDisplay(p) {
    const real = parseInt(p.soldCount) || 0;
    const virt = parseInt(p.virtualSold) || 0;
    return real + (virt > 0 ? virt : autoVirtualSold(p.id));
}

function getStockDisplay(p) {
    const st = parseInt(p.totalCount) || 0;
    // Tồn kho thật > 0 và hợp lệ → dùng, ngược lại sinh số "còn lại" ổn định
    return st >= getSoldDisplay(p) ? (st - getSoldDisplay(p)) : autoVirtualStock(p.id);
}

// --- SẢN PHẨM CHƯA ĐẶT GIÁ (giá 0/rỗng) → hiện "Giá liên hệ", không cho mua 0 đ ---
function hasRealPrice(p) { return (parsePrice(p.price) || 0) > 0; }
function siteHotline() { return (window.SITE_CONFIG && window.SITE_CONFIG.phone) || '0938992785'; }
function contactForPrice(id) {
    const p = (typeof products !== 'undefined' ? products : []).find(x => x.id === id);
    showToast(`Sản phẩm hiện chưa có giá bán khung web — anh/chị vui lòng gọi ${siteHotline()} để được báo giá chính xác${p ? ': ' + p.name.slice(0, 50) : ''}`, 'info');
}

function getDiscountPercent(price, oldPrice) {
    const p = parsePrice(price);
    const op = parsePrice(oldPrice);
    if (op > p && p > 0) {
        return Math.round(((op - p) / op) * 100);
    }
    return 0;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-blue-600';
    toast.className = `${bgColor} text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-lg flex items-center space-x-2 transition transform duration-300 translate-y-2 opacity-0 z-50`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-info'}"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- PARSE CSV ---
function parseCategoryHierarchy(subCategoryStr) {
    if (!subCategoryStr) return { subCategory: '', childCategory: '' };
    const parts = subCategoryStr.split('/').map(s => s.trim());
    return {
        subCategory: parts[0] || '',
        childCategory: parts[1] || ''
    };
}

function parseCSV(text) {
    let p = '', c = '', r = [];
    let q = false;
    let row = [''];
    for (let i = 0; i < text.length; i++) {
        c = text[i];
        let next = text[i+1];
        if (c === '"') {
            if (q && next === '"') { row[row.length - 1] += '"'; i++; }
            else { q = !q; }
        } else if (c === ',' && !q) {
            row.push('');
        } else if ((c === '\r' || c === '\n') && !q) {
            if (c === '\r' && next === '\n') { i++; }
            r.push(row);
            row = [''];
        } else {
            row[row.length - 1] += c;
        }
    }
    if (row.length > 1 || row[0] !== '') { r.push(row); }
    return r;
}

function parseProductsFromCSV(csvText) {
    const rows = parseCSV(csvText);
    if (rows.length < 2) return [];

    const result = [];
    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        if (cols.length >= 4) {
            const rawId = cols[0].trim() || `SP${i}`;
            const gallery = parseImageGallery(cols[6] || '');
            const catHierarchy = parseCategoryHierarchy(cols[3] || '');
            const skuGroup = (cols[15] && cols[15].trim()) ? cols[15].trim() : rawId;

            result.push({
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
                badge: cols[7] || '', // Cột H (index 7) là Tag/Badge trên Google Sheets
                isFlashSale: false, // cột trên sheet đã xóa — Flash Sale quản lý trong admin
                stock: cols[8] || 'Còn hàng',
                specs: cols[9] || 'Bảo hành chính hãng', // cột J = THÔNG SỐ
                description: cols[10] || '',             // cột K = MÔ TẢ SẢN PHẨM
                sku: (cols[14] || '').trim() || rawId,   // cột O = SKU
                skuGroup: skuGroup
            });
        }
    }
    return result;
}
function getGroupedUniqueProducts(productList) {
    const seen = new Set();
    const groupedList = [];

    productList.forEach(p => {
        const groupKey = p.skuGroup || p.id;
        if (!seen.has(groupKey)) {
            seen.add(groupKey);
            groupedList.push(p);
        }
    });

    return groupedList;
}

// --- KHỞI TẠO DỮ LIỆU & GIAO DIỆN ---
document.addEventListener('DOMContentLoaded', () => {
// Khởi tạo History State mặc định khi load trang (file:// không dùng được History API -> bỏ qua)
try {
    if (window.history.state === null) {
        window.history.replaceState({ tab: 'home' }, '', window.location.href);
    }
} catch (e) { /* file:// - dùng hash thay thế */ }
initData();
    initHeroSlider();
    initFlashSaleTimer();
    // Tài khoản khách hàng: hiển thị trạng thái đăng nhập + đóng panel khi bấm ra ngoài
    updateAccountUI();
    document.addEventListener('click', (e) => {
        const btn = document.getElementById('accountMenuBtn');
        const dd = document.getElementById('accountDropdown');
        if (btn && dd && !dd.classList.contains('hidden') && !btn.contains(e.target) && !dd.contains(e.target)) {
            dd.classList.add('hidden');
        }
    });
});

async function initData() {
    // ==== NỘI DUNG ĐỌC TỪ SOURCE CỘC BỘ (do trang admin quản lý) ====
    // data/products.js là nguồn dữ liệu chính. Ảnh sản phẩm vẫn nằm trên Google Drive (chỉ lưu URL).
    products = window.PRODUCTS_DATA || window.PRODUCTS_FALLBACK || [];
    filteredProducts = [...products];

    if (!products || products.length === 0) {
        showToast("Chưa có sản phẩm trong source! Mở admin và bấm nút 'Cập nhật từ Sheets'.", "info");
    }

    renderHoverCategories();
    renderFlashSale();
    renderCategoryBlocks();

    await loadCouponsFromSheet();  // mã khuyến mãi (từ Sheet)
    await loadDevicesFromSheet();  // danh sách thiết bị máy tính công suất
    await loadPolicies();          // bài viết / chính sách từ data/policies.js (local, admin quản lý)

    applyStartupRouting();
}

// Nạp bài viết / chính sách: HOÀN TOÀN từ source cục bộ (admin đăng) — không lấy từ Sheet nữa
async function loadPolicies() {
    policiesMap = Object.assign({}, window.POLICIES_DATA || {});
    // Vẽ lại danh sách chính sách nếu đã render rồi
    if (typeof renderPolicies === 'function' && document.getElementById('policyList')) {
        try { renderPolicies(); } catch (e) { /* bỏ qua */ }
    }
}

// Điều hướng mở sâu khi vừa vào trang (dùng chung cho cả 2 nhánh data online/offline)
function applyStartupRouting() {
    if (!products || products.length === 0) return;
    try {
        // 1) URL chuẩn SEO dạng /san-pham/<id> (id có thể chứa "/", ví dụ 2P-3M/2-15A)
        const pathMatch = window.location.pathname.match(/\/san-pham\/([^?#]+)/);
        if (pathMatch) {
            const productId = decodeURIComponent(pathMatch[1].replace(/\/+$/, ''));
            const targetProd = products.find(x => x.id === productId);
            if (targetProd) {
                openProductDetailWithoutPush(productId);
            } else if (location.protocol.startsWith('http')) {
                // URL sản phẩm cũ/không tồn tại -> đưa về trang chủ
                history.replaceState({ tab: 'home' }, '', '/#');
            }
        }
        // 2) Giữ tương thích với link dạng #product-<id> cũ
        const hash = window.location.hash;
        if (!pathMatch && hash && hash.startsWith('#product-')) {
            const productId = hash.replace('#product-', '');
            const targetProd = products.find(x => x.id === productId);
            if (targetProd) {
                openProductDetailWithoutPush(productId);
                // Nâng link hash cũ lên URL chuẩn mới (chỉ khi chạy qua http/https)
                if (location.protocol.startsWith('http') && window.SITE_CONFIG) {
                    history.replaceState({ tab: 'product-detail', productId: productId }, '', window.SITE_CONFIG.productPathUrl(productId));
                }
            }
        }
    } catch (e) {
        console.warn('Bỏ qua định tuyến khởi động (file:// không hỗ trợ History API):', e);
    }
}

// (Dự phòng: nếu source hoàn toàn trống, thử nạp data/products.js lần cuối)
function loadProductsFallback() {
    return new Promise((resolve) => {
        const apply = (list) => {
            products = list || [];
            filteredProducts = [...products];
            renderHoverCategories();
            renderFlashSale();
            renderCategoryBlocks();
        };
        if (window.PRODUCTS_FALLBACK && window.PRODUCTS_FALLBACK.length) { apply(window.PRODUCTS_FALLBACK); resolve(); return; }
        const s = document.createElement('script');
        s.src = 'data/products.js';
        s.onload = () => { apply(window.PRODUCTS_DATA || window.PRODUCTS_FALLBACK); resolve(); };
        s.onerror = () => resolve();
        document.head.appendChild(s);
    });
}
// === NẠP DANH SÁCH THIẾT BỊ TỪ GOOGLE SHEET (ĐÃ XỬ LÝ LỖI HOÀN CHỈNH) ===
async function loadDevicesFromSheet() {
    const defaultDevices = [
        { id: 'dev_1', name: 'Quạt máy', power: 60, icon: 'fa-fan' },
        { id: 'dev_2', name: 'Tivi LED', power: 150, icon: 'fa-tv' },
        { id: 'dev_3', name: 'Đèn chiếu sáng', power: 40, icon: 'fa-lightbulb' },
        { id: 'dev_4', name: 'Tủ lạnh', power: 200, icon: 'fa-snowflake' },
        { id: 'dev_5', name: 'Bếp từ / Bếp điện', power: 2000, icon: 'fa-fire-burner' },
        { id: 'dev_6', name: 'Điều hòa / Máy lạnh', power: 1200, icon: 'fa-wind' },
        { id: 'dev_7', name: 'Nồi cơm điện', power: 700, icon: 'fa-kitchen-set' },
        { id: 'dev_8', name: 'Máy giặt', power: 500, icon: 'fa-shirt' }
    ];

    if (!GOOGLE_SHEET_DEVICES_CSV_URL) {
        deviceList = defaultDevices;
        return;
    }

    try {
        // Tự động xử lý URL Google Sheet pubhtml sang dạng xuất CSV hợp lệ
        let targetUrl = GOOGLE_SHEET_DEVICES_CSV_URL.trim();
        if (targetUrl.includes('/pubhtml')) {
            targetUrl = targetUrl.replace('/pubhtml', '/pub');
            if (!targetUrl.includes('output=csv')) {
                targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'output=csv';
            }
        }

        const cacheBusterUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
        const res = await fetch(cacheBusterUrl);
        if (!res.ok) {
            deviceList = defaultDevices;
            return;
        }

        const csvText = await res.text();
        const rows = parseCSV(csvText);

        deviceList = [];
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            if (cols && cols.length >= 2) {
                const nameStr = cols[0].replace(/^["']|["']$/g, '').trim();
                const powerVal = parseInt(cols[1].replace(/[^0-9]/g, ''), 10) || 0;
                
                // Lọc bỏ dữ liệu rác/mã lệnh JS không hợp lệ
                if (nameStr && !nameStr.includes('function') && !nameStr.includes('prototype') && powerVal >= 0) {
                    deviceList.push({
                        id: 'dev_' + i,
                        name: nameStr,
                        power: powerVal,
                        icon: (cols[2] && !cols[2].includes('function')) ? cols[2].trim() : 'fa-plug'
                    });
                }
            }
        }

        if (deviceList.length === 0) {
            deviceList = defaultDevices;
        }
    } catch (e) {
        console.warn("Lỗi nạp danh sách thiết bị từ Sheet, dùng mặc định:", e);
        deviceList = defaultDevices;
    }
}

async function loadCouponsFromSheet() {
    if (!GOOGLE_SHEET_COUPON_CSV_URL) return;
    try {
        const cacheBusterUrl = GOOGLE_SHEET_COUPON_CSV_URL + '&t=' + new Date().getTime();
        const res = await fetch(cacheBusterUrl);
        if (!res.ok) return;

        const csvText = await res.text();
        const rows = parseCSV(csvText);

        couponsList = [];
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            if (cols.length >= 3) {
                couponsList.push({
                    code: cols[0].trim().toUpperCase(),
                    type: (cols[1] || 'AMOUNT').trim().toUpperCase(),
                    value: parsePrice(cols[2]),
                    minOrder: parsePrice(cols[3] || 0),
                    quantity: parsePrice(cols[4] || 0)
                });
            }
        }
    } catch (e) {
        console.warn("Không thể tải danh sách mã khuyến mãi:", e);
    }
}

// --- SLIDER & TIMER ---
let currentHeroSlideIndex = 0;
let heroSlideInterval = null;

function initHeroSlider() {
    heroSlideInterval = setInterval(() => {
        nextHeroSlide();
    }, 5000);
}

function showHeroSlide(index) {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.hero-dot');
    if (slides.length === 0) return;

    if (index >= slides.length) currentHeroSlideIndex = 0;
    else if (index < 0) currentHeroSlideIndex = slides.length - 1;
    else currentHeroSlideIndex = index;

    slides.forEach((slide, idx) => {
        if (idx === currentHeroSlideIndex) {
            slide.classList.remove('opacity-0', 'pointer-events-none');
            slide.classList.add('opacity-100', 'active');
        } else {
            slide.classList.remove('opacity-100', 'active');
            slide.classList.add('opacity-0', 'pointer-events-none');
        }
    });

    dots.forEach((dot, idx) => {
        if (idx === currentHeroSlideIndex) {
            dot.className = "hero-dot w-8 h-2 rounded-full bg-white transition-all duration-300 shadow-md";
        } else {
            dot.className = "hero-dot w-2 h-2 rounded-full bg-white/40 hover:bg-white/80 transition-all duration-300 shadow-md";
        }
    });
}

function nextHeroSlide() { showHeroSlide(currentHeroSlideIndex + 1); }
function prevHeroSlide() { showHeroSlide(currentHeroSlideIndex - 1); }
function goToHeroSlide(idx) { showHeroSlide(idx); }

function initFlashSaleTimer() {
    // Thời lượng đếm ngược đọc từ cấu hình admin (Hệ thống > Flash Sale), mặc định 12h45'30"
    const cfg = window.SITE_SETTINGS || {};
    const totalSecs = Math.max(60, Math.round(((cfg.flashHours || 12.75) * 3600)));
    let duration = totalSecs;
    setInterval(() => {
        if (duration <= 0) duration = totalSecs;
        duration--;
        const h = Math.floor(duration / 3600);
        const m = Math.floor((duration % 3600) / 60);
        const s = duration % 60;

        const hEl = document.getElementById('flashHours');
        const mEl = document.getElementById('flashMinutes');
        const sEl = document.getElementById('flashSeconds');

        if (hEl) hEl.innerText = String(h).padStart(2, '0');
        if (mEl) mEl.innerText = String(m).padStart(2, '0');
        if (sEl) sEl.innerText = String(s).padStart(2, '0');
    }, 1000);
}

// ============ TÀI KHOẢN KHÁCH HÀNG (lưu trên máy người dùng) ============
// Website tĩnh (Vercel) không có server → tài khoản & đơn hàng lưu trong trình duyệt
function hashPass(s) {
    return String(s).split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}
function loadCustomerAccounts() {
    try { return JSON.parse(localStorage.getItem('tohoAccounts')) || []; } catch { return []; }
}
function saveCustomerAccounts(list) { localStorage.setItem('tohoAccounts', JSON.stringify(list)); }
function getCustomerSession() {
    try { return JSON.parse(localStorage.getItem('tohoSession')); } catch { return null; }
}
function setCustomerSession(s) {
    if (s) localStorage.setItem('tohoSession', JSON.stringify(s));
    else localStorage.removeItem('tohoSession');
}

function accountBtnTap() {
    const s = getCustomerSession();
    if (s) {
        const dd = document.getElementById('accountDropdown');
        dd.classList.toggle('hidden');
        if (!dd.classList.contains('hidden')) renderAccountOrdersCount();
    } else {
        openAuthModal('login');
    }
}
function closeAccountDropdown() {
    const dd = document.getElementById('accountDropdown');
    if (dd) dd.classList.add('hidden');
}

function openAuthModal(mode) {
    closeAccountDropdown();
    document.getElementById('authModal').classList.remove('hidden');
    authShowMode(mode || 'login');
}
function closeAuthModal() { document.getElementById('authModal').classList.add('hidden'); }

function authShowMode(mode) {
    const isLogin = mode === 'login';
    document.getElementById('authMode').value = mode;
    document.getElementById('fwAuthName').classList.toggle('hidden', isLogin);
    document.getElementById('fwAuthPhone').classList.toggle('hidden', isLogin);
    document.getElementById('fwAuthPass2').classList.toggle('hidden', isLogin);
    document.getElementById('fwAuthUser').classList.toggle('hidden', !isLogin);
    document.getElementById('tabAuthLogin').className = isLogin
        ? 'flex-1 py-2.5 text-xs font-black rounded-xl border-2 border-starRed bg-red-50 text-starRed'
        : 'flex-1 py-2.5 text-xs font-black rounded-xl border-2 border-slate-200 bg-white text-slate-500';
    document.getElementById('tabAuthRegister').className = !isLogin
        ? 'flex-1 py-2.5 text-xs font-black rounded-xl border-2 border-starRed bg-red-50 text-starRed'
        : 'flex-1 py-2.5 text-xs font-black rounded-xl border-2 border-slate-200 bg-white text-slate-500';
    document.getElementById('authSubmitLabel').textContent = isLogin ? 'Đăng nhập' : 'Tạo tài khoản';
    const msg = document.getElementById('authMsg');
    msg.textContent = ''; msg.classList.add('hidden');
}

function authMsgShow(ok, text) {
    const msg = document.getElementById('authMsg');
    msg.textContent = (ok ? '✓ ' : '✗ ') + text;
    msg.className = 'text-xs font-bold ' + (ok ? 'text-green-600' : 'text-red-600');
}

function authSubmit(e) {
    e.preventDefault();
    const mode = document.getElementById('authMode').value;
    const v = (id) => (document.getElementById(id) || {}).value?.trim() || '';

    if (mode === 'register') {
        const name = v('fAuthName'), phone = v('fAuthPhone'), pass = v('fAuthPass'), pass2 = v('fAuthPass2');
        if (!name || !phone || !pass) return authMsgShow(false, 'Vui lòng điền đủ Họ tên, SĐT và Mật khẩu');
        if (pass.length < 6) return authMsgShow(false, 'Mật khẩu cần ít nhất 6 ký tự');
        if (pass !== pass2) return authMsgShow(false, 'Mật khẩu 2 lần nhập không giống nhau');
        const accounts = loadCustomerAccounts();
        if (accounts.find(a => a.phone === phone)) return authMsgShow(false, 'SĐT này đã đăng ký rồi — chuyển sang ĐĂNG NHẬP');
        accounts.push({ name, phone, pass: hashPass(pass), created: Date.now() });
        saveCustomerAccounts(accounts);
        setCustomerSession({ name, phone });
        authMsgShow(true, 'Đăng ký thành công! Bạn đang đăng nhập.');
        updateAccountUI();
        setTimeout(closeAuthModal, 800);
    } else {
        const user = v('fAuthUser'), pass = v('fAuthPass');
        if (!user || !pass) return authMsgShow(false, 'Nhập tên/SĐT và mật khẩu đã đăng ký');
        const acc = loadCustomerAccounts().find(a => a.phone === user || (a.name || '').toLowerCase() === user.toLowerCase());
        if (!acc) return authMsgShow(false, 'Không tìm thấy tài khoản này — bấm ĐĂNG KÝ để tạo mới');
        if (acc.pass !== hashPass(pass)) return authMsgShow(false, 'Mật khẩu không đúng');
        setCustomerSession({ name: acc.name, phone: acc.phone });
        authMsgShow(true, 'Đăng nhập thành công!');
        updateAccountUI();
        setTimeout(closeAuthModal, 700);
    }
}

function authLogout() {
    setCustomerSession(null);
    updateAccountUI();
    closeAccountDropdown();
    showToast('Đã đăng xuất tài khoản', 'info');
}

function updateAccountUI() {
    const s = getCustomerSession();
    const nameEl = document.getElementById('accountNameLabel');
    const subEl = document.getElementById('accountSubLabel');
    if (s) {
        subEl.textContent = 'Xin chào!';
        nameEl.innerHTML = s.name.split(' ').slice(-1)[0] + ' <i class="fa-solid fa-caret-down ml-1 text-[10px]"></i>';
        document.getElementById('dropAccName').textContent = s.name;
        document.getElementById('dropAccPhone').textContent = s.phone;
    } else {
        subEl.textContent = 'Đăng nhập/Đăng ký';
        nameEl.innerHTML = 'Tài khoản <i class="fa-solid fa-caret-down ml-1 text-[10px]"></i>';
    }
    renderAccountOrdersCount();
}

// --- Đơn hàng của tôi (lưu theo SĐT đã đăng nhập) ---
function getMyOrders() {
    const s = getCustomerSession();
    if (!s) return [];
    try { return JSON.parse(localStorage.getItem('tohoOrders_' + s.phone)) || []; } catch { return []; }
}
function saveMyOrder(order) {
    const s = getCustomerSession();
    if (!s) return; // khách chưa đăng nhập thì không lưu cục bộ
    const list = getMyOrders();
    list.unshift(order);
    localStorage.setItem('tohoOrders_' + s.phone, JSON.stringify(list));
    renderAccountOrdersCount();
}
function renderAccountOrdersCount() {
    const el = document.getElementById('dropAccOrderCount');
    if (!el) return;
    const n = getMyOrders().length;
    el.textContent = n > 0 ? n : '';
}
function openMyOrdersModal() {
    document.getElementById('myOrdersModal').classList.remove('hidden');
    const s = getCustomerSession();
    document.getElementById('myOrdersSub').textContent = s ? (s.name + ' · ' + s.phone) : '';
    const list = getMyOrders();
    document.getElementById('myOrdersList').innerHTML = list.length ? list.map(o => `
        <div class="border border-slate-200 rounded-2xl p-4 bg-slate-50/60">
            <div class="flex items-center justify-between mb-2">
                <span class="font-black text-sm font-heading">Đơn <span class="text-starRed font-mono">${o.id}</span></span>
                <span class="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">${o.status || 'Chờ xác nhận'}</span>
            </div>
            <p class="text-[11px] text-slate-500 mb-1.5">${o.date}</p>
            <p class="text-[11px] text-slate-600 whitespace-pre-line leading-relaxed">${o.items}</p>
            <p class="text-right text-sm font-black text-starRed mt-2">Tổng: ${formatVND(o.total)}</p>
        </div>`).join('')
        : '<div class="text-center py-12"><i class="fa-solid fa-box-open text-4xl text-slate-200 mb-3"></i><p class="text-sm text-slate-400 font-bold">Bạn chưa có đơn hàng nào.</p><p class="text-[11px] text-slate-400 mt-1">Đơn đặt khi đã đăng nhập sẽ hiện tại đây.</p></div>';
}
function closeMyOrdersModal() { document.getElementById('myOrdersModal').classList.add('hidden'); }

// Tự điền thông tin đã đăng nhập vào form thanh toán
function prefillCheckoutFromAccount() {
    const s = getCustomerSession();
    if (!s) return;
    const n = document.getElementById('custName'); if (n && !n.value) n.value = s.name;
    const ph = document.getElementById('custPhone'); if (ph && !ph.value) ph.value = s.phone;
}

// Thêm tham số pushToHistory để tránh lặp state khi người dùng bấm nút Back/Forward
function switchTab(tab, pushToHistory = true, stateData = {}) {
    const home = document.getElementById('homePage');
    const detail = document.getElementById('productDetailPage');
    const policy = document.getElementById('policyPage');

    if (home) home.classList.toggle('hidden', tab !== 'home');
    if (detail) detail.classList.toggle('hidden', tab !== 'product-detail');
    if (policy) policy.classList.toggle('hidden', tab !== 'policy');

    if (tab === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        resetSeoToHome();
    }

    // Đẩy state vào lịch sử trình duyệt nếu được phép
    if (pushToHistory) {
        const state = { tab: tab, ...stateData };
        let url = `#${tab}`;
        if (tab === 'product-detail' && stateData.productId) {
            // URL chuẩn SEO: /san-pham/<id>
            url = window.SITE_CONFIG ? window.SITE_CONFIG.productPathUrl(stateData.productId) : url;
        }
        try {
            history.pushState(state, '', url);
        } catch (e) {
            // file:// -> URL/History API bị hạn chế, giữ nguyên trang không đổi địa chỉ
        }
    }
}

// === SEO ĐỘNG: cập nhật title/meta/canonical/OG/JSON-LD theo sản phẩm đang xem ===
function setHeadMeta() {
    if (!window.SITE_CONFIG) return null;

    const seo = {
        siteUrl: (window.SITE_CONFIG.siteUrl || '').replace(/\/$/, ''),
        siteName: window.SITE_CONFIG.siteName || 'TOHO ELECTRIC VN'
    };

    const ensure = (selector, createTag, attrs) => {
        let el = document.head.querySelector(selector);
        if (!el) {
            el = document.createElement(createTag);
            Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
            document.head.appendChild(el);
        }
        return el;
    };

    return {
        ...seo,
        title: document.querySelector('title'),
        desc: ensure('meta[name="description"]', 'meta', { name: 'description' }),
        canonical: ensure('link[rel="canonical"]', 'link', { rel: 'canonical' }),
        ogTitle: ensure('meta[property="og:title"]', 'meta', { property: 'og:title' }),
        ogDesc: ensure('meta[property="og:description"]', 'meta', { property: 'og:description' }),
        ogImage: ensure('meta[property="og:image"]', 'meta', { property: 'og:image' }),
        ogUrl: ensure('meta[property="og:url"]', 'meta', { property: 'og:url' }),
        ldProduct: ensure('script#ldProduct', 'script', { type: 'application/ld+json', id: 'ldProduct' })
    };
}

// Gọi khi mở trang chi tiết sản phẩm (Google index đúng từng sản phẩm)
function updateSeoForProduct(p) {
    const meta = setHeadMeta();
    if (!meta || !p) return;

    const price = parsePrice(p.price);
    const oldPrice = parsePrice(p.oldPrice);
    const hasDiscount = oldPrice > price && oldPrice > 0;
    const productUrl = window.SITE_CONFIG ? window.SITE_CONFIG.productPathUrl(p.id, true) : (`${meta.siteUrl}/san-pham/${encodeURIComponent(p.id)}`);
    const desc = `${p.name} - Mã SP ${p.code}. Giá ${formatVND(p.price)}${hasDiscount ? ` (giảm còn ${formatVND(p.price)} từ ${formatVND(oldPrice)})` : ''}. ${p.category || ''} ${p.subCategory || ''} chính hãng tại ${meta.siteName}. Giao hàng toàn quốc, hỗ trợ tư vấn ${window.SITE_CONFIG.phone || ''}.`;

    meta.title.textContent = `${p.name} | ${meta.siteName}`;
    meta.desc.setAttribute('content', desc.slice(0, 300));
    meta.canonical.setAttribute('href', productUrl);
    meta.ogTitle.setAttribute('content', p.name);
    meta.ogDesc.setAttribute('content', desc.slice(0, 200));
    meta.ogImage.setAttribute('content', p.image || 'images/hero-banner-01.jpg');
    meta.ogUrl.setAttribute('content', productUrl);

    const ld = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        sku: p.code,
        mpn: p.code,
        description: (p.specs || desc).slice(0, 5000),
        image: (p.images && p.images.length ? p.images : [p.image]).filter(Boolean),
        category: [p.category, p.subCategory, p.childCategory].filter(Boolean).join(' > '),
        brand: { '@type': 'Brand', name: meta.siteName },
        offers: {
            '@type': 'Offer',
            url: productUrl,
            priceCurrency: 'VND',
            price: String(price),
            itemCondition: 'https://schema.org/NewCondition',
            availability: 'https://schema.org/InStock',
            seller: { '@type': 'Organization', name: meta.siteName }
        }
    };
    meta.ldProduct.textContent = JSON.stringify(ld);
}

// Khôi phục SEO trang chủ khi quay về home
function resetSeoToHome() {
    const meta = setHeadMeta();
    if (!meta) return;
    const homeTitle = document.querySelector('title');
    homeTitle.textContent = 'TOHO ELECTRIC VN - Ổ cắm điện, Ổn áp, Thiết bị điện Giá Rẻ';
    meta.canonical.setAttribute('href', `${meta.siteUrl}/`);
    meta.ogUrl.setAttribute('content', `${meta.siteUrl}/`);
    meta.ogTitle.setAttribute('content', 'TOHO ELECTRIC VN - Thiết Bị Điện & Ổ Cắm Chính Hãng');
    const ld = document.querySelector('script#ldProduct');
    if (ld) ld.textContent = '';
}

function renderHoverCategories() {
    const categoryMap = {};
    products.forEach(p => {
        if (!p.category) return;
        if (!categoryMap[p.category]) categoryMap[p.category] = {};
        if (p.subCategory) {
            if (!categoryMap[p.category][p.subCategory]) {
                categoryMap[p.category][p.subCategory] = new Set();
            }
            if (p.childCategory) {
                categoryMap[p.category][p.subCategory].add(p.childCategory);
            }
        }
    });

    const mainListContainer = document.getElementById('mainCategoryList');
    if (!mainListContainer) return;

    let mainHtml = `<div onclick="resetFilter()" class="cat-item-hover px-4 py-2 cursor-pointer flex items-center justify-between border-b border-gray-100">
        <span><i class="fa-solid fa-list mr-2"></i>Tất cả sản phẩm</span>
    </div>`;

    Object.keys(categoryMap).forEach((cat) => {
        mainHtml += `
            <div class="cat-item-hover px-4 py-2.5 cursor-pointer flex items-center justify-between border-b border-gray-100" 
                 onmouseenter="showSubCategories('${cat}')" 
                 onclick="filterByCategory('${cat}')">
                <span>${cat}</span>
                <i class="fa-solid fa-chevron-right text-[10px] text-gray-400"></i>
            </div>
        `;
    });

    mainListContainer.innerHTML = mainHtml;
    const firstCat = Object.keys(categoryMap)[0];
    if (firstCat) showSubCategories(firstCat);
}

function showSubCategories(catName) {
    const subContainer = document.getElementById('subCategoryList');
    if (!subContainer) return;

    const catProducts = products.filter(p => p.category.toLowerCase() === catName.toLowerCase());
    const subMap = {};
    catProducts.forEach(p => {
        if (p.subCategory) {
            if (!subMap[p.subCategory]) subMap[p.subCategory] = new Set();
            if (p.childCategory) subMap[p.subCategory].add(p.childCategory);
        }
    });

    const subCats = Object.keys(subMap);

    if (subCats.length === 0) {
        subContainer.innerHTML = `
            <div class="space-y-3">
                <h4 class="font-extrabold text-starRed uppercase border-b pb-1.5 text-xs">${catName}</h4>
                <p class="text-gray-400 italic">Không có danh mục con</p>
                <button onclick="filterByCategory('${catName}')" class="bg-starRed text-white px-3 py-1.5 rounded text-[11px] font-bold">Xem tất cả ${catName}</button>
            </div>
        `;
        return;
    }

    subContainer.innerHTML = `
        <div class="space-y-4">
            <h4 class="font-extrabold text-starRed uppercase border-b pb-1.5 text-xs">${catName}</h4>
            <div class="space-y-3">
                ${subCats.map(sub => {
                    const children = Array.from(subMap[sub]);
                    return `
                        <div class="space-y-1">
                            <a href="javascript:void(0)" onclick="filterBySubCategory('${catName}', '${sub}')" 
                               class="font-bold text-gray-800 hover:text-starRed flex items-center space-x-1">
                                <i class="fa-solid fa-angle-right text-[10px] text-starRed"></i>
                                <span>${sub}</span>
                            </a>
                            ${children.length > 0 ? `
                                <div class="pl-4 flex flex-wrap gap-1.5">
                                    ${children.map(child => `
                                        <a href="javascript:void(0)" onclick="filterByChildCategory('${catName}', '${sub}', '${child}')" 
                                           class="bg-gray-100 hover:bg-red-50 hover:text-starRed px-2 py-0.5 rounded text-[10px] text-gray-600 font-medium">
                                            ${child}
                                        </a>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function filterByCategory(catName) {
    switchTab('home');
    const filtered = products.filter(p => p.category.toLowerCase() === catName.toLowerCase());
    renderCustomProductsGrid(`DANH MỤC: ${catName.toUpperCase()}`, filtered);
}

function filterBySubCategory(catName, subCat) {
    switchTab('home');
    const filtered = products.filter(p => p.category.toLowerCase() === catName.toLowerCase() && p.subCategory.toLowerCase() === subCat.toLowerCase());
    renderCustomProductsGrid(`DANH MỤC: ${subCat.toUpperCase()}`, filtered);
}

function filterByChildCategory(catName, subCat, childCat) {
    switchTab('home');
    const filtered = products.filter(p => p.category.toLowerCase() === catName.toLowerCase() && p.subCategory.toLowerCase() === subCat.toLowerCase() && p.childCategory.toLowerCase() === childCat.toLowerCase());
    renderCustomProductsGrid(`DANH MỤC: ${childCat.toUpperCase()}`, filtered);
}

function resetFilter() {
    switchTab('home');
    filteredProducts = [...products];
    renderCategoryBlocks();
}

function quickSearch(keyword) {
    const input = document.getElementById('searchInput');
    if (input) input.value = keyword;
    handleSearch();
}

function handleSearch() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    if (!query) {
        resetFilter();
        return;
    }

    switchTab('home');
    const results = products.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.category.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query)
    );

    renderCustomProductsGrid(`KẾT QUẢ TÌM KIẾM CHO: "${query.toUpperCase()}"`, results);
}

function applyFilters() {
    const priceVal = document.getElementById('priceFilter')?.value || 'all';
    const sortVal = document.getElementById('sortFilter')?.value || 'default';

    let result = [...products];

    if (priceVal === 'under5m') {
        result = result.filter(p => parsePrice(p.price) < 5000000);
    } else if (priceVal === '5m15m') {
        result = result.filter(p => {
            const pr = parsePrice(p.price);
            return pr >= 5000000 && pr <= 15000000;
        });
    } else if (priceVal === 'above15m') {
        result = result.filter(p => parsePrice(p.price) > 15000000);
    }

    if (sortVal === 'priceAsc') {
        result.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    } else if (sortVal === 'priceDesc') {
        result.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
    } else if (sortVal === 'discount') {
        result.sort((a, b) => getDiscountPercent(b.price, b.oldPrice) - getDiscountPercent(a.price, a.oldPrice));
    }

    renderCustomProductsGrid("KẾT QUẢ LỌC SẢN PHẨM", result);
}

function renderCustomProductsGrid(title, items) {
    const container = document.getElementById('categoryBlocksContainer');
    if (!container) return;

    const groupedItems = getGroupedUniqueProducts(items);

    if (groupedItems.length === 0) {
        container.innerHTML = `
            <div class="bg-white rounded-xl p-8 text-center border space-y-3">
                <i class="fa-solid fa-magnifying-glass text-4xl text-gray-300"></i>
                <h3 class="font-bold text-gray-700 text-lg">${title}</h3>
                <p class="text-sm text-gray-500">Không tìm thấy sản phẩm nào phù hợp.</p>
                <button onclick="resetFilter()" class="bg-starRed text-white text-xs font-bold px-4 py-2 rounded-lg">Xem tất cả sản phẩm</button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-4">
            <div class="flex justify-between items-center border-b pb-2">
                <h3 class="font-black text-base md:text-lg text-starRed uppercase border-l-4 border-starRed pl-3 font-heading">${title} (${groupedItems.length})</h3>
                <button onclick="resetFilter()" class="text-xs font-semibold text-slate-500 hover:text-starRed">Quay lại mặc định</button>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
                ${groupedItems.map(p => renderProductCard(p)).join('')}
            </div>
        </div>
    `;
}

function renderProductCard(p) {
    const discount = getDiscountPercent(p.price, p.oldPrice);
    const hasDiscount = discount > 0;
    const fp = getFlashSalePrice(p); // giá Flash Sale tùy chỉnh (nếu có)
    const shownOld = fp > 0 ? p.price : (hasDiscount ? p.oldPrice : '');
    const detailUrl = window.SITE_CONFIG ? window.SITE_CONFIG.productPathUrl(p.id) : (`san-pham/${encodeURIComponent(p.id)}`);

    return `
        <a href="${detailUrl}" onclick="openProductDetail('${p.id}'); return false;" class="block glass-card art-card p-3 flex flex-col justify-between cursor-pointer relative group overflow-hidden" title="${p.name}">
            ${p.badge ? `<span class="absolute top-3 left-3 bg-starRed text-white text-[10px] font-extrabold px-2 py-0.5 rounded-lg shadow-md z-10 font-heading">${p.badge}</span>` : (fp > 0 ? `<span class="absolute top-3 left-3 bg-gradient-to-r from-amber-400 to-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-lg shadow-md z-10 font-heading"><i class="fa-solid fa-bolt mr-0.5"></i>FLASH</span>` : (hasDiscount ? `<span class="absolute top-3 left-3 bg-starRed text-white text-[10px] font-extrabold px-2 py-0.5 rounded-lg shadow-md z-10 font-heading">-${discount}%</span>` : ''))}
            
           <div class="w-full h-70 md:h-72 flex items-center justify-center p-2 rounded-xl bg-slate-50 mb-2 overflow-hidden">
                <img src="${p.image || IMG_PLACEHOLDER}" onerror="imgFallback(this)" loading="lazy" decoding="async" class="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300" alt="${p.name} - ${p.code}">
           </div>

            <div class="space-y-1.5 flex-1 flex flex-col justify-between">
                <div>
                    <h4 class="product-title line-clamp-2 hover:text-starRed transition font-bold text-xs text-slate-800">${p.name}</h4>
                    ${p.code ? `<div class="text-[11px] text-slate-500 font-mono mt-1">
                        Mã: <span class="font-bold text-starRed">${p.code}</span>
                    </div>` : ''}
                    ${(() => {
                        const soldShown = getSoldDisplay(p);
                        if (p.isFlashSale) {
                            const stockLeft = getStockDisplay(p);
                            const pct = Math.min(96, Math.max(18, Math.round((soldShown / (soldShown + stockLeft + 30)) * 100)));
                            return `<div class="mt-1.5">
                                <div class="flex items-center justify-between text-[10px] font-bold">
                                    <span class="text-red-600"><i class="fa-solid fa-fire mr-1"></i>Đã bán ${soldShown}</span>
                                    <span class="text-slate-400">Còn lại ${stockLeft} hàng</span>
                                </div>
                                <div class="h-1.5 bg-red-100 rounded-full mt-1 overflow-hidden">
                                    <div class="h-full bg-gradient-to-r from-amber-400 to-red-500 rounded-full" style="width:${pct}%"></div>
                                </div>
                            </div>`;
                        }
                        return `<div class="text-[10px] text-orange-500 font-semibold mt-0.5"><i class="fa-solid fa-fire mr-1"></i>Đã bán ${soldShown}</div>`;
                    })()}
                </div>

                <div class="pt-2">
                    <div class="flex items-baseline space-x-1.5 flex-wrap">
                        ${(() => {
                            const noPrice = !(fp > 0) && !hasRealPrice(p);
                            if (noPrice) return `<span class="font-extrabold text-slate-700 text-sm">Giá liên hệ</span>`;
                            return `<span class="product-price font-extrabold text-starRed text-sm">${formatVND(fp > 0 ? fp : p.price)}</span>
                            ${shownOld ? `<span class="text-[11px] text-slate-400 line-through">${formatVND(shownOld)}</span>` : ''}`;
                        })()}
                    </div>
                    
                    <button onclick="event.preventDefault(); event.stopPropagation(); ${(fp > 0 || hasRealPrice(p)) ? `addToCart('${p.id}', event)` : `contactForPrice('${p.id}')`}" class="mt-2 w-full ${(fp > 0 || hasRealPrice(p)) ? 'bg-red-50 hover:bg-starRed text-starRed hover:text-white border border-red-200' : 'bg-slate-50 hover:bg-slate-200 text-slate-700 border border-slate-200'} text-xs font-bold py-1.5 rounded-xl transition flex items-center justify-center space-x-1">
                        <i class="fa-solid ${(fp > 0 || hasRealPrice(p)) ? 'fa-cart-plus' : 'fa-phone'}"></i>
                        <span>${(fp > 0 || hasRealPrice(p)) ? 'Thêm vào giỏ' : 'Liên hệ báo giá'}</span>
                    </button>
                </div>
            </div>
        </a>
    `;
}
function renderFlashSale() {
    const container = document.getElementById('flashSaleGrid');
    if (!container) return;

    const flashProducts = getGroupedUniqueProducts(products.filter(p => p.isFlashSale));

    // Không còn sản phẩm nào Flash Sale → ẨN TOÀN BỘ khu Flash Sale trên web
    const flashSection = document.getElementById('flashSaleSection');
    if (flashProducts.length === 0) {
        if (flashSection) flashSection.classList.add('hidden');
        container.innerHTML = '';
        return;
    }
    if (flashSection) flashSection.classList.remove('hidden');

    // flashMax = 0 hoặc bỏ trống → hiện TẤT CẢ sản phẩm đang Flash Sale
    const cfgMax = parseInt(window.SITE_SETTINGS && window.SITE_SETTINGS.flashMax, 10);
    const maxShow = (cfgMax > 0) ? cfgMax : flashProducts.length;
    const displayList = flashProducts.slice(0, maxShow);

    // CHẠY CUỘN ngang tự động (dừng khi rê chuột vào): mỗi thẻ gói đầu flash-item
    let items = displayList;
    if (displayList.length > 5) items = displayList.concat(displayList); // nhân đôi để cuộn liền mạch

    container.innerHTML = items.map(p => `<div class="flash-item">${renderProductCard(p)}</div>`).join('');

    if (displayList.length > 5) {
        // thời lượng tỉ lệ số sản phẩm để cuộn êm; >5 sp mới chạy cuộn
        const dur = Math.max(12, displayList.length * 2.6);
        container.style.animation = `flashMarqueeScroll ${dur}s linear infinite`;
    } else {
        container.style.animation = 'none';
    }
}

function renderCategoryBlocks() {
    const container = document.getElementById('categoryBlocksContainer');
    if (!container) return;

    const categoryMap = {};
    products.forEach(p => {
        if (!p.category) return;
        if (!categoryMap[p.category]) categoryMap[p.category] = [];
        categoryMap[p.category].push(p);
    });

    let html = '';
    Object.keys(categoryMap).forEach(cat => {
        const categoryProducts = getGroupedUniqueProducts(categoryMap[cat]);
        const fourProducts = categoryProducts.slice(0, 4);

        const upperCat = cat.trim().toUpperCase();
        const bannerImg = categoryBannerMap[upperCat] 
            || (categoryProducts[0] && categoryProducts[0].image ? categoryProducts[0].image : IMG_PLACEHOLDER);

        html += `
            <div class="glass-panel p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4 mb-6">
                <div class="flex justify-between items-center border-b border-slate-200/80 pb-3">
                    <h3 class="font-black text-base md:text-lg text-slate-900 uppercase border-l-4 border-starRed pl-3 font-heading tracking-tight">${cat}</h3>
                    <button onclick="filterByCategory('${cat}')" class="text-xs font-bold text-starRed hover:underline flex items-center gap-1">
                        <span>Xem tất cả</span> <i class="fa-solid fa-arrow-right text-[10px]"></i>
                    </button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="md:col-span-1 relative rounded-2xl overflow-hidden group cursor-pointer border border-slate-200/80 shadow-inner bg-slate-900 flex flex-col justify-between p-5 min-h-[280px]" onclick="filterByCategory('${cat}')">
                        <img src="${bannerImg}" onerror="imgFallback(this)" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-100 group-hover:scale-105 transition-transform duration-500" alt="Danh mục ${sanitizeAttr(cat)}">
                        
                        <div class="relative z-10 pt-4"></div>
                    </div>

                    <div class="md:col-span-3 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                        ${fourProducts.map(p => renderProductCard(p)).join('')}
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// --- CHI TIẾT SẢN PHẨM & BIẾN THỂ ---
function openProductDetail(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;

    currentDetailProduct = p;
    
    // Đẩy state vào History API
    switchTab('product-detail', true, { productId: id });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateSeoForProduct(p);

    if (!recentlyViewed.some(x => x.id === p.id)) {
        recentlyViewed.unshift(p);
        if (recentlyViewed.length > 5) recentlyViewed.pop();
        renderRecentlyViewed();
    }

    const sameGroupProducts = products.filter(x => x.skuGroup && x.skuGroup === p.skuGroup);
    const hasVariants = sameGroupProducts.length > 1;

    let variant1List = [];
    let variant2List = [];

    if (hasVariants) {
        variant1List = Array.from(new Set(sameGroupProducts.map(x => x.variant1).filter(v => v)));
        variant2List = Array.from(new Set(sameGroupProducts.map(x => x.variant2).filter(v => v)));
    }

    const discount = getDiscountPercent(p.price, p.oldPrice);

    const detailHtml = `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div class="md:col-span-5 space-y-4">
                <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-inner flex items-center justify-center min-h-[300px]">
                    <img id="mainDetailImage" src="${p.image || IMG_PLACEHOLDER}" onerror="imgFallback(this)" decoding="async" class="max-h-80 object-contain hover:scale-105 transition cursor-pointer" onclick="openLightbox('${p.image}')" alt="${p.name} - ${p.code}">
                </div>
                ${p.images && p.images.length > 1 ? `
                    <div class="flex space-x-2 overflow-x-auto pb-2">
                        ${p.images.map((img, idx) => `
                            <img src="${img}" onerror="imgFallback(this)" loading="lazy" decoding="async" onclick="document.getElementById('mainDetailImage').src='${img}'; document.getElementById('mainDetailImage').dataset.fbk = '';" class="w-16 h-16 object-contain rounded-xl border border-slate-200 bg-white p-1 cursor-pointer hover:border-starRed transition">
                        `).join('')}
                    </div>
                ` : ''}
            </div>

            <div class="md:col-span-7 space-y-5">
                <div>
                    <span class="text-xs font-bold text-starRed uppercase tracking-wider block">${p.category} ${p.subCategory ? ' / ' + p.subCategory : ''}</span>
                    <h1 class="text-xl md:text-2xl font-black text-slate-900 font-heading leading-tight mt-1">${p.name}</h1>
                    <p class="text-xs text-slate-400 mt-1">Mã sản phẩm: <span class="font-mono text-starRed font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-200">${p.code}</span></p>
                </div>

                <div class="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 flex items-baseline space-x-3 flex-wrap">
                    ${(() => {
                        const fp = getFlashSalePrice(p);
                        const noPrice = !(fp > 0) && !hasRealPrice(p);
                        if (noPrice) return `<span id="detailPrice" class="text-2xl md:text-3xl font-extrabold text-starRed font-heading">Giá liên hệ</span>
                            <span class="text-xs text-slate-500 font-bold"><i class="fa-solid fa-phone text-starRed mr-1"></i>${siteHotline()}</span>`;
                        const disc = fp > 0 ? Math.round((1 - fp / parsePrice(p.price || fp)) * 100) : discount;
                        return `${fp > 0 ? `<span class="bg-amber-400 text-white text-[10px] font-black px-2 py-1 rounded-lg uppercase"><i class="fa-solid fa-bolt mr-1"></i>Giá Flash Sale</span>` : ''}
                        <span id="detailPrice" class="text-2xl md:text-3xl font-extrabold text-starRed font-heading">${formatVND(fp > 0 ? fp : p.price)}</span>
                        ${disc > 0 ? `<span class="${fp > 0 ? 'text-sm text-slate-400 line-through' : 'text-sm text-slate-400 line-through'}">${formatVND(fp > 0 ? p.price : p.oldPrice)}</span>` : ''}
                        ${disc > 0 ? `<span class="bg-red-100 text-starRed text-xs font-bold px-2 py-0.5 rounded-lg">Tiết kiệm ${disc}%</span>` : ''}`;
                    })()}
                </div>

                ${hasVariants ? `
                    <div class="space-y-4 border-y border-slate-200 py-4">
                        ${variant1List.length > 0 ? `
                            <div>
                                <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Phân loại / Kích thước:</label>
                                <div class="flex flex-wrap gap-2">
                                    ${variant1List.map(v => {
                                        const isSelected = p.variant1 === v;
                                        return `<button onclick="switchProductVariant('${p.skuGroup}', '${v}', '${p.variant2}')" class="px-3.5 py-1.5 rounded-xl border text-xs font-bold transition ${isSelected ? 'border-starRed bg-red-50 text-starRed shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}">${v}</button>`;
                                    }).join('')}
                                </div>
                            </div>
                        ` : ''}

                        ${variant2List.length > 0 ? `
                            <div>
                                <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Màu sắc / Tùy chọn:</label>
                                <div class="flex flex-wrap gap-2">
                                    ${variant2List.map(v => {
                                        const isSelected = p.variant2 === v;
                                        return `<button onclick="switchProductVariant('${p.skuGroup}', '${p.variant1}', '${v}')" class="px-3.5 py-1.5 rounded-xl border text-xs font-bold transition ${isSelected ? 'border-starRed bg-red-50 text-starRed shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}">${v}</button>`;
                                    }).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <div class="space-y-2 text-xs text-slate-600 bg-white p-4 rounded-2xl border border-slate-200">
                    <p class="whitespace-pre-line"><i class="fa-solid fa-shield-check text-green-600 mr-2"></i><strong>Thông số:</strong><br>${p.specs}</p>
                    <p><i class="fa-solid fa-boxes-stacked text-blue-600 mr-2"></i> <strong>Tình trạng:</strong> <span class="text-green-600 font-bold">${p.stock}</span></p>
                </div>

                <div class="flex gap-3 pt-2">
                    ${!hasRealPrice(p) ? `
                        <button onclick="contactForPrice('${p.id}')" class="flex-1 bg-starRed hover:bg-starRedHover text-white font-bold py-3.5 rounded-2xl shadow-lg transition flex items-center justify-center space-x-2 text-sm uppercase font-heading">
                            <i class="fa-solid fa-phone"></i>
                            <span>Liên hệ báo giá</span>
                        </button>` : `
                        <button onclick="addToCart('${p.id}', event)" class="flex-1 bg-starRed hover:bg-starRedHover text-white font-bold py-3.5 rounded-2xl shadow-lg transition flex items-center justify-center space-x-2 text-sm uppercase font-heading">
                            <i class="fa-solid fa-cart-plus"></i>
                            <span>Thêm vào giỏ hàng</span>
                        </button>
                        <button onclick="addToCart('${p.id}', event); toggleCartModal();" class="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-2xl shadow-lg transition text-sm uppercase font-heading">
                            Mua ngay
                        </button>`}
                </div>
            </div>
        </div>

        ${p.description && p.description.trim() ? `
        <div class="mt-8 bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 class="font-black text-slate-800 uppercase text-base mb-3 border-b border-slate-100 pb-3"><i class="fa-solid fa-circle-info text-starRed mr-2"></i>MÔ TẢ SẢN PHẨM</h2>
            <div class="whitespace-pre-line text-sm text-slate-600 leading-relaxed max-w-4xl">${p.description.trim().replace(/</g, '&lt;')}</div>
        </div>` : ''}
    `;

    document.getElementById('productDetailContent').innerHTML = detailHtml;
    renderRelatedProducts(p);
}
function switchProductVariant(skuGroup, v1, v2) {
    let matched = products.find(p => p.skuGroup === skuGroup && p.variant1 === v1 && p.variant2 === v2);
    if (!matched) {
        matched = products.find(p => p.skuGroup === skuGroup && (p.variant1 === v1 || p.variant2 === v2));
    }
    if (matched) {
        openProductDetail(matched.id);
    }
}

function renderRelatedProducts(currentProduct) {
    const relatedGrid = document.getElementById('relatedProductsGrid');
    if (!relatedGrid) return;

    const related = getGroupedUniqueProducts(
        products.filter(p => p.category === currentProduct.category && p.id !== currentProduct.id)
    ).slice(0, 5);

    if (related.length === 0) {
        document.getElementById('relatedProductsSection')?.classList.add('hidden');
        return;
    }

    document.getElementById('relatedProductsSection')?.classList.remove('hidden');
    relatedGrid.innerHTML = related.map(p => renderProductCard(p)).join('');
}

function renderRecentlyViewed() {
    const sec = document.getElementById('recentlyViewedSection');
    const grid = document.getElementById('recentlyViewedGrid');
    if (!sec || !grid) return;

    if (recentlyViewed.length === 0) {
        sec.classList.add('hidden');
        return;
    }

    sec.classList.remove('hidden');
    grid.innerHTML = recentlyViewed.map(p => renderProductCard(p)).join('');
}

// --- LOGIC GIỎ HÀNG & HIỆU ỨNG BAY ---
function addToCart(productId, event = null) {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    // Chưa có giá bán (0/rỗng) và không flash → không thêm vào giỏ, hướng dẫn liên hệ
    if (!(getFlashSalePrice(p) > 0) && !hasRealPrice(p)) {
        contactForPrice(p.id);
        return;
    }

    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.quantity += 1;
    } else {
        // Đang Flash Sale + có giá tùy chỉnh → giỏ hàng dùng giá Flash Sale
        const fp = getFlashSalePrice(p);
        cart.push({ ...p, price: fp > 0 ? fp : p.price, quantity: 1 });
    }

    if (event) {
        animateFlyToCart(event, p.image);
    }

    updateCartUI();
    showToast(`Đã thêm "${p.id}" vào giỏ hàng!`);
}

function animateFlyToCart(event, imageUrl) {
    if (isFlying) return;
    const flyingEl = document.getElementById('flyingProduct');
    const flyingImg = document.getElementById('flyingImage');
    const cartBar = document.getElementById('cartBar');

    if (!flyingEl || !flyingImg || !cartBar) return;
    isFlying = true;

    const targetRect = event.currentTarget.getBoundingClientRect();
    const cartRect = cartBar.getBoundingClientRect();

    flyingImg.src = imageUrl;
    flyingEl.style.left = `${targetRect.left + targetRect.width / 2 - 32}px`;
    flyingEl.style.top = `${targetRect.top + targetRect.height / 2 - 32}px`;
    flyingEl.style.display = 'block';

    const animation = flyingEl.animate(
        [
            { left: `${targetRect.left}px`, top: `${targetRect.top}px`, transform: 'scale(1)', opacity: 1 },
            { left: `${cartRect.left + 30}px`, top: `${cartRect.top + 10}px`, transform: 'scale(0.2)', opacity: 0 }
        ],
        {
            duration: 800,
            easing: 'cubic-bezier(0.2, 1, 0.3, 1)',
            fill: 'forwards'
        }
    );

    animation.onfinish = () => {
        flyingEl.style.display = 'none';
        cartBar.classList.remove('pulse');
        void cartBar.offsetWidth;
        cartBar.classList.add('pulse');
        isFlying = false;
    };
}

function updateCartUI() {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (parsePrice(item.price) * item.quantity), 0);

    const badge = document.getElementById('cartBadge');
    if (badge) badge.innerText = totalCount;

    const cartSummary = document.getElementById('cartSummary');
    if (cartSummary) cartSummary.innerText = `${totalCount} sản phẩm - ${formatVND(totalPrice)}`;

    const totalEl = document.getElementById('cartTotal');
    if (totalEl) {
        totalEl.innerText = formatVND(totalPrice);
    }

    const cartList = document.getElementById('cartItemsList');
    if (cartList) {
        if (cart.length === 0) {
            cartList.innerHTML = `
                <div class="text-center py-10 space-y-2">
                    <i class="fa-solid fa-cart-flatbed text-3xl text-slate-300"></i>
                    <p class="text-slate-400 text-xs font-semibold">Giỏ hàng của bạn đang trống</p>
                </div>`;
        } else {
            cartList.innerHTML = cart.map(item => `
                <div class="flex items-center justify-between border-b border-slate-100 pb-3 text-xs gap-2">
                    <img src="${smallImageUrl(item.image, 120)}" onerror="imgFallback(this)" loading="lazy" decoding="async" class="w-12 h-12 object-contain rounded-lg border bg-white p-1 shrink-0">
                    <div class="flex-1 min-w-0">
                        <h5 class="font-bold text-slate-800 line-clamp-1">${item.name}</h5>
                        <p class="text-[10px] font-mono text-slate-400">Mã SP: <span class="text-starRed font-bold">${item.code}</span></p>
                        <p class="text-starRed font-bold mt-0.5">${formatVND(item.price)}</p>
                    </div>
                    <div class="flex items-center space-x-1.5 bg-slate-100 rounded-lg p-1 shrink-0">
                        <button onclick="changeQuantity('${item.id}', -1)" class="w-5 h-5 flex items-center justify-center font-bold text-slate-600 hover:bg-white rounded transition">-</button>
                        <span class="font-bold px-1 text-slate-800">${item.quantity}</span>
                        <button onclick="changeQuantity('${item.id}', 1)" class="w-5 h-5 flex items-center justify-center font-bold text-slate-600 hover:bg-white rounded transition">+</button>
                    </div>
                    <button onclick="removeFromCart('${item.id}')" class="text-slate-400 hover:text-starRed p-1 transition shrink-0" title="Xóa khỏi giỏ">
                        <i class="fa-regular fa-trash-can text-sm"></i>
                    </button>
                </div>
            `).join('');
        }
    }
}

function changeQuantity(id, delta) {
    const item = cart.find(x => x.id === id);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(x => x.id !== id);
    }
    updateCartUI();
}

function removeFromCart(id) {
    cart = cart.filter(x => x.id !== id);
    updateCartUI();
    showToast("Đã xóa sản phẩm khỏi giỏ hàng", "info");
}

function toggleCartModal() {
    const modal = document.getElementById('cartModal');
    const cartBar = document.getElementById('cartBar');
    
    if (modal) {
        const isHidden = modal.classList.toggle('hidden');
        
        // Nếu modal giỏ hàng mở -> ẩn thanh "Xem giỏ hàng" phía dưới đi để không bị đè
        // Nếu modal đóng -> hiện lại thanh "Xem giỏ hàng"
        if (cartBar) {
            if (!isHidden) {
                cartBar.style.transform = 'translate(-50%, 150%)';
                cartBar.style.transition = 'transform 0.3s ease';
            } else {
                cartBar.style.transform = 'translate(-50%, 0)';
            }
        }
    }
}
// --- THANH TOÁN & GỬI ĐƠN HÀNG QUA EMAILJS ---
function openCheckoutModal() {
    if (cart.length === 0) {
        showToast("Giỏ hàng của bạn đang trống!", "info");
        return;
    }
    toggleCartModal();
    const modal = document.getElementById('checkoutModal');
    if (modal) modal.classList.remove('hidden');

    // Đã đăng nhập → tự điền thông tin khách hàng
    prefillCheckoutFromAccount();

    // Ẩn thanh xem giỏ hàng cố định ở dưới màn hình mobile khi mở bảng thanh toán
    const cartBar = document.getElementById('cartBar');
    if (cartBar) {
        cartBar.style.transform = 'translate(-50%, 150%)';
        cartBar.style.transition = 'transform 0.3s ease';
    }

    renderCheckoutSummary();
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) modal.classList.add('hidden');

    // Hiện lại thanh xem giỏ hàng khi đóng bảng thanh toán
    const cartBar = document.getElementById('cartBar');
    if (cartBar) {
        cartBar.style.transform = 'translate(-50%, 0)';
    }
}
function renderCheckoutSummary() {
    const summaryContainer = document.getElementById('checkoutSummaryItems');
    const subTotalEl = document.getElementById('checkoutSubTotal');
    const totalEl = document.getElementById('checkoutTotal');
    const shipFeeEl = document.getElementById('checkoutShippingFee');
    const discountEl = document.getElementById('checkoutDiscountRow');

    const subTotal = cart.reduce((sum, item) => sum + (parsePrice(item.price) * item.quantity), 0);
    const shippingFee = subTotal >= 300000 ? 0 : 30000;

    let discount = 0;

    if (appliedCoupon) {
        if (appliedCoupon.type === 'AMOUNT') discount = appliedCoupon.value;
        else if (appliedCoupon.type === 'PERCENT') discount = Math.round((subTotal * appliedCoupon.value) / 100);
        else if (appliedCoupon.type === 'FREE_SHIP') discount = shippingFee;
    }

    const grandTotal = Math.max(0, subTotal + shippingFee - discount);

    if (summaryContainer) {
        summaryContainer.innerHTML = cart.map(item => `
            <div class="flex justify-between items-center text-xs gap-2 py-1 border-b border-dashed border-slate-100">
                <div class="flex-1 min-w-0">
                    <span class="line-clamp-1 text-slate-800 font-semibold">${item.name}</span>
                    <span class="text-[10px] text-slate-400 font-mono">Mã: ${item.code} (x${item.quantity})</span>
                </div>
                <span class="font-bold text-slate-700 shrink-0">${formatVND(parsePrice(item.price) * item.quantity)}</span>
            </div>
        `).join('');
    }

    if (subTotalEl) subTotalEl.innerText = formatVND(subTotal);
    if (shipFeeEl) shipFeeEl.innerText = shippingFee === 0 ? "Miễn phí" : formatVND(shippingFee);

    if (discountEl) {
        if (discount > 0) {
            discountEl.classList.remove('hidden');
            discountEl.innerHTML = `<span>Giảm giá:</span><span>-${formatVND(discount)}</span>`;
        } else {
            discountEl.classList.add('hidden');
        }
    }

    if (totalEl) totalEl.innerText = formatVND(grandTotal);

    togglePaymentView(grandTotal);
}

function togglePaymentView(grandTotal) {
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'COD';
    const vietqrArea = document.getElementById('vietqrArea');
    const vietqrImg = document.getElementById('vietqrImg');

    if (paymentMethod === 'BANK') {
        if (vietqrArea) vietqrArea.classList.remove('hidden');
        if (vietqrImg) {
            const amount = grandTotal || cart.reduce((sum, item) => sum + (parsePrice(item.price) * item.quantity), 0);
            vietqrImg.src = `https://img.vietqr.io/image/MB-0768718896-compact2.png?amount=${amount}&addInfo=TOHO%20DON%20HANG`;
        }
    } else {
        if (vietqrArea) vietqrArea.classList.add('hidden');
    }
}

function applyCoupon() {
    const input = document.getElementById('couponCodeInput');
    const msg = document.getElementById('couponMsg');
    if (!input || !msg) return;

    const code = input.value.trim().toUpperCase();
    if (!code) {
        msg.className = "block text-[11px] font-medium text-red-500 mt-1";
        msg.innerText = "Vui lòng nhập mã voucher";
        msg.classList.remove('hidden');
        return;
    }

    const subTotal = cart.reduce((sum, item) => sum + (parsePrice(item.price) * item.quantity), 0);
    const coupon = couponsList.find(c => c.code === code);

    if (!coupon) {
        msg.className = "block text-[11px] font-medium text-red-500 mt-1";
        msg.innerText = "Mã voucher không tồn tại";
        msg.classList.remove('hidden');
        return;
    }

    if (subTotal < coupon.minOrder) {
        msg.className = "block text-[11px] font-medium text-red-500 mt-1";
        msg.innerText = `Mã áp dụng cho đơn từ ${formatVND(coupon.minOrder)}`;
        msg.classList.remove('hidden');
        return;
    }

    appliedCoupon = coupon;
    msg.className = "block text-[11px] font-medium text-green-600 mt-1";
    msg.innerText = `Áp dụng thành công mã ${code}!`;
    msg.classList.remove('hidden');

    renderCheckoutSummary();
}

async function submitOrder(e) {
    if (e) e.preventDefault();

    if (!cart || cart.length === 0) {
        showToast("Giỏ hàng của bạn đang trống!", "info");
        return;
    }

    const name = document.getElementById('custName')?.value.trim();
    const phone = document.getElementById('custPhone')?.value.trim();
    const email = document.getElementById('custEmail')?.value.trim();
    const address = document.getElementById('custAddress')?.value.trim();
    const note = document.getElementById('custNote')?.value.trim() || 'Không có';
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'COD';

    if (!name || !phone || !email || !address) {
        showToast("Vui lòng điền đầy đủ thông tin bắt buộc (*)", "info");
        return;
    }

    const submitBtn = document.getElementById('submitOrderBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> <span>Đang xử lý đơn hàng...</span>`;
    }

    const subTotal = cart.reduce((sum, item) => sum + (parsePrice(item.price) * item.quantity), 0);
    const shippingFee = subTotal >= 300000 ? 0 : 30000;
    let discount = 0;

    if (appliedCoupon) {
        if (appliedCoupon.type === 'AMOUNT') discount = appliedCoupon.value;
        else if (appliedCoupon.type === 'PERCENT') discount = Math.round((subTotal * appliedCoupon.value) / 100);
        else if (appliedCoupon.type === 'FREE_SHIP') discount = shippingFee;
    }

    const grandTotal = Math.max(0, subTotal + shippingFee - discount);
    const orderId = 'TH' + Date.now().toString().slice(-6);

    const orderDetailsList = cart.map((item, index) => 
        `${index + 1}. ${item.name} (${item.code}) - SL: ${item.quantity} x ${formatVND(item.price)}`
    ).join('\n');

    const templateParams = {
        order_id: orderId,
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
        customer_address: address,
        customer_note: note,
        payment_method: paymentMethod === 'COD' ? 'Thanh toán khi nhận hàng (COD)' : 'Chuyển khoản VietQR',
        order_items: orderDetailsList,
        sub_total: formatVND(subTotal),
        shipping_fee: formatVND(shippingFee),
        discount_amount: formatVND(discount),
        total_amount: formatVND(grandTotal)
    };

    try {
        // Gửi đơn về TRẠM ADMIN trên máy này — để mục "Đơn Hàng" trong admin tự nhận đơn mới
        // (chỉ khi website mở trên máy có chạy server; truy cập từ điện thoại/khách qua Vercel vẫn gửi về Google Sheet như cũ)
        if (location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname)) {
            fetch('http://localhost:8120/', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' }, // tránh preflight CORS
                body: JSON.stringify({
                    action: 'order.add',
                    order: {
                        id: orderId, date: new Date().toLocaleString('vi-VN'),
                        name, phone, email, address, note,
                        payment: paymentMethod,
                        items: cart.map((it) => ({ name: it.name, code: it.code, quantity: it.quantity, price: it.price })),
                        subTotal, shippingFee, discount, total: grandTotal,
                        status: 'Chờ xác nhận', source: 'web'
                    }
                })
            }).catch(() => { /* Không có server admin trên máy → bỏ qua yên lặng */ });
        }
    } catch (e) { /* bỏ qua */ }

    try {
        if (SCRIPT_WEB_APP_URL) {
            fetch(SCRIPT_WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(templateParams)
            }).catch(err => console.warn("Lỗi đồng bộ Sheet:", err));
        }
        // Ghi đơn vào sheet ĐƠN HÀNG tự động (khi đã cấu hình Web App)
        try {
            if (ORDER_SHEET_WEB_APP_URL) {
                fetch(ORDER_SHEET_WEB_APP_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        id: orderId, date: new Date().toLocaleString('vi-VN'),
                        name, phone, email, address, note,
                        payment: paymentMethod === 'COD' ? 'COD' : 'BANK',
                        items: cart.map((it) => ({ name: it.name, code: it.code, quantity: it.quantity, price: it.price })),
                        total: grandTotal, subTotal, shippingFee, discount
                    })
                }).catch(() => {});
            }
        } catch (e) { /* bỏ qua */ }

        try {
            if (typeof emailjs !== 'undefined' && EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID) {
                await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
            }
        } catch (mailErr) {
            console.error("Lỗi EmailJS:", mailErr);
        }

        showToast("Đặt hàng thành công! Mã đơn của bạn là: " + orderId, "success");
        // Đăng nhập rồi → lưu đơn vào "Đơn hàng của tôi" trên máy
        saveMyOrder({
            id: orderId,
            date: new Date().toLocaleString('vi-VN'),
            items: orderDetailsList,
            total: grandTotal,
            status: 'Chờ xác nhận'
        });
        cart = [];
        appliedCoupon = null;
        updateCartUI();
        closeCheckoutModal();
        
        const checkoutForm = document.getElementById('checkoutForm');
        if (checkoutForm) checkoutForm.reset();

    } catch (err) {
        console.error("Lỗi xử lý đơn hàng:", err);
        showToast("Có lỗi xảy ra khi tạo đơn. Vui lòng liên hệ Hotline: 076 871 8896!", "info");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>XÁC NHẬN ĐẶT HÀNG</span>`;
        }
    }
}

// --- MODAL CHÍNH SÁCH ---
function loadPolicyPage(title) {
    const modalTitle = document.getElementById('policyModalTitle');
    const modalContent = document.getElementById('policyModalContent');
    const modal = document.getElementById('policyModal');

    if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid fa-file-contract"></i> <span>${title}</span>`;
    if (modalContent) modalContent.innerText = policiesMap[title] || "Nội dung đang được cập nhật...";
    if (modal) modal.classList.remove('hidden');
}

function closePolicyModal() {
    const modal = document.getElementById('policyModal');
    if (modal) modal.classList.add('hidden');
}

// --- LIGHTBOX ---
function openLightbox(url) {
    const modal = document.getElementById('imageLightboxModal');
    const img = document.getElementById('lightboxImg');
    if (modal && img) {
        img.src = url;
        modal.classList.remove('hidden');
    }
}

function closeLightbox() {
    const modal = document.getElementById('imageLightboxModal');
    if (modal) modal.classList.add('hidden');
}

// === TÍNH NĂNG TÍNH CÔNG SUẤT BẰNG JS HOÀN CHỈNH ===
function openPcBuilderModal() {
    const modal = document.getElementById('pcBuilderModal');
    if (modal) modal.classList.remove('hidden');
    renderPowerCalculator();
}

function closePcBuilderModal() {
    const modal = document.getElementById('pcBuilderModal');
    if (modal) modal.classList.add('hidden');
}

// Biến lưu từ khóa tìm kiếm thiết bị trong modal
let deviceSearchQuery = '';

function renderPowerCalculator() {
    const container = document.getElementById('pcBuilderComponentsList');
    if (!container) return;

    if (deviceList.length === 0) {
        container.innerHTML = `<p class="text-slate-400 text-center py-4">Đang tải danh sách thiết bị...</p>`;
        return;
    }

    // Lọc danh sách thiết bị theo từ khóa tìm kiếm
    const filteredDevices = deviceList.filter(dev => 
        dev.name.toLowerCase().includes(deviceSearchQuery.toLowerCase())
    );

    container.innerHTML = `
        <div class="space-y-4">
            <p class="text-slate-600 text-xs">Nhập tìm kiếm hoặc chọn số lượng các thiết bị điện đang sử dụng:</p>
            
            <!-- Ô TÌM KIẾM THIẾT BỊ -->
            <div class="relative">
                <input type="text" 
                       id="deviceSearchInput" 
                       placeholder="Tìm nhanh thiết bị (vd: Quạt, Tivi, Máy lạnh...)..." 
                       value="${deviceSearchQuery}"
                       oninput="handleDeviceSearch(this.value)"
                       class="w-full border border-slate-200 rounded-xl px-3.5 py-2 pl-9 text-xs focus:outline-none focus:border-starRed bg-slate-50">
                <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                ${filteredDevices.length > 0 ? filteredDevices.map(dev => {
                    const qty = selectedDevices[dev.id] || 0;
                    return `
                        <div class="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/50">
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 rounded-xl bg-red-100 text-starRed flex items-center justify-center shrink-0">
                                    <i class="fa-solid ${dev.icon}"></i>
                                </div>
                                <div>
                                    <h5 class="font-bold text-slate-800 text-xs">${dev.name}</h5>
                                    <span class="text-[10px] text-slate-500 font-mono">${dev.power} W/cái</span>
                                </div>
                            </div>
                            <div class="flex items-center space-x-2 bg-white rounded-xl border border-slate-200 p-1">
                                <button onclick="updateDeviceQty('${dev.id}', -1)" class="w-6 h-6 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 rounded-lg">-</button>
                                <span class="font-bold px-1 min-w-[20px] text-center text-xs">${qty}</span>
                                <button onclick="updateDeviceQty('${dev.id}', 1)" class="w-6 h-6 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 rounded-lg">+</button>
                            </div>
                        </div>
                    `;
                }).join('') : `<p class="col-span-2 text-center text-slate-400 text-xs py-4">Không tìm thấy thiết bị phù hợp</p>`}
            </div>
            
            <div id="calculatorResultArea" class="pt-3 border-t border-slate-200 space-y-3"></div>
        </div>
    `;

    calculateTotalPower();

    // Giữ tiêu điểm (focus) vào ô tìm kiếm khi gõ
    const input = document.getElementById('deviceSearchInput');
    if (input && deviceSearchQuery) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }
}

// Xử lý sự kiện tìm kiếm thiết bị
function handleDeviceSearch(val) {
    deviceSearchQuery = val;
    renderPowerCalculator();
}
function updateDeviceQty(devId, delta) {
    const current = selectedDevices[devId] || 0;
    const updated = Math.max(0, current + delta);
    if (updated === 0) {
        delete selectedDevices[devId];
    } else {
        selectedDevices[devId] = updated;
    }
    renderPowerCalculator();
}

function calculateTotalPower() {
    let totalWatts = 0;
    Object.keys(selectedDevices).forEach(id => {
        const dev = deviceList.find(d => d.id === id);
        if (dev) {
            totalWatts += dev.power * selectedDevices[id];
        }
    });

    const totalKva = (totalWatts / 1000 / 0.8).toFixed(1);
    const recommendedKva = Math.ceil((totalWatts / 1000 / 0.8) * 1.25);

    const resultArea = document.getElementById('calculatorResultArea');
    const totalEl = document.getElementById('pcBuilderTotal');

    if (totalEl) {
        totalEl.innerText = `${totalWatts.toLocaleString('vi-VN')} W (~ ${totalKva} kVA)`;
    }

    if (!resultArea) return;

    if (totalWatts === 0) {
        resultArea.innerHTML = `<p class="text-xs text-slate-400 italic text-center">Vui lòng chọn ít nhất 1 thiết bị để tính toán công suất phù hợp.</p>`;
        return;
    }

    // HIỂN THỊ KẾT QUẢ TÍNH TỔNG CÔNG SUẤT (ĐÃ XÓA PHẦN GỢI Ý SẢN PHẨM)
    resultArea.innerHTML = `
        <div class="bg-red-50/80 border border-red-200 p-4 rounded-2xl space-y-2">
            <div class="flex justify-between items-center text-xs font-bold text-slate-800">
                <span>Tổng công suất sử dụng:</span>
                <span class="text-starRed text-sm font-mono font-black">${totalWatts.toLocaleString('vi-VN')} Watts</span>
            </div>
            <div class="flex justify-between items-center text-xs text-slate-600">
                <span>Khuyến nghị chọn Ổn áp / Biến áp:</span>
                <span class="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">Từ ${recommendedKva} kVA trở lên</span>
            </div>
            <p class="text-[11px] text-slate-500 italic">* Đã tính dự phòng 25% dòng khởi động và biến động điện áp.</p>
        </div>
    `;
}
function addPcBuildToCart() {
    showToast("Đã tính toán xong công suất!");
    closePcBuilderModal();
}
// --- LIGHTBOX ARTISTIC CONTROLLER ---
let lightboxImages = [];
let currentLightboxIndex = 0;

function updateLightboxUI() {
    const img = document.getElementById('lightboxImg');
    const currEl = document.getElementById('lightboxCurrentIdx');
    const totalEl = document.getElementById('lightboxTotalIdx');

    if (img && lightboxImages.length > 0) {
        img.src = lightboxImages[currentLightboxIndex];
    }
    if (currEl) {
        currEl.innerText = String(currentLightboxIndex + 1).padStart(2, '0');
    }
    if (totalEl) {
        totalEl.innerText = String(lightboxImages.length).padStart(2, '0');
    }
}

function openLightbox(url) {
    const modal = document.getElementById('imageLightboxModal');
    
    if (currentDetailProduct && currentDetailProduct.images && currentDetailProduct.images.length > 0) {
        lightboxImages = currentDetailProduct.images;
        currentLightboxIndex = lightboxImages.indexOf(url);
        if (currentLightboxIndex === -1) currentLightboxIndex = 0;
    } else {
        lightboxImages = [url];
        currentLightboxIndex = 0;
    }

    if (modal) {
        updateLightboxUI();
        modal.classList.remove('hidden');
    }
}

function nextLightboxImage() {
    if (lightboxImages.length <= 1) return;
    currentLightboxIndex = (currentLightboxIndex + 1) % lightboxImages.length;
    updateLightboxUI();
}

function prevLightboxImage() {
    if (lightboxImages.length <= 1) return;
    currentLightboxIndex = (currentLightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
    updateLightboxUI();
}

function closeLightbox() {
    const modal = document.getElementById('imageLightboxModal');
    if (modal) modal.classList.add('hidden');
}

window.addEventListener('popstate', (event) => {
    const state = event.state;

    if (state && state.tab) {
        if (state.tab === 'product-detail' && state.productId) {
            // Mở lại chi tiết sản phẩm khi người dùng bấm Next/Back
            openProductDetailWithoutPush(state.productId);
        } else {
            // Chuyển tab về trang chủ hoặc chính sách mà không đẩy thêm state mới
            switchTab(state.tab, false);
            resetSeoToHome();
        }
    } else {
        switchTab('home', false);
        resetSeoToHome();
    }
});

// Hàm hỗ trợ hiển thị trang chi tiết khi bấm Back/Forward mà không đẩy lại PushState
function openProductDetailWithoutPush(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;

    currentDetailProduct = p;
    switchTab('product-detail', false); // false: không pushState nữa
    
    // Gọi hàm openProductDetail hiển thị dữ liệu bình thường
    const originalPush = history.pushState;
    history.pushState = function() {}; // Tạm ngắt pushState
    openProductDetail(id);
    history.pushState = originalPush; // Khôi phục lại pushState
}
// --- TỐI ƯU HIỂN THỊ DANH MỤC TRÊN MOBILE ---
function toggleMobileCategoryMenu() {
    const modal = document.getElementById('mobileCategoryModal');
    if (!modal) return;
    
    const isHidden = modal.classList.contains('hidden');
    if (isHidden) {
        renderMobileCategories();
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

function renderMobileCategories() {
    const container = document.getElementById('mobileCategoryListContent');
    if (!container) return;

    // Tổng hợp cấu trúc danh mục, danh mục con và danh mục cháu từ mảng sản phẩm
    const categoryMap = {};
    products.forEach(p => {
        if (!p.category) return;
        if (!categoryMap[p.category]) categoryMap[p.category] = {};
        if (p.subCategory) {
            if (!categoryMap[p.category][p.subCategory]) {
                categoryMap[p.category][p.subCategory] = new Set();
            }
            if (p.childCategory) {
                categoryMap[p.category][p.subCategory].add(p.childCategory);
            }
        }
    });

    let html = `
        <div onclick="filterByCategory(''); toggleMobileCategoryMenu();" class="p-3 rounded-xl bg-red-50 text-starRed font-bold flex items-center justify-between cursor-pointer">
            <span><i class="fa-solid fa-list mr-2"></i>Tất cả sản phẩm</span>
            <i class="fa-solid fa-chevron-right text-[10px]"></i>
        </div>
    `;

    Object.keys(categoryMap).forEach(cat => {
        const subMap = categoryMap[cat];
        const subCats = Object.keys(subMap);

        html += `
            <div class="border border-slate-100 rounded-2xl p-3 space-y-2 bg-slate-50/50">
                <div onclick="filterByCategory('${cat}'); toggleMobileCategoryMenu();" class="font-extrabold text-slate-900 flex justify-between items-center cursor-pointer">
                    <span class="uppercase text-starRed">${cat}</span>
                    <i class="fa-solid fa-arrow-right text-[10px] text-slate-400"></i>
                </div>
                ${subCats.length > 0 ? `
                    <div class="pl-3 space-y-2 pt-2 border-t border-slate-200/60">
                        ${subCats.map(sub => {
                            const children = Array.from(subMap[sub]);
                            return `
                                <div class="space-y-1">
                                    <div onclick="filterBySubCategory('${cat}', '${sub}'); toggleMobileCategoryMenu();" class="font-bold text-slate-700 flex justify-between items-center cursor-pointer py-1">
                                        <span>• ${sub}</span>
                                    </div>
                                    ${children.length > 0 ? `
                                        <div class="pl-3 flex flex-wrap gap-1.5 py-1">
                                            ${children.map(child => `
                                                <span onclick="filterByChildCategory('${cat}', '${sub}', '${child}'); toggleMobileCategoryMenu();" class="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-[11px] text-slate-600 font-medium cursor-pointer shadow-sm">
                                                    ${child}
                                                </span>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    });

    container.innerHTML = html;
}