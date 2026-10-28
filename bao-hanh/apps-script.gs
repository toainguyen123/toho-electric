/**
 * ============================================================
 *  MÃ APPS SCRIPT — LƯU PHIẾU BẢO HÀNH VÀO GOOGLE SHEETS
 *  Cách cài: xem file HUONG-DAN-CAI-DAT.md
 * ============================================================
 */

// ================= CẤU HÌNH =================
// Tên tab (sheet) trong file Google Sheets — script sẽ tự tạo nếu chưa có
var SHEET_NAME = 'BẢO HÀNH';

// Phải KHỚP với ADMIN_KEY trong config.js
var ADMIN_KEY = 'shop2026';

// Cột chuẩn của bảng (dòng 1 của tab). Trang web được thiết kế theo đúng thứ tự này
var HEADERS = [
  'THỜI GIAN GỬI',    // 1  - tự động điền
  'MÃ PHIẾU',         // 2  - mã in trên thẻ bảo hành kèm gói hàng
  'HỌ TÊN',           // 3
  'SỐ ĐIỆN THOẠI',    // 4
  'TÊN SẢN PHẨM',     // 5
  'MÃ ĐƠN HÀNG',      // 6
  'NỀN TẢNG MUA',     // 7  - Shopee / TikTok Shop / Website / Khác
  'NGÀY MUA',         // 8
  'ĐỊA CHỈ GIAO',     // 9
  'MÔ TẢ LỖI/HƯ HẠI', // 10
  'LINK ẢNH/VIDEO',   // 11 - khách dán link (tuỳ chọn)
  'TÌNH TRẠNG',       // 12 - do chủ shop cập nhật
  'GHI CHÚ'           // 13
];

var STATUS_DEFAULT = 'Chờ xử lý';

// Các tình trạng hợp lệ (trang quản lý sẽ dùng đúng các giá trị này)
var STATUS_LIST = ['Chờ xử lý', 'Đang xử lý', 'Đang bảo hành', 'Hoàn tất', 'Từ chối bảo hành'];

// ============ TAB "VOUCHER" — bố cục 10 cột (A–J) ============
var VOUCHER_SHEET_NAME = 'VOUCHER';
var VOUCHER_HEADERS = [
  'MÃ VOUCHER',        // A
  'MÃ THẺ BẢO HÀNH',   // B
  'TRẠNG THÁI',        // C   CHƯA SỬ DỤNG / ĐÃ SỬ DỤNG
  'NGÀY IN',           // D
  'NGÀY SỬ DỤNG',      // E
  'GỬI QUA PHIẾU',     // F   mã phiếu BH nếu dùng qua form bảo hành
  'HIỆU LỰC ĐẾN',      // G   = ngày in + số ngày hiệu lực
  'DISCOUNT_VALUE',    // H   50000 hoặc 10%
  'MIN_ORDER',         // I   đơn tối thiểu
  'SỐ LƯỢNG'           // J   số lượt dùng; trống = 1 lần
];
var VOUCHER_VALID_DAYS = 30; // hiệu lực mặc định (ngày) nếu không truyền days

// ============ TAB "MÃ THẺ BẢO HÀNH" — chỉ chứa mã thẻ ============
var CARD_SHEET_NAME = 'MÃ THẺ BẢO HÀNH';
var CARD_HEADERS = [
  'MÃ THẺ BẢO HÀNH',  // 1
  'TÌNH TRẠNG',       // 2  CHƯA ĐĂNG KÝ / ĐÃ ĐĂNG KÝ
  'NGÀY IN',          // 3
  'NGÀY KÍCH HOẠT',   // 4
  'VOUCHER KÈM THEO'  // 5
];

