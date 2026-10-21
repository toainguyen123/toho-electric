// ============================================================
// NHẬP SẢN PHẨM BIẾN ÁP TỪ LIOA.COM.VN VỀ SOURCE WEBSITE
// Chạy: node tools/scrape-lioa.js
// Lấy: tên, mã, thông số kỹ thuật, giá, ảnh (chạy bằng link gốc)
// KHÔNG tải ảnh về máy (không chiếm dung lượng)
// ============================================================
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const SOURCE = 'https://lioa.com.vn';
const CAT_URL = SOURCE + '/bien-ap';

// ---------- tiện ích ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&/g, '&').replace(/</g, '<')
    .replace(/>/g, '>').replace(/"/g, '"').replace(/&#039;|'/g, "'")
    .replace(/&ndash;|&#8211;/g, '–').replace(/&mdash;|&#8212;/g, '—')
    .replace(/&rsquo;/g, '’').replace(/&hellip;/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
}
const tagStrip = (s) => String(s || '').replace(/<[^>]*>/g, ' ');

function parsePriceVND(txt) {
  const clean = String(txt).replace(/&\w+;|&nbsp;/g, ' ').replace(/[\s\u00a0]/g, '');
  const m = clean.match(/\d[\d.,]*/);
  if (!m) return '0';
  const num = m[0].replace(/[.,](?=\d{3}\b)/g, '').replace(/\./g, '').replace(/,/g, '');
  return String(parseInt(num, 10) || 0);
}

async function get(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
      'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8'
    }
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  return res.text();
}

// ---------- 1) LẤY DANH SÁCH LINK SẢN PHẨM (REST API WordPress) ----------
async function listProducts() {
  const all = [];
  let page = 1, pages = 1;
  do {
    const res = await fetch(`${SOURCE}/wp-json/wp/v2/product?per_page=100&page=${page}&product_cat=35&_fields=id,slug,title,link`);
    if (!res.ok) throw new Error('REST lỗi ' + res.status);
    pages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10);
    const items = await res.json();
    if (Array.isArray(items)) all.push(...items);
    page++;
    await sleep(300);
  } while (page <= pages);
  return all;
}

