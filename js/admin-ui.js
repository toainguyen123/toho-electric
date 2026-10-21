// ============================================================
// LOGIC TRANG QUẢN TRỊ TOHO ELECTRIC VN (giao diện sidebar)
// ============================================================
const API = window.ADMIN_CONFIG.apiUrl;
let PASS = window.ADMIN_CONFIG.pass; // có thể đổi khi đổi mật khẩu trong Hệ Thống
let _products = [];
let _policies = {};
let _editingId = null; // id đang sửa (null = đăng mới)
let _chart = null;     // biểu đồ lượt truy cập

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
  const colors = { ok: 'bg-green-600', err: 'bg-red-600', info: 'bg-navy-800' };
  const el = document.createElement('div');
  el.className = `${colors[type]} text-white text-sm font-bold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2`;
  el.innerHTML = `<i class="fa-solid ${type === 'ok' ? 'fa-circle-check' : type === 'err' ? 'fa-circle-exclamation' : 'fa-circle-info'}"></i> ${msg}`;
  document.getElementById('toast').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

const fmtVND = (v) => (parseInt(String(v || '0').replace(/[^0-9]/g, ''), 10) || 0).toLocaleString('vi-VN') + 'đ';
const driveUrl = (u) => {
  u = String(u || '').trim();
  const m = u.match(/\/d\/([A-Za-z0-9_-]+)/) || u.match(/id=([A-Za-z0-9_-]+)/);
  return (u.includes('drive.google.com') && m) ? `https://lh3.googleusercontent.com/d/${m[1]}=w200` : u;
};
const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

// ---------- đọc số liệu truy cập (main site ghi vào localStorage) ----------
function readVisits() {
  try { return JSON.parse(localStorage.getItem('tohoVisits') || '{"days":{},"devices":{}}'); }
  catch { return { days: {}, devices: {} }; }
}
const dayKey = (d) => d.toISOString().slice(0, 10);
const fmtDMY = (d) => { const p = (n) => String(n).padStart(2, '0'); return p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + String(d.getFullYear()).slice(2); };

// ---------- sidebar mobile ----------
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('-translate-x-full');
  document.getElementById('sbOverlay').classList.toggle('hidden');
}

// ---------- đăng nhập gate ----------
async function doLogin(pass) {
  pass = pass !== undefined ? pass : document.getElementById('passInput').value;
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
document.getElementById('passInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

// ---------- tabs + sidebar active ----------
function switchTab(tab) {
  document.querySelectorAll('main > section').forEach((s) => s.classList.add('hidden'));
  const sec = document.getElementById('tab-' + tab);
  if (sec) sec.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  if (tab === 'dashboard') renderDashboard();
  window.scrollTo({ top: 0 });
}

// ---------- nạp dữ liệu ----------
async function refreshData() {
  const r = await api('data');
  if (!r.ok) return toast('Không lấy được dữ liệu server', 'err');
  _products = r.products || [];
  _policies = r.policies || {};
  renderDashboard();
  renderProductRows();
  renderPostList();
}

// ---------- DASHBOARD ----------
function sumVisits(days, n) {
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    s += days[dayKey(d)] || 0;
  }
  return s;
}

function renderDashboard() {
  const v = readVisits();
  const days = v.days || {}, devices = v.devices || {};

  // thẻ thống kê lượt truy cập
  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  setText('stToday', days[dayKey(new Date())] || 0);
  setText('stDesk', devices.desktop || 0);
  setText('stMob', devices.mobile || 0);
  setText('stYest', days[dayKey(yd)] || 0);
  setText('stWeek', sumVisits(days, 7));
  setText('stMonth', sumVisits(days, 30));

  // dữ liệu website
  setText('dtProducts', _products.length);
  setText('dtFlash', _products.filter((p) => p.isFlashSale).length);
  setText('dtPosts', Object.keys(_policies).length);
  setText('dtCats', new Set(_products.map((p) => p.category).filter(Boolean)).size);

  // sản phẩm bán chạy nhất
  const top = [..._products].sort((a, b) => (parseInt(b.soldCount) || 0) - (parseInt(a.soldCount) || 0)).slice(0, 5);
  const rowsEl = document.getElementById('topRows');
  if (rowsEl) {
    rowsEl.innerHTML = top.map((p) => `
      <tr class="hover:bg-slate-50">
        <td class="p-3 font-semibold text-slate-700 max-w-[220px] truncate">
          <img src="${driveUrl(p.image)}" onerror="this.src='images/no-image.svg'" class="w-8 h-8 object-contain rounded border bg-slate-50 inline-block mr-2 align-middle">${(p.name || '').slice(0, 45)}
        </td>
        <td class="p-3 font-bold text-tohoRed whitespace-nowrap">${fmtVND(p.price)}</td>
        <td class="p-3 text-center font-bold">${parseInt(p.soldCount) || 0}</td>
        <td class="p-3 text-center text-slate-500">${parseInt(p.totalCount) || 0}</td>
      </tr>`).join('') || '<tr><td colspan="4" class="p-4 text-center text-slate-400">Chưa có dữ liệu</td></tr>';
  }

  // biểu đồ 7 ngày
  const labels = [], data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    labels.push(fmtDMY(d));
    data.push(days[dayKey(d)] || 0);
  }
  if (typeof Chart === 'undefined') return;
  if (_chart) _chart.destroy();
  const max = Math.max(30, ...data);
  _chart = new Chart(document.getElementById('visitChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Lượt truy cập',
        data,
        borderColor: '#38bdb8',
        backgroundColor: 'rgba(56,189,184,.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: '#38bdb8'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } },
      scales: {
        y: { min: 0, max: max + 5, grid: { color: '#e2e8f0' }, ticks: { color: '#64748b', stepSize: Math.ceil(max / 6) } },
        x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } }
      }
    }
  });
}

