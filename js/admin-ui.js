// ============================================================
// LOGIC TRANG QUẢN TRỊ TOHO ELECTRIC VN (giao diện sidebar)
// ============================================================
const API = window.ADMIN_CONFIG.apiUrl;
let PASS = window.ADMIN_CONFIG.pass; // có thể đổi khi đổi mật khẩu trong Hệ Thống
let _products = [];
let _policies = {};
let _editingId = null; // id đang sửa (null = đăng mới)
let _chart = null;     // biểu đồ lượt truy cập
let prodPage = 1;      // trang hiện tại của bảng Sản Phẩm
const PROD_PAGE_SIZE = 20;
let _flashSelected = new Set(); // sản phẩm đang chọn cho Flash Sale
let _settings = {};             // cấu hình website (flashHours, flashMax...)
let _orders = [];               // đơn hàng của khách (tab Đơn Hàng)

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
      startOrderWatchdog(); // giữ admin mở → tự báo & tự kéo đơn mới mỗi 45 giây
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
  if (tab === 'flash') syncFlashTab();
  if (tab === 'orders') renderOrderRows();
  if (tab === 'warranty' && window.initWarrantyTab) window.initWarrantyTab();
  window.scrollTo({ top: 0 });
}

// ---------- nạp dữ liệu ----------
async function refreshData() {
  const r = await api('data');
  if (!r.ok) return toast('Không lấy được dữ liệu server', 'err');
  _products = r.products || [];
  _policies = r.policies || {};
  _settings = r.settings || {};
  _orders = r.orders || [];
  syncFlashSelected();
  renderDashboard();
  renderProductRows();
  renderPostList();
  renderOrderRows();
}

