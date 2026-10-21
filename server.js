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

// ============ API ============
const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': 'http://localhost:' + PORT });
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
      'Access-Control-Allow-Origin': 'http://localhost:' + PORT,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (req.method === 'GET') {
    if (req.url === '/api/health') return json(res, 200, { ok: true, server: 'admin-server' });
    return serveStatic(req, res, req.url);
  }

  if (req.method !== 'POST') { res.writeHead(405); return res.end(); }

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
    catch { return json(res, 400, { ok: false, error: 'JSON lỗi' }); }

    if (body.pass !== ADMIN_PASS && !buffers.has('auth_' + req.socket.remoteAddress)) {
      return json(res, 401, { ok: false, error: 'Sai mật khẩu admin' });
    }

    switch (body.action) {
      case 'auth': {
        buffers.set('auth_' + req.socket.remoteAddress, Date.now());
        return json(res, 200, { ok: true });
      }
      case 'data': {
        return json(res, 200, { ok: true, products: readProducts(), policies: readPolicies() });
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
