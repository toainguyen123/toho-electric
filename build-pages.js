// ============================================================
// BUILD: sinh trang tĩnh SEO cho từng sản phẩm + sitemap.xml
// Chạy:  node build-pages.js
// (hãy convert lại products.json mới từ Google Sheet trước
//  bằng convert.js nếu vừa cập nhật dữ liệu)
// ============================================================
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// Đọc cấu hình từ js/site.config.js bằng regex thay vì require (tránh lỗi "window" trong Node)
let baseURL = 'https://toho-electric.vercel.app';
let productName = 'TOHO ELECTRIC VN';
let productPath = 'san-pham';
let phone = '0768718896';
const cfgPath = path.join(ROOT, 'js', 'site.config.js');
if (fs.existsSync(cfgPath)) {
  const cfgRaw = fs.readFileSync(cfgPath, 'utf8');
  const getCfg = (key, def) => {
    const m = cfgRaw.match(new RegExp(key + "\\s*:\\s*'([^']*)'"));
    return (m && m[1]) || def;
  };
  baseURL = getCfg('siteUrl', baseURL).replace(/\/$/, '');
  productName = getCfg('siteName', productName);
  productPath = getCfg('productPath', productPath);
  phone = getCfg('phone', phone);
}

const dataPath = path.join(ROOT, 'data', 'products.json');
const products = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
console.log(`Dữ liệu: ${products.length} sản phẩm`);

// --- 1) Đọc index.html gốc làm khung trang chung ---
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// --- 2) Tiện ích ---
const escapeHtml = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const parsePrice = (v) => {
  const s = String(v || '').replace(/[^0-9]/g, '');
  return parseInt(s, 10) || 0;
};
const formatVND = (v) => (parsePrice(v) || 0).toLocaleString('vi-VN') + ' đ';

// URL chi tiết sản phẩm: id có thể chứa "/" -> /san-pham/2P-3M/2-20A
const productUrlOf = (id, absolute) => {
  const path = String(id || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return (absolute ? baseURL : '') + '/' + productPath + '/' + path;
};

// --- 3) Sinh nội dung SEO cho từng sản phẩm ---
function buildSeoBlock(p) {
  const price = parsePrice(p.price);
  const oldPrice = parsePrice(p.oldPrice);
  const hasDiscount = oldPrice > price && oldPrice > 0;
  const url = productUrlOf(p.id, true);
  const title = `${p.name} | ${productName}`;
  const desc = `${p.name} - Mã SP ${p.code}. Giá ${formatVND(p.price)}${hasDiscount ? ` (giảm còn ${formatVND(p.price)} từ ${formatVND(oldPrice)})` : ''}. ${[p.category, p.subCategory, p.childCategory].filter(Boolean).join(' > ')} chính hãng tại ${productName}. Giao hàng toàn quốc, tư vấn ${phone}.`;
  const firstImage = p.image || (p.images && p.images[0]) || `${baseURL}/images/no-image.svg`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.code,
    mpn: p.code,
    description: String(p.specs || p.name).slice(0, 5000),
    image: [firstImage].concat(Array.isArray(p.images) ? p.images : []).slice(0, 5),
    category: [p.category, p.subCategory, p.childCategory].filter(Boolean).join(' > '),
    brand: { '@type': 'Brand', name: productName },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'VND',
      price: String(price),
      itemCondition: 'https://schema.org/NewCondition',
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: productName }
    }
  };

  const html = `
<!-- === SEO PAGE ${escapeHtml(p.id)} === -->
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc.slice(0, 300))}">
<meta name="keywords" content="${escapeHtml([p.name, p.code, p.category, p.subCategory, p.childCategory].filter(Boolean).join(', '))}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="product">
<meta property="og:title" content="${escapeHtml(p.name)}">
<meta property="og:description" content="${escapeHtml(desc.slice(0, 200))}">
<meta property="og:image" content="${escapeHtml(firstImage)}">
<meta property="og:url" content="${url}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<noscript>
  <div style="max-width:720px;margin:40px auto;padding:20px;font-family:Arial,sans-serif;border:1px solid #e2e8f0;border-radius:16px;">
    <h1 style="color:#0f172a;font-size:22px;margin:0 0 8px;">${escapeHtml(p.name)}</h1>
    <p style="color:#334155;margin:4px 0;"><b>Mã SP:</b> ${escapeHtml(p.code)}</p>
    <p style="color:#E31837;font-weight:800;font-size:20px;margin:4px 0;">Giá: ${escapeHtml(formatVND(p.price))}${hasDiscount ? ` <s style="color:#64748b;font-size:14px;font-weight:400;">${escapeHtml(formatVND(oldPrice))}</s>` : ''}</p>
    <p style="color:#334155;margin:4px 0;"><b>Danh mục:</b> ${escapeHtml([p.category, p.subCategory, p.childCategory].filter(Boolean).join(' > '))}</p>
    ${p.specs ? `<p style="color:#334155;margin:4px 0;"><b>Thông số:</b> ${escapeHtml(String(p.specs).slice(0, 500))}</p>` : ''}
    ${(p.description || p.specs) ? `<p style="color:#334155;margin:4px 0;"><b>Mô tả sản phẩm:</b> ${escapeHtml(String(p.description || p.specs).slice(0, 800))}</p>` : ''}
    <p style="color:#64748b;font-size:14px;margin:12px 0 0;">Xem chi tiết &amp; đặt hàng tại <a href="${baseURL}" style="color:#E31837;">${productName}</a> hoặc gọi hotline <b>${phone}</b>.</p>
  </div>
</noscript>
<!-- === /SEO PAGE === -->`;
  return html;
}