// Đồng bộ lựa chọn Flash Sale từ trạng thái thật của source
function syncFlashSelected() {
  _flashSelected = new Set(_products.filter((p) => p.isFlashSale).map((p) => String(p.id)));
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

// Số "đã bán" hiển thị trên web: bán thật + bán ảo (không điền → tự động 50–100, ổn định theo mã)
function autoVirtualSoldAdmin(id) {
    let h = 0; const s = String(id || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000007;
    return 50 + (h % 51);
}
function soldDisplay(p) {
    const real = parseInt(p.soldCount) || 0;
    const virt = parseInt(p.virtualSold) || 0;
    return real + (virt > 0 ? virt : autoVirtualSoldAdmin(p.id));
}

// ---------- SẢN PHẨM (phân trang, chứa toàn bộ sản phẩm của web) ----------
function renderProductRows() {
  const q = (document.getElementById('prodSearch').value || '').toLowerCase();
  const list = _products.filter((p) => !q || String(p.id).toLowerCase().includes(q) || String(p.name).toLowerCase().includes(q) || String(p.sku || '').toLowerCase().includes(q));

  const totalPages = Math.max(1, Math.ceil(list.length / PROD_PAGE_SIZE));
  if (prodPage > totalPages) prodPage = totalPages;
  const pageItems = list.slice((prodPage - 1) * PROD_PAGE_SIZE, prodPage * PROD_PAGE_SIZE);

  document.getElementById('prodRows').innerHTML = pageItems.map((p) => `
    <tr class="hover:bg-slate-50">
      <td class="p-2"><img src="${driveUrl(p.image)}" onerror="this.src='images/no-image.svg'" class="w-10 h-10 object-contain rounded-lg border bg-slate-50"></td>
      <td class="p-3 font-mono font-bold text-tohoRed whitespace-nowrap">${p.id}</td>
      <td class="p-3 font-mono text-slate-500 whitespace-nowrap">${p.sku || p.code || ''}</td>
      <td class="p-3">${(p.name || '').slice(0, 60)}</td>
      <td class="p-3 font-bold whitespace-nowrap">${fmtVND(p.price)}</td>
      <td class="p-3 text-slate-500">${((p.category || '') + (p.subCategory ? ' <span class="text-slate-300">/</span> ' + p.subCategory : '')).slice(0, 60)}</td>
      <td class="p-3 whitespace-nowrap">${p.stock ? `<span class="text-green-600 font-bold text-[10px]">${p.stock}</span>` : '—'}</td>
      <td class="p-3 text-center whitespace-nowrap"><span class="font-bold">${soldDisplay(p)}</span>${(parseInt(p.virtualSold) || 0) > 0 ? `<span class="text-[9px] text-slate-400 block">đã đặt: +${parseInt(p.virtualSold)} ảo</span>` : '<span class="text-[9px] text-slate-400 block">tự động</span>'}</td>
      <td class="p-3 whitespace-nowrap">
        <button onclick="openProductForm('${String(p.id).replace(/'/g, "\\'")}')" class="text-blue-600 hover:underline mr-2 font-bold">Sửa</button>
        <button onclick="deleteProduct('${String(p.id).replace(/'/g, "\\'")}')" class="text-red-600 hover:underline font-bold">Xóa</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="9" class="p-6 text-center text-slate-400">Không tìm thấy sản phẩm</td></tr>';

  // Bộ đếm + phân trang
  setText('prodCount', list.length ? `Tổng ${list.length} sản phẩm — trang ${prodPage}/${totalPages}` : 'Không có sản phẩm nào');
  document.getElementById('prodPager').innerHTML = totalPages > 1 ? `
    <button onclick="gotoProdPage(${prodPage - 1})" ${prodPage <= 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40 font-bold"><i class="fa-solid fa-chevron-left"></i> Trước</button>
    <span class="px-3 py-1.5 font-bold text-slate-600">${prodPage} / ${totalPages}</span>
    <button onclick="gotoProdPage(${prodPage + 1})" ${prodPage >= totalPages ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40 font-bold">Sau <i class="fa-solid fa-chevron-right"></i></button>` : '';
}
function gotoProdPage(n) { prodPage = n; renderProductRows(); }

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
  // Lượt bán ảo: chưa điền → hiển thị số tự động đang dùng (placeholder), điền mới ghi đè
  const autoVirt = p ? autoVirtualSoldAdmin(p.id) : 50;
  document.getElementById('f_vsold').value = p && (parseInt(p.virtualSold) || 0) > 0 ? parseInt(p.virtualSold) : '';
  document.getElementById('f_vsold').placeholder = 'Tự động: ' + autoVirt;
  document.getElementById('f_stock').value = p ? (p.stock || 'Còn hàng') : 'Còn hàng';
  document.getElementById('f_skuGroup').value = p ? (p.skuGroup || p.id) : '';
  document.getElementById('f_sku').value = p ? (p.sku || p.code || '') : '';
  document.getElementById('f_images').value = p ? (p.images || []).join('\n') : '';
  document.getElementById('f_specs').value = p ? (p.specs || '') : '';
  document.getElementById('f_desc').value = p ? (p.description || '') : '';
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
    virtualSold: parseInt(document.getElementById('f_vsold').value) || 0,
    stock: document.getElementById('f_stock').value.trim() || 'Còn hàng',
    specs: document.getElementById('f_specs').value.trim(),
    description: document.getElementById('f_desc').value.trim(),
    sku: document.getElementById('f_sku').value.trim() || document.getElementById('f_id').value.trim(),
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
  el.innerHTML = titles.map((t, i) => `
    <button data-post-i="${i}" class="w-full text-left px-3 py-2.5 hover:bg-red-50 rounded-xl font-bold text-xs text-slate-700 hover:text-tohoRed transition">
      <i class="fa-regular fa-newspaper mr-2 text-slate-400"></i>${t.length > 90 ? t.slice(0, 88) + '…' : t}
    </button>`).join('') || '<p class="text-xs text-slate-400 p-3">Chưa có bài viết. Bấm nút bài viết mới.</p>';
}

// Bấm chọn bài viết (đi theo data-index, tránh hỏng khi tiêu đề chứa dấu nháy/ký tự lạ)
document.getElementById('postList').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-post-i]');
  if (b) openPostEditor(Object.keys(_policies)[Number(b.dataset.postI)]);
});

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

// ---------- FLASH SALE ----------
function syncFlashTab() {
  // cài đặt hiện tại
  document.getElementById('setFlashHours').value = (_settings.flashHours === undefined ? 12.75 : _settings.flashHours);
  document.getElementById('setFlashMax').value = (_settings.flashMax === undefined ? 5 : _settings.flashMax);
  renderFlashList();
  renderFlashPool();
}

function renderFlashList() {
  const items = _products.filter((p) => _flashSelected.has(String(p.id)));
  setText('flashCount', items.length);
  setText('flashSummary', `${items.length} sản phẩm đang sale · đếm ngược ${_settings.flashHours || 12.75} giờ/lượt · ${(!parseInt(_settings.flashMax) ? 'hiện TẤT CẢ' : 'hiển thị tối đa ' + _settings.flashMax)} trên trang chủ`);
  document.getElementById('flashList').innerHTML = items.map((p) => `
    <div class="flex items-center gap-3 border border-red-100 bg-red-50/50 rounded-xl p-2">
      <img src="${driveUrl(p.image)}" onerror="this.src='images/no-image.svg'" class="w-10 h-10 object-contain rounded-lg border bg-white">
      <div class="flex-1 min-w-0">
        <p class="font-bold text-xs truncate">${(p.name || '').slice(0, 55)}</p>
        <p class="text-[10px] text-slate-500 font-mono">${p.id} · Giá thường: <b>${fmtVND(p.price)}</b></p>
      </div>
      <div class="shrink-0 text-right">
        <label class="text-[9px] font-bold text-slate-400 uppercase block">Giá Flash Sale (đ)</label>
        <input data-flash-price="${String(p.id).replace(/"/g, '')}" type="number" min="0" step="1000"
               value="${(p.flashPrice && parseFloat(p.flashPrice) > 0) ? p.flashPrice : ''}"
               placeholder="Trống = giá thường"
               class="w-28 border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-right font-bold text-tohoRed">
      </div>
      <button onclick="flashRemove('${String(p.id).replace(/'/g, "\\'")}')" class="text-red-600 hover:underline font-bold text-xs whitespace-nowrap">Bỏ sale</button>
    </div>`).join('') || '<p class="text-xs text-slate-400 p-3">Chưa có sản phẩm nào trong sale. Tìm &amp; bấm THÊM ở khung bên phải.</p>';
}

function renderFlashPool() {
  const q = (document.getElementById('flashSearch').value || '').toLowerCase();
  const pool = _products.filter((p) => !_flashSelected.has(String(p.id)) && (!q || String(p.id).toLowerCase().includes(q) || String(p.name).toLowerCase().includes(q) || String(p.sku || '').toLowerCase().includes(q)));
  const shown = pool.slice(0, 200);
  const more = pool.length - shown.length;
  document.getElementById('flashPool').innerHTML = (pool.length > 200 ? `<p class="text-[10px] text-slate-400 font-bold">Đang hiện 200/${pool.length} kết quả${more > 0 ? ` — còn ${more} sản phẩm nữa, hãy gõ từ khóa để tìm nhanh hơn` : ''}</p>` : (pool.length ? `<p class="text-[10px] text-slate-400">${pool.length} sản phẩm khớp</p>` : '')) + shown.map((p) => `
    <div class="flex items-center gap-3 border border-slate-100 rounded-xl p-2 hover:bg-slate-50">
      <img src="${driveUrl(p.image)}" onerror="this.src='images/no-image.svg'" class="w-9 h-9 object-contain rounded-lg border bg-white">
      <div class="flex-1 min-w-0">
        <p class="text-xs font-semibold truncate">${(p.name || '').slice(0, 45)}</p>
        <p class="text-[10px] text-slate-400 font-mono truncate">${p.id} · ${fmtVND(p.price)}</p>
      </div>
      <button onclick="flashAdd('${String(p.id).replace(/'/g, "\\'")}')" class="btn bg-tohoRed text-white text-[10px] px-2.5 py-1.5 shrink-0">THÊM</button>
    </div>`).join('') || '<p class="text-xs text-slate-400 p-3">Không còn sản phẩm nào khớp từ khóa.</p>';
}

function flashAdd(id) { _flashSelected.add(String(id)); renderFlashList(); renderFlashPool(); }
function flashRemove(id) { _flashSelected.delete(String(id)); renderFlashList(); renderFlashPool(); }

async function saveFlashSale() {
  // Thu thập bảng Giá Flash Sale tùy chỉnh theo từng sản phẩm từ ô nhập
  const prices = {};
  document.querySelectorAll('#flashList [data-flash-price]').forEach((el) => {
    const v = parseFloat(el.value);
    if (isFinite(v) && v > 0) prices[el.dataset.flashPrice] = v;
  });
  const settings = {
    flashHours: document.getElementById('setFlashHours').value,
    flashMax: document.getElementById('setFlashMax').value
  };
  const btn = event && event.target && event.target.closest ? event.target.closest('button') : null;
  btn && (btn.disabled = true);
  const r = await api('flash.save', { ids: [..._flashSelected], prices, settings });
  btn && (btn.disabled = false);
  toast(r.ok ? r.msg : (r.error || 'Lỗi'), r.ok ? 'ok' : 'err');
  if (r.ok) await refreshData();
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

// ---------- ĐƠN HÀNG ----------
const ORDER_STATUSES = ['Chờ xác nhận', 'Đã xác nhận', 'Đang giao', 'Hoàn thành', 'Đã hủy'];
const orderBadge = (s) => ({
  'Chờ xác nhận': 'bg-amber-100 text-amber-700',
  'Đã xác nhận': 'bg-blue-100 text-blue-700',
  'Đang giao': 'bg-violet-100 text-violet-700',
  'Hoàn thành': 'bg-green-100 text-green-700',
  'Đã hủy': 'bg-slate-200 text-slate-500'
}[s] || 'bg-slate-100 text-slate-600');

async function refreshOrders() {
  const r = await api('data');
  if (!r.ok) return toast('Không lấy được dữ liệu server', 'err');
  _orders = r.orders || [];
  renderOrderRows();
  toast('Đã làm mới danh sách đơn hàng', 'ok');
}

function updateOrdersBadge() {
  const badge = document.getElementById('ordersNavBadge');
  if (!badge) return;
  const n = _orders.filter((o) => o.status === 'Chờ xác nhận').length;
  badge.textContent = n;
  badge.classList.toggle('hidden', n === 0);
}

function renderOrderRows() {
  updateOrdersBadge();
  const body = document.getElementById('ordersBody');
  if (!body) return;
  const filter = document.getElementById('ordersStatusFilter').value;
  const list = _orders.filter((o) => !filter || o.status === filter);
  setText('ordersSummary', `(${_orders.length} đơn, ${_orders.filter((o) => o.status === 'Chờ xác nhận').length} chờ xác nhận)`);
  document.getElementById('ordersEmpty').classList.toggle('hidden', list.length > 0);
  body.innerHTML = list.map((o) => `
    <tr class="border-b border-slate-100 hover:bg-slate-50">
      <td class="p-2.5 font-black font-mono text-navy-800 cursor-pointer" onclick="openOrderDetail('${o.id}')">${o.id}</td>
      <td class="p-2.5 text-slate-500 whitespace-nowrap">${o.date || ''}</td>
      <td class="p-2.5 whitespace-nowrap">
        <span class="font-bold text-slate-700">${o.name || '—'}</span>
        <span class="block text-[10px] text-slate-400 font-mono">${o.phone || ''}</span>
      </td>
      <td class="p-2.5 max-w-[260px]">
        <span class="text-slate-600 line-clamp-2">${(o.items || []).map((it) => `${it.quantity ? 'x' + it.quantity + ' ' : ''}${it.name}`).join('; ')}</span>
      </td>
      <td class="p-2.5 text-right font-black text-tohoRed whitespace-nowrap">${fmtVND(o.total)}</td>
      <td class="p-2.5 text-center whitespace-nowrap"><span class="text-[10px] font-bold ${o.payment === 'BANK' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'} px-2 py-0.5 rounded-full">${o.payment === 'BANK' ? 'CK QR' : 'COD'}</span></td>
      <td class="p-2.5">
        <select onchange="orderStatusChange('${o.id}', this.value)" class="border rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-none focus:border-tohoRed">
          ${ORDER_STATUSES.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td class="p-2.5 text-center whitespace-nowrap">
        <button onclick="openOrderDetail('${o.id}')" title="Xem chi tiết" class="w-7 h-7 rounded-lg hover:bg-slate-200 text-slate-500"><i class="fa-solid fa-eye"></i></button>
        <button onclick="orderDelete('${o.id}')" title="Xóa đơn" class="w-7 h-7 rounded-lg hover:bg-red-50 text-red-500"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`).join('');
}

async function orderStatusChange(id, status) {
  const r = await api('order.save', { id, status });
  if (!r.ok) return toast(r.error || 'Lỗi cập nhật', 'err');
  const o = _orders.find((x) => x.id === id);
  if (o) o.status = status;
  renderOrderRows();
  toast(`Đơn ${id}: ${status}`, 'ok');
}

async function orderDelete(id) {
  if (!confirm('Xóa vĩnh viễn đơn ' + id + '?')) return;
  const r = await api('order.delete', { id });
  if (!r.ok) return toast(r.error || 'Lỗi xóa', 'err');
  _orders = _orders.filter((x) => x.id !== id);
  renderOrderRows();
  toast(`Đã xóa đơn ${id}`, 'ok');
}

function openOrderDetail(id) {
  const o = _orders.find((x) => x.id === id);
  if (!o) return;
  setText('odId', o.id);
  document.getElementById('orderDetailBody').innerHTML = `
    <div class="flex items-center justify-between">
      <span class="font-bold text-slate-500 text-xs">Trạng thái</span>
      <span class="text-xs font-black px-2.5 py-1 rounded-full ${orderBadge(o.status)}">${o.status}</span>
    </div>
    <div class="border border-slate-200 rounded-xl p-3 space-y-1.5">
      <p><b>Khách:</b> ${o.name || '—'} · <span class="font-mono">${o.phone || '—'}</span></p>
      ${o.email ? `<p class="text-xs text-slate-500">Email: ${o.email}</p>` : ''}
      <p class="text-xs text-slate-600 leading-relaxed"><b>Địa chỉ:</b> ${o.address || '—'}</p>
      ${o.note ? `<p class="text-xs text-slate-600"><b>Ghi chú:</b> ${o.note}</p>` : ''}
      <p class="text-[10px] text-slate-400 pt-1">Đặt lúc: ${o.date || ''} · Nguồn: ${o.source === 'google-sheet' ? 'Website (Sheets)' : 'Website'}</p>
    </div>
    <div class="border border-slate-200 rounded-xl p-3">
      <p class="text-xs font-black text-slate-400 uppercase mb-2">Sản phẩm</p>
      ${(o.items || []).map((it) => {
        // Giá lưu dạng "75.000" (chuỗi có dấu chấm) — phải tách số trước khi nhân, nếu không sẽ mất số 0
        const unit = parseInt(String(it.price || '0').replace(/[^0-9]/g, ''), 10) || 0;
        return `
        <div class="flex justify-between text-xs py-1 border-b border-slate-50 last:border-0">
          <span class="font-mono">${it.quantity ? `<b>x${it.quantity}</b> ` : ''}${it.code || it.name || ''}</span>
          ${it.price ? `<span class="font-mono text-slate-500 shrink-0 ml-2">${fmtVND(unit * (it.quantity || 1))}</span>` : ''}
        </div>`;
      }).join('')}
    </div>
    <div class="bg-slate-50 rounded-xl p-3 text-xs space-y-1">
      ${o.subTotal ? `<div class="flex justify-between"><span>Tạm tính</span><b>${fmtVND(o.subTotal)}</b></div>` : ''}
      ${o.shippingFee ? `<div class="flex justify-between"><span>Phí vận chuyển</span><b>${fmtVND(o.shippingFee)}</b></div>` : ''}
      ${o.discount ? `<div class="flex justify-between text-green-600"><span>Giảm giá</span><b>- ${fmtVND(o.discount)}</b></div>` : ''}
      <div class="flex justify-between text-base pt-1 border-t border-slate-200">
        <span class="font-black">TỔNG CỘNG</span><b class="font-black text-tohoRed">${fmtVND(o.total)}</b>
      </div>
      <p class="text-right text-[10px] text-slate-400">Thanh toán: ${o.payment === 'BANK' ? 'Chuyển khoản QR' : 'COD khi nhận hàng'}</p>
    </div>
    <button onclick="orderStatusChange('${o.id}', 'Đã xác nhận'); closeOrderDetail()" class="w-full bg-tohoRed hover:bg-tohoRedHover text-white font-bold py-2.5 rounded-xl text-xs">
      <i class="fa-solid fa-check mr-1"></i>XÁC NHẬN ĐƠN NÀY
    </button>`;
  document.getElementById('orderDetailModal').classList.remove('hidden');
}
function closeOrderDetail() { document.getElementById('orderDetailModal').classList.add('hidden'); }

function ordersCsvLink() {
  return API + '/api/export?type=orders-csv&pass=' + encodeURIComponent(PASS);
}

// Kéo đơn đặt trên website Vercel về (qua Google Sheet của khách)
async function importOrdersSheet() {
  const saved = _settings.ordersSheetUrl || '';
  const useAlt = (typeof event !== 'undefined' && event && event.altKey); // giữ Alt + bấm = đổi link
  let url = saved;
  if (!saved || useAlt) {
    const asked = prompt((saved ? 'Link hiện tại:\n' + saved + '\n\n' : '') +
      'Dán link CSV sheet ĐƠN HÀNG đã xuất bản.\nHướng dẫn: mở Google Sheet chứa đơn hàng → File → Chia sẻ → Xuất bản lên web → chọn sheet ĐƠN HÀNG → định dạng CSV → Copy link.') || '';
    url = asked.trim();
    if (!url) return;
  }
  const r = await api('orders.import', { url, saveUrl: url !== saved });
  if (!r.ok) return toast(r.error || 'Không nhập được đơn từ Sheets', 'err');
  const d = await api('data');
  if (d.ok) { _orders = d.orders || []; _settings = d.settings || _settings; }
  renderOrderRows();
  toast(r.msg, 'ok');
}

// ---------- TỰ BÁO ĐƠN MỚI + TỰ KÉO ĐƠN TỪ SHEETS ----------
let _knownOrderIds = null; // mảng id các đơn đã biết (đánh dấu đơn mới khi admin bật sẵn)

async function ordersWatchdog() {
  if (document.getElementById('adminApp').classList.contains('hidden')) return; // chưa đăng nhập → bỏ qua
  try {
    // 1) Nhập đơn đặt từ web Vercel (nếu đã cấu hình link sheet)
    if (_settings.ordersSheetUrl) {
      await api('orders.import', {});
      // lệnh api('data') bên dưới sẽ nạp lại danh sách đơn mới nhất
    }
    // 2) Nạp dữ liệu mới nhất (đơn gửi về server admin + từ sheet vừa nhập)
    const r = await api('data');
    if (!r.ok) return;
    const before = _knownOrderIds;
    _orders = r.orders || [];
    _knownOrderIds = _orders.map((o) => String(o.id));
    // Lần đầu chỉ học danh sách, không báo
    if (before === null) return;
    const newIds = _knownOrderIds.filter((id) => !before.includes(id));
    if (newIds.length) {
      toast(`🔔 Có ${newIds.length} đơn hàng mới: ${newIds.join(', ')}`, 'ok');
      renderOrderRows();
    } else if (document.getElementById('tab-orders') && !document.getElementById('tab-orders').classList.contains('hidden')) {
      renderOrderRows(); // đang ở tab Đơn Hàng → cập nhật bảng luôn
    }
    // 3) Thống kê-dashboard nhẹ nhàng
    renderDashboard();
  } catch (e) { /* mạng chập chờn → bỏ qua lượt này */ }
}

// ---------- khởi động ----------
let _watchdogStarted = false;
function startOrderWatchdog() {
  if (_watchdogStarted) return;
  _watchdogStarted = true;
  ordersWatchdog();
  setInterval(ordersWatchdog, 45000); // giữ admin mở → 45 giây tự kiểm tra đơn mới
}

(function init() {
  if (sessionStorage.getItem('tohoAdmin') === '1') {
    document.getElementById('loginGate').classList.add('hidden');
    document.getElementById('adminApp').classList.remove('hidden');
    refreshData().then(() => {
      switchTab('dashboard');
      startOrderWatchdog();
    });
  }
})();
