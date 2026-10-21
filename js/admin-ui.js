// ============================================================
// LOGIC TRANG QUẢN TRỊ TOHO ELECTRIC VN
// ============================================================
const API = window.ADMIN_CONFIG.apiUrl;
const PASS = window.ADMIN_CONFIG.pass;
let _products = [];
let _policies = {};
let _editingId = null; // id đang sửa (null = đăng mới)

// ---------- tiện ích ----------
async function api(action, payload = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // tránh preflight CORS
    body: JSON.stringify({ pass: PASS, action, ...payload })
  });
  return res.json();
}

function toast(msg, type = 'ok') {
  const colors = { ok: 'bg-green-600', err: 'bg-red-600', info: 'bg-slate-800' };
  const el = document.createElement('div');
  el.className = `${colors[type]} text-white text-sm font-bold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2`;
  el.innerHTML = `<i class="fa-solid ${type === 'ok' ? 'fa-circle-check' : type === 'err' ? 'fa-circle-exclamation' : 'fa-circle-info'}"></i> ${msg}`;
  document.getElementById('toast').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

const fmtVND = (v) => (parseInt(String(v || '0').replace(/[^0-9]/g, ''), 10) || 0).toLocaleString('vi-VN') + ' đ';
const driveUrl = (u) => {
  u = String(u || '').trim();
  const m = u.match(/\/d\/([A-Za-z0-9_-]+)/) || u.match(/id=([A-Za-z0-9_-]+)/);
  return (u.includes('drive.google.com') && m) ? `https://lh3.googleusercontent.com/d/${m[1]}=w200` : u;
};

// ---------- đăng nhập gate ----------
async function doLogin() {
  const pass = document.getElementById('passInput').value;
  try {
    const r = await api('auth', { pass });
    if (r.ok) {
      sessionStorage.setItem('tohoAdmin', '1');
      document.getElementById('loginGate').classList.add('hidden');
      document.getElementById('adminApp').classList.remove('hidden');
      await refreshData();
    } else {
      const msg = document.getElementById('loginMsg');
      msg.textContent = r.error || 'Đăng nhập thất bại';
      msg.classList.remove('hidden');
    }
  } catch (e) {
    const msg = document.getElementById('loginMsg');
    msg.textContent = 'Không kết nối được server admin! Chạy ADMIN.bat trước.';
    msg.classList.remove('hidden');
  }
}
document.getElementById('passInput').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

// ---------- tabs ----------
function switchTab(tab) {
  document.querySelectorAll('[id^=tab-]').forEach(s => s.classList.add('hidden'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.className = 'tab-btn btn bg-white shadow';
  });
  const active = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  active.className = 'tab-btn btn bg-starRed text-white shadow';
}

// ---------- nạp dữ liệu ----------
async function refreshData() {
  const r = await api('data');
  if (!r.ok) return toast('Không lấy được dữ liệu server', 'err');
  _products = r.products;
  _policies = r.policies;
  renderProductRows();
  renderPostList();
}

// ---------- SẢN PHẨM ----------
function renderProductRows() {
  const q = (document.getElementById('prodSearch').value || '').toLowerCase();
  const list = _products.filter(p => !q || String(p.id).toLowerCase().includes(q) || String(p.name).toLowerCase().includes(q));
  document.getElementById('prodRows').innerHTML = list.slice(0, 300).map(p => `
    <tr class="hover:bg-slate-50">
      <td class="p-2"><img src="${driveUrl(p.image)}" onerror="this.src='images/no-image.svg'" class="w-10 h-10 object-contain rounded-lg border bg-slate-50"></td>
      <td class="p-3 font-mono font-bold text-starRed">${p.id}</td>
      <td class="p-3">${(p.name || '').slice(0, 60)}</td>
      <td class="p-3 font-bold">${fmtVND(p.price)}</td>
      <td class="p-3">${p.badge ? `<span class="bg-red-100 text-starRed px-2 py-0.5 rounded font-bold text-[10px]">${p.badge}</span>` : '—'}</td>
      <td class="p-3 text-center">${p.isFlashSale ? '<i class="fa-solid fa-bolt text-amber-500"></i>' : '—'}</td>
      <td class="p-3 whitespace-nowrap">
        <button onclick="openProductForm('${String(p.id).replace(/'/g, "\\'")}')" class="text-blue-600 hover:underline mr-2 font-bold">Sửa</button>
        <button onclick="deleteProduct('${String(p.id).replace(/'/g, "\\'")}')" class="text-red-600 hover:underline font-bold">Xóa</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="7" class="p-6 text-center text-slate-400">Không tìm thấy sản phẩm</td></tr>';
}

function openProductForm(id) {
  _editingId = id || null;
  const p = id ? _products.find(x => String(x.id) === String(id)) : null;
  document.getElementById('prodModalTitle').textContent = p ? 'Sửa sản phẩm: ' + p.id : 'Đăng sản phẩm mới';
  document.getElementById('f_id').value = p ? p.id : '';
  document.getElementById('f_id').disabled = !!p; // không đổi mã khi sửa
  document.getElementById('f_name').value = p ? p.name : '';
  document.getElementById('f_category').value = p ? (p.category || 'Ổ CẮM ĐIỆN') : 'Ổ CẮM ĐIỆN';
  document.getElementById('f_sub').value = p ? [p.subCategory, p.childCategory].filter(Boolean).join(' / ') : '';
  document.getElementById('f_price').value = p ? parseNum(p.price) : '';
  document.getElementById('f_oldPrice').value = p ? parseNum(p.oldPrice) : '';
  document.getElementById('f_badge').value = p ? (p.badge || '') : '';
  document.getElementById('f_stock').value = p ? (p.stock || 'Còn hàng') : 'Còn hàng';
  document.getElementById('f_skuGroup').value = p ? (p.skuGroup || p.id) : '';
  document.getElementById('f_flash').checked = p ? !!p.isFlashSale : false;
  document.getElementById('f_images').value = p ? (p.images || []).join('\n') : '';
  document.getElementById('f_specs').value = p ? (p.specs || '') : '';
  document.getElementById('prodMsg').classList.add('hidden');
  document.getElementById('prodModal').classList.remove('hidden');
}

function closeProductForm() {
  document.getElementById('prodModal').classList.add('hidden');
  document.getElementById('f_id').disabled = false;
}

function parseNum(v) {
  const n = parseInt(String(v || '').replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? '' : n;
}

async function saveProduct() {
  const sub = document.getElementById('f_sub').value;
  const parts = sub.split('/').map(s => s.trim());
  const product = {
    id: document.getElementById('f_id').value.trim() || (_editingId || '').trim(),
    name: document.getElementById('f_name').value.trim(),
    category: document.getElementById('f_category').value.trim() || 'Khác',
    subCategory: parts[0] || '',
    childCategory: parts[1] || '',
    price: String(parseNum(document.getElementById('f_price').value) || 0),
    oldPrice: String(parseNum(document.getElementById('f_oldPrice').value) || 0),
    badge: document.getElementById('f_badge').value.trim(),
    stock: document.getElementById('f_stock').value.trim() || 'Còn hàng',
    isFlashSale: document.getElementById('f_flash').checked,
    specs: document.getElementById('f_specs').value.trim(),
    skuGroup: document.getElementById('f_skuGroup').value.trim() || document.getElementById('f_id').value.trim(),
    images: document.getElementById('f_images').value.split(/\n|,/).map(s => s.trim()).filter(Boolean)
  };

  if (!product.id || !product.name) {
    const m = document.getElementById('prodMsg');
    m.textContent = '⚠ Cần điền MÃ sản phẩm và Tên sản phẩm!';
    m.className = 'text-sm font-bold text-red-600';
    return;
  }
  if (product.price && product.oldPrice && parseInt(product.price) >= parseInt(product.oldPrice)) {
    product.oldPrice = '0'; // và cũ phải > giá mới, nếu không bỏ giá cũ
  }

  const r = await api('product.save', { product });
  const m = document.getElementById('prodMsg');
  m.textContent = r.ok ? '✓ ' + r.msg + ' — website đặt tải lại là thấy ngay!' : '✗ ' + (r.error || 'Lỗi');
  m.className = r.ok ? 'text-sm font-bold text-green-600' : 'text-sm font-bold text-red-600';
  if (r.ok) { await refreshData(); setTimeout(closeProductForm, 900); }
}

async function deleteProduct(id) {
  if (!confirm('Xóa sản phẩm ' + id + ' khỏi website?')) return;
  const r = await api('product.delete', { id });
  toast(r.ok ? r.msg : (r.error || 'Lỗi'), r.ok ? 'ok' : 'err');
  await refreshData();
}

// ---------- BÀI VIẾT ----------
function renderPostList() {
  const titles = Object.keys(_policies);
  document.getElementById('postList').innerHTML = titles.map(t => `
    <button onclick="openPostEditor('${t.replace(/'/g, "\\'")}')" class="w-full text-left px-3 py-2.5 hover:bg-red-50 rounded-xl font-bold text-xs text-slate-700 hover:text-starRed transition">
      <i class="fa-regular fa-newspaper mr-2 text-slate-400"></i>${t}
    </button>`).join('') || '<p class="text-xs text-slate-400 p-3">Chưa có bài viết. Bấm nút bài viết mới.</p>';
}

function openPostEditor(title) {
  const t = title || '';
  document.getElementById('postTitle').value = t;
  document.getElementById('postTitle').dataset.mode = t; // tiêu đề cũ (để update)
  document.getElementById('postContent').value = t ? (_policies[t] || '') : '';
  document.getElementById('postTitle').scrollIntoView({ behavior: 'smooth' });
}

async function savePost() {
  const title = document.getElementById('postTitle').value.trim();
  const content = document.getElementById('postContent').value;
  const oldTitle = document.getElementById('postTitle').dataset.mode || '';
  if (!title) return toast('Cần tiêu đề bài viết!', 'err');

  const r = await api('policy.save', { title, content, oldTitle });
  toast(r.ok ? r.msg : (r.error || 'Lỗi'), r.ok ? 'ok' : 'err');
  if (r.ok) await refreshData();
}

async function deletePost() {
  const title = document.getElementById('postTitle').value.trim().toUpperCase();
  if (!title) return toast('Chưa chọn bài viết nào', 'err');
  if (!confirm('Xóa bài viết "' + title + '"?')) return;
  const r = await api('policy.delete', { title });
  toast(r.ok ? r.msg : (r.error || 'Lỗi'), r.ok ? 'ok' : 'err');
  document.getElementById('postTitle').value = '';
  document.getElementById('postContent').value = '';
  document.getElementById('postTitle').dataset.mode = '';
  await refreshData();
}

// ---------- ĐỒNG BỘ / XUẤT ----------
async function runAction(action, btn) {
  const log = document.getElementById('syncLog');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>ĐANG CHẠY...';
  log.textContent = 'Đang thực hiện…\n';
  try {
    const r = await api(action);
    log.textContent = (r.log || r.msg || '');
    toast(r.msg || (r.ok ? 'Hoàn tất' : 'Lỗi'), r.ok ? 'ok' : 'err');
  } catch (e) {
    log.textContent += '\nLỗi kết nối: ' + e.message;
    toast('Lỗi server', 'err');
  }
  btn.disabled = false;
  btn.innerHTML = action === 'sync.sheets'
    ? '<i class="fa-solid fa-rotate mr-2"></i>CẬP NHẬT TỪ SHEETS'
    : '<i class="fa-solid fa-hammer mr-2"></i>ĐẠM BẢO SEO LÀM MỚI';
}

// ---------- khởi động ----------
(function init() {
  if (sessionStorage.getItem('tohoAdmin') === '1') {
    document.getElementById('loginGate').classList.add('hidden');
    document.getElementById('adminApp').classList.remove('hidden');
    refreshData().then(() => switchTab('products'));
  }
  const onErr = window.addEventListener('error', () => {
    const msg = document.getElementById('loginMsg');
    if (msg) { msg.textContent = 'Không chạy được admin — hãy chạy ADMIN.bat / node server.js'; msg.classList.remove('hidden'); }
  });
})();
