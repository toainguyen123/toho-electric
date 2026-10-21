// ============================================================
// ĐỒNG BỘ DỮ LIỆU TỪ GOOGLE SHEETS VỀ THƯ MỤC SOURCE WEBSITE
// Chạy: node tools/sync-sheets.js
// Ảnh KHÔNG tải về máy (để tiết kiệm dung lượng) — chỉ lưu URL Drive.
// ============================================================
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');

const PRODUCTS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQWm2p0bF1cb1jjEdiol9BUZzVnH53XEvwpj9DW9QfOmgmbgj9VIX-QqoXXA6QCP-YvPQQQDGOaVrEW/pub?gid=1881975737&single=true&output=csv';
const POLICIES_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQWm2p0bF1cb1jjEdiol9BUZzVnH53XEvwpj9DW9QfOmgmbgj9VIX-QqoXXA6QCP-YvPQQQDGOaVrEW/pub?gid=607784045&single=true&output=csv';

// --- Nạp lại Bộ phân tích sản phẩm từ convert.js (đảm bảo parse giống hệt web) ---
const r = spawnSync('node', ['convert.js'], { cwd: ROOT, encoding: 'utf8' });
console.log((r.stdout || '') + (r.stderr || ''));

// --- Đồng bộ CHÍNH SÁCH / BÀI VIẾT ---
function parseCSV(text) {
  const lines = String(text || '').split(/\r\n|\n|\r/);
  const out = [];
  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line) continue;
    const row = [];
    let inQ = false, f = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQ = !inQ;
      else if (c === ',' && !inQ) { row.push(f.trim()); f = ''; }
      else f += c;
    }
    row.push(f.trim());
    out.push(row);
  }
  return out;
}

(async () => {
  // 1) Sản phẩm vừa được convert.js cập nhật → nạp lại và ghi file js
  const products = JSON.parse(fs.readFileSync(path.join(DATA, 'products.json'), 'utf8'));
  writeProductsFile(products);
  console.log(`Sản phẩm: ${products.length} mục -> data/products.js`);

  // 2) Chính sách / bài viết
  try {
    const res = await fetch(POLICIES_CSV);
    const rows = parseCSV(await res.text());
    const policies = {};
    for (const cols of rows) {
      if (cols.length >= 2 && cols[0].trim()) {
        policies[cols[0].trim().toUpperCase()] = cols[1].trim();
      }
    }
    writePoliciesFile(policies);
    console.log(`Bài viết / chính sách: ${Object.keys(policies).length} mục -> data/policies.js`);
  } catch (e) {
    console.warn('Lỗi tải chính sách từ Sheet:', e.message);
  }

  console.log('ĐỒNG BỘ HOÀN TẤT. Website giờ đọc từ source cục bộ (ảnh vẫn chạy ở Google Drive).');
})();

// Ghi file source mà website nạp trực tiếp
function writeProductsFile(products) {
  fs.writeFileSync(path.join(DATA, 'products.js'),
    'window.PRODUCTS_DATA = ' + JSON.stringify(products) + ';\nwindow.PRODUCTS_FALLBACK = window.PRODUCTS_DATA;', 'utf-8');
}
function writePoliciesFile(policies) {
  fs.writeFileSync(path.join(DATA, 'policies.json'), JSON.stringify(policies, null, 2), 'utf-8');
  fs.writeFileSync(path.join(DATA, 'policies.js'), 'window.POLICIES_DATA = ' + JSON.stringify(policies) + ';', 'utf-8');
}
