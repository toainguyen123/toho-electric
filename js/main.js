const categoryBannerMap = {
    "Ổ CẮM ĐIỆN": "images/opt/category-o-cam-dien.webp",
    "DÂY ĐIỆN": "images/opt/category-day-dien.webp",
    "ỔN ÁP": "images/opt/category-thiet-bi-dien.webp",
    "BIẾN ÁP": "images/opt/category-thiet-bi-dien.webp",
    "THIẾT BỊ ĐIỆN": "images/opt/category-thiet-bi-dien.webp"
};
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQWm2p0bF1cb1jjEdiol9BUZzVnH53XEvwpj9DW9QfOmgmbgj9VIX-QqoXXA6QCP-YvPQQQDGOaVrEW/pub?gid=1881975737&single=true&output=csv';
const GOOGLE_SHEET_POLICY_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQWm2p0bF1cb1jjEdiol9BUZzVnH53XEvwpj9DW9QfOmgmbgj9VIX-QqoXXA6QCP-YvPQQQDGOaVrEW/pub?gid=607784045&single=true&output=csv'; 
const GOOGLE_SHEET_COUPON_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTwd1vDetlRkcIJlVh_kJSPjOkelKivMYZ_t6F_6lj6B9DJZwq9qCcf1Bqv6C8JQ50lOUKwqWaMBuuL/pub?gid=242716168&single=true&output=csv'; 

// === ĐƯỜNG DẪN GOOGLE SHEET THIẾT BỊ CÔNG SUẤT ===
// BẠN DÁN LINK CSV SHEETS THIẾT BỊ CỦA BẠN VÀO DÒNG DƯỚI DÂY:
const GOOGLE_SHEET_DEVICES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ8R7cVFNzYCQSaFr2Qebvp55YQV35S7AuxTx8v49S3qsgDu7BDaR8fa5K8pUjLztJPBhWrMbYFfo75/pubhtml?gid=242716168&single=true';

const SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzth1uAlb4AaxDKmi_Wb0RDdfTPU7ZaqDx6epOz4SRFZeBBYPIWqx2HtsSta479mzLW/exec';

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

// BIO CỦA TÍNH NĂNG TÍNH CÔNG SUẤT
let deviceList = [];
let selectedDevices = {};

// --- TIỆN ÍCH XỬ LÝ HÌNH ẢNH & GIÁ ---
// Ảnh lỗi cho sạch: dùng file local thay vì dịch vụ placeholder ngoài (tránh thêm chậm/lỗi)
const IMG_PLACEHOLDER = 'images/no-image.svg';

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
    // Bỏ mọi tham số =w... cũ rồi thêm tham số mới
    return url.replace(/=[^=]*$/, '') + '=w' + width;
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
});