// --- 4) Chèn SEO block vào head của trang gốc ---
// Chunk SEO hiện tại của index.html giữ nguyên, ta thêm block sản phẩm bằng marker
const SEO_MARKER = '<!-- SEO_PAGES_MARKER -->';
let template = indexHtml;
if (!template.includes(SEO_MARKER)) {
  template = template.replace('</title>', '</title>\n    ' + SEO_MARKER);
  if (!template.includes(SEO_MARKER)) {
    console.error('Không tìm được vị trí marker để chèn SEO!');
    process.exit(1);
  }
  fs.writeFileSync(path.join(ROOT, 'index.html'), template);
}

// --- 5) Ghi từng trang /san-pham/<id>/index.html ---
const outRoot = path.join(ROOT, productPath.split('/').pop());
// Lọc dòng dữ liệu rác từ Google Sheet (id chứa khoảng trắng/dấu ":" là lỗi parse)
const validProducts = products.filter(p => p.id && /^[A-Za-z0-9._\-\/]+$/.test(p.id));
console.log(`Sản phẩm hợp lệ: ${validProducts.length}/${products.length} (bỏ ${products.length - validProducts.length} dòng rác)`);
let written = 0;
for (const p of validProducts) {
  if (!p.id) continue;
  // id chứa "/" -> tạo thư mục lồng nhau khớp URL gõ tay (/san-pham/2P-3M/2-20A)
  const dir = path.join(ROOT, productPath, ...String(p.id).split('/').filter(Boolean).map(encodeURIComponent));
  fs.mkdirSync(dir, { recursive: true });
  let page = template.replace(SEO_MARKER, buildSeoBlock(p));
  // index.html con nằm ở /san-pham/<id>/, thêm <base href="/"> để mọi đường dẫn
  // js/css/images về đúng thư mục gốc site
  page = page.replace(/<head([^>]*)>/i, (m) => `${m}\n    <base href="/">`);
  if (!page.includes('<base href="/">')) {
    console.error(`Không chèn được base tag cho ${p.id}`);
  }
  fs.writeFileSync(path.join(dir, 'index.html'), page);
  written++;
}
console.log(`✅ Đã ghi ${written} trang tĩnh trong ./${productPath}/`);

// --- 6) sitemap.xml ---
const urls = [`<url><loc>${baseURL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`];
for (const p of validProducts) {
  if (!p.id) continue;
  const loc = productUrlOf(p.id, true);
  urls.push(`<url><loc>${loc}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
}
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  ${u}`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
console.log(`✅ Đã ghi sitemap.xml với ${urls.length} URL`);

// --- 7) robots.txt cấu hình chuẩn ---
const robots = `User-agent: *
Allow: /
Sitemap: ${baseURL}/sitemap.xml
`;
fs.writeFileSync(path.join(ROOT, 'robots.txt'), robots);
console.log('✅ Đã cập nhật robots.txt (sổ địa chỉ sitemap)');

console.log(`\nHOÀN TẤT. Triển khai thư mục dự án lên hosting (Vercel), Google sẽ tự index các URL như ${baseURL}/${productPath}/3TN3.2.5`);
