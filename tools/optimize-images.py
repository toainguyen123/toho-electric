# Chạy:  python tools/optimize-images.py
# Nén ảnh banner sang WebP đặt trong images/opt/ (giữ nguyên bản gốc)
import os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "images")
OUT = os.path.join(IMG, "opt")
os.makedirs(OUT, exist_ok=True)

# (file gốc, chiều rộng nén tối đa, chất lượng WebP)
JOBS = [
    ("hero-banner-01.jpg", 1600, 78),
    ("hero-banner-02.jpg", 1600, 78),
    ("hero-banner-03.jpg", 1600, 78),
    ("hero-banner-04.jpg", 1600, 78),
    ("banner-left.jpg",    420, 80),
    ("banner-right.jpg",   420, 80),
    ("category-o-cam-dien.jpg",   800, 80),
    ("category-day-dien.jpg",     800, 80),
    ("category-thiet-bi-dien.jpg",800, 80),
    ("logo.png", 300, 90),
]

def fmt(b):
    return f"{b/1024:.0f} KB"

def main():
    total_old, total_new = 0, 0
    for name, width, q in JOBS:
        src = os.path.join(IMG, name)
        if not os.path.exists(src):
            print(f"!! Bỏ qua (không tồn tại): {name}")
            continue
        stem = os.path.splitext(name)[0]
        ext = ".webp"
        if name == "logo.png":
            ext = ".png"  # logo cần nền trong suốt -> nén png gọn
        dst_name, dst_path = None, None
        # 1) Thử WebP
        if ext != ".png":
            try:
                with Image.open(src) as im:
                    im = im.convert("RGB")
                    if im.width > width:
                        h = round(im.height * width / im.width)
                        im = im.resize((width, h), Image.LANCZOS)
                    dst_name = f"{stem}.webp"
                    dst_path = os.path.join(OUT, dst_name)
                    im.save(dst_path, "WEBP", quality=q, method=6)
            except Exception as e:
                print(f"!! WebP lỗi cho {name}: {e}")
                continue
        else:
            try:
                with Image.open(src) as im:
                    if im.width > width:
                        h = round(im.height * width / im.width)
                        im = im.resize((width, h), Image.LANCZOS)
                    dst_name = f"{stem}.png"
                    dst_path = os.path.join(OUT, dst_name)
                    im.convert("RGBA" if name.lower().endswith("png") else "RGB").save(
                        dst_path, optimize=True)
            except Exception as e:
                print(f"!! PNG lỗi cho {name}: {e}")
                continue
        old, new = os.path.getsize(src), os.path.getsize(dst_path)
        total_old += old; total_new += new
        print(f"{name:>30}  {fmt(old):>9} -> {fmt(new):>9}  ({dst_name})")
    print(f"\nTỔNG: {fmt(total_old)} -> {fmt(total_new)}  (giảm {100 - total_new*100//max(total_old,1)}%)")

if __name__ == "__main__":
    sys.exit(main())
