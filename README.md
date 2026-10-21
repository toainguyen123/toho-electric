# TOHO ELECTRIC VN — Website bán thiết bị điện

Website tĩnh (HTML + Tailwind + Vanilla JS), dữ liệu sản phẩm đọc trực tiếp từ Google Sheet.

## Quy trình cập nhật bình thường
1. Sửa dữ liệu trên **Google Sheet** (sản phẩm / chính sách / coupon / thiết bị)
2. Deploy như thường lệ (push lên Git → Vercel tự build). Không cần build lại gì cả.

## Nếu muốn inventory trang tĩnh SEO khớp dữ liệu mới
Chạy 2 lệnh rồi deploy:

```bash
python tools/optimize-images.py   # nén lại ảnh banner (chỉ cần khi đổi ảnh)
node build-pages.js               # sinh san-pham/<id>/index.html + sitemap.xml + robots.txt
```

## Tối ưu đã có sẵn
- URL chuẩn SEO từng sản phẩm: `/san-pham/<id>` — id có thể chứa `/` (vd `/san-pham/2P-3M/2-20A`)
- Mỗi trang sản phẩm là HTML tĩnh đầy đủ meta + JSON-LD Product (Offer giá VND) → Google index
- `sitemap.xml` + `robots.txt` tự sinh từ `data/products.json`
- Legacy link `#product-<id>` tự chuyển hướng sang URL mới
- Ảnh Google Drive tự gắn tham số `=w…` (nhẹ hơn nhiều), lazy-load toàn bộ ảnh dưới màn hình đầu
- Ảnh lỗi về `images/no-image.svg` (không còn ô xám)
- Banner đã nén WebP (`images/opt/`) — giảm ~85% dung lượng
- JSON-LD Organization + WebSite ở trang chủ; title/canonical/OG cập nhật động theo sản phẩm

## Cấu hình tên miền / hotline / đường dẫn trang
Sửa `js/site.config.js`, sau đó `node build-pages.js` nếu đã build trang tĩnh trước đó.
