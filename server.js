// ============================================================
// SERVER ADMIN CỤC BỘ — QUẢN LÝ SẢN PHẨM, BÀI VIẾT KHÔNG CẦN SHEET
// Chạy:  node server.js   (hoặc nhấp đúp ADMIN.bat)
// Web    : http://localhost:8120/
// Admin  : http://localhost:8120/admin.html
// Dữ liệu lưu thẳng vào: data/products.json, data/products.js, data/policies.js
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
const PORT = 8120;
const DATA = path.join(ROOT, 'data');

// Đọc mật khẩu admin từ js/admin-config.js (regex thay vì require)
let ADMIN_PASS = 'TOHO-ADMIN-2026';
const cfgPath = path.join(ROOT, 'js', 'admin-config.js');
if (fs.existsSync(cfgPath)) {
  const raw = fs.readFileSync(cfgPath, 'utf8');
  const m = raw.match(/pass\s*:\s*'([^']*)'/);
  if (m) ADMIN_PASS = m[1];
}

// Đổi mật khẩu: ghi lại vào js/admin-config.js
function updatePassFile(newPass) {
  const raw = fs.readFileSync(cfgPath, 'utf8');
  const updated = raw.replace(/pass\s*:\s*'([^']*)'/, "pass: '" + newPass + "'");
  fs.writeFileSync(cfgPath, updated, 'utf-8');
  ADMIN_PASS = newPass;
}

// ============ DỮ LIỆU ============
function readProducts() {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, 'products.json'), 'utf8')); }
  catch { return []; }
}
function writeProducts(list) {
  fs.writeFileSync(path.join(DATA, 'products.json'), JSON.stringify(list, null, 2), 'utf-8');
  fs.writeFileSync(path.join(DATA, 'products.js'),
    'window.PRODUCTS_DATA = ' + JSON.stringify(list) + ';\nwindow.PRODUCTS_FALLBACK = window.PRODUCTS_DATA;', 'utf-8');
}
function readPolicies() {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, 'policies.json'), 'utf8')); }
  catch { return {}; }
}
function writePolicies(p) {
  fs.writeFileSync(path.join(DATA, 'policies.json'), JSON.stringify(p, null, 2), 'utf-8');
  fs.writeFileSync(path.join(DATA, 'policies.js'), 'window.POLICIES_DATA = ' + JSON.stringify(p) + ';', 'utf-8');
}

// ============ ĐƠN HÀNG ============
function readOrders() {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, 'orders.json'), 'utf8')); }
  catch { return []; }
}
function writeOrders(list) {
  // Mới nhất lên đầu
  list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''), 'vi', { numeric: true }) || 0);
  fs.writeFileSync(path.join(DATA, 'orders.json'), JSON.stringify(list, null, 2), 'utf-8');
  fs.writeFileSync(path.join(DATA, 'orders.js'), 'window.ORDERS_DATA = ' + JSON.stringify(list) + ';', 'utf-8');
}
function normalizeOrder(o) {
  return {
    id: String(o.id || '').trim(),
    date: o.date || new Date().toLocaleString('vi-VN'),
    name: o.name || '', phone: o.phone || '', email: o.email || '',
    address: o.address || '', note: o.note || '',
    payment: o.payment || 'COD',
    items: Array.isArray(o.items) ? o.items : [],
    subTotal: parseInt(o.subTotal) || 0,
    shippingFee: parseInt(o.shippingFee) || 0,
    discount: parseInt(o.discount) || 0,
    total: parseInt(o.total) || 0,
    status: o.status || 'Chờ xác nhận',
    source: o.source || 'web'
  };
}

// Cấu hình website (Flash Sale...)
function readSettings() {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, 'settings.json'), 'utf8')); }
  catch { return {}; }
}
function writeSettings(s) {
  fs.writeFileSync(path.join(DATA, 'settings.json'), JSON.stringify(s, null, 2), 'utf-8');
  fs.writeFileSync(path.join(DATA, 'settings.js'), 'window.SITE_SETTINGS = ' + JSON.stringify(s) + ';', 'utf-8');
}

