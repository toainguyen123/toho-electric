// ============================================================
// Tải toàn bộ ảnh sản phẩm từ Google Drive về images/products/
// Chạy:  node tools/download-images.js       (lần đầu)
// Chạy lại định kỳ sau khi chạy convert.js
// Kết quả: data/product-images.js (map driveId -> file local)
// ============================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'images', 'products');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Kéo ảnh từ products.json (bản mới nhất từ convert.js)
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8'));

// Thu thập mọi driveId từ image + images
const driveIds = new Set();
const grab = (url) => {
  if (!url) return;
  const m = String(url).match(/(?:\/d\/|id=)([A-Za-z0-9_-]{20,})/);
  if (m && !m[1].startsWith('https')) driveIds.add(m[1]);
};
products.forEach(p => {
  grab(p.image);
  (p.images || []).forEach(grab);
});
const ids = [...driveIds];
console.log(`Tổng ảnh cần có: ${ids.length}`);

// Map cũ (nếu có) để bỏ qua ảnh đã tải
let existing = {};
const mapFile = path.join(ROOT, 'data', 'product-images.js');
if (fs.existsSync(mapFile)) {
  existing = JSON.parse(fs.readFileSync(mapFile, 'utf8').replace(/^.*?=\s*/, '').replace(/;\s*$/, ''));
}

// Ghi tạm mapping (nạp đại khi crash mất tiến trình)
const savePartial = (done) => {
  fs.writeFileSync(mapFile, 'window.LOCAL_IMAGES = ' + JSON.stringify(done) + ';', 'utf-8');
};

(async () => {
  const done = { ...existing };
  let okCount = 0, skip = 0, failIds = [];

  const queue = [...ids];
  const CONCURRENCY = 6;

  async function worker() {
    while (queue.length) {
      const id = queue.shift();
      const file = path.join(OUT_DIR, `${id}.jpg`);
      if (done[id] && fs.existsSync(file)) { skip++; continue; }
      const url = `https://lh3.googleusercontent.com/d/${id}=w600`;
      let saved = false;
      for (let retry = 0; retry < 3 && !saved; retry++) {
        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length < 500) throw new Error('Quá nhỏ, có thể là lỗi Drive');
          fs.writeFileSync(file, buf);
          done[id] = `images/products/${id}.jpg`;
          okCount++;
          if (okCount % 20 === 0) { savePartial(done); process.stdout.write(`.${okCount}`); }
          saved = true;
        } catch (e) {
          await new Promise(r => setTimeout(r, 800 * (retry + 1)));
        }
      }
      if (!saved) failIds.push(id);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  savePartial(done);

  console.log(`\nXONG: tải ${okCount} + dùng sẵn ${skip} / ${ids.length}`);
  if (failIds.length) {
    console.log(`⚠ ${failIds.length} ảnh lỗi (Drive có thể đã chặn):`);
    console.log(failIds.slice(0, 20).join(', '));
    console.log('-> Chạy lại script lần nữa để retry tiếp (những ảnh đã có sẽ được bỏ qua).');
  }
  // Sinh bản JS để web nạp map
  savePartial(done);
})();