// ---------- 2) BỎ TỪNG TRANG CHI TIẾT ----------
function extractProduct(html, url) {
  // Tên
  let name = '';
  const h1 = html.match(/<h1[^>]*class="[^"]*product-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/)
    || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (h1) name = decodeEntities(tagStrip(h1[1]));

  // Mã sản phẩm (VD: "Mã DNV015D" / "mã DNV008D")
  let code = '';
  const mCode = name.match(/M[ãa]\s*([A-Za-z0-9][A-Za-z0-9.\-\/]*)/i);
  if (mCode) code = mCode[1];
  if (!code) {
    const mSlug = url.split('/').pop().match(/ma-([a-z0-9\-\.]+)/i);
    if (mSlug) code = mSlug[1].toUpperCase().replace(/-/g, '.');
  }

  // Giá bán: khối "price-wrapper" của WooCommerce (khu vực sản phẩm chính)
  let price = '0', oldPrice = '0';
  const wrapM = html.match(/class="price-wrapper"[\s\S]{0,600}?<\/div>/);
  if (wrapM) {
    const block = wrapM[0];
    const del = block.match(/del[\s\S]{0,400}?<bdi>([\s\S]*?)<\/bdi>/);
    const ins = block.match(/ins[\s\S]{0,400}?<bdi>([\s\S]*?)<\/bdi>/);
    const bdi1 = block.match(/<bdi>([\s\S]*?)<\/bdi>/);
    if (del) oldPrice = parsePriceVND(del[1] + 'đ');
    if (ins) price = parsePriceVND(ins[1] + 'đ');
    else if (bdi1) price = parsePriceVND(bdi1[1] + 'đ');
  }
  // dự phòng: khối <p class="price"> kiểu cũ
  if (price === '0') {
    const pm = html.match(/<p class="price">([\s\S]{0,1000}?)<\/p>/);
    if (pm) {
      const sale = pm[1].match(/<ins[^>]*>\s*[\s\S]*?<bdi>([\s\S]*?)<\/bdi>/);
      const any = pm[1].match(/<bdi>([\s\S]*?)<\/bdi>/);
      if (sale) price = parsePriceVND(sale[1] + 'đ');
      else if (any) price = parsePriceVND(any[1] + 'đ');
    }
  }

  // Ảnh: og:image + ảnh gallery sản phẩm
  const images = [];
  const og = html.match(/<meta property="og:image"[^>]*content="([^"]+)"/);
  if (og) images.push(og[1]);
  const gal = html.matchAll(/data-large_image="([^"]+)"/g);
  for (const g of gal) if (!images.includes(g[1])) images.push(g[1]);

  // Thông số kỹ thuật (chỉ phần thông số, bỏ nội dung quảng cáo)
  let specs = '';
  const od = html.match(/<meta property="og:description"[^>]*content="([^"]+)"/);
  if (od) specs = decodeEntities(od[1]);
  if (!specs) {
    const exc = html.match(/<meta name="description"[^>]*content="([^"]+)"/);
    if (exc) specs = decodeEntities(exc[1]);
  }

  // Danh mục con: từ breadcrumb
  let sub = '';
  const bc = html.match(/<nav[^>]*breadcrumb[\s\S]{0,3000}?<\/nav>/) || html.match(/class="woocommerce-breadcrumb[\s\S]{0,2000}?<\/nav>/);
  if (bc) {
    const items = [...bc[0].matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map((m) => decodeEntities(m[1]));
    if (items.length >= 3) sub = items[1]; // Sau "Trang chủ", trước tên sản phẩm
  }

  return { name, code, price, oldPrice, images, specs, sub, url };
}

// ---------- 2) MAIN ----------
(async () => {
  console.log('=== NHẬP SẢN PHẨM BIẾN ÁP TỪ LIOA.COM.VN ===');

  const items = await listProducts();
  console.log(`Danh mục biến áp: ${items.length} sản phẩm (WordPress REST)`);

  const out = [];
  let idx = 0;
  for (const it of items) {
    idx++;
    try {
      const html = await get(it.link);
      const r = extractProduct(html, it.link);
      const id = 'LIOA-' + (r.code || it.slug.split('-').slice(-2).join('.'));
      const fspecs = r.specs
        ? r.specs.split(/(?=\S+:?\s)/).filter((s) => /:(?!\d{2,4}\/)/i.test(s) || /VA|V\b|kg|mm|Hz|tháng|W/i.test(s)).join('\n').slice(0, 600)
        : '';
      const prod = {
        id,
        code: r.code,
        name: r.name || decodeEntities(it.title.rendered),
        category: 'BIẾN ÁP',
        subCategory: r.sub || 'Dòng 1 pha',
        childCategory: '',
        price: r.price,
        oldPrice: r.oldPrice,
        badge: '',
        isFlashSale: false,
        images: r.images.slice(0, 5),
        image: r.images[0] || 'images/no-image.svg',
        specs: fspecs || 'Xem chi tiết tại nhà sản xuất LiOA.',
        skuGroup: id,
        soldCount: 0,
        totalCount: 10,
        stock: 'Còn hàng',
        vat: 'Giá đã gồm VAT',
        warranty: 'Bảo hành chính hãng LiOA',
        source: it.link
      };
      out.push(prod);
      console.log(`  ${idx}/${items.length} ✓ ${id} — ${prod.name.slice(0, 55)} — ${(parseInt(prod.price) / 1000 || 'Liên hệ')}${prod.price !== '0' ? 'k' : ''}`);
      await sleep(350);
    } catch (e) {
      console.log(`  ${idx}/${items.length} ✗ LỖI: ${it.slug} — ${e.message}`);
    }
  }

  // Trùng mã → bỏ
  const seen = new Set();
  const uniq = out.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // Ghi vào source: bỏ sản phẩm LIOA cũ, thêm mới
  const list = JSON.parse(fs.readFileSync(path.join(DATA, 'products.json'), 'utf8'));
  const others = list.filter((p) => !String(p.id).startsWith('LIOA-'));
  const merged = others.concat(uniq);
  fs.writeFileSync(path.join(DATA, 'products.json'), JSON.stringify(merged, null, 2), 'utf-8');
  fs.writeFileSync(path.join(DATA, 'products.js'),
    'window.PRODUCTS_DATA = ' + JSON.stringify(merged) + ';\nwindow.PRODUCTS_FALLBACK = window.PRODUCTS_DATA;', 'utf-8');

  console.log(`\n✓ Đã nhập ${uniq.length} sản phẩm LIOA vào source (tổng web: ${merged.length} sản phẩm).`);
  console.log('→ Ảnh chạy bằng link gốc trên lioa.com.vn (không lưu máy).');
  console.log('→ Lưu ý: nên chụp ảnh thật + viết phần mô tả riêng của bạn khi bán chính thức (ảnh hiện đang dùng link bên LIOA).');

  // Xuất lại trang SEO + sitemap
  console.log('\n>>> Xuất lại trang SEO tĩnh...');
  const b = spawnSync('node', ['build-pages.js'], { cwd: ROOT, encoding: 'utf8' });
  console.log((b.stdout || b.stderr || '').trim().split('\n').slice(-6).join('\n'));
  console.log('HOÀN TẤT.');
})().catch((e) => { console.error('LỖI NHẬP HÀNG:', e); process.exit(1); });