// Tạo file bảng tính (mở bằng Excel, chia cột rõ ràng bằng dấu ;)
function productsToCSV(list) {
  const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""').replace(/\r?\n/g, ' | ') + '"';
  const head = ['MÃ SP (SKU)', 'TÊN SẢN PHẨM', 'MÔ TẢ SẢN PHẨM', 'DANH MỤC', 'DANH MỤC CON', 'GIÁ BÁN (đ)', 'GIÁ GỐC (đ)', 'MÃ HÀNG', 'TÌNH TRẠNG', 'FLASH SALE', 'GIÁ FLASH SALE (đ)', 'SỐ LƯỢNG ĐÃ BÁN', 'BÁN ẢO', 'TỒN KHO', 'LINK ẢNH'];
  const rows = list.map((p) => [
    p.sku || p.code || p.id,
    p.name,
    p.description || '',
    p.category,
    p.subCategory,
    p.price,
    p.oldPrice,
    p.code || '',
    p.stock,
    p.isFlashSale ? 'CÓ' : 'KHÔNG',
    (p.isFlashSale && parseFloat(p.flashPrice) > 0) ? p.flashPrice : '',
    p.soldCount,
    p.virtualSold || 0,
    p.totalCount,
    (p.images || []).join(' , ')
  ].map(esc).join(';'));
  return head.map(esc).join(';') + '\n' + rows.join('\n');
}

// Phân tích CSV biết dấu ngoặc kép + ô có xuống dòng (sheet đơn hàng chứa nhiều dòng)
function parseCSV(text) {
  const rows = []; let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); cell = ''; rows.push(row); row = []; }
    else if (c === '\r') { /* bỏ qua */ }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(s => s.trim()));
}

// ============ API ============
const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
};

// ============ STATIC FILE SERVER ============
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon', '.xml': 'application/xml'
};

