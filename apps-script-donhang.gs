/**
 * ============================================================
 * APPS SCRIPT — GHI ĐƠN HÀNG VÀO GOOGLE SHEET (bản 2)
 * Dùng cho Web App "ĐƠN HÀNG" của website TOHO ELECTRIC VN
 * ============================================================
 * CÁCH CÀI ĐẶT (làm 1 lần):
 * 1. Mở Google Sheet ĐƠN HÀNG → Extensions (Tiện ích mở rộng) → Apps Script
 * 2. Xóa hết code cũ → dán TOÀN BỘ code này vào
 * 3. Nhấn Deploy (Triển khai) → Manage deployments (Quản lý bản triển khai)
 *    → chọn bản hiện có → Edit (bút chì) → Version: New version (Bản mới)
 *    → Deploy. (Giữ nguyên "Execute as: Me" và "Who has access: Anyone")
 * 4. Không cần đổi link trên website — link Web App giữ nguyên.
 * ============================================================
 * Cột SẢN PHẨM sẽ ghi theo cấu trúc:  MÃ SẢN PHẨM x SỐ LƯỢNG - GIÁ TIỀN
 * Ví dụ:  3TN3.2.5 x1 - 60.000
 *         4TN3.2.5 x2 - 150.000
 * ============================================================
 */

var SHEET_NAME = ''; // Để trống = dùng sheet đầu tiên (Tab đang mở đầu tiên trong file)

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];

    var items = body.items || [];
    var lines = items.map(function (it) {
      var code = String(it.code || '').trim() || String(it.name || '').trim();
      var qty = parseInt(it.quantity, 10) || 1;
      var price = Number(it.price) || 0;          // 60000 (số)
      var priceTxt = price.toLocaleString('vi-VN'); // "60.000"
      return code + ' x' + qty + ' - ' + priceTxt;
    });

    var row = [
      body.id || '',
      body.date || new Date().toLocaleString('vi-VN'),
      body.name || '',
      String(body.phone || ''),
      body.email || '',
      body.address || '',
      body.note || '',
      lines.join('\n'),                             // mỗi sản phẩm 1 dòng
      Number(body.total) || 0,
      body.payment || 'COD',
      body.status || 'Chờ xác nhận'
    ];

    // Nếu MÃ ĐƠN đã tồn tại thì cập nhật lại dòng đó (không tạo trùng)
    var colA = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues();
    for (var i = 0; i < colA.length; i++) {
      if (String(colA[i][0]).trim() === String(row[0]).trim()) {
        sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
        return ContentService.createTextOutput(JSON.stringify({ ok: true, mode: 'updated', id: row[0] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    sh.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, mode: 'appended', id: row[0] }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, script: 'TOHO don hang v2' }))
    .setMimeType(ContentService.MimeType.JSON);
}