// ================================================
//  CHÍNH SỬA FORM WEB → GHI VÀO SHEET
// ================================================
function doGet(e) {
  var p = (e && e.parameter) || {};
  var out;

  if (p.key !== ADMIN_KEY) {
    out = { ok: false, error: 'Sai khóa quản trị (ADMIN_KEY)' };
    return respond_(out, p.callback);
  }

  try {
    switch (p.action) {

      case 'ping':
        out = { ok: true, sheet: SHEET_NAME, rows: getSheet_().getLastRow() - 1 };
        break;

      // --- Khi IN THẺ NGAY: lưu lô VOUCHER vào sheet "VOUCHER" (10 cột A–J) ---
      // p.data = "VC-000001,VC-000002" — p.cards = mã thẻ tương ứng (tuỳ chọn)
      // p.discount (VD: 50000 hoặc "10%") — p.minorder — p.qty (số lượt dùng)
      case 'savevouchers': {
        var vouchers = String(p.data || '').split(',').map(s => String(s || '').trim().toUpperCase()).filter(Boolean);
        if (!vouchers.length) { out = { ok: false, error: 'Thiếu danh sách mã voucher' }; break; }
        var cardsIn = String(p.cards || '').split(',').map(s => String(s || '').trim().toUpperCase());
        var vsh = getVoucherSheet_();
        var vdata = vsh.getDataRange().getValues();
        var have = {};
        for (var v = 1; v < vdata.length; v++) {
          have[String(vdata[v][0] || '').trim().toUpperCase()] = true;
        }
        var days = Math.max(1, parseFloat(p.days || '30') || 30);
        var disc = String(p.discount || '').trim();
        var minO = String(p.minorder || '').trim();
        var qty = String(p.qty || '').trim();
        var now = new Date();
        var exp = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        var buf = [];
        var added = 0, skipped = 0;
        for (var k = 0; k < vouchers.length; k++) {
          if (have[vouchers[k]]) { skipped++; continue; }
          have[vouchers[k]] = true;
          // A: mã voucher | B: mã thẻ | C: trạng thái | D: ngày in | E: ngày dùng
          // F: gửi qua phiếu | G: hiệu lực đến | H: giảm giá | I: đơn tối thiểu | J: số lượng
          buf.push([vouchers[k], cardsIn[k] || '', 'CHƯA SỬ DỤNG', now, '', '', exp, disc, minO, qty]);
          added++;
        }
        if (buf.length) {
          vsh.getRange(vsh.getLastRow() + 1, 1, buf.length, 10).setValues(buf);
        }
        out = { ok: true, added: added, skipped: skipped, days: days };
        break;
      }

      // --- Khi IN THẺ NGAY: lưu lô MÃ THẺ vào sheet "MÃ THẺ BẢO HÀNH" ---
      // p.data = "TOHO15-202501,TOHO15-202502,..."
      case 'savecards': {
        var cards = String(p.data || '').split(',').map(s => String(s || '').trim().toUpperCase()).filter(Boolean);
        if (!cards.length) { out = { ok: false, error: 'Thiếu danh sách mã thẻ' }; break; }
        var csh = getCardSheet_();
        var cdata = csh.getDataRange().getValues();
        var have = {};
        for (var c = 1; c < cdata.length; c++) {
          have[String(cdata[c][0] || '').trim().toUpperCase()] = true;
        }
        var now = new Date();
        var buf = [];
        var added = 0, skipped = 0;
        for (var k = 0; k < cards.length; k++) {
          if (have[cards[k]]) { skipped++; continue; }
          have[cards[k]] = true;
          buf.push([cards[k], 'CHƯA ĐĂNG KÝ', now, '', '']);
          added++;
        }
        if (buf.length) {
          csh.getRange(csh.getLastRow() + 1, 1, buf.length, 5).setValues(buf);
        }
        out = { ok: true, added: added, skipped: skipped };
        break;
      }

      // --- Trang quản lý: đọc toàn bộ voucher ---
      case 'listvouchers': {
        var vs = getVoucherSheet_();
        var vd = vs.getDataRange().getValues();
        var vrows = [];
        for (var r = 1; r < vd.length; r++) {
          if (String(vd[r][0] || '').trim() === '') continue;
          vrows.push({
            row: r + 1,
            vou:   String(vd[r][0] || ''),
            card:  String(vd[r][1] || ''),
            status: String(vd[r][2] || ''),
            printed: toISO_(vd[r][3]),
            usedAt:  toISO_(vd[r][4]),
            quaPhieu: String(vd[r][5] || ''),
            validTo: toISO_(vd[r][6]),
            discount: String(vd[r][7] || ''),
            minOrder: String(vd[r][8] || ''),
            qty: String(vd[r][9] || '')
          });
        }
        out = { ok: true, count: vrows.length, rows: vrows };
        break;
      }

      // --- Đánh dấu voucher ĐÃ SỬ DỤNG (nhậu khách dùng / gọi tay) ---
      // --- Ghi nhận dùng voucher: trừ SỐ LƯỢNG (cột J); trống = dùng 1 lần ---
      case 'usevoucher': {
        var vcode = String(p.code || '').trim().toUpperCase();
        if (!vcode) { out = { ok: false, error: 'Thiếu mã voucher' }; break; }
        var foundV = findVoucher_(vcode);
        if (!foundV) { out = { ok: false, error: 'MÃ VOUCHER này không tồn tại' }; break; }
        var vsh2 = getVoucherSheet_();
        if (String(vsh2.getRange(foundV.row, 3).getValue()).toUpperCase().includes('ĐÃ SỬ DỤNG')) {
          out = { ok: false, error: 'Mã voucher này đã sử dụng rồi', row: foundV.row }; break;
        }
        var qtyCell = vsh2.getRange(foundV.row, 10);
        var qtyVal = String(qtyCell.getValue()).trim();
        if (qtyVal === '') {
          // không set số lượng → mã chỉ dùng 1 lần
          vsh2.getRange(foundV.row, 3).setValue('ĐÃ SỬ DỤNG');
          vsh2.getRange(foundV.row, 5).setValue(new Date());
        } else {
          var q = parseInt(qtyVal, 10);
          if (isNaN(q)) q = 1;
          if (q <= 0) { out = { ok: false, error: 'Mã voucher đã hết lượt sử dụng', row: foundV.row }; break; }
          q--;
          qtyCell.setValue(q);
          if (q <= 0) {
            vsh2.getRange(foundV.row, 3).setValue('ĐÃ SỬ DỤNG');
            vsh2.getRange(foundV.row, 5).setValue(new Date());
          }
        }
        out = { ok: true, row: foundV.row, vou: vcode };
        break;
      }

      // --- Khách gửi phiếu: thêm 1 dòng mới ---
      case 'save':
        out = save_(p);
        break;

      // --- Kiểm tra mã phiếu đã tồn tại chưa ---
      case 'check': {
        var code = String(p.code || '').trim().toUpperCase();
        if (!code) { out = { ok: false, error: 'Thiếu mã' }; break; }
        var found = findByCode_(code);
        out = { ok: true, exists: !!found, row: found ? found.row : 0 };
        break;
      }

      // --- Trang quản lý: lấy danh sách phiếu ---
      case 'list': {
        var sh = getSheet_();
        var data = sh.getDataRange().getValues();
        var rows = [];
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][1] || '').trim() === '' && String(data[i][2] || '').trim() === '') continue;
          rows.push({
            row: i + 1,
            time: toISO_(data[i][0]),
            code: String(data[i][1] || ''),
            name: String(data[i][2] || ''),
            phone: String(data[i][3] || ''),
            product: String(data[i][4] || ''),
            order: String(data[i][5] || ''),
            platform: String(data[i][6] || ''),
            buyDate: toISO_(data[i][7]),
            address: String(data[i][8] || ''),
            issue: String(data[i][9] || ''),
            media: String(data[i][10] || ''),
            status: String(data[i][11] || STATUS_DEFAULT),
            note: String(data[i][12] || '')
          });
        }
        out = { ok: true, count: rows.length, rows: rows };
        break;
      }

      // --- Trang quản lý: đọc toàn bộ mã thẻ ---
      case 'listcards': {
        var cs = getCardSheet_();
        var cd = cs.getDataRange().getValues();
        var crows = [];
        for (var r = 1; r < cd.length; r++) {
          if (String(cd[r][0] || '').trim() === '') continue;
          crows.push({
            row: r + 1,
            code:   String(cd[r][0] || ''),
            status: String(cd[r][1] || ''),
            printed: toISO_(cd[r][2]),
            usedAt:  toISO_(cd[r][3]),
            voucher: String(cd[r][4] || '')
          });
        }
        out = { ok: true, count: crows.length, rows: crows };
        break;
      }

      // --- Khi khách đăng ký: đánh dấu thẻ ĐÃ ĐĂNG KÝ ---
      case 'usecard': {
        var cardCode = String(p.code || '').trim().toUpperCase();
        if (!cardCode) { out = { ok: false, error: 'Thiếu mã thẻ' }; break; }
        var foundC = findCard_(cardCode);
        if (!foundC) { out = { ok: false, error: 'MÃ THẺ này không tồn tại' }; break; }
        var csh = getCardSheet_();
        if (String(csh.getRange(foundC.row, 2).getValue()).toUpperCase().includes('ĐÃ')) {
          out = { ok: false, error: 'Thẻ này đã đăng ký rồi', row: foundC.row }; break;
        }
        csh.getRange(foundC.row, 2).setValue('ĐÃ ĐĂNG KÝ');
        csh.getRange(foundC.row, 4).setValue(new Date());
        if (p.vou) csh.getRange(foundC.row, 5).setValue(String(p.vou));
        out = { ok: true, row: foundC.row, code: cardCode };
        break;
      }

      // --- Kiểm tra MÃ BẢO HÀNH đã có trong hệ thống chưa (khi khách gửi phiếu) ---
      case 'checkbh': {
        var bhCode = String(p.code || '').trim().toUpperCase();
        if (!bhCode) { out = { ok: false, error: 'Thiếu mã' }; break; }
        var foundB = findCard_(bhCode);
        out = { ok: true, exists: !!foundB, row: foundB ? foundB.row : 0 };
        break;
      }

      // --- Trang quản lý: cập nhật tình trạng / ghi chú ---
      case 'update': {
        var sheet = getSheet_();
        var rowNum = parseInt(p.row, 10);
        var statusCol = HEADERS.indexOf('TÌNH TRẠNG') + 1;
        var noteCol = HEADERS.indexOf('GHI CHÚ') + 1;
        if (!rowNum || rowNum < 2) { out = { ok: false, error: 'Số dòng không hợp lệ' }; break; }
        if (p.status && STATUS_LIST.indexOf(String(p.status)) === -1) {
          out = { ok: false, error: 'Tình trạng không hợp lệ' }; break;
        }
        if (p.status) sheet.getRange(rowNum, statusCol).setValue(String(p.status));
        if (p.note !== undefined) sheet.getRange(rowNum, noteCol).setValue(String(p.note));
        out = { ok: true, row: rowNum };
        break;
      }

      default:
        out = { ok: false, error: 'Thiếu tham số action (ping|save|check|list|update|savevouchers|savecards|listvouchers|listcards|usevoucher|usecard)' };
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }

  return respond_(out, p.callback);
}