// ---------- SẢN PHẨM ----------
function renderProductRows() {
  const q = (document.getElementById('prodSearch').value || '').toLowerCase();
  const list = _products.filter((p) => !q || String(p.id).toLowerCase().includes(q) || String(p.name).toLowerCase().includes(q));
  document.getElementById('prodRows').innerHTML = list.slice(0, 300).map((p) => `
    <tr class="hover:bg-slate-50">
      <td class="p-2"><img src="${driveUrl(p.image)}" onerror="this.src='images/no-image.svg'" class="w-10 h-10 object-contain rounded-lg border bg-slate-50"></td>
      <td class="p-3 font-mono font-bold text-tohoRed">${p.id}</td>
      <td class="p-3">${(p.name || '').slice(0, 60)}</td>
      <td class="p-3 font-bold whitespace-nowrap">${fmtVND(p.price)}</td>
      <td class="p-3">${p.badge ? `<span class="bg-red-100 text-tohoRed px-2 py-0.5 rounded font-bold text-[10px]">${p.badge}</span>` : '—'}</td>
      <td class="p-3 text-center">${p.isFlashSale ? '<i class="fa-solid fa-bolt text-amber-500"></i>' : '—'}</td>
      <td class="p-3 whitespace-nowrap">
        <button onclick="openProductForm('${String(p.id).replace(/'/g, "\\'")}')" class="text-blue-600 hover:underline mr-2 font-bold">Sửa</button>
        <button onclick="deleteProduct('${String(p.id).replace(/'/g, "\\'")}')" class="text-red-600 hover:underline font-bold">Xóa</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="7" class="p-6 text-center text-slate-400">Không tìm thấy sản phẩm</td></tr>';
}

function openProductForm(id) {
  _editingId = id || null;
  const p = id ? _products.find((x) => String(x.id) === String(id)) : null;
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
  const parts = sub.split('/').map((s) => s.trim());
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
    images: document.getElementById('f_images').value.split(/\n|,/).map((s) => s.trim()).filter(Boolean)
  };

  if (!product.id || !product.name) {
    const m = document.getElementById('prodMsg');
    m.textContent = '⚠ Cần điền MÃ sản phẩm và Tên sản phẩm!';
    m.className = 'text-sm font-bold text-red-600';
    return;
  }
  if (product.price && product.oldPrice && parseInt(product.price) >= parseInt(product.oldPrice)) {
    product.oldPrice = '0'; // giá gốc phải > giá bán, nếu không bỏ giá gốc
  }

  const r = await api('product.save', { product });
  const m = document.getElementById('prodMsg');
  m.textContent = r.ok ? '✓ ' + r.msg + ' — website tải lại là thấy ngay!' : '✗ ' + (r.error || 'Lỗi');
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
  const el = document.getElementById('postList');
  if (!el) return;
  el.innerHTML = titles.map((t) => `
    <button onclick="openPostEditor('${t.replace(/'/g, "\\'")}')" class="w-full text-left px-3 py-2.5 hover:bg-red-50 rounded-xl font-bold text-xs text-slate-700 hover:text-tohoRed transition">
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
  const oldHtml = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG CHẠY...';
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
  btn.innerHTML = oldHtml;
}

// ---------- HỆ THỐNG: TÀI KHOẢN ----------
async function changePassword() {
  const cur = document.getElementById('curPass').value;
  const np = document.getElementById('newPass').value;
  if (!cur || np.length < 6) return toast('Điền đủ mật khẩu hiện tại + mật khẩu mới (≥6 ký tự)', 'err');
  const r = await api('auth.save', { currentPass: cur, newPass: np });
  if (r.ok) {
    toast(r.msg, 'ok');
    PASS = np;
    document.getElementById('curPass').value = '';
    document.getElementById('newPass').value = '';
  } else {
    toast(r.error || 'Lỗi', 'err');
  }
}

function logout() {
  sessionStorage.removeItem('tohoAdmin');
  window.location.reload();
}

// ---------- HỆ THỐNG: XUẤT FILE ----------
async function downloadExport(type) {
  try {
    const res = await fetch(API + '/api/export?type=' + type + '&pass=' + encodeURIComponent(PASS));
    if (!res.ok) return toast('Lỗi khi tạo file (' + res.status + ')', 'err');
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="([^"]+)"/);
    const name = (m && m[1]) || ('toho-' + type + '.' + (type === 'products-csv' ? 'csv' : 'json'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Đã tải file ' + name, 'ok');
  } catch (e) {
    toast('Lỗi tải file: ' + e.message, 'err');
  }
}

// ---------- khởi động ----------
(function init() {
  if (sessionStorage.getItem('tohoAdmin') === '1') {
    document.getElementById('loginGate').classList.add('hidden');
    document.getElementById('adminApp').classList.remove('hidden');
    refreshData().then(() => switchTab('dashboard'));
  }
})();
