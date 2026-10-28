// ============================================================
// BẢO HÀNH TRONG TRANG ADMIN — Quản lý phiếu + Trạng thái voucher + In thẻ
// Chuyển từ warranty-web/quan-ly.html vào tab "Bảo Hành" của admin
// Dùng config chung: bao-hanh/config.js (APPS_SCRIPT_URL, ADMIN_KEY...)
// ============================================================
(function () {
  'use strict';

  /* ============================================================
     CSS — bản scoped riêng cho tab Bảo Hành (không ảnh hưởng admin)
     ============================================================ */
  const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&family=Dancing+Script:wght@600;700&display=swap');

#tab-warranty{--accent:#e11d1d;--ink:#1e1b36;--muted:#6b7191;--line:#e6e7f2}
#tab-warranty .w-sub-btn{font-size:.8rem;font-weight:800;padding:.55rem 1.1rem;border-radius:.7rem;color:#475569;transition:.15s}
#tab-warranty .w-sub-btn.active{background:#e31837;color:#fff;box-shadow:0 4px 12px rgba(227,24,55,.35)}

#tab-warranty .banner-warn{background:#fff7d6;border:1px solid #fde68a;color:#92400e;border-radius:14px;padding:12px 16px;font-size:13px;line-height:1.6}
#tab-warranty .banner-err{background:#ffe4e6;border:1px solid #fda4af;color:#9f1239;border-radius:14px;padding:12px 16px;font-size:13px;line-height:1.6}
#tab-warranty .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
#tab-warranty .stat{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 16px;display:flex;gap:12px;align-items:center}
#tab-warranty .stat .ic{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:19px;flex:none}
#tab-warranty .stat b{font-size:22px;font-weight:800;line-height:1.1}
#tab-warranty .stat span{font-size:11.5px;color:var(--muted);font-weight:600;display:block;margin-top:2px}
#tab-warranty .toolbar{background:#fff;border:1px solid var(--line);border-radius:16px;padding:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
#tab-warranty .search{flex:1;min-width:200px;position:relative}
#tab-warranty .search input{width:100%;font:inherit;font-size:14px;border:1.6px solid var(--line);border-radius:11px;padding:9px 13px 9px 36px;outline:none;transition:.15s}
#tab-warranty .search input:focus{border-color:var(--accent);box-shadow:0 0 0 3px #e11d1d22}
#tab-warranty .search::before{content:'🔍';position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:13px}
#tab-warranty .toolbar select,#tab-warranty .toolbar .btn-tb{font:inherit;font-size:13px;font-weight:600;border:1.6px solid var(--line);border-radius:11px;padding:8px 12px;background:#fff;cursor:pointer;outline:none}
#tab-warranty .toolbar .btn-tb:hover{border-color:var(--accent);color:var(--accent)}
#tab-warranty .toolbar .btn-tb.primary{background:linear-gradient(100deg,#b31313,#e11d1d);color:#fff;border-color:transparent}
#tab-warranty .toolbar .btn-tb.primary:hover{color:#fff}
#tab-warranty .toolbar label.tgl{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--muted);font-weight:600;cursor:pointer}
#tab-warranty .toolbar .tgl input{accent-color:var(--accent)}
#tab-warranty .count-note{font-size:12px;color:var(--muted);font-weight:600}
#tab-warranty .tbl-card{background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 12px 34px #1e1b360c}
#tab-warranty .tbl-scroll{overflow:auto;max-height:65vh}
#tab-warranty table{width:100%;border-collapse:collapse;font-size:13px;min-width:900px}
#tab-warranty thead th{position:sticky;top:0;background:#f8fafc;z-index:5;text-align:left;padding:10px 12px;font-size:11px;color:#475569;letter-spacing:.5px;border-bottom:2px solid var(--line);white-space:nowrap}
#tab-warranty tbody td{padding:11px 12px;border-bottom:1px solid #f1f2f8;vertical-align:top}
#tab-warranty tbody tr:hover{background:#fef5f5}
#tab-warranty .code-cell{font-weight:800;color:var(--accent);letter-spacing:.5px;white-space:nowrap}
#tab-warranty .muted{color:var(--muted);font-size:12px}
#tab-warranty .row-sel{font:inherit;font-size:12px;font-weight:700;border:1.5px solid var(--line);border-radius:9px;padding:4px 7px;background:#fff;cursor:pointer;outline:none}
#tab-warranty .row-sel:focus{border-color:var(--accent)}
#tab-warranty .empty-state{text-align:center;padding:48px 20px;color:var(--muted)}
#tab-warranty .empty-state .em{font-size:48px;margin-bottom:10px}
#tab-warranty .empty-state b{display:block;font-size:15px;color:var(--ink);margin-bottom:5px}
#tab-warranty .pill{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 10px;font-size:11.5px;font-weight:700}
#tab-warranty .pill i{width:7px;height:7px;border-radius:50%;flex:none}
#tab-warranty .lnk{color:var(--accent);font-weight:700}
#tab-warranty .spin-mini{width:13px;height:13px;border:2px solid #ffffff66;border-top-color:#fff;border-radius:50%;animation:wSpin .7s linear infinite;display:inline-block}
@keyframes wSpin{to{transform:rotate(360deg)}}
#tab-warranty .v-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 10px;font-size:11.5px;font-weight:700}
#tab-warranty .v-badge.unused{background:#fff7d6;color:#9a6b00}
#tab-warranty .v-badge.used{background:#dcf9ec;color:#047857}
#tab-warranty .v-badge.expired{background:#ffe4e4;color:#b91c1c}
#tab-warranty .tbl-title{font-size:14px;font-weight:800;display:flex;align-items:center;gap:8px;margin:18px 2px 10px}

/* ===== THẺ BẢO HÀNH (khung in) ===== */
#tab-warranty .setup-panel{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:0 10px 30px #1e1b3609}
#tab-warranty .setup-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:11px}
#tab-warranty .fld{display:flex;flex-direction:column;gap:4px}
#tab-warranty .fld.full{grid-column:1/-1}
#tab-warranty .fld label{font-size:10.5px;font-weight:700;color:#494e7a;letter-spacing:.3px}
#tab-warranty .fld input,#tab-warranty .fld select{font:inherit;font-size:13px;border:1.6px solid var(--line);border-radius:11px;padding:7px 10px;outline:none;transition:.15s;background:#fbfbfe;color:var(--ink);width:100%}
#tab-warranty .fld input:focus,#tab-warranty .fld select:focus{border-color:var(--accent);box-shadow:0 0 0 3px #e11d1d1a;background:#fff}
#tab-warranty .hint{font-size:10.5px;color:var(--muted)}
#tab-warranty .gen-row{display:flex;gap:10px;margin-top:13px;flex-wrap:wrap;align-items:center}
#tab-warranty .btn-big{font:inherit;font-size:13.5px;font-weight:800;color:#fff;border:0;border-radius:12px;padding:10px 18px;cursor:pointer;transition:.15s;display:flex;gap:8px;align-items:center}
#tab-warranty .btn-big:hover{filter:brightness(1.08);transform:translateY(-1px)}
#tab-warranty .btn-gen{background:linear-gradient(100deg,#b31313,#e11d1d)}
#tab-warranty .btn-in{background:linear-gradient(100deg,#059669,#10b981)}
#tab-warranty .btn-copy{background:#dbeafe;color:#1e40af}
#tab-warranty .stage-info{font-size:13px;color:var(--muted);margin-bottom:12px}
#tab-warranty .stage-info b{color:var(--ink)}
#tab-warranty .tip{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 14px;font-size:12.5px;color:#374151;margin-bottom:14px;line-height:1.55}
#tab-warranty .sheet-frame{display:flex;flex-direction:column;gap:20px;align-items:center;padding-bottom:40px}
#tab-warranty .sheet{background:#fff;border:1px solid #cfd2e8;box-shadow:0 10px 30px #1e1b3614;border-radius:3px;flex:none;display:grid;gap:8mm;justify-content:center;align-content:center}
#tab-warranty .sheet-label{font-size:11.5px;color:var(--muted);font-weight:600;margin-top:-14px;margin-bottom:6px}
#tab-warranty .cell{display:flex;align-items:center;justify-content:center;min-width:0;min-height:0}

/* ===== THIẾT KẾ THẺ 148×105mm ===== */
#tab-warranty .ticket-wrap{width:calc(148mm * var(--s));height:calc(105mm * var(--s));flex:none}
#tab-warranty .ticket{width:148mm;height:105mm;background:#fff;border:1.3pt solid #141414;border-radius:3mm;overflow:hidden;position:relative;display:flex;box-shadow:0 2.5mm 7mm #0003;transform:scale(var(--s));transform-origin:top left;font-size:10pt;color:#141414}
#tab-warranty .deco{position:absolute;inset:0;z-index:0;pointer-events:none}
#tab-warranty .deco i{position:absolute;transform:skewX(-38deg)}
#tab-warranty .deco .d1{bottom:-2.6mm;right:9mm;width:21mm;height:5.6mm;background:#141414}
#tab-warranty .deco .d2{bottom:-2.6mm;right:0;width:9mm;height:5.6mm;background:#4b4b4b}
#tab-warranty .lband{width:28mm;flex:none;position:relative;color:#fff;background:linear-gradient(112deg,#191919 0%,#191919 55%,#2c2c2c 55%,#2c2c2c 100%);display:flex;flex-direction:column;align-items:center;text-align:center;padding:4.2mm 2.6mm 3.4mm 3.6mm}
#tab-warranty .lband::before,#tab-warranty .lband::after{content:'';position:absolute;top:-2mm;bottom:-2mm;width:4.6mm;background-image:radial-gradient(circle closest-side,#fff 90%,transparent 94%);background-size:4.6mm 6.4mm;background-repeat:repeat-y;background-position:center top}
#tab-warranty .lband::before{left:-3.4mm}
#tab-warranty .lband::after{right:-3.4mm}
#tab-warranty .lb-logo{font-size:12.5pt;font-weight:900;line-height:1;letter-spacing:.5px}
#tab-warranty .lb-name{font-size:7.6pt;font-weight:900;letter-spacing:.7px;margin-top:.9mm;white-space:nowrap}
#tab-warranty .lb-desc{font-size:5.1pt;font-weight:700;line-height:1.5;margin-top:1.6mm;max-width:21mm}
#tab-warranty .lb-line{width:13mm;border-top:.8pt solid #ffffffd9;margin:2.2mm 0 1.2mm}
#tab-warranty .lb-mid{margin:auto 0;display:flex;flex-direction:column;align-items:center;gap:1.4mm}
#tab-warranty .lb-shield{width:10.4mm;height:10.4mm}
#tab-warranty .lb-big{font-size:8.6pt;font-weight:900;line-height:1.22;letter-spacing:.1px}
#tab-warranty .lb-script{font-family:'Dancing Script',cursive;font-size:12.5pt;font-weight:700;transform:rotate(-4deg);line-height:1}
#tab-warranty .mr{flex:1;min-width:0;padding:3.6mm 4.6mm 3mm 5mm;display:flex;flex-direction:column;position:relative;z-index:1}
#tab-warranty .hd{display:flex;align-items:flex-start;gap:2.6mm}
#tab-warranty .hd-shield{width:9.6mm;height:9.6mm;flex:none;margin-top:.4mm}
#tab-warranty .hd-col{min-width:0}
#tab-warranty .hd-title{font-size:13.6pt;font-weight:900;line-height:1;letter-spacing:.3px;white-space:nowrap;color:#141414}
#tab-warranty .hd-brand{margin-top:1.2mm;background:#141414;color:#fff;font-weight:900;font-size:8pt;border-radius:999px;padding:1.2mm 4.6mm;letter-spacing:.5px;display:inline-block;white-space:nowrap}
#tab-warranty .hd-script{margin-left:auto;font-family:'Dancing Script',cursive;color:#141414;font-size:11.5pt;font-weight:700;line-height:1;transform:rotate(-5deg);white-space:nowrap;padding-top:1mm}
#tab-warranty .hd-tag{display:flex;align-items:center;justify-content:center;gap:2.4mm;margin:2.2mm 0 1.6mm;font-size:6.4pt;font-weight:800;letter-spacing:.8px;color:#1a1a1a;white-space:nowrap}
#tab-warranty .hd-tag .tg-ln{height:.9pt;background:#9a9a9a;width:8mm;flex:none}
#tab-warranty .panel{margin-top:.4mm;background:#f2f3f5;border-radius:2.8mm;position:relative;padding:2mm 3.2mm 2mm 5.8mm;display:grid;grid-template-columns:1fr 27mm;column-gap:3mm;align-items:center}
#tab-warranty .panel::before{content:'';position:absolute;left:0;top:0;bottom:0;width:1.8mm;background:#141414;border-radius:2.8mm 0 0 2.8mm}
#tab-warranty .r1{display:flex;align-items:center;gap:2.6mm;padding:1.6mm 0;min-width:0;border-bottom:.7pt solid #dfe1e5}
#tab-warranty .pico{width:7.4mm;height:7.4mm;border-radius:50%;background:#141414;display:grid;place-items:center;flex:none}
#tab-warranty .pico svg{width:4.3mm;height:4.3mm}
#tab-warranty .pr-title{font-size:7.9pt;font-weight:900;white-space:nowrap;color:#141414}
#tab-warranty .pr-sub{font-size:6.1pt;font-weight:400;color:#232323;margin-top:.5mm;white-space:nowrap}
#tab-warranty .pr-sub .arr{font-size:6.5pt}
#tab-warranty .code-badge{margin-left:auto;background:#141414;color:#fff;border-radius:2mm;padding:1.4mm 4.2mm;font-weight:900;font-size:10.6pt;letter-spacing:.6px;white-space:nowrap}
#tab-warranty .pr-rows{grid-column:1;display:flex;flex-direction:column;min-width:0}
#tab-warranty .pr{display:flex;align-items:center;gap:2.6mm;min-width:0;padding:1.6mm 0}
#tab-warranty .pr + .pr{border-top:.7pt solid #dfe1e5}
#tab-warranty .pr-lines .pr-line{font-size:7.4pt;font-weight:900;white-space:nowrap;line-height:1.5}
#tab-warranty .qrzone{grid-column:2;grid-row:2/4;display:flex;flex-direction:column;align-items:center;gap:1.2mm;min-width:0}
#tab-warranty .qrbox{position:relative;width:21mm;height:21mm;display:grid;place-items:center}
#tab-warranty .qrbox img{width:18.6mm;height:18.6mm;display:block}
#tab-warranty .corner{position:absolute;width:4.4mm;height:4.4mm;border:1.3pt solid #141414;border-radius:1mm}
#tab-warranty .c-tl{top:0;left:0;border-right:0;border-bottom:0}
#tab-warranty .c-tr{top:0;right:0;border-left:0;border-bottom:0}
#tab-warranty .c-bl{bottom:0;left:0;border-right:0;border-bottom:0}
#tab-warranty .c-br{bottom:0;right:0;border-left:0;border-top:0}
#tab-warranty .site-chip{background:#141414;color:#fff;font-size:5.4pt;font-weight:600;border-radius:999px;padding:1.1mm 2.8mm;display:flex;gap:1.2mm;align-items:center;max-width:27mm;white-space:nowrap}
#tab-warranty .site-chip svg{width:3mm;height:3mm;flex:none}
#tab-warranty .site-chip span{overflow:hidden;text-overflow:ellipsis}
#tab-warranty .common-hr{border-top:1pt dashed #8a8a8a;margin:3mm 0 2.2mm}
#tab-warranty .voucher{background:#141414;color:#fff;border-radius:2.8mm;display:flex;align-items:center;position:relative;overflow:hidden;min-height:15.8mm}
#tab-warranty .voucher::before{content:'';position:absolute;top:50%;right:-1.9mm;transform:translateY(-50%);width:3.4mm;height:9.5mm;background-image:radial-gradient(circle closest-side,#fff 90%,transparent 94%);background-size:3.4mm 3.2mm;background-repeat:repeat-y;background-position:center top}
#tab-warranty .v-left{background:#fff;color:#141414;align-self:stretch;display:flex;align-items:center;gap:2mm;padding:0 3.6mm;clip-path:polygon(0 0,100% 0,calc(100% - 3mm) 100%,0 100%);border-radius:2.8mm 0 0 2.8mm}
#tab-warranty .v-left svg{width:5.8mm;height:5.8mm;flex:none}
#tab-warranty .vc{display:flex;flex-direction:column;gap:.7mm;min-width:0}
#tab-warranty .v-left b{font-size:7.2pt;font-weight:900;line-height:1.12;white-space:nowrap}
#tab-warranty .v-code{background:#141414;color:#fff;font-weight:900;font-size:5.8pt;letter-spacing:.4px;border-radius:1.2mm;padding:.7mm 2mm;display:inline-block;max-width:36mm;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;align-self:flex-start}
#tab-warranty .v-mid{display:flex;align-items:center;gap:2.2mm;padding:0 2.6mm 0 4mm}
#tab-warranty .v-mid small{font-size:6.2pt;font-weight:800;letter-spacing:.3px;white-space:nowrap}
#tab-warranty .v-pct{font-size:17pt;font-weight:900;color:#fff;line-height:1;letter-spacing:.5px;font-family:'Be Vietnam Pro',sans-serif}
#tab-warranty .v-sep{align-self:center;height:10mm;width:0;border-left:1.3pt dashed #ffffff70}
#tab-warranty .v-right{display:flex;flex-direction:column;justify-content:center;gap:.9mm;padding:0 3.6mm 0 1.4mm;min-width:0;flex:1;overflow:hidden}
#tab-warranty .v-right b{font-size:6.3pt;font-weight:900;line-height:1.22;max-width:32mm;overflow:hidden;text-overflow:ellipsis}
#tab-warranty .v-chip{background:#fff;color:#141414;border:.8pt solid #141414;font-size:4.9pt;font-weight:800;border-radius:999px;padding:.8mm 2.2mm;align-self:flex-start;white-space:nowrap;letter-spacing:.15px}
#tab-warranty .foot{margin-top:3mm;display:flex;align-items:center;justify-content:space-between;gap:1.4mm}
#tab-warranty .f-item{display:flex;align-items:center;gap:1.5mm;min-width:0;overflow:hidden}
#tab-warranty .f-ico{width:5.6mm;height:5.6mm;border-radius:50%;background:#141414;display:grid;place-items:center;flex:none}
#tab-warranty .f-ico svg{width:3.2mm;height:3.2mm}
#tab-warranty .f-ico .fchar{color:#fff;font-weight:900;font-size:4.4pt;line-height:1}
#tab-warranty .f-item small{display:block;font-size:5.2pt;font-weight:500;color:#333;line-height:1.1;white-space:nowrap}
#tab-warranty .f-item b{display:block;font-size:7.2pt;font-weight:900;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#tab-warranty .f-sep{width:.8pt;height:7.6mm;background:#d6d6d6;flex:none;margin:0 .6mm}

/* ===== Modal xác nhận in + đồng bộ ===== */
#tab-warranty .overlay{position:fixed;inset:0;background:#1e1b36cc;backdrop-filter:blur(4px);display:none;place-items:center;z-index:100;padding:20px}
#tab-warranty .overlay.show{display:grid}
#tab-warranty .modal{background:#fff;border-radius:22px;max-width:560px;width:100%;padding:26px 26px 22px;text-align:left;box-shadow:0 30px 80px #00000055;animation:wmpop .35s cubic-bezier(.2,1.3,.4,1)}
@keyframes wmpop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}
#tab-warranty .modal h3{font-size:19px;font-weight:800;margin-bottom:6px}
#tab-warranty .modal .msub{font-size:13.5px;color:var(--muted);line-height:1.55;margin-bottom:14px}
#tab-warranty .modal .mstats{display:flex;gap:10px;margin-bottom:12px}
#tab-warranty .modal .mstat{flex:1;background:#fbfbfe;border:1px solid var(--line);border-radius:14px;padding:12px 14px}
#tab-warranty .modal .mstat b{font-size:22px;font-weight:800;display:block}
#tab-warranty .modal .mstat span{font-size:12px;color:var(--muted);font-weight:600}
#tab-warranty .modal .mcols{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
#tab-warranty .modal .mbox{background:#fbfbfe;border:1px solid var(--line);border-radius:12px;padding:10px 12px;max-height:150px;overflow:auto;font-size:12px;line-height:1.7;font-weight:600;white-space:pre-wrap}
#tab-warranty .modal .mwarn{background:#fff7d6;border:1px solid #fde68a;color:#92400e;border-radius:12px;padding:10px 14px;font-size:12.5px;margin-bottom:12px;line-height:1.5}
#tab-warranty .modal .mrow{display:flex;gap:10px}
#tab-warranty .modal .mbtn{flex:1;border:0;border-radius:13px;padding:13px 14px;font:inherit;font-size:14px;font-weight:800;cursor:pointer;transition:.15s}
#tab-warranty .modal .mbtn.main{background:linear-gradient(100deg,#b31313,#e11d1d);color:#fff}
#tab-warranty .modal .mbtn.main:hover{filter:brightness(1.08)}
#tab-warranty .modal .mbtn.ghost{background:#f1f2f8;color:#39415c;border:1.6px solid var(--line)}
#tab-warranty .modal .mbtn.ghost:hover{background:#e8eaf3}
#tab-warranty .modal .mprog{font-size:12.5px;color:#047857;font-weight:700;margin-top:10px;display:none}

/* ===== IN ===== */
@media print{
  body{background:#fff}
  body.print-cards #sidebar, body.print-cards #toast, body.print-cards #loginGate{display:none !important}
  body.print-cards header{display:none !important}
  body.print-cards main{padding:0 !important;max-width:none !important}
  body, body *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
  body.print-cards #tab-warranty .setup-panel, body.print-cards #tab-warranty .w-sub-tabs{display:none !important}
  body.print-cards #tab-warranty .tip, body.print-cards #tab-warranty .no-print{display:none !important}
  body.print-cards #tab-warranty .stage-info{display:none !important}
  body.print-cards #tab-warranty .sheet-frame{gap:0;padding:0;display:block}
  body.print-cards #tab-warranty .sheet{border:0;box-shadow:none;border-radius:0;margin:0;page-break-after:always;break-after:page;break-inside:avoid;overflow:hidden}
  body.print-cards #tab-warranty .sheet:last-child{page-break-after:auto;break-after:auto}
  body.print-cards #tab-warranty .ticket{box-shadow:none}
  body.print-cards #tab-warranty .sheet-label{display:none !important}
}
@media screen and (max-width:900px){ #tab-warranty .stats{grid-template-columns:repeat(2,1fr)} #tab-warranty .setup-grid{grid-template-columns:1fr 1fr} }
@media (max-width:640px){ #tab-warranty .stats{grid-template-columns:1fr 1fr} #tab-warranty .stat{padding:12px} #tab-warranty .stat b{font-size:19px} #tab-warranty .setup-grid{grid-template-columns:1fr} }
`;
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ============================================================
     PHẦN 1 — QUẢN LÝ PHIẾU (Google Sheets qua Apps Script)
     ============================================================ */
  const PUB_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTJC1JSQqDc9xMbqzLWIPw1csHtwkQ95vTeQiMabe8L8R5vt1T3Yi6Q5penOOh_5qpmZGNfa_C8711i/pubhtml?gid=1943665480&single=true';
  let ALL = [], VOUS = [], RO = { q: '', st: '', pf: '' };
  let _wLoaded = false, _autoTimer = null;
  const $ = (id) => document.getElementById(id);

  window.wSwitch = function (t) {
    const phi = t === 'phi';
    $('wTabPhi').classList.toggle('active', phi);
    $('wTabCard').classList.toggle('active', !phi);
    $('wViewPhi').style.display = phi ? '' : 'none';
    $('wViewCard').style.display = phi ? 'none' : '';
  };

  // badge ngoài sidebar: đếm phiếu chưa xử lý
  function updateNavBadge(pending) {
    const b = document.getElementById('warrantyNavBadge');
    if (!b) return;
    if (pending > 0) { b.textContent = pending; b.classList.remove('hidden'); }
    else b.classList.add('hidden');
  }

  function renderStats(rows) {
    const c = { total: rows.length };
    STATUS_LIST.forEach(s => c[s] = 0);
    rows.forEach(r => { if (c[r.status] !== undefined) c[r.status]++; });
    const cards = [
      { ic: '📋', bg: '#eef2ff', n: c.total, lb: 'Tổng phiếu' },
      { ic: '⏳', bg: '#fff7d6', n: c['Chờ xử lý'], lb: 'Chờ xử lý' },
      { ic: '🛠️', bg: '#ede4ff', n: c['Đang bảo hành'] + c['Đang xử lý'], lb: 'Đang xử lý' },
      { ic: '✅', bg: '#dcf9ec', n: c['Hoàn tất'], lb: 'Hoàn tất' },
    ];
    $('stats').innerHTML = cards.map(x => `
      <div class="stat"><div class="ic" style="background:${x.bg}">${x.ic}</div><div><b>${x.n}</b><span>${x.lb}</span></div></div>`).join('');
    updateNavBadge(c['Chờ xử lý'] + c['Đang xử lý']);
  }

  $('qSearch') && $('qSearch').addEventListener('input', e => { RO.q = e.target.value.toLowerCase().trim(); paint(); });
  $('fStatus') && $('fStatus').addEventListener('change', e => { RO.st = e.target.value; paint(); });
  $('fPlatform') && $('fPlatform').addEventListener('change', e => { RO.pf = e.target.value; paint(); });

  function filtered() {
    return ALL.filter(r => {
      if (RO.st && r.status !== RO.st) return false;
      if (RO.pf && r.platform !== RO.pf) return false;
      if (RO.q) {
        const blob = (r.code + ' ' + r.name + ' ' + r.phone + ' ' + r.product + ' ' + r.order).toLowerCase();
        if (!blob.includes(RO.q)) return false;
      }
      return true;
    });
  }

  function badgeEl(status) {
    const st = STATUS_STYLES[status] || { bg: '#f1f2f8', color: '#475569', dot: '#94a3b8' };
    return `<span class="pill" style="background:${st.bg};color:${st.color}"><i style="background:${st.dot}"></i>${escapeHtml(status)}</span>`;
  }

  function paint() {
    const rows = filtered();
    renderStats(ALL);
    // danh mục tình trạng / nền tảng (chỉ thêm 1 lần)
    const fs = $('fStatus'), fp = $('fPlatform');
    if (fs && fs.options.length === 1) STATUS_LIST.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; fs.appendChild(o); });
    if (fp) {
      const cur = RO.pf;
      fp.innerHTML = '<option value="">Tất cả nền tảng</option>' +
        [...new Set(ALL.map(r => r.platform).filter(Boolean))].sort()
          .map(p => `<option value="${escapeHtml(p)}" ${cur === p ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('');
    }
    $('countNote').textContent = `Hiển thị ${rows.length}/${ALL.length} phiếu`;
    $('emptyState').style.display = rows.length ? 'none' : 'block';
    $('tbody').innerHTML = rows.map(r => `
      <tr>
        <td class="code-cell">${escapeHtml(r.code || '—')}<div class="muted" style="margin-top:3px">${escapeHtml(r.phone || '')}</div></td>
        <td><b>${escapeHtml(r.name || '—')}</b><div class="muted">${escapeHtml(r.address || '')}</div></td>
        <td><b>${escapeHtml(r.product || '—')}</b><div class="muted">${escapeHtml(r.platform || '')}${r.order ? ' • ' + escapeHtml(r.order) : ''}</div></td>
        <td class="muted">${fmtDateTime(r.time)}</td>
        <td class="muted">${r.buyDate ? escapeHtml(String(r.buyDate).slice(0, 10)) : '—'}</td>
        <td style="max-width:230px">${escapeHtml(r.issue || '—')}</td>
        <td>${r.media ? `<a class="lnk" href="${escapeHtml(r.media)}" target="_blank" rel="noopener">Xem ảnh ↗</a>` : '<span class="muted">—</span>'}</td>
        <td>
          ${badgeEl(r.status)}
          <select class="row-sel" data-row="${r.row}" style="margin-top:5px">${STATUS_LIST.map(s => `<option ${s === r.status ? 'selected' : ''} value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}</select>
        </td>
        <td><input class="row-sel" data-note="${r.row}" value="${escapeHtml(r.note || '')}" placeholder="+ ghi chú..." style="min-width:140px"></td>
      </tr>`).join('');
  }

  document.addEventListener('change', async (ev) => {
    const t = ev.target;
    if (!$('tab-warranty') || !$('tab-warranty').contains(t)) return; // chỉ tab Bảo Hành
    if (t.matches('select.row-sel')) {
      const row = t.getAttribute('data-row');
      const status = t.value;
      if (!confirm(`Đổi tình trạng phiếu thành "${status}" ?`)) { paint(); return; }
      try {
        const res = await appsGet({ action: 'update', row: row, status: status });
        if (!res.ok) throw new Error(res.error || 'Lỗi');
        const r = ALL.find(x => String(x.row) === String(row));
        if (r) r.status = status;
        paint();
        toast('✔ Đã cập nhật tình trạng phiếu', 'ok');
      } catch (err) {
        alert('Không cập nhật được: ' + err.message + (err.message === 'NOT_CONFIGURED' ? '\nChưa gán APPS_SCRIPT_URL trong bao-hanh/config.js hoặc chưa Deploy Apps Script.' : ''));
        paint();
      }
    }
    if (t.matches('input[data-note]')) {
      clearTimeout(window.__wNoteTimer);
      window.__wNoteTimer = setTimeout(async () => {
        const row = t.getAttribute('data-note');
        const note = t.value.trim();
        const r = ALL.find(x => String(x.row) === String(row));
        if (r && r.note === note) return;
        try { await appsGet({ action: 'update', row: row, note: note }); if (r) r.note = note; }
        catch (err) { if (err.message !== 'NOT_CONFIGURED') alert('Lưu ghi chú lỗi: ' + err.message); }
      }, 700);
    }
  });

  async function load() {
    if (!CONFIG.APPS_SCRIPT_URL) { $('wBannerWarn').style.display = 'block'; return; }
    $('wBannerWarn').style.display = 'none';
    const btn = $('btnRefresh');
    btn.innerHTML = '<span class="spin-mini"></span> Đang đọc...';
    try {
      const res = await appsGet({ action: 'list' });
      if (!res.ok) throw new Error(res.error || 'Lỗi đọc dữ liệu');
      ALL = res.rows;
      paint();
      loadVouchers(); // đọc thêm trạng thái voucher
    } catch (err) {
      ALL = []; paint();
      $('wBannerErr').textContent = '❌ Không đọc được phiếu: ' + err.message + ' — kiểm tra đã dán apps-script.gs (bao-hanh/) và Deploy mới nhất.';
      $('wBannerErr').style.display = 'block';
    }
    btn.innerHTML = '↻ Làm mới';
  }

  /* ============ VOUCHER — đọc / đánh dấu ĐÃ SỬ DỤNG ============ */
  async function loadVouchers() {
    const note = $('vouCount'), btn = $('btnVouReload');
    btn.innerHTML = '<span class="spin-mini"></span> Đang đọc...';
    try {
      const res = await appsGet({ action: 'listvouchers' });
      if (!res.ok) throw new Error(res.error || 'Lỗi đọc voucher');
      VOUS = res.rows;
      paintVouchers();
    } catch (err) {
      VOUS = []; paintVouchers();
      note.textContent = '❌ ' + err.message;
    }
    btn.innerHTML = '↻ Đọc lại từ Sheets';
  }
  function paintVouchers() {
    const tb = $('vouTbody'), note = $('vouCount');
    const q = ($('vouSearch').value || '').trim().toUpperCase();
    const rows = VOUS.filter(r => !q || (r.vou + ' ' + r.card + ' ' + r.status + ' ' + r.quaPhieu).toUpperCase().includes(q));
    note.textContent = rows.length ? rows.length + '/' + VOUS.length + ' voucher' : '';
    $('vouEmpty').style.display = VOUS.length ? 'none' : 'block';
    tb.innerHTML = rows.map(r => {
      const used = String(r.status).toUpperCase().includes('ĐÃ');
      const vt = r.validTo ? new Date(r.validTo) : null;
      const expired = !used && vt && vt < new Date();
      const badge = used ? `<span class="v-badge used">✔ ĐÃ SỬ DỤNG</span>`
        : expired ? `<span class="v-badge expired">✕ HẾT HIỆU LỰC</span>`
        : `<span class="v-badge unused">⏳ CHƯA SỬ DỤNG</span>`;
      return `<tr>
        <td><b style="letter-spacing:.4px">${escapeHtml(r.vou)}</b></td>
        <td style="font-family:monospace">${escapeHtml(r.card || '—')}</td>
        <td>${badge}</td>
        <td>${fmtDateTime(r.printed)}</td>
        <td>${vt ? fmtDateTime(r.validTo) : '—'}</td>
        <td>${r.usedAt ? fmtDateTime(r.usedAt) : '—'}</td>
        <td>${escapeHtml(r.quaPhieu || '—')}</td>
      </tr>`;
    }).join('');
  }

  $('btnVouReload') && ($('btnVouReload').onclick = loadVouchers);
  $('vouSearch') && $('vouSearch').addEventListener('input', paintVouchers);
  $('btnVouUsed') && ($('btnVouUsed').onclick = async () => {
    const inp = $('vouInput');
    const code = inp.value.trim().toUpperCase();
    if (!code) { inp.focus(); alert('Nhập mã voucher khách xuất trình trước.'); return; }
    const btn = $('btnVouUsed');
    btn.disabled = true;
    try {
      const res = await appsGet({ action: 'usevoucher', code: code });
      if (!res.ok) {
        toast('⚠️ ' + res.error, 'err');
      } else {
        inp.value = '';
        toast(`✔ ${code} → ĐÃ SỬ DỤNG`, 'ok');
        const r = VOUS.find(x => x.vou === code);
        if (r) { r.status = 'ĐÃ SỬ DỤNG'; r.usedAt = new Date().toISOString(); paintVouchers(); }
      }
    } catch (err) { toast('⚠️ Lỗi kết nối: ' + err.message, 'err'); }
    btn.disabled = false;
  });

  document.getElementById('btnRefresh') && (document.getElementById('btnRefresh').onclick = load);
  document.getElementById('btnReload2') && (document.getElementById('btnReload2').onclick = load);
  document.getElementById('btnSheets') && (document.getElementById('btnSheets').onclick = () => window.open(PUB_URL, '_blank'));
  document.getElementById('btnExport') && (document.getElementById('btnExport').onclick = () => {
    const rows = filtered();
    const cols = ['code', 'name', 'phone', 'product', 'order', 'platform', 'buyDate', 'address', 'issue', 'media', 'status', 'note', 'time'];
    const head = ['MA PHIEU', 'HO TEN', 'SDT', 'SAN PHAM', 'MA DON HANG', 'NEN TANG', 'NGAY MUA', 'DIA CHI', 'LOI', 'LINK ANH', 'TINH TRANG', 'GHI CHU', 'GUI LUC'];
    const csv = [head].concat(rows.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'phieu-bao-hanh-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    toast('✔ Đã xuất file CSV phiếu bảo hành', 'ok');
  });
  $('autoReload') && $('autoReload').addEventListener('change', e => {
    clearInterval(_autoTimer);
    if (e.target.checked) _autoTimer = setInterval(() => {
      if (document.getElementById('adminApp').classList.contains('hidden')) return;
      if (document.getElementById('tab-warranty').classList.contains('hidden')) return;
      load();
    }, 60000);
  });

  /* ============================================================
     PHẦN 2 — IN THẺ TOHO: sinh mã + khung A4/A5 theo mm
     ============================================================ */
  const CARD_W = 148, CARD_H = 105;
  const LAYOUTS = {
    a4p: [
      { label: '2 × 2 — 4 thẻ/trang (thẻ lớn)', cols: 2, rows: 2 },
      { label: '2 × 3 — 6 thẻ/trang (thẻ nhỏ)', cols: 2, rows: 3 },
    ],
    a4l: [{ label: '2 × 2 — 4 thẻ/trang', cols: 2, rows: 2 }],
    a5p: [
      { label: '1 × 2 — 2 thẻ/trang (gần nguyên cỡ)', cols: 1, rows: 2 },
      { label: '2 × 2 — 4 thẻ/trang (thẻ nhỏ)', cols: 2, rows: 2 },
    ],
    a5l: [{ label: '2 × 2 — 4 thẻ/trang', cols: 2, rows: 2 }],
  };
  const PAGE = {
    a4p: { w: 210, h: 297, size: 'A4 portrait', vn: 'A4 dọc' },
    a4l: { w: 297, h: 210, size: 'A4 landscape', vn: 'A4 ngang' },
    a5p: { w: 148, h: 210, size: 'A5 portrait', vn: 'A5 dọc' },
    a5l: { w: 210, h: 148, size: 'A5 landscape', vn: 'A5 ngang' },
  };

  /* ---------- bộ icon SVG khớp bản gốc ---------- */
  const SVG = {
    shieldBand: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.6l7.4 2.7v5.5c0 4.5-3 8.3-7.4 10.4-4.4-2.1-7.4-5.9-7.4-10.4V5.3L12 2.6z" fill="#ffffff2e" stroke="#fff" stroke-width="1.5"/><path d="M8.7 11.9l2.3 2.3 4.4-4.5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    shieldBlack: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.2l8.2 3v5.9c0 4.9-3.3 9.2-8.2 11.3C7.1 20.3 3.8 16 3.8 11.1V5.2l8.2-3z" fill="#141414"/><path d="M8.4 11.9l2.5 2.5 4.9-5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    barcode: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round"><path d="M4 5.5v13M7.3 5.5v13M10.4 5.5v8.6M13.6 5.5v13M16.7 5.5v8.6M20 5.5v13"/></svg>',
    scan: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M4 8.2V6a2 2 0 012-2h2.2M15.8 4H18a2 2 0 012 2v2.2M20 15.8V18a2 2 0 01-2 2h-2.2M8.2 20H6a2 2 0 01-2-2v-2.2M6.5 12h11"/></svg>',
    person: '<svg viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="8.4" r="3.5"/><path d="M4.9 19.6c.9-3.4 3.6-5.4 7.1-5.4s6.2 2 7.1 5.4H4.9z"/></svg>',
    gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M4.6 10.6h14.8v9a1 1 0 01-1 1H5.6a1 1 0 01-1-1v-9z"/><path d="M3.6 7.2h16.8V10H3.6z"/><path d="M12 7.2V20.6M12 7.2c-2.2 0-3.9-.9-3.9-2.2C8.1 3.8 9.2 3 10.1 3.6c1.3.9 1.9 3.6 1.9 3.6zm0 0c2.2 0 3.9-.9 3.9-2.2 0-1.2-1.1-2-2-1.4-1.3.9-1.9 3.6-1.9 3.6z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M6.6 10.8c1.5 3 3.6 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .8-.3 1l-2.1 2.2z"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9"><circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h16.4M12 3.8c2.9 2.9 2.9 13.5 0 16.4M12 3.8c-2.9 2.9-2.9 13.5 0 16.4" stroke-width="1.5"/></svg>',
  };

  let CODES = [], VOUCODES = [];

  function setDefaults() {
    if (!$('inShop')) return;
    const g = (k, f) => localStorage.getItem(k) || f;
    $('inBrandShort').value = g('t2_bshort', 'TOHO');
    $('inShop').value = g('t2_shop', (CONFIG.SHOP_NAME || 'TOHO ELECTRIC VN'));
    $('inDesc').value = g('t2_desc', 'Ổ CẮM - THIẾT BỊ ĐIỆN CHÍNH HÃNG');
    $('inWebsite').value = g('t2_web', 'https://toho-electric.vercel.app/');
    $('inSlogan').value = g('t2_slogan', 'Chất lượng là uy tín');
    $('inHotline').value = g('t2_zalo', (CONFIG.SHOP_HOTLINE || '0768718896'));
    $('inFb').value = g('t2_fb', ($('inShop').value || 'TOHO ELECTRIC VN'));
    // Link QR mặc định trỏ tới trang bảo hành chính thức /bao-hanh/
    $('inUrl').value = (localStorage.getItem('t2_url') !== null ? localStorage.getItem('t2_url') : (location.origin.startsWith('http') ? 'https://toho-electric.vercel.app/bao-hanh/' : ''));
    $('inPaper').value = g('t2_paper', 'a4p');
    $('inGenMode').value = g('t2_mode', 'seq');
    $('inPrefix').value = g('t2_prefix', 'TOHO15-');
    $('inSeqFrom').value = g('t2_seq', '202501');
    $('inVoucherPct').value = g('t2_pct', '15%');
    $('inVoucherLine').value = g('t2_vline', 'CHO ĐƠN HÀNG TIẾP THEO');
    $('inUnlimited').value = g('t2_unl', 'KHÔNG GIỚI HẠN SỐ LƯỢNG • KHÔNG GIỚI HẠN THỜI GIAN');
    $('inVouMode').value = g('t2_voumode', 'seq');
    $('inVouPrefix').value = g('t2_vouprefix', 'VC-');
    $('inVouFrom').value = g('t2_voufrom', '1');
    $('inVouValid').value = g('t2_vouvalid', '30');
    $('inVouDiscount').value = g('t2_voudisc', '');
    $('inVouMinOrder').value = g('t2_voumin', '0');
    $('inVouQty').value = g('t2_vouqty', '1');
    fillLayouts();
    refreshGroups();
  }

  function savePrefs() {
    try {
      [['t2_shop', 'inShop'], ['t2_desc', 'inDesc'], ['t2_web', 'inWebsite'], ['t2_zalo', 'inHotline'], ['t2_fb', 'inFb'],
       ['t2_url', 'inUrl'], ['t2_paper', 'inPaper'], ['t2_mode', 'inGenMode'], ['t2_prefix', 'inPrefix'], ['t2_seq', 'inSeqFrom'],
       ['t2_pct', 'inVoucherPct'], ['t2_vline', 'inVoucherLine'], ['t2_unl', 'inUnlimited'], ['t2_slogan', 'inSlogan'],
       ['t2_bshort', 'inBrandShort'], ['t2_voumode', 'inVouMode'], ['t2_vouprefix', 'inVouPrefix'], ['t2_voufrom', 'inVouFrom'], ['t2_vouvalid', 'inVouValid'],
       ['t2_voudisc', 'inVouDiscount'], ['t2_voumin', 'inVouMinOrder'], ['t2_vouqty', 'inVouQty']
      ].forEach(([k, id]) => { const el = $(id); if (el) localStorage.setItem(k, el.value); });
      localStorage.setItem('t2_layout_' + $('inPaper').value, $('inLayout').value);
    } catch (e) {}
  }

  function fillLayouts() {
    $('inLayout').innerHTML = LAYOUTS[$('inPaper').value].map((o, i) => `<option value="${i}">${o.label}</option>`).join('');
    $('inLayout').value = localStorage.getItem('t2_layout_' + $('inPaper').value) || ($('inPaper').value === 'a5p' ? '1' : '0');
  }
  function refreshGroups() {
    const m = $('inGenMode').value;
    $('grpSeqFrom').style.display = m === 'seq' ? 'flex' : 'none';
    $('grpManual').style.display = m === 'manual' ? 'flex' : 'none';
    $('inCount').style.display = m === 'manual' ? 'none' : 'block';
  }

  $('inPaper') && $('inPaper').addEventListener('change', () => { fillLayouts(); savePrefs(); });
  $('inGenMode') && $('inGenMode').addEventListener('change', refreshGroups);
  ['inShop', 'inDesc', 'inWebsite', 'inHotline', 'inFb', 'inUrl', 'inLayout', 'inGenMode', 'inPrefix', 'inSeqFrom', 'inVoucherPct', 'inVoucherLine', 'inUnlimited', 'inSlogan', 'inBrandShort', 'inVouMode', 'inVouPrefix', 'inVouFrom', 'inVouValid', 'inVouDiscount', 'inVouMinOrder', 'inVouQty']
    .forEach(id => { const el = $(id); el && el.addEventListener('change', savePrefs); });

  $('btnGen') && ($('btnGen').onclick = () => generate(false));
  $('btnPrint') && ($('btnPrint').onclick = () => {
    if (!CODES.length) generate(true);
    openPrintModal();
  });
  $('btnCopyCodes') && ($('btnCopyCodes').onclick = async () => {
    if (!$('codeList').value) { alert('Chưa có mã — bấm TẠO THẺ trước.'); return; }
    try { await navigator.clipboard.writeText($('codeList').value); }
    catch (e) { $('codeList').select(); document.execCommand('copy'); }
    $('btnCopyCodes').textContent = '✔ Đã copy';
    setTimeout(() => $('btnCopyCodes').textContent = '📋 Copy mã BH', 1500);
  });
  $('btnCopyVou') && ($('btnCopyVou').onclick = async () => {
    if (!$('codeListVou').value) { alert('Chưa có mã voucher — bấm TẠO THẺ trước.'); return; }
    try { await navigator.clipboard.writeText($('codeListVou').value); }
    catch (e) { $('codeListVou').select(); document.execCommand('copy'); }
    $('btnCopyVou').textContent = '✔ Đã copy';
    setTimeout(() => $('btnCopyVou').textContent = '📋 Copy mã VOUCHER', 1500);
  });

  /* ---------- Modal in thẻ + đồng bộ Sheets ---------- */
  function openPrintModal() {
    if (!CODES.length) { alert('Chưa có thẻ nào — bấm ✨ TẠO THẺ XEM TRƯỚC trước.'); return; }
    $('mCountCards').textContent = CODES.length;
    $('mCountVou').textContent = VOUCODES.length;
    $('mBoxesCode').textContent = CODES.join('\n');
    $('mBoxesVou').textContent = VOUCODES.join('\n');
    $('mWarn').style.display = CONFIG.APPS_SCRIPT_URL ? 'none' : 'block';
    $('mBtnSyncPrint').disabled = !CONFIG.APPS_SCRIPT_URL;
    $('mBtnSyncPrint').textContent = CONFIG.APPS_SCRIPT_URL ? '✅ CẬP NHẬT SHEETS & IN' : '⛔ CHƯA CẤU HÌNH SHEETS';
    $('mProg').style.display = 'none'; $('mProg').textContent = '';
    $('printOverlay').classList.add('show');
  }
  $('mBtnCancel') && ($('mBtnCancel').onclick = () => $('printOverlay').classList.remove('show'));
  $('mBtnPrintOnly') && ($('mBtnPrintOnly').onclick = () => { $('printOverlay').classList.remove('show'); doPrint(); });
  $('mBtnSyncPrint') && ($('mBtnSyncPrint').onclick = async () => {
    const btn = $('mBtnSyncPrint'), prog = $('mProg');
    btn.disabled = true; $('mBtnPrintOnly').disabled = true;
    prog.style.display = 'block';
    try {
      prog.textContent = 'Đang ghi MÃ THẺ BẢO HÀNH vào Sheets…';
      const CH = 8;
      let addedC = 0, skippedC = 0;
      for (let i = 0; i < CODES.length; i += CH) {
        const res = await appsGet({ action: 'savecards', data: CODES.slice(i, i + CH).join(',') });
        if (!res || !res.ok) throw new Error((res && res.error) || 'Không xác định (savecards)');
        addedC += res.added || 0; skippedC += res.skipped || 0;
        await new Promise(r => setTimeout(r, 350));
      }
      prog.textContent = `✔ MÃ THẺ: ${addedC} mới, ${skippedC} trùng bỏ qua.`;
      await new Promise(r => setTimeout(r, 400));

      prog.textContent = 'Đang ghi VOUCHER vào Sheets…';
      let addedV = 0, skippedV = 0;
      const days = Math.max(1, parseInt($('inVouValid').value, 10) || 30);
      const disc = $('inVouDiscount').value.trim();
      const minO = String(parseInt($('inVouMinOrder').value, 10) || 0);
      const qty = String(parseInt($('inVouQty').value, 10) || 1);
      for (let i = 0; i < VOUCODES.length; i += CH) {
        const res = await appsGet({ action: 'savevouchers', data: VOUCODES.slice(i, i + CH).join(','), cards: CODES.slice(i, i + CH).join(','), days: days, discount: disc, minorder: minO, qty: qty });
        if (!res || !res.ok) throw new Error((res && res.error) || 'Không xác định (savevouchers)');
        addedV += res.added || 0; skippedV += res.skipped || 0;
        await new Promise(r => setTimeout(r, 350));
      }
      prog.textContent = `✔ VOUCHER: ${addedV} mới, ${skippedV} trùng bỏ qua. Đang mở khung in…`;
      await new Promise(r => setTimeout(r, 600));
      $('printOverlay').classList.remove('show');
      doPrint();
    } catch (err) {
      prog.style.color = '#b91c1c';
      prog.textContent = '❌ Không cập nhật được: ' + err.message + ' — bạn vẫn có thể chọn "IN NGAY (không cập nhật)".';
      btn.disabled = false; $('mBtnPrintOnly').disabled = false;
    }
  });

  function doPrint() {
    if (!CODES.length) { alert('Chưa có thẻ nào — bấm ✨ TẠO THẺ XEM TRƯỚC trước.'); return; }
    document.body.classList.add('print-cards');
    window.print();
    setTimeout(() => document.body.classList.remove('print-cards'), 800);
  }

  function generate(alsoPrint) {
    const url = $('inUrl').value.trim();
    if (!url) { alert('Cần dán Link QR (trang đăng ký bảo hành /bao-hanh/) để tạo QR trên thẻ.'); $('inUrl').focus(); return; }
    const mode = $('inGenMode').value;
    const prefix = $('inPrefix').value.trim().toUpperCase();
    let codes = [];
    if (mode === 'manual') {
      codes = $('inManual').value.split(/[\n,;]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      codes = [...new Set(codes)];
      if (!codes.length) { alert('Bạn cần nhập ít nhất 1 mã.'); return; }
    } else {
      const n = Math.min(200, Math.max(1, parseInt($('inCount').value || '8', 10)));
      if (mode === 'seq') {
        const start = parseInt($('inSeqFrom').value || '1', 10);
        for (let i = 0; i < n; i++) codes.push(prefix + String(start + i));
        $('inSeqFrom').value = start + n;
        savePrefs();
      } else {
        const used = new Set(); let guard = 0; const maxNum = 999999;
        while (codes.length < n && guard < n * 80) {
          guard++;
          const c = prefix + String(Math.floor(Math.random() * (maxNum + 1)));
          if (!used.has(c)) { used.add(c); codes.push(c); }
        }
      }
    }
    CODES = codes;

    // sinh mã voucher riêng — không trùng với mã bảo hành
    const vouMode = $('inVouMode').value;
    const vouPrefix = ($('inVouPrefix').value.trim().toUpperCase() || 'VC-');
    let vouCodes = [];
    const nV = codes.length;
    if (vouMode === 'seq') {
      const vs = parseInt($('inVouFrom').value || '1', 10);
      for (let i = 0; i < nV; i++) vouCodes.push(vouPrefix + String(vs + i));
      $('inVouFrom').value = vs + nV;
      savePrefs();
    } else {
      const usedV = new Set(); let guardV = 0;
      while (vouCodes.length < nV && guardV < nV * 80) {
        guardV++;
        const c = vouPrefix + String(Math.floor(Math.random() * 999999)).padStart(6, '0');
        if (!usedV.has(c)) { usedV.add(c); vouCodes.push(c); }
      }
    }
    VOUCODES = vouCodes;
    $('codeList').value = codes.join('\n');
    $('codeListVou').value = vouCodes.join('\n');
    buildSheets(codes, vouCodes, url);
    if (alsoPrint) doPrint();
  }

  function buildSheets(codes, vouCodes, baseUrl) {
    const page = PAGE[$('inPaper').value];
    const layout = LAYOUTS[$('inPaper').value][parseInt($('inLayout').value, 10) || 0];
    const P = (page.w > page.h ? 8 : 10), gap = 8;
    const innerW = page.w - P * 2;
    const innerH = page.h - P * 2;
    const cellW = (innerW - gap * (layout.cols - 1)) / layout.cols;
    const cellH = (innerH - gap * (layout.rows - 1)) / layout.rows;
    const s = Math.min(cellW / CARD_W, cellH / CARD_H, 1);
    const orient = page.w > page.h ? 'Khổ ngang' : 'Chân dung';
    const szLetter = page.size.indexOf('A4') === 0 ? 'A4' : 'A5';
    $('stageInfo').innerHTML =
      `<b>${codes.length}</b> thẻ — cỡ <b>${(CARD_W * s).toFixed(0)} × ${(CARD_H * s).toFixed(0)} mm</b> — ` +
      `<b>${Math.ceil(codes.length / (layout.cols * layout.rows))}</b> trang ${page.vn}` +
      ` &nbsp;•&nbsp; ⚙️ Khi in chọn: <b>${szLetter} + ${orient} + Lề: None + 100%</b>`;
    const stage = $('stage'); stage.innerHTML = '';
    const per = layout.cols * layout.rows;
    const pages = Math.ceil(codes.length / per);
    let idx = 0;
    for (let p = 0; p < pages; p++) {
      const sheet = document.createElement('div');
      sheet.className = 'sheet';
      sheet.style.width = page.w + 'mm';
      sheet.style.height = `calc(${page.h}mm - 1px)`;
      sheet.style.padding = P + 'mm';
      sheet.style.gridTemplateColumns = `repeat(${layout.cols}, ${cellW}mm)`;
      for (let i = 0; i < per; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.width = cellW + 'mm';
        cell.style.height = cellH + 'mm';
        if (idx < codes.length) { cell.appendChild(makeTicket(codes[idx], vouCodes[idx] || '', baseUrl, s)); idx++; }
        sheet.appendChild(cell);
      }
      stage.appendChild(sheet);
      const lb = document.createElement('div');
      lb.className = 'sheet-label no-print';
      lb.textContent = `Trang ${p + 1}/${pages} — ${page.vn} — ${Math.round(s * 100)}% cỡ thẻ`;
      stage.appendChild(lb);
    }
  }

  function makeTicket(code, vouCode, baseUrl, s) {
    const wrap = document.createElement('div');
    wrap.className = 'ticket-wrap';
    wrap.style.setProperty('--s', s);
    const short = ($('inBrandShort').value.trim() || 'TOHO').toUpperCase();
    const full = ($('inShop').value.trim() || 'TOHO ELECTRIC VN').toUpperCase();
    const desc = $('inDesc').value.trim();
    const web = $('inWebsite').value.trim();
    const webShow = (web || '').replace(/^https?:\/\//i, '');
    const slogan = $('inSlogan').value.trim();
    const vPct = $('inVoucherPct').value.trim() || '15%';
    const vLine = $('inVoucherLine').value.trim();
    const unl = $('inUnlimited').value.trim();
    const unlLines = unl.split(/\s*[•/]\s*|\n/).filter(Boolean);
    const zalo = $('inHotline').value.trim();
    const fb = ($('inFb').value.trim() || full).toUpperCase();
    const link = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'code=' + encodeURIComponent(code);
    const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&qzone=1&data=' + encodeURIComponent(link);
    wrap.innerHTML = `
      <div class="ticket">
        <div class="deco"><i class="d1"></i><i class="d2"></i></div>
        <div class="lband">
          <div class="lb-logo">${escapeHtml(short)}</div>
          <div class="lb-name">${escapeHtml(lbRestOf(full, short))}</div>
          <div class="lb-desc">${escapeHtml(desc)}</div>
          <div class="lb-line"></div>
          <div class="lb-mid">
            <div class="lb-shield">${SVG.shieldBand}</div>
            <div class="lb-big">BẢO HÀNH<br>CHÍNH HÃNG</div>
          </div>
          <div class="lb-script">An tâm sử dụng</div>
        </div>
        <div class="mr">
          <div class="hd">
            <div class="hd-shield">${SVG.shieldBlack}</div>
            <div class="hd-col">
              <div class="hd-title">THẺ BẢO HÀNH</div>
              <div class="hd-brand">${escapeHtml(full)}</div>
            </div>
            <div class="hd-script">${escapeHtml(slogan)}</div>
          </div>
          <div class="hd-tag"><span class="tg-ln"></span>SẢN PHẨM CHÍNH HÃNG&nbsp;&nbsp;-&nbsp;&nbsp;DỊCH VỤ TẬN TÂM<span class="tg-ln"></span></div>
          <div class="panel">
            <div class="r1">
              <div class="pico">${SVG.barcode}</div>
              <span class="pr-title">MÃ BẢO HÀNH:</span>
              <span class="code-badge">${escapeHtml(code)}</span>
            </div>
            <div class="pr-rows">
              <div class="pr">
                <div class="pico">${SVG.scan}</div>
                <div style="min-width:0">
                  <div class="pr-title">QUÉT MÃ QR</div>
                  <div class="pr-sub">Để truy cập website bảo hành &nbsp;<span class="arr">▸</span></div>
                </div>
              </div>
              <div class="pr">
                <div class="pico">${SVG.person}</div>
                <div class="pr-lines">${unlLines.map(l => `<div class="pr-line">${escapeHtml(l)}</div>`).join('')}</div>
              </div>
            </div>
            <div class="qrzone">
              <div class="qrbox">
                <span class="corner c-tl"></span><span class="corner c-tr"></span>
                <span class="corner c-bl"></span><span class="corner c-br"></span>
                <img alt="QR" src="${qr}">
              </div>
              <div class="site-chip">${SVG.globe}<span>${escapeHtml(webShow || web)}</span></div>
            </div>
          </div>
          <div class="common-hr"></div>
          <div class="voucher">
            <div class="v-left">${SVG.gift}
              <div class="vc">
                <b>VOUCHER GIẢM GIÁ</b>
                <span class="v-code">MÃ: ${escapeHtml(vouCode || '—')}</span>
              </div>
            </div>
            <div class="v-mid"><small>GIẢM NGAY</small><span class="v-pct">${escapeHtml(vPct)}</span></div>
            <span class="v-sep"></span>
            <div class="v-right">
              <b>${escapeHtml(vLine)}</b>
              <span class="v-chip">ÁP DỤNG MUA TRÊN WEB</span>
            </div>
          </div>
          <div class="foot">
            <div class="f-item">
              <span class="f-ico">${SVG.phone}</span>
              <div><small>Liên hệ Zalo</small><b>${escapeHtml(zalo)}</b></div>
            </div>
            <span class="f-sep"></span>
            <div class="f-item f-mid">
              <span class="f-ico"><span class="fchar">f</span></span>
              <div><small>Facebook</small><b>${escapeHtml(fb)}</b></div>
            </div>
            <span class="f-sep"></span>
            <div class="f-item f-web">
              <span class="f-ico">${SVG.globe}</span>
              <div><small>Web</small><b>${escapeHtml(webShow || web)}</b></div>
            </div>
          </div>
        </div>
      </div>`;
    return wrap;
  }

  function lbRestOf(full, short) {
    const r = full.includes(short) ? full.replace(short, '').trim() : full;
    return r || 'ELECTRIC VN';
  }

  /* ============================================================
     KHỞI TẠO — hook từ admin-ui.js switchTab('warranty')
     ============================================================ */
  window.initWarrantyTab = function () {
    if (_wLoaded) return;
    _wLoaded = true;
    setDefaults();
    load();
    if ($('autoReload') && $('autoReload').checked && !_autoTimer) {
      _autoTimer = setInterval(() => {
        if (document.getElementById('adminApp').classList.contains('hidden')) return;
        if (document.getElementById('tab-warranty').classList.contains('hidden')) return;
        load();
      }, 60000);
    }
  };
})();
