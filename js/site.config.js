// ============================================================
// CẤU HÌNH WEBSITE TOHO ELECTRIC VN
// khi đổi tên miền, chỉ cần sửa 1 dòng này, rồi chạy "node build-pages.js"
// ============================================================
window.SITE_CONFIG = {
    siteUrl: 'https://toho-electric.vercel.app',
    siteName: 'TOHO ELECTRIC VN',
    // Tiền tố đường dẫn trang chi tiết sản phẩm: /san-pham/<id>
    productPath: 'san-pham',
    phone: '0768718896',
    logo: 'images/logo.png'
};

// URL chi tiết sản phẩm, id có thể chứa "/" (vd 2P-3M/2-20A) -> /san-pham/2P-3M/2-20A
window.SITE_CONFIG.productPathUrl = function (id, absolute) {
    const base = (window.SITE_CONFIG.productPath || 'san-pham');
    const path = String(id || '')
        .split('/')
        .filter(Boolean)
        .map(encodeURIComponent)
        .join('/');
    return (absolute ? window.SITE_CONFIG.siteUrl.replace(/\/$/, '') : '') + '/' + base + '/' + path;
};
window.SITE_CONFIG.productPathUrlSelf = function (id) {
    // href dùng cho thẻ <a>: tuyệt đối từ gốc để vừa chạy ở SPA lẫn trang tĩnh
    return window.SITE_CONFIG.productPathUrl(id, false);
};