/** Cho phép POST đơn giản (nếu cần) — trang web đang dùng GET nên không bắt buộc */
function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { body = {}; }
  if (!body.key || body.key !== ADMIN_KEY) {
    return respond_({ ok: false, error: 'Sai khóa quản trị (ADMIN_KEY)' }, null);
  }
  return respond_(save_(body), null);
}

// ================================================
//  HÀM PHỤ
// ================================================
function save_(p) {
  var code = String(p.code || '').trim().toUpperCase();
  if (!code)      return { ok: false, error: 'Thiếu MÃ PHIẾU' };
  if (!p.name)    return { ok: false, error: 'Thiếu HỌ TÊN' };
  if (!p.phone)   return { ok: false, error: 'Thiếu SỐ ĐIỆN THOẠI' };

  if (findByCode_(code)) return { ok: false, error: 'MÃ PHIẾU này đã được đăng ký rồi' };

  // --- Xử lý mã VOUCHER khách nhập (nếu có) ---
  var vouCode = String(p.voucode || '').trim().toUpperCase();
  var foundVu = null;
  if (vouCode) {
    foundVu = findVoucher_(vouCode);
    if (!foundVu)         return { ok: false, error: 'MÃ VOUCHER không tồn tại — kiểm tra lại chữ in trên thẻ' };
    var vsh = getVoucherSheet_();
    if (String(vsh.getRange(foundVu.row, 3).getValue()).toUpperCase() === 'ĐÃ SỬ DỤNG') {
      return { ok: false, error: 'MÃ VOUCHER này đã được sử dụng' };
    }
  }

  var sh = getSheet_();
  var row = [
    new Date(),            // THỜI GIAN GỬI
    code,                  // MÃ PHIẾU
    String(p.name || ''),
    String(p.phone || ''),
    String(p.product || ''),
    String(p.order || ''),
    String(p.platform || ''),
    String(p.buyDate || ''),
    String(p.address || ''),
    String(p.issue || ''),
    String(p.media || ''),
    STATUS_DEFAULT,        // TÌNH TRẠNG
    vouCode ? 'Voucher: ' + vouCode : ''   // GHI CHÚ
  ];
  sh.appendRow(row);

  // Đánh dấu voucher ĐÃ SỬ DỤNG rồi mới trả kết quả
  if (foundVu) {
    var vsh = getVoucherSheet_();
    vsh.getRange(foundVu.row, 3).setValue('ĐÃ SỬ DỤNG');
    vsh.getRange(foundVu.row, 5).setValue(new Date());
    vsh.getRange(foundVu.row, 6).setValue(code);
  }

  // Đánh dấu MÃ THẺ BẢO HÀNH đã đăng ký trong sheet "MÃ THẺ BẢO HÀNH" (nếu có)
  try {
    var foundC = findCard_(code);
    if (foundC) {
      var csh = getCardSheet_();
      csh.getRange(foundC.row, 2).setValue('ĐÃ ĐĂNG KÝ');
      csh.getRange(foundC.row, 4).setValue(new Date());
      if (vouCode) csh.getRange(foundC.row, 5).setValue(vouCode);
    }
  } catch(e) {}

  return { ok: true, code: code, row: sh.getLastRow(), vou: vouCode || '' };
}