function serveStatic(req, res, urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h2 style="font-family:sans-serif">404 — Không thấy file: ' + p + '</h2>');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}

// ============ WEB SERVER ============
let buffers = new Map();
const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (req.method === 'GET') {
    if (req.url === '/api/health') return json(res, 200, { ok: true, server: 'admin-server' });
    // ==== XUẤT FILE DỮ LIỆU (download từ admin) ====
    if (req.url.startsWith('/api/export')) {
      const u = new URL(req.url, 'http://localhost');
      if (u.searchParams.get('pass') !== ADMIN_PASS) { res.writeHead(401); return res.end('Sai mật khẩu'); }
      let body, name;
      if (u.searchParams.get('type') === 'policies') {
        body = JSON.stringify(readPolicies(), null, 2);
        name = 'policies.json';
      } else if (u.searchParams.get('type') === 'products-csv') {
        body = productsToCSV(readProducts());
        name = 'san-pham.csv';
      } else if (u.searchParams.get('type') === 'orders-csv') {
        const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""').replace(/\r?\n/g, ' | ') + '"';
        const head = ['MÃ ĐƠN', 'NGÀY GIỜ', 'KHÁCH HÀNG', 'ĐIỆN THOẠI', 'EMAIL', 'ĐỊA CHỈ', 'GHI CHÚ', 'SẢN PHẨM', 'TỔNG TIỀN (đ)', 'THANH TOÁN', 'TRẠNG THÁI'];
        const rows = readOrders().map((o) => [
          o.id, o.date, o.name, o.phone, o.email || '', o.address, o.note || '',
          (o.items || []).map((it) => (it.name || '') + (it.quantity ? ' x' + it.quantity : '')).join(' | '),
          o.total, o.payment, o.status
        ].map(esc).join(';'));
        body = head.map(esc).join(';') + '\n' + rows.join('\n');
        name = 'don-hang.csv';
      } else if (u.searchParams.get('type') === 'all') {
        body = JSON.stringify({ exportedAt: new Date().toISOString(), products: readProducts(), policies: readPolicies() }, null, 2);
        name = 'backup-toho-dulieu.json';
      } else {
        body = JSON.stringify(readProducts(), null, 2);
        name = 'products.json';
      }
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="' + name + '"'
      });
      return res.end('\uFEFF' + body); // BOM để Excel đọc tiếng Việt chuẩn
    }
    return serveStatic(req, res, req.url);
  }

  if (req.method !== 'POST') { res.writeHead(405); return res.end(); }

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', async () => {
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
    catch { return json(res, 400, { ok: false, error: 'JSON lỗi' }); }

    if (body.action !== 'order.add' && body.pass !== ADMIN_PASS && !buffers.has('auth_' + req.socket.remoteAddress)) {
      return json(res, 401, { ok: false, error: 'Sai mật khẩu admin' });
    }

    switch (body.action) {
      case 'auth': {
        buffers.set('auth_' + req.socket.remoteAddress, Date.now());
        return json(res, 200, { ok: true });
      }
      case 'data': {
        return json(res, 200, { ok: true, products: readProducts(), policies: readPolicies(), settings: readSettings(), orders: readOrders() });
      }

      // === ĐƠN HÀNG: web gửi đơn về trạm admin (không cần mật khẩu — chỉ máy này gọi được) ===
      case 'order.add': {
        const o = normalizeOrder(body.order || {});
        if (!o.id || !o.phone) return json(res, 400, { ok: false, error: 'Đơn thiếu mã hoặc SĐT' });
        const list = readOrders();
        const i = list.findIndex(x => String(x.id) === String(o.id));
        if (i >= 0) { o.status = list[i].status || o.status; list[i] = o; } // chống nhân đôi khi trang gửi lại
        else list.unshift(o);
        writeOrders(list);
        return json(res, 200, { ok: true, msg: `Đã nhận đơn ${o.id}`, count: list.length });
      }
      case 'order.save': {
        const id = String(body.id || '');
        const list = readOrders();
        const o = list.find(x => String(x.id) === id);
        if (!o) return json(res, 404, { ok: false, error: 'Không tìm thấy đơn ' + id });
        if (body.status !== undefined) o.status = String(body.status);
        if (body.note !== undefined) o.adminNote = String(body.note);
        writeOrders(list);
        return json(res, 200, { ok: true, msg: `Đã cập nhật đơn ${id}` });
      }
      case 'order.delete': {
        const id = String(body.id || '');
        const list = readOrders().filter(x => String(x.id) !== id);
        writeOrders(list);
        return json(res, 200, { ok: true, msg: `Đã xóa đơn ${id}`, count: list.length });
      }
      // === NHẬP ĐƠN TỪ GOOGLE SHEET (dành cho đơn đặt từ web Vercel) ===
      case 'orders.import': {
        let url = String(body.url || readSettings().ordersSheetUrl || '').trim();
        if (!url) return json(res, 400, { ok: false, error: 'Chưa có link: mở Google Sheet đơn hàng → File → Chia sẻ → Xuất bản lên web → CSV, rồi dán link vào.' });
        try {
          const txt = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()).then(r => r.text());
          const rows = parseCSV(txt).filter(r => r.some(c => String(c).trim()));
          const pick = (r, names) => { for (const n of names) { const i = r.h.findIndex(h => String(h).toLowerCase().includes(String(n).toLowerCase())); if (i >= 0 && r[i] !== undefined) return String(r[i] || '').trim(); } return ''; };
          const head = rows.shift() || [];
          const list = readOrders();
          let added = 0, updated = 0, skipped = 0;
          rows.forEach(r => {
            r.h = head;
            const id = pick(r, ['order_id', 'mã đơn', 'ma don', 'id đơn', 'id']);
            const phone = pick(r, ['customer_phone', 'điện thoại', 'dien thoai', 'phone', 'sdt']);
            const email = pick(r, ['customer_email', 'email']);
            const total = parseInt(String(pick(r, ['total_amount', 'tổng tiền', 'tổng', 'total'])).replace(/[^0-9]/g, ''), 10) || 0;
            if (!id && !phone) { skipped++; return; }
            const items = pick(r, ['order_items', 'sản phẩm', 'items']) || '';
            const o = {
              id: id || ('TH' + Date.now().toString().slice(-6) + added),
              date: pick(r, ['timestamp', 'date', 'ngày']) || new Date().toLocaleString('vi-VN'),
              name: pick(r, ['customer_name', 'khách hàng', 'khach hang', 'name', 'tên']),
              phone,
              email,
              address: pick(r, ['customer_address', 'địa chỉ', 'dia chi', 'address']),
              note: pick(r, ['customer_note', 'ghi chú', 'note']),
              payment: (pick(r, ['payment_method', 'thanh toán', 'payment']).toUpperCase().includes('QR') || pick(r, ['payment_method', 'thanh toán', 'payment']).toUpperCase().includes('CHUYỂN')) ? 'BANK' : 'COD',
              items: items.split(/\n|\s\|\s/).map(s => s.trim()).filter(Boolean).map(line => ({ name: line })),
              total,
              status: 'Chờ xác nhận',
              source: 'google-sheet'
            };
            const i = list.findIndex(x => String(x.id) === String(o.id));
            if (i >= 0) { if (list[i].status === 'Chờ xác nhận') list[i] = o; updated++; }
            else { list.unshift(o); added++; }
          });
          writeOrders(list);
          if (body.saveUrl) { const s = readSettings(); s.ordersSheetUrl = url; writeSettings(s); }
          return json(res, 200, { ok: true, msg: `Nhập sheet: ${added} đơn mới, ${updated} cập nhật, ${skipped} bỏ qua`, count: list.length });
        } catch (e) {
          return json(res, 500, { ok: false, error: 'Không đọc được sheet: ' + e.message });
        }
      }
      case 'product.save': {
        const p = body.product || {};
        if (!String(p.id || '').trim()) return json(res, 400, { ok: false, error: 'Thiếu MÃ sản phẩm' });
        const list = readProducts();
        const i = list.findIndex(x => String(x.id) === String(p.id));
        // Chuẩn hóa ảnh: mảng URL (không tải về máy — ảnh vẫn nằm trên Google Drive)
        p.images = Array.isArray(p.images) ? p.images : String(p.images || '').split(/[\n,|]/).map(s => s.trim()).filter(Boolean);
        p.image = p.images[0] || 'images/no-image.svg';
        if (i >= 0) list[i] = { ...list[i], ...p };
        else list.push({ soldCount: 5, totalCount: 20, stock: 'Còn hàng', ...p });
        writeProducts(list);
        return json(res, 200, { ok: true, msg: `Đã lưu sản phẩm ${p.id} (source website)`, count: list.length });
      }
      case 'product.delete': {
        const list = readProducts().filter(x => String(x.id) !== String(body.id));
        writeProducts(list);
        return json(res, 200, { ok: true, msg: `Đã xóa sản phẩm ${body.id}`, count: list.length });
      }
      case 'policy.save': {
        const title = String(body.title || '').trim().toUpperCase();
        if (!title) return json(res, 400, { ok: false, error: 'Thiếu tiêu đề bài viết' });
        const p = readPolicies();
        const existed = Object.prototype.hasOwnProperty.call(p, title);
        p[title] = body.content || '';
        writePolicies(p);
        return json(res, 200, { ok: true, msg: existed ? `Cập nhật bài viết: ${title}` : `Đã đăng bài viết mới: ${title}` });
      }
      case 'policy.delete': {
        const p = readPolicies();
        const title = String(body.title || '').trim().toUpperCase();
        if (!(title in p)) return json(res, 404, { ok: false, error: 'Không tìm thấy bài viết' });
        delete p[title];
        writePolicies(p);
        return json(res, 200, { ok: true, msg: `Đã xóa bài viết: ${title}` });
      }
      // === NÚT "CẬP TẪ SHEETS": kéo dữ liệu Sheet về source cục bộ ===
      case 'sync.sheets': {
        const out = spawn('node', ['tools/sync-sheets.js'], { cwd: ROOT });
        let log = '';
        out.stdout.on('data', d => { log += d; });
        out.stderr.on('data', d => { log += d; });
        out.on('close', code => {
          json(res, 200, { ok: code === 0, msg: code === 0 ? 'Đã cập nhật từ Google Sheets về source!' : 'Lỗi đồng bộ', log });
        });
        return; // trả về sau khi process kết thúc
      }
      // === NÚT "XUẤT TRANG SEO TĨNH": rebuild san-pham/* + sitemap ===
      case 'rebuild.pages': {
        const out = spawn('node', ['build-pages.js'], { cwd: ROOT });
        let log = '';
        out.stdout.on('data', d => { log += d; });
        out.stderr.on('data', d => { log += d; });
        out.on('close', code => {
          json(res, 200, { ok: code === 0, msg: code === 0 ? 'Đã export 394 trang SEO tĩnh + sitemap!' : 'Lỗi khi build', log });
        });
        return;
      }

      // === FLASH SALE CỤM: đặt/bỏ sale cho sản phẩm theo trang tab Flash Sale của admin ===
      case 'flash.save': {
        const ids = new Set((body.ids || []).map((x) => String(x)));
        // Bảng giá Flash Sale tùy chỉnh: { 'id sản phẩm': giá sale }
        const prices = body.prices && typeof body.prices === 'object' ? body.prices : {};
        const list = readProducts();
        list.forEach((p) => {
          const inSale = ids.has(String(p.id));
          p.isFlashSale = inSale;
          // Bỏ khỏi sale → xóa giá sale; đang sale → nhận giá tùy chỉnh (nếu có nhập)
          if (!inSale) p.flashPrice = 0;
          else {
            const v = parseFloat(prices[String(p.id)]);
            p.flashPrice = (isFinite(v) && v > 0) ? v : 0;
          }
        });
        writeProducts(list);
        const s = readSettings();
        if (body.settings && typeof body.settings === 'object') {
          if (body.settings.flashHours !== undefined) { const h = parseFloat(body.settings.flashHours); if (!isNaN(h)) s.flashHours = Math.max(0.1, h); }
          if (body.settings.flashMax !== undefined) { const m = parseInt(body.settings.flashMax, 10); if (!isNaN(m)) s.flashMax = Math.max(0, m); } // 0 = hiện TẤT CẢ
          writeSettings(s);
        }
        const count = list.filter((p) => p.isFlashSale).length;
        return json(res, 200, { ok: true, msg: `Flash Sale cập nhật: ${count} sản phẩm trong khu sale`, count });
      }
      // (Đã ẩn khỏi admin — trường hợp cũ giữ lại để tương thích)
      case 'scrape.lioa': {
        const out = spawn('node', ['tools/scrape-lioa.js'], { cwd: ROOT });
        let log = '';
        out.stdout.on('data', d => { log += d; });
        out.stderr.on('data', d => { log += d; });
        out.on('close', code => {
          json(res, 200, { ok: code === 0, msg: code === 0 ? 'Đã nhập sản phẩm LIOA + xuất lại SEO!' : 'Lỗi nhập hàng LIOA', log });
        });
        return;
      }
      // === TÀI KHOẢN: ĐỔI MẬT KHẨU ADMIN ===
      case 'auth.save': {
        if (String(body.currentPass || '') !== ADMIN_PASS) {
          return json(res, 401, { ok: false, error: 'Mật khẩu hiện tại không đúng' });
        }
        const np = String(body.newPass || '').trim();
        if (np.length < 6) return json(res, 400, { ok: false, error: 'Mật khẩu mới cần tối thiểu 6 ký tự' });
        updatePassFile(np);
        return json(res, 200, { ok: true, msg: 'Đã đổi mật khẩu admin! Lần đăng nhập sau dùng mật khẩu mới.' });
      }

      default:
        return json(res, 400, { ok: false, error: 'Action không rõ: ' + body.action });
    }
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('============================================');
  console.log('  TOHO ELECTRIC VN — SERVER ADMIN CỤC BỘ');
  console.log('============================================');
  console.log(`  Website : http://localhost:${PORT}/index.html`);
  console.log(`  Admin   : http://localhost:${PORT}/admin.html`);
  console.log(`  Mật khẩu: xem tại js/admin-config.js`);
  console.log('  (Tắt server = đóng cửa sổ này)');
  console.log('');
});
