/* ==========================================================
   CẤU HÌNH CHUNG — Chỉ sửa phần "CONFIG" bên dưới
   ========================================================== */
const CONFIG = {
  // Dán URL kết thúc bằng /exec của Apps Script vào đây (xem HUONG-DAN-CAI-DAT.md)
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw0C8zN8-E_aSVAwn1NOp9GNq0KOb6lu9DyJgIR-EnTg-jmnmNwOLecAw2fKPMtpsnh3w/exec',

  // Khóa quản trị (phải khớp với ADMIN_KEY trong apps-script.gs)
  ADMIN_KEY: 'shop2026',

  // Thông tin shop hiển thị trên trang
  SHOP_NAME: 'TOHO ELECTRIC VN',
  SHOP_HOTLINE: '076 871 8896',
  SHOP_ZALO: 'https://zalo.me/0768718896',
  SHOP_FACEBOOK: 'https://facebook.com/tohoelectricvn',

  // Thời gian bảo hành (tháng) — hiển thị trên form & thẻ in
  WARRANTY_MONTHS: 12,
};

/* ============ KHÔNG CẦN SỬA PHẦN DƯỚI ĐÂY ============ */

/** Gọi yêu cầu kiểu JSONP bằng GET — chạy được cả khi mở file trực tiếp, tránh CORS */
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = 'bh_cb_' + Math.random().toString(36).slice(2) + Date.now();
    const s = document.createElement('script');
    const sep = url.includes('?') ? '&' : '?';
    const timer = setTimeout(() => { cleanup(); reject(new Error('TIMEOUT')); }, 15000);
    function cleanup() { s.remove(); try { delete window[cb]; } catch (e) { window[cb] = undefined; } }
    window[cb] = (data) => { clearTimeout(timer); cleanup(); resolve(data); };
    s.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error('NETWORK_ERROR')); };
    s.src = url + sep + 'callback=' + cb;
    document.body.appendChild(s);
  });
}

/** Gọi lệnh lên Apps Script (GET + JSONP) */
function appsGet(params) {
  if (!CONFIG.APPS_SCRIPT_URL) {
    return Promise.reject(new Error('NOT_CONFIGURED'));
  }
  const p = new URLSearchParams(Object.assign({ key: CONFIG.ADMIN_KEY }, params));
  return jsonp(CONFIG.APPS_SCRIPT_URL + '?' + p.toString());
}

/** Tránh ký tự đặc biệt khi chèn HTML */
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Định dạng ngày giờ kiểu Việt Nam */
function fmtDateTime(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Màu badge theo tình trạng xử lý */
const STATUS_STYLES = {
  'Chờ xử lý':        { bg: '#fff7d6', color: '#9a6b00', dot: '#f5b301' },
  'Đang xử lý':       { bg: '#e0ecff', color: '#1d4ed8', dot: '#3b82f6' },
  'Đang bảo hành':    { bg: '#ede4ff', color: '#6d28d9', dot: '#8b5cf6' },
  'Hoàn tất':         { bg: '#dcf9ec', color: '#047857', dot: '#10b981' },
  'Từ chối bảo hành': { bg: '#ffe4e4', color: '#b91c1c', dot: '#ef4444' },
};
const STATUS_LIST = Object.keys(STATUS_STYLES);