function findByCode_(code) {
  var sh = getSheet_();
  var last = sh.getLastRow();
  if (last < 2) return null;
  var colValues = sh.getRange(2, 2, last - 1, 1).getValues(); // cột MÃ PHIẾU
  for (var i = 0; i < colValues.length; i++) {
    if (String(colValues[i][0] || '').trim().toUpperCase() === code) {
      return { row: i + 2 };
    }
  }
  return null;
}

function getSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold')
      .setBackground('#eef2ff').setFontColor('#312e81');
    sh.setFrozenRows(1);
  }
  return sh;
}

function getVoucherSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(VOUCHER_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(VOUCHER_SHEET_NAME);
  // sheet mới → dán bộ 10 cột; sheet cũ (thiếu cột) → tự ghi đè header chuẩn
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, VOUCHER_HEADERS.length).setValues([VOUCHER_HEADERS]);
    sh.getRange(1, 1, 1, VOUCHER_HEADERS.length).setFontWeight('bold')
      .setBackground('#fff7d6').setFontColor('#92400e');
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < VOUCHER_HEADERS.length) {
    sh.getRange(1, 1, 1, VOUCHER_HEADERS.length).setValues([VOUCHER_HEADERS]);
    sh.getRange(1, 1, 1, VOUCHER_HEADERS.length).setFontWeight('bold')
      .setBackground('#fff7d6').setFontColor('#92400e');
    sh.setFrozenRows(1);
  }
  return sh;
}

