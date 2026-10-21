/**
 * ============================================================
 * TOHO ELECTRIC VN — BACKEND QUẢN TRỊ (Google Apps Script)
 * ============================================================
 * CÁCH CÀI (làm 1 lần):
 * 1. Mở Google Sheet chứa dữ liệu website → Extensions (Tiện ích mở rộng)
 *    → Apps Script
 * 2. Xóa code mẫu, dán NGUYÊN file này vào Code.gs
 * 3. Sửa dòng SHARED_SECRET bên dưới thành mật khẩu riêng của bạn
 * 4. Deploy (Triển khai) → New deployment (Triển khai mới)
 *    - Type: Web app (Ứng dụng web)
 *    - Execute as: Me (Chạy với tư cách: Tôi)
 *    - Who has access: Anyone (Bất kỳ ai)  ← bắt buộc để web gọi được
 *    → Copy vào URL kết thúc bằng /exec và dán vào file js/admin-config.js
 * 5. Deploy lại (Deploy > Manage deployments > Edit > New version) mỗi lần sửa code
 */

// ★★★ ĐỔI MẬT KHẨU NÀY ★★★
const SHARED_SECRET = 'TOHO-ADMIN-2026';

// Các sheet theo gid — giống website đang dùng
const GID_PRODUCTS = 1881975737;  // sheet dữ liệu sản phẩm
const GID_POLICIES = 607784045;   // sheet chính sách / bài viết

function sheetByGid_(gid) {
  const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (const s of sheets) {
    if (s.getSheetId() === gid) return s;
  }
  return null;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
       .setMimeType(ContentService.MimeType.JSON);
}

function check_(body) {
  return body && body.token === SHARED_SECRET;
}

// ============ GET: đọc dữ liệu (dùng ?action=list) ============
function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) || '';
    if (action === 'list') {
      const rowsCsv = e.parameter.sheet === 'policies' ? GID_POLICIES : GID_PRODUCTS;
      const sh = sheetByGid_(rowsCsv);
      const rows = sh.getDataRange().getValues();
      return out_({ ok: true, rows: rows });
    }
    return out_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

// ============ POST: ghi dữ liệu ============
function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents || '{}');
  } catch (err) {
    return out_({ ok: false, error: 'bad json' });
  }
  if (!check_(body)) return out_({ ok: false, error: 'SAI MẬT KHẨU' });

  try {
    switch (body.action) {
      case 'ping': return out_({ ok: true, msg: 'connected' });

      case 'upsertProduct': return upsertProduct_(body);
      case 'deleteProduct': return deleteProduct_(body);
      case 'upsertPolicy':  return upsertPolicy_(body);
      case 'deletePolicy':  return deletePolicy_(body);

      default: return out_({ ok: false, error: 'unknown action' });
    }
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

// ---------- SẢN PHẨM (gid 1881975737) ----------
// Cột: A id | B tên | C danh mục | D danh mục con | E giá | F giá cũ
//      G ảnh (cách nhau |) | H badge | I flashSale | J tình trạng
//      K thông số | L đã bán | M tổng | N biến thể 1 | O biến thể 2 | P nhóm sku
function upsertProduct_(body) {
  const sh = sheetByGid_(GID_PRODUCTS);
  if (!sh) return out_({ ok: false, error: 'Không tìm thấy sheet sản phẩm' });

  const id = String(body.id || '').trim();
  if (!id) return out_({ ok: false, error: 'Thiếu MÃ sản phẩm' });

  const rowValues = [
    id, body.name || 'Sản phẩm', body.category || 'Khác', body.subCategory || '',
    body.price || '0', body.oldPrice || '0',
    (body.images || []).join('|'), body.badge || '',
    body.isFlashSale ? 'TRUE' : 'FALSE', body.stock || 'Còn hàng',
    body.specs || 'Bảo hành chính hãng',
    body.soldCount || 0, body.totalCount || 20,
    body.variant1 || '', body.variant2 || '', body.skuGroup || id
  ];

  const colA = sh.getRange('A1:A' + sh.getLastRow()).getDisplayValues();
  for (let r = 0; r < colA.length; r++) {
    if (String(colA[r][0]).trim() === id) {
      sh.getRange(r + 1, 1, 1, rowValues.length).setValues([rowValues]);
      return out_({ ok: true, msg: 'Cập nhật ' + id, mode: 'update', row: r + 1 });
    }
  }
  sh.appendRow(rowValues);
  return out_({ ok: true, msg: 'Thêm mới ' + id, mode: 'add' });
}

function deleteProduct_(body) {
  const sh = sheetByGid_(GID_PRODUCTS);
  if (!sh) return out_({ ok: false, error: 'Không tìm thấy sheet sản phẩm' });
  const id = String(body.id || '').trim();
  const colA = sh.getRange('A1:A' + sh.getLastRow()).getDisplayValues();
  for (let r = 0; r < colA.length; r++) {
    if (String(colA[r][0]).trim() === id && r > 0) { // giữ dòng tiêu đề
      sh.deleteRow(r + 1);
      return out_({ ok: true, msg: 'Đã xóa ' + id });
    }
  }
  return out_({ ok: false, error: 'Không tìm thấy ' + id });
}

// ---------- CHÍNH SÁCH / BÀI VIẾT (gid 607784045) ----------
// Cột: A tiêu đề | B nội dung (nhiều xuống dòng)
function upsertPolicy_(body) {
  const sh = sheetByGid_(GID_POLICIES);
  if (!sh) return out_({ ok: false, error: 'Không tìm thấy sheet chính sách' });

  const title = String(body.title || '').trim().toUpperCase();
  if (!title) return out_({ ok: false, error: 'Thiếu tiêu đề bài viết' });

  const colA = sh.getRange('A1:A' + sh.getLastRow()).getDisplayValues();
  for (let r = 0; r < colA.length; r++) {
    if (String(colA[r][0]).trim() === title) {
      sh.getRange(r + 1, 1, 1, 2).setValues([[title, body.content || '']]);
      return out_({ ok: true, msg: 'Cập nhật bài viết', mode: 'update' });
    }
  }
  sh.appendRow([title, body.content || '']);
  return out_({ ok: true, msg: 'Đã đăng bài viết mới', mode: 'add' });
}

function deletePolicy_(body) {
  const sh = sheetByGid_(GID_POLICIES);
  if (!sh) return out_({ ok: false, error: 'Không tìm thấy sheet chính sách' });
  const title = String(body.title || '').trim().toUpperCase();
  const colA = sh.getRange('A1:A' + sh.getLastRow()).getDisplayValues();
  for (let r = 0; r < colA.length; r++) {
    if (String(colA[r][0]).trim() === title && r > 0) {
      sh.deleteRow(r + 1);
      return out_({ ok: true, msg: 'Đã xóa bài viết' });
    }
  }
  return out_({ ok: false, error: 'Không tìm thấy bài viết' });
}