async function initData() {
    try {
        const res = await fetch(GOOGLE_SHEET_CSV_URL);
        const csvText = await res.text();
        products = parseProductsFromCSV(csvText);

        // file:// hoặc Sheet lỗi -> dùng bản data cục bộ data/products.js (do convert.js tạo)
        if (!products || products.length === 0) {
            await loadProductsFallback();
        }
        filteredProducts = [...products];

        renderHoverCategories();
        renderFlashSale();
        renderCategoryBlocks();

        await loadPoliciesFromSheet();
        await loadCouponsFromSheet();
        await loadDevicesFromSheet();

        applyStartupRouting();
        // =============================================

    } catch (e) {
        console.error("Lỗi tải dữ liệu Sheets:", e);
        // file:// bị CORS hoặc mạng lỗi -> nạp bản data cục bộ thay thế
        await loadProductsFallback();
        applyStartupRouting();
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

// Nạp data/products.js (script đơn giản, chạy được kể cả khi mở file:// double-click)
function loadProductsFallback() {
    return new Promise((resolve) => {
        if (window.PRODUCTS_FALLBACK && window.PRODUCTS_FALLBACK.length) {
            products = window.PRODUCTS_FALLBACK;
            filteredProducts = [...products];
            renderHoverCategories();
            renderFlashSale();
            renderCategoryBlocks();
            showToast("Đang dùng bản dự phòng cục bộ (nội dung có thể chưa mới nhất).", "info");
            resolve();
            return;
        }
        const s = document.createElement('script');
        s.src = 'data/products.js';
        s.onload = () => {
            if (window.PRODUCTS_FALLBACK && window.PRODUCTS_FALLBACK.length) {
                products = window.PRODUCTS_FALLBACK;
                filteredProducts = [...products];
                renderHoverCategories();
                renderFlashSale();
                renderCategoryBlocks();
                showToast("Đang dùng bản dự phòng cục bộ (nội dung có thể chưa mới nhất).", "info");
            } else {
                showToast("Không tải được danh sách sản phẩm!", "info");
            }
            resolve();
        };
        s.onerror = () => {
            showToast("Không tải được danh sách sản phẩm!", "info");
            resolve();
        };
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

async function loadPoliciesFromSheet() {
    loadDefaultPolicies();
    if (!GOOGLE_SHEET_POLICY_CSV_URL) return;

    try {
        const cacheBusterUrl = GOOGLE_SHEET_POLICY_CSV_URL + '&t=' + new Date().getTime();
        const res = await fetch(cacheBusterUrl);
        if (!res.ok) throw new Error("Không thể kết nối tập tin chính sách CSV.");

        const csvText = await res.text();
        const rows = parseCSV(csvText);

        rows.forEach(cols => {
            if (cols.length >= 2) {
                const policyTitle = cols[0].trim();
                const policyContent = cols[1].trim();
                if (policyTitle && policyContent) {
                    policiesMap[policyTitle] = policyContent;
                }
            }
        });
    } catch (e) {
        console.warn("Dùng dữ liệu chính sách mặc định do lỗi:", e);
    }
}

function loadDefaultPolicies() {
    policiesMap = {
        "CHÍNH SÁCH GIAO HÀNG": "Chúng tôi giao hàng toàn quốc. Khách hàng được kiểm tra hàng trước khi thanh toán.\nMiễn phí vận chuyển cho đơn hàng từ 300.000đ.",
        "ĐỔI TRẢ DỄ DÀNG": "Sản phẩm được đổi mới 1 đổi 1 trong vòng 7 ngày kể từ khi nhận hàng nếu có lỗi từ nhà sản xuất.",
        "GIÁ LUÔN LUÔN RẺ NHẤT": "Cam kết mang đến sản phẩm chất lượng tốt nhất với mức giá cạnh tranh nhất trên thị trường.",
        "HỖ TRỢ NHIỆT TÌNH": "Đội ngũ kỹ thuật viên tư vấn 24/7 qua Zalo và Hotline 076 871 8896."
    };
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
    let duration = 12 * 3600 + 45 * 60 + 30;
    setInterval(() => {
        if (duration <= 0) duration = 24 * 3600;
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
    const detailUrl = window.SITE_CONFIG ? window.SITE_CONFIG.productPathUrl(p.id) : (`san-pham/${encodeURIComponent(p.id)}`);

    return `
        <a href="${detailUrl}" onclick="openProductDetail('${p.id}'); return false;" class="block glass-card art-card p-3 flex flex-col justify-between cursor-pointer relative group overflow-hidden" title="${p.name}">
            ${p.badge ? `<span class="absolute top-3 left-3 bg-starRed text-white text-[10px] font-extrabold px-2 py-0.5 rounded-lg shadow-md z-10 font-heading">${p.badge}</span>` : (hasDiscount ? `<span class="absolute top-3 left-3 bg-starRed text-white text-[10px] font-extrabold px-2 py-0.5 rounded-lg shadow-md z-10 font-heading">-${discount}%</span>` : '')}
            
           <div class="w-full h-70 md:h-72 flex items-center justify-center p-2 rounded-xl bg-slate-50 mb-2 overflow-hidden">
                <img src="${p.image}" onerror="imgFallback(this)" loading="lazy" decoding="async" class="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300" alt="${p.name} - ${p.code}">
           </div>

            <div class="space-y-1.5 flex-1 flex flex-col justify-between">
                <div>
                    <h4 class="product-title line-clamp-2 hover:text-starRed transition font-bold text-xs text-slate-800">${p.name}</h4>
                    <div class="text-[11px] text-slate-500 font-mono mt-1">
                        Mã: <span class="font-bold text-starRed">${p.code}</span>
                    </div>
                </div>

                <div class="pt-2">
                    <div class="flex items-baseline space-x-1.5 flex-wrap">
                        <span class="product-price font-extrabold text-starRed text-sm">${formatVND(p.price)}</span>
                        ${hasDiscount ? `<span class="text-[11px] text-slate-400 line-through">${formatVND(p.oldPrice)}</span>` : ''}
                    </div>
                    
                    <button onclick="event.preventDefault(); event.stopPropagation(); addToCart('${p.id}', event)" class="mt-2 w-full bg-red-50 hover:bg-starRed text-starRed hover:text-white border border-red-200 text-xs font-bold py-1.5 rounded-xl transition flex items-center justify-center space-x-1">
                        <i class="fa-solid fa-cart-plus"></i>
                        <span>Thêm vào giỏ</span>
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
    const displayList = flashProducts.length > 0 ? flashProducts.slice(0, 5) : getGroupedUniqueProducts(products).slice(0, 5);

    container.innerHTML = displayList.map(p => renderProductCard(p)).join('');
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
                    <img id="mainDetailImage" src="${p.image}" onerror="imgFallback(this)" decoding="async" class="max-h-80 object-contain hover:scale-105 transition cursor-pointer" onclick="openLightbox('${p.image}')" alt="${p.name} - ${p.code}">
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

                <div class="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 flex items-baseline space-x-3">
                    <span id="detailPrice" class="text-2xl md:text-3xl font-extrabold text-starRed font-heading">${formatVND(p.price)}</span>
                    ${discount > 0 ? `<span id="detailOldPrice" class="text-sm text-slate-400 line-through">${formatVND(p.oldPrice)}</span>` : ''}
                    ${discount > 0 ? `<span class="bg-red-100 text-starRed text-xs font-bold px-2 py-0.5 rounded-lg">Tiết kiệm ${discount}%</span>` : ''}
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
                    <button onclick="addToCart('${p.id}', event)" class="flex-1 bg-starRed hover:bg-starRedHover text-white font-bold py-3.5 rounded-2xl shadow-lg transition flex items-center justify-center space-x-2 text-sm uppercase font-heading">
                        <i class="fa-solid fa-cart-plus"></i>
                        <span>Thêm vào giỏ hàng</span>
                    </button>
                    <button onclick="addToCart('${p.id}', event); toggleCartModal();" class="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-2xl shadow-lg transition text-sm uppercase font-heading">
                        Mua ngay
                    </button>
                </div>
            </div>
        </div>
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

    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...p, quantity: 1 });
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
                cartBar.style.transform = 'translateY(150%)';
                cartBar.style.transition = 'transform 0.3s ease';
            } else {
                cartBar.style.transform = 'translateY(0)';
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

    // Ẩn thanh xem giỏ hàng cố định ở dưới màn hình mobile khi mở bảng thanh toán
    const cartBar = document.getElementById('cartBar');
    if (cartBar) {
        cartBar.style.transform = 'translateY(150%)';
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
        cartBar.style.transform = 'translateY(0)';
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
        if (SCRIPT_WEB_APP_URL) {
            fetch(SCRIPT_WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(templateParams)
            }).catch(err => console.warn("Lỗi đồng bộ Sheet:", err));
        }

        try {
            if (typeof emailjs !== 'undefined' && EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID) {
                await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
            }
        } catch (mailErr) {
            console.error("Lỗi EmailJS:", mailErr);
        }

        showToast("Đặt hàng thành công! Mã đơn của bạn là: " + orderId, "success");
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