function findVoucher_(vouCode) {
  var sh = getVoucherSheet_();
  var last = sh.getLastRow();
  if (last < 2) return null;
  var colV = sh.getRange(2, 1, last - 1, 1).getValues(); // cột MÃ VOUCHER
  for (var i = 0; i < colV.length; i++) {
    if (String(colV[i][0] || '').trim().toUpperCase() === vouCode) {
      return { row: i + 2 };
    }
  }
  return null;
}

function getCardSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(CARD_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(CARD_SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, CARD_HEADERS.length).setValues([CARD_HEADERS]);
    sh.getRange(1, 1, 1, CARD_HEADERS.length).setFontWeight('bold')
      .setBackground('#eef2ff').setFontColor('#312e81');
    sh.setFrozenRows(1);
  }
  return sh;
}

function findCard_(cardCode) {
  var sh = getCardSheet_();
  var last = sh.getLastRow();
  if (last < 2) return null;
  var colC = sh.getRange(2, 1, last - 1, 1).getValues(); // cột MÃ THẺ BẢO HÀNH
  for (var i = 0; i < colC.length; i++) {
    if (String(colC[i][0] || '').trim().toUpperCase() === cardCode) {
      return { row: i + 2 };
    }
  }
  return null;
}

function toISO_(v) {
  if (v && v.getTime) return v.toISOString();
  return v ? String(v) : '';
}

/** Trả kết quả: có callback → JSONP (gọi được từ web), không → JSON thường */
function respond_(obj, cbName) {
  var text = JSON.stringify(obj);
  var out = ContentService.createTextOutput(cbName ? (cbName + '(' + text + ')') : text);
  out.setMimeType(cbName ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  return out;
}
