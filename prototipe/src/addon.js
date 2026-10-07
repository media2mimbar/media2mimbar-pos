/* ════════════════════════════════════════════════════════════
   MODUL v8: Event, Laporan, Pengaturan POS, dashboard dari data,
   produk + varian yang benar-benar tersimpan, PIN karyawan.
   Semua data yang dipakai POS dibaca/ditulis lewat shared.js.
   ════════════════════════════════════════════════════════════ */
(function(){

/* ── sambungkan state dashboard ke data bersama ── */
function pull(d){
  state.products=d.produk; state.categories=d.kategori; state.stokItems=d.stok; state.staff=d.staff;
  state.marketplaceChannels=d.channel; state.po.orders=d.orders; state.po.batches=d.batches;
  state.events=d.events; state.posSettings=d.pos; state.posTrx=d.trx; state.posShift=d.shift;
  state.promoProdukList=d.promoProduk; state.promoTotalList=d.promoTotal; state.customers=d.pelanggan;
  state.mutasi=d.mutasi; state.posOpname=d.opname; state.masukPos=d.masuk||[]; state.faktur=d.faktur||[]; state.pemasok=d.pemasok||[]; state.terbuang=d.terbuang||[]; state.biaya=d.biaya||[];
  if(!state._opnameSeed) state._opnameSeed=state.opnameList.slice();
  state.opnameList=[...d.opname.map(o=>({tanggal:`${hkTgl(o.waktu)}, ${hkJam(o.waktu)}`, nomor:o.no, outlet:o.lokasi, dibuatOleh:o.oleh+(o.jenis==='Tutup Event'?' (Tutup Event)':' (POS)'), status:o.status})), ...state._opnameSeed];
  syncOutlets();
}
window.hkData=()=>data();
function data(){
  return {produk:state.products, kategori:state.categories, stok:state.stokItems, staff:state.staff, channel:state.marketplaceChannels,
    orders:state.po.orders, batches:state.po.batches, events:state.events, pos:state.posSettings, trx:state.posTrx, shift:state.posShift,
    promoProduk:state.promoProdukList, promoTotal:state.promoTotalList, pelanggan:state.customers, mutasi:state.mutasi, opname:state.posOpname, masuk:state.masukPos, faktur:state.faktur, pemasok:state.pemasok, terbuang:state.terbuang, biaya:state.biaya};
}
function syncOutlets(){
  OUTLETS.splice(0, OUTLETS.length, HK_GUDANG, ...state.events.filter(e=>!e.ditutup).map(e=>e.nama));
  if(state.outletMode==='single' && !OUTLETS.includes(state.outlet)) state.outlet=HK_GUDANG;
}
pull(hkLoad());
state.outlet=HK_GUDANG; state.outletMode='all';
state.view='dashboard';
state.openGroups={}; state.openSubGroups={};
state.dashboard={periode:'Harian', refDate:hkToday()};
state.hk={psTab:'Menunggu', psEvent:'', modal:null, evTab:'Semua', evId:null, evForm:null, lapPeriode:'bulan', lapTab:'saluran', prodForm:null, prodTab:'semua', prodSearch:'', prodKat:'', staffForm:null};

/* ── menu: tambah Event & Pengaturan POS, sembunyikan menu yang belum perlu di v1 ── */
ICONS.event = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="8.5" width="16" height="14.5" rx="2"/><path d="M7 13h16M11.5 6.5v4M18.5 6.5v4"/><path d="M12 17.2l2 2 4-4"/></g></svg>`;
ICONS.presale = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 11h14l-1.2 11.5a1.5 1.5 0 0 1-1.5 1.3h-8.6a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M11.5 11V9.5a3.5 3.5 0 0 1 7 0V11"/><path d="M15 15v3.5l2 1.2"/></g></svg>`;
ICONS.setelan = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="10" y="5.5" width="10" height="19" rx="2"/><path d="M13.5 21h3"/><path d="M6 10v10M24 10v10"/></g></svg>`;
(function(){
  const at=id=>NAV.find(n=>n.id===id);
  const lap=at('laporan'); delete lap.placeholder;
  lap.children=[{id:'lap-saluran', label:'Per Saluran'},{id:'lap-event', label:'Per Event'},{id:'lap-kasir', label:'Per Kasir'},{id:'lap-produk', label:'Per Produk'},{id:'lap-harian', label:'Rekap Harian'},{id:'lap-kerugian', label:'Selisih & Kerugian'}];
  at('produk').children=at('produk').children.filter(c=>c.id!=='departemen');
  at('inventori').children=at('inventori').children.filter(c=>['faktur-list','kelola-stok','pemasok'].includes(c.id)).map(c=>c.id==='pemasok'?{id:'pemasok', label:'Daftar Pemasok'}:c);
  { const L=at('inventori').children, i=L.findIndex(c=>c.id==='pemasok'), sp=L.splice(i,1)[0]; L.splice(1,0,sp); }
  at('pelanggan').children=at('pelanggan').children.filter(c=>c.id==='pelanggan-list');
  NAV.splice(NAV.findIndex(n=>n.id==='laporan')+1, 0, {id:'event', label:'Event', icon:'event'}, {id:'presale', label:'Pesanan Pre-sale', icon:'presale'});
  NAV.push({id:'pengaturan-pos', label:'Pengaturan POS', icon:'setelan'});
})();
FORM_VIEWS['event-form']='event';
FORM_VIEWS['produk-form']='produk-list';

/* ── modal milik modul ini ── */
/* semua isian angka yang punya batas: nilai di atas batas langsung diturunkan ke batas, tidak bisa ditambah */
document.addEventListener('input',e=>{ const t=e.target; if(!t||t.tagName!=='INPUT'||t.type!=='number'||t.max==='') return;
  const mx=+t.max, mn=t.min===''?null:+t.min; if(t.value!==''&&+t.value>mx){ t.value=mx; toast(`Maksimal ${mx.toLocaleString('id-ID')}${t.dataset.batas?' · '+t.dataset.batas:''}`); }
  else if(mn!=null&&t.value!==''&&+t.value<mn) t.value=mn; },true);
/* form halaman penuh: klik area kosong tidak menutup form */
document.addEventListener('click',e=>{ const t=e.target; if(t&&t.classList&&t.classList.contains('overlay')&&t.querySelector(':scope > .hk-page')) e.stopImmediatePropagation(); },true);
/* pindah menu dari topbar menutup form yang sedang terbuka */
document.addEventListener('click',e=>{ if(!e.target.closest||!e.target.closest('.topbar')) return; document.querySelectorAll('.overlay.open > .hk-page').forEach(bx=>{ const c=bx.querySelector('.close'); if(c) c.click(); }); },true);
const modalRoot=document.createElement('div'); modalRoot.className='overlay center'; modalRoot.id='hkModalRoot'; modalRoot.style.zIndex=160;
document.body.appendChild(modalRoot);
const css=document.createElement('style');
css.textContent=`
  .hk-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:14px;}
  .hk-kpis .metric-card .metric-value{font-size:19px;}
  .hk-sub{color:var(--text-mut);font-size:11.5px;}
  .hk-num{text-align:right;white-space:nowrap;}
  th.hk-num{text-align:right;}
  .hk-row-link{cursor:pointer;}
  .hk-row-link:hover td{background:#FFF8F2;}
  .badge-info{background:#E8F0FE;color:#1F57C3;}
  .badge-mut{background:#EEEFEC;color:var(--text-2);}
  .badge-danger{background:var(--danger-bg);color:var(--danger-text);}
  .hk-live{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:14px;}
  .hk-live .card{border-left:4px solid var(--accent);cursor:pointer;}
  .hk-live .t{font-weight:700;font-size:14px;margin-bottom:2px;}
  .hk-live .nums{display:flex;gap:18px;margin-top:10px;}
  .hk-live .nums b{display:block;font-size:16px;}
  .hk-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#1BA672;margin-right:6px;box-shadow:0 0 0 3px #D4F3E6;}
  .hk-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
  .hk-chiplist{display:flex;flex-wrap:wrap;gap:6px;}
  .hk-check{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;cursor:pointer;}
  .hk-check.on{border-color:var(--accent);background:var(--accent-bg);}
  .hk-modal{width:720px;max-width:94vw;max-height:88vh;display:flex;flex-direction:column;padding:0;}
  .hk-modal .hk-mb{padding:16px 20px;overflow:auto;flex:1;}
  .hk-modal .hk-mh{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;}
  .hk-modal .hk-mh h4{margin:0;font-size:15px;}
  .hk-modal .hk-mf{padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;align-items:center;}
  /* form tampil sebagai halaman penuh, bukan popup */
  .body.form-mode .main .card{max-width:none!important;}
  .overlay:has(> .hk-page){top:56px;background:var(--bg);align-items:flex-start!important;justify-content:center!important;overflow-y:auto;padding:24px 20px 48px;}
  .overlay > .hk-page{width:100%!important;max-width:960px!important;max-height:none!important;height:auto!important;overflow:visible!important;box-shadow:none;border:1px solid var(--border);border-radius:12px;flex-shrink:0;}
  .hk-page .hk-mh,.hk-page .slideover-head{padding:18px 32px;}
  .hk-page .hk-mh h4,.hk-page .slideover-head .title{font-size:17px;}
  .hk-page .hk-mb{padding:24px 32px;overflow:visible;}
  .hk-page .hk-mf{padding:16px 32px;}
  .hk-page .hk-mh .close,.hk-page .slideover-head .close{order:-1;font-size:0!important;cursor:pointer;margin-right:6px;white-space:nowrap;}
  .hk-page .hk-mh .close::before,.hk-page .slideover-head .close::before{content:'← Kembali';font-size:13px;font-weight:600;color:var(--text-2);}
  .hk-page .hk-mb > .field{display:grid;grid-template-columns:200px 1fr;column-gap:24px;align-items:start;margin-bottom:18px;}
  .hk-page .hk-mb > .field > label{padding-top:9px;margin-bottom:0;}
  .hk-page .hk-mb > .field > *:not(label){grid-column:2;}
  /* form addon: judul + kembali di luar kartu, sama seperti halaman form lain */
  .overlay > .hk-modal.hk-page{background:transparent;border:none;border-radius:0;}
  .hk-modal.hk-page .hk-mh{flex-direction:column;align-items:flex-start;gap:14px;padding:0 0 12px;border:none;}
  .hk-modal.hk-page .hk-mh .spacer{display:none;}
  .hk-modal.hk-page .hk-mh h4{font-size:16px;font-weight:600;}
  .hk-modal.hk-page .hk-mh .close{margin:0;}
  .hk-modal.hk-page .hk-mb{background:#fff;border:1px solid var(--border);border-bottom:none;border-radius:12px 12px 0 0;padding:28px 32px;}
  .hk-modal.hk-page .hk-mf{background:#fff;border:1px solid var(--border);border-radius:0 0 12px 12px;}
  .hk-qty{width:80px;padding:6px 8px;border:1px solid var(--border-strong);border-radius:6px;text-align:right;}
  .hk-set{display:grid;grid-template-columns:1fr 340px;gap:16px;align-items:start;}
  .hk-set .card{margin-bottom:14px;}
  .hk-line{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);}
  .hk-line:last-child{border-bottom:none;}
  .hk-line .grow{flex:1;}
  .hk-line .lbl{font-weight:600;}
  .hk-struk{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;background:#fff;border:1px dashed var(--border-strong);border-radius:8px;padding:14px;line-height:1.55;}
  .hk-struk .c{text-align:center;} .hk-struk .r{display:flex;justify-content:space-between;gap:8px;} .hk-struk hr{border:none;border-top:1px dashed #bbb;margin:6px 0;}
  .outlet-switch{display:none!important;}
  .hk-evprod{display:flex; flex-direction:column; gap:8px; max-height:520px; overflow:auto; padding-right:4px;}
  .hk-evprod-item{border:1px solid var(--border); border-radius:10px; overflow:hidden; flex-shrink:0;}
  .hk-evprod-item.on{border-color:var(--accent);}
  .hk-invalid{border-color:var(--danger-text)!important; box-shadow:0 0 0 3px rgba(192,57,43,.12)!important;}
  .field.hk-invalid,.hk-lokasi.hk-invalid{border:1px solid var(--danger-text); border-radius:10px; padding:6px;}
  .btn-primary:hover{color:#fff;}
  .hk-row-on td{background:var(--accent-bg, #FFF6EF);}
  .hk-evprod-head{display:flex; align-items:center; gap:10px; padding:10px 12px; cursor:pointer; background:#fff;}
  .hk-evprod-item.on .hk-evprod-head{background:var(--accent-bg);}
  .hk-evprod-head .hk-sub{margin-left:auto;}
  .hk-evprod table th,.hk-evprod table td{padding:7px 12px;}
  .hk-evprod td .hk-sub{white-space:nowrap;}
  .hk-ro{padding:9px 12px;border:1px solid var(--border);border-radius:8px;background:#F7F7F5;}
  .hk-rentang{display:flex;align-items:center;gap:8px;padding:5px 10px;border:1px solid var(--border);border-radius:999px;background:#fff;font-size:12.5px;color:var(--text-2);}
  .hk-rentang.on{border-color:var(--accent);background:var(--accent-bg);color:var(--accent-text);font-weight:600;}
  .hk-rentang input{border:none;background:transparent;font:inherit;color:var(--text);padding:3px 2px;}
  .hk-rentang-x{cursor:pointer;padding:0 4px;}
  .hk-mp{border:1px solid var(--border);border-radius:10px;padding:2px 14px 10px;margin-bottom:8px;}
  .hk-mp.on{border-color:var(--accent);}
  .hk-mp .hk-line{border:none;}
  .badge-mp{background:var(--accent-bg);color:var(--accent-text);margin:1px 0;}
  .hk-login-bg{position:fixed; inset:0; z-index:300; background:rgba(30,35,33,.55); display:flex; align-items:center; justify-content:center; padding:16px;}
  .hk-login{width:420px; max-width:100%; background:#fff; border-radius:16px; padding:24px; box-shadow:0 20px 60px rgba(0,0,0,.25);}
  .hk-login-brand{display:flex; gap:12px; align-items:center; margin-bottom:18px;} .hk-login-brand b{font-size:16px;}
  .hk-login-logo{width:44px; height:44px; border-radius:12px; background:var(--accent); color:#fff; font-weight:800; display:flex; align-items:center; justify-content:center;}
  .hk-login-judul{font-size:18px; font-weight:700; margin-bottom:12px;}
  .hk-lf{margin-bottom:12px;} .hk-lf label{display:block; font-size:12.5px; color:var(--text-2); margin-bottom:5px;}
  .hk-lf input{width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid var(--border-strong); border-radius:8px; font-size:14px;}
  .hk-pwbox{position:relative;} .hk-pwbox input{padding-right:96px;}
  .hk-pwlihat{position:absolute; right:10px; top:50%; transform:translateY(-50%); font-size:12px; color:var(--accent-text); cursor:pointer; font-weight:600;}
  .hk-login-err{color:var(--danger-text); background:var(--danger-bg); border-radius:8px; padding:8px 10px; font-size:12.5px; margin:0 0 10px;}
  .hk-login-list{display:flex; flex-direction:column; gap:8px;}
  .hk-login-av{width:34px; height:34px; border-radius:50%; background:var(--accent-bg); color:var(--accent-text); font-weight:800; font-size:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0;}
  .hk-akun-ro{padding:9px 11px; border:1px solid var(--border); border-radius:8px; background:#FAFAF8;}
  .hk-qris-up{display:flex; gap:14px; align-items:flex-start; margin:4px 0 10px;}
  .hk-qris-prev{width:130px; height:130px; flex-shrink:0; border:1px dashed var(--border-strong); border-radius:10px; display:flex; align-items:center; justify-content:center; background:#fff; overflow:hidden; font-size:11px; color:var(--text-mut); text-align:center;}
  .hk-qris-prev img{width:100%; height:100%; object-fit:contain;}
  .hk-note{background:#FFF8E6;border:1px solid #F4DFA8;color:#7A5A00;border-radius:8px;padding:10px 12px;font-size:12px;margin-bottom:12px;}
  .hk-varian td input{width:100%;padding:7px 8px;border:1px solid var(--border-strong);border-radius:6px;}
  .hk-tabsrow{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;}
  .hk-tabsrow .tabs{margin-bottom:0;}
  .hk-empty{text-align:center;color:var(--text-mut);padding:28px;}
  .hk-sel{padding:8px 10px;border:1px solid var(--border-strong);border-radius:20px;background:#fff;}
`;
document.head.appendChild(css);

/* ── akun dashboard: Admin/Owner masuk dengan email + password yang didaftarkan Owner.
   Password dari Owner bersifat sementara dan wajib diganti saat pertama masuk. Tidak ada verifikasi email. ── */
const DASH_KEY='hk2dash:sesi';
function akunSesi(){ try{ return JSON.parse(localStorage.getItem(DASH_KEY)); }catch(e){ return null; } }
function akunLogin(){ const s=akunSesi(); return s&&state.staff.find(x=>x.nama===s.nama&&x.aktif!==false&&hkAksesDashboard(x))||null; }
function akun(){ const st=akunLogin(); return st&&!st.pwBaru?st:null; }
const akunNama=()=>(akun()||{nama:'Admin'}).nama;
window.hkAkun=akun;
const loginRoot=document.createElement('div'); loginRoot.id='hkDashLogin'; document.body.appendChild(loginRoot);
let dashLogin={email:'', pw:'', err:'', ganti:false, lama:'', baru:'', ulang:''};
const pwInput=(id,label,val,ph)=>`<div class="hk-lf"><label for="${id}">${label}</label><div class="hk-pwbox"><input type="password" id="${id}" value="${hkEsc(val)}" placeholder="${ph||''}" autocomplete="off"><span class="hk-pwlihat" data-hk-lihat="${id}">Lihat</span></div></div>`;
function renderLogin(){
  const st=akunLogin(), wajib=st&&st.pwBaru, D=dashLogin;
  if(akun()&&!D.ganti){ loginRoot.innerHTML=''; loginRoot.className=''; return; }
  loginRoot.className='hk-login-bg';
  const brand=`<div class="hk-login-brand"><div class="hk-login-logo">HK</div><div><b>Hikayat Merchandise</b><div class="hk-sub">Dashboard admin</div></div></div>`;
  const err=D.err?`<div class="hk-login-err">${hkEsc(D.err)}</div>`:'';
  if(wajib||D.ganti){ const u=wajib?st:akun();
    loginRoot.innerHTML=`<div class="hk-login">${brand}
      <div class="hk-login-judul">${wajib?'Buat password baru':'Ganti password'}</div>
      <div class="hk-sub" style="margin-bottom:14px;">${wajib?`Halo ${hkEsc(u.nama.split(' ')[0])}. Password dari Owner hanya sementara. Buat password Anda sendiri untuk melanjutkan.`:`Akun ${hkEsc(u.email)}`}</div>
      ${wajib?'':pwInput('hkPwLama','Password sekarang',D.lama)}
      ${pwInput('hkPwBaru','Password baru',D.baru,'Minimal 8 karakter, huruf dan angka')}
      ${pwInput('hkPwUlang','Ulangi password baru',D.ulang)}
      ${err}<button class="btn btn-primary" style="width:100%;padding:11px;margin-top:4px;" data-hk-pw-simpan>${wajib?'Simpan dan masuk':'Simpan password'}</button>
      <div style="text-align:center;margin-top:12px;"><span class="hk-row-link hk-sub" data-hk-pw-batal>${wajib?'Keluar':'Batal'}</span></div></div>`;
    const f=document.getElementById(wajib?'hkPwBaru':'hkPwLama'); if(f&&!document.activeElement.closest('#hkDashLogin')) f.focus(); return; }
  loginRoot.innerHTML=`<div class="hk-login">${brand}
    <div class="hk-login-judul">Masuk</div>
    <div class="hk-lf"><label for="hkDashEmail">Email</label><input type="email" id="hkDashEmail" value="${hkEsc(D.email)}" placeholder="nama@hikayat.id" autocomplete="username"></div>
    ${pwInput('hkDashPw','Password',D.pw)}
    ${err}<button class="btn btn-primary" style="width:100%;padding:11px;margin-top:4px;" data-hk-login-ok>Masuk</button>
    <div class="hk-sub" style="margin-top:14px;">Akun dibuat oleh Owner di menu Karyawan. Lupa password? Minta Owner meresetnya. Kasir tidak masuk dashboard, cukup PIN di POS.</div>
    <div class="hk-sub" style="margin-top:8px;padding:8px 10px;background:var(--bg);border-radius:8px;">Demo: rina@hikayat.id (Owner), dimas@hikayat.id, budi@hikayat.id, password <b>hikayat123</b>. Karyawan baru: laila@hikayat.id, password sementara <b>sementara1</b>.</div></div>`;
  const f=document.getElementById(D.email?'hkDashPw':'hkDashEmail'); if(f&&!document.activeElement.closest('#hkDashLogin')) f.focus();
}
function cobaLogin(){
  const D=dashLogin, email=D.email.trim().toLowerCase(), st=state.staff.find(x=>(x.email||'').toLowerCase()===email);
  if(!email||!D.pw){ D.err='Isi email dan password'; renderLogin(); return; }
  if(!st||!hkCekPw(st,D.pw)){ D.err='Email atau password salah'; D.pw=''; renderLogin(); return; }
  if(st.aktif===false){ D.err='Akun ini sudah dinonaktifkan. Hubungi Owner.'; D.pw=''; renderLogin(); return; }
  if(!hkAksesDashboard(st)){ D.err='Akun ini hanya untuk POS'; D.pw=''; renderLogin(); return; }
  localStorage.setItem(DASH_KEY, JSON.stringify({nama:st.nama, email:st.email, waktu:hkIso(new Date())}));
  dashLogin={email:'', pw:'', err:'', ganti:false, lama:'', baru:'', ulang:''};
  if(st.pwBaru){ renderLogin(); return; }
  render(); toast(`Masuk sebagai ${st.nama}`);
}
function simpanPwBaru(){
  const D=dashLogin, st=akunLogin(), wajib=st&&st.pwBaru;
  if(!st){ D.ganti=false; renderLogin(); return; }
  if(!wajib&&!hkCekPw(st,D.lama)){ D.err='Password sekarang salah'; renderLogin(); return; }
  const lemah=hkPwLemah(D.baru); if(lemah){ D.err=lemah; renderLogin(); return; }
  if(D.baru!==D.ulang){ D.err='Ulangi password baru belum sama'; renderLogin(); return; }
  if(hkCekPw(st,D.baru)){ D.err='Password baru tidak boleh sama dengan yang lama'; renderLogin(); return; }
  st.pw=hkHashPw(D.baru); st.pwBaru=false; st.pwDiganti=hkIso(new Date()); hkSaveAll(data());
  dashLogin={email:'', pw:'', err:'', ganti:false, lama:'', baru:'', ulang:''};
  render(); toast(wajib?`Password tersimpan. Selamat datang, ${st.nama}`:'Password berhasil diganti');
}
loginRoot.addEventListener('click', e=>{
  const l=e.target.closest('[data-hk-lihat]'); if(l){ const i=document.getElementById(l.getAttribute('data-hk-lihat')); i.type=i.type==='password'?'text':'password'; l.textContent=i.type==='password'?'Lihat':'Sembunyikan'; return; }
  if(e.target.closest('[data-hk-login-ok]')) cobaLogin();
  if(e.target.closest('[data-hk-pw-simpan]')) simpanPwBaru();
  if(e.target.closest('[data-hk-pw-batal]')){ if(akunLogin()&&akunLogin().pwBaru) localStorage.removeItem(DASH_KEY); dashLogin={email:'', pw:'', err:'', ganti:false, lama:'', baru:'', ulang:''}; render(); }
});
loginRoot.addEventListener('input', e=>{ const m={hkDashEmail:'email', hkDashPw:'pw', hkPwLama:'lama', hkPwBaru:'baru', hkPwUlang:'ulang'}[e.target.id]; if(m){ dashLogin[m]=e.target.value; if(dashLogin.err){ dashLogin.err=''; const x=loginRoot.querySelector('.hk-login-err'); if(x) x.remove(); } } });
loginRoot.addEventListener('keydown', e=>{ if(e.key!=='Enter') return; if(loginRoot.querySelector('[data-hk-login-ok]')) cobaLogin(); else if(loginRoot.querySelector('[data-hk-pw-simpan]')) simpanPwBaru(); });
function renderAkun(){
  const a=akun(), box=document.querySelector('.user-box'); if(!box) return;
  box.querySelector('.avatar').textContent=a?a.nama.split(' ').map(w=>w[0]).slice(0,2).join(''):'?';
  box.querySelector('.who .name').textContent=a?a.nama:'Belum masuk';
  box.querySelector('.who .sub').textContent=a?`${a.role.filter(r=>r!=='Kasir').join(', ')} · Hikayat Merchandise`:'';
  let menu=document.getElementById('hkAkunMenu');
  if(!menu){ box.style.position='relative'; box.insertAdjacentHTML('beforeend','<div class="kebab-menu" id="hkAkunMenu" style="right:0;top:42px;width:170px;"><div class="mi" data-hk-act="dash-gantipw">Ganti password</div><div class="mi" data-hk-act="dash-logout">Keluar</div></div>'); box.querySelector('.kebab').setAttribute('data-hk-act','akun-menu'); }
}

/* ── helper ── */
const $=id=>document.getElementById(id);
const cat=()=>hkCatalog(state.products);
const evById=id=>state.events.find(e=>e.id===id);
function statusBadge(st){
  const cls={'Berlangsung':'badge-success','Akan Datang':'badge-info','Perlu Ditutup':'badge-warn','Selesai':'badge-mut'}[st]||'badge-mut';
  return `<span class="badge ${cls}">${st}</span>`;
}
function tglRange(a,b){ return a===b?hkTgl(a):`${hkTgl(a)} – ${hkTgl(b)}`.replace(' – ',' s/d '); }
function evSales(ev){ return hkSales(data()).filter(s=>s.eventId===ev.id); }
function lokasiTerpilih(){ return state.outletMode==='single'?state.outlet:null; }
function filterLokasi(list){
  const l=lokasiTerpilih(); if(!l) return list;
  if(l===HK_GUDANG) return list.filter(s=>s.jenis==='Online'||s.saluran===HK_GUDANG);
  return list.filter(s=>s.saluran===l);
}
function download(name, rows){
  const csv=rows.map(r=>r.map(c=>{ const s=String(c==null?'':c); return /[",\n;]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }).join(',')).join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv'})); a.download=name; a.click();
}

/* ════════ DASHBOARD (angka dihitung dari transaksi) ════════ */
function periodeRange(){
  const {periode,refDate}=state.dashboard; const d=new Date(refDate);
  if(periode==='Harian') return [hkYmd(d),hkYmd(d)];
  if(periode==='Mingguan'){ const day=d.getDay()||7; const s=hkAddDays(d,1-day); return [hkYmd(s),hkYmd(hkAddDays(s,6))]; }
  return [hkYmd(new Date(d.getFullYear(),d.getMonth(),1)), hkYmd(new Date(d.getFullYear(),d.getMonth()+1,0))];
}
function bars(map, fmtV){
  const items=[...map.entries()].map(([nama,v])=>({nama,v})).sort((a,b)=>b.v-a.v).slice(0,6);
  return items.length?statBarsHTML(items,{valueKey:'v',valueFmt:fmtV}):`<div class="hk-empty" style="padding:16px;">Belum ada data di periode ini</div>`;
}
function liveEventsHTML(){
  const live=state.events.filter(e=>['Berlangsung','Perlu Ditutup'].includes(hkStatusEvent(e)));
  if(!live.length) return '';
  const today=hkYmd(new Date());
  return `<div class="hk-live">${live.map(e=>{
    const s=evSales(e), sToday=s.filter(x=>x.waktu.slice(0,10)===today);
    const buka=state.posShift.filter(x=>x.eventId===e.id&&!x.tutup);
    const st=hkStatusEvent(e);
    return `<div class="card" data-hk-act="ev-open" data-hk-arg="${e.id}">
      <div style="display:flex;align-items:center;gap:8px;"><span class="hk-dot" style="${st==='Perlu Ditutup'?'background:#E0A100;box-shadow:0 0 0 3px #FCEFC7;':''}"></span><span class="t">${hkEsc(e.nama)}</span><div class="spacer"></div>${statusBadge(st)}</div>
      <div class="hk-sub">${hkEsc(e.venue)} · ${tglRange(e.mulai,e.selesai)}</div>
      <div class="nums"><div><span class="hk-sub">Hari ini</span><b>${hkRp(hkSum(sToday,'kotor'))}</b></div><div><span class="hk-sub">Total event</span><b>${hkRp(hkSum(s,'kotor'))}</b></div><div><span class="hk-sub">Shift terbuka</span><b>${buka.length?buka.map(b=>b.kasir.split(' ')[0]).join(', '):'–'}</b></div></div>
    </div>`; }).join('')}</div>`;
}
viewDashboard=function(){
  const d=state.dashboard; const [dari,sampai]=periodeRange();
  const S=filterLokasi(hkSales(data(),dari,sampai));
  const off=S.filter(s=>s.jenis==='Offline'), on=S.filter(s=>s.jenis==='Online');
  const kotor=hkSum(S,'kotor'), nTrx=S.filter(x=>!x.retur).length, qty=hkSum(S,'qty'), laba=hkSum(S,'laba');
  const metode=new Map(), saluran=new Map(), kategori=new Map(), produk=new Map(), kasir=new Map();
  off.forEach(s=>s.bayar.forEach(b=>metode.set(b.metode,(metode.get(b.metode)||0)+b.jumlah)));
  S.forEach(s=>{ saluran.set(s.saluran,(saluran.get(s.saluran)||0)+s.kotor);
    s.items.forEach(i=>{ kategori.set(i.kategori,(kategori.get(i.kategori)||0)+i.qty*i.harga); const c=cat().find(x=>x.sku===i.sku); const n=c?c.produk:i.nama; produk.set(n,(produk.get(n)||0)+i.qty); }); });
  off.forEach(s=>kasir.set(s.kasir,(kasir.get(s.kasir)||0)+s.kotor));
  const totKat=[...kategori.values()].reduce((a,b)=>a+b,0)||1;
  kategori.forEach((v,k)=>kategori.set(k,Math.round(v/totKat*100)));
  const minim=state.stokItems.filter(it=>it.jenis==='Produk').map(it=>{ const p=state.products.find(x=>x.sku===it.parent||x.sku===it.sku); return {it, min:p?(p.stokMin||0):0, aktif:p&&p.status==='Aktif'}; })
    .filter(x=>x.aktif&&x.it.akhir<=x.min).sort((a,b)=>a.it.akhir-b.it.akhir).slice(0,6);
  const lok=lokasiTerpilih();
  return `<div class="page-head"><span class="page-title">Dashboard Penjualan</span></div>
    <div class="page-sub">Diperbarui ${formatTimestampID(new Date())}${lok?` · Lokasi: <b>${hkEsc(lok)}</b>${lok===HK_GUDANG?' (pesanan online + jual langsung)':''}`:' · Semua lokasi dan saluran'}</div>
    <div class="filter-row">
      <div class="tabs" style="margin-bottom:0;">${['Harian','Mingguan','Bulanan'].map(p=>`<div class="tab ${d.periode===p?'active':''}" data-dash-period="${p}">${p}</div>`).join('')}</div>
      <div class="period-nav"><div class="nav-btn" data-dash-nav="-1">‹</div><div class="label">${getPeriodLabel()}</div><div class="nav-btn" data-dash-nav="1">›</div></div>
      <div class="spacer"></div><button class="btn" data-nav="lap-saluran">Buka laporan lengkap →</button>
    </div>
    <div class="summary-banner">
      <div class="summary-total"><div class="lbl">Total Penjualan</div><div class="val">${hkRp(kotor)}</div><div class="sub">Offline (event) + online (marketplace), sebelum potongan</div></div>
      <div class="summary-mini-wrap">
        <div class="summary-mini"><div class="lbl">Transaksi</div><div class="val">${nTrx}</div></div>
        <div class="summary-mini"><div class="lbl">Rata-rata per Transaksi</div><div class="val">${hkRp(nTrx?kotor/nTrx:0)}</div></div>
        <div class="summary-mini"><div class="lbl">Produk Terjual</div><div class="val">${qty} pcs</div></div>
        <div class="summary-mini"><div class="lbl">Laba Kotor</div><div class="val">${hkRp(laba)}</div></div>
      </div>
    </div>
    <div class="grid-4" style="margin-bottom:14px;">
      <div class="metric-card"><div class="metric-label">Penjualan Offline (Event)</div><div class="metric-value">${hkRp(hkSum(off,'kotor'))}</div><div class="hk-sub">${off.length} transaksi POS</div></div>
      <div class="metric-card"><div class="metric-label">Penjualan Online</div><div class="metric-value">${hkRp(hkSum(on,'kotor'))}</div><div class="hk-sub">${on.length} pesanan marketplace</div></div>
      <div class="metric-card"><div class="metric-label">Potongan Marketplace</div><div class="metric-value" style="color:var(--danger-text);">${hkRp(hkSum(on,'potongan'))}</div><div class="hk-sub">Admin, layanan, dan biaya pesanan</div></div>
      <div class="metric-card"><div class="metric-label">Belum Cair dari Marketplace</div><div class="metric-value">${hkRp(hkSum(on.filter(s=>!s.terbayar),'bersih'))}</div><div class="hk-sub">Pesanan berstatus Diproses</div></div>
    </div>
    <div class="grid-3">
      <div class="card"><div class="widget-title">Metode Pembayaran (POS)</div>${bars(metode,hkRp)}</div>
      <div class="card"><div class="widget-title">Penjualan per Saluran</div>${bars(saluran,hkRp)}</div>
      <div class="card"><div class="widget-title">Penjualan per Kategori</div>${bars(kategori,v=>v+'%')}</div>
      <div class="card"><div class="widget-title">Produk Terlaris</div>${bars(produk,v=>v+' pcs')}</div>
      <div class="card"><div class="widget-title">Penjualan per Kasir</div>${bars(kasir,hkRp)}</div>
      <div class="card"><div class="widget-title">Stok Menipis (semua lokasi)</div>${minim.length?`<div class="stat-bars">${minim.map(x=>`<div style="display:flex;justify-content:space-between;font-size:12px;"><span>${hkEsc(x.it.nama)}</span><b style="color:var(--danger-text);">${x.it.akhir} / min ${x.min}</b></div>`).join('')}</div>`:`<div class="hk-empty" style="padding:16px;">Semua stok di atas batas minimum</div>`}</div>
    </div>`;
};
const _getPeriodLabel=getPeriodLabel;
getPeriodLabel=function(){ return state.dashboard.periode==='Bulanan'?`${INDO_MONTHS[state.dashboard.refDate.getMonth()]} ${state.dashboard.refDate.getFullYear()}`:_getPeriodLabel(); };

/* ════════ EVENT ════════ */
function viewEventList(){
  const tabs=['Semua','Berlangsung','Akan Datang','Perlu Ditutup','Selesai'];
  const all=[...state.events].sort((a,b)=>b.mulai.localeCompare(a.mulai));
  const list=all.filter(e=>state.hk.evTab==='Semua'||hkStatusEvent(e)===state.hk.evTab);
  const rows=list.map(e=>{ const s=evSales(e); return `<tr class="hk-row-link" data-hk-act="ev-open" data-hk-arg="${e.id}">
    <td><b>${hkEsc(e.nama)}</b><div class="hk-sub">${hkEsc(e.venue)}</div></td>
    <td>${tglRange(e.mulai,e.selesai)}</td><td>${statusBadge(hkStatusEvent(e))}</td>
    <td>${e.pj?hkEsc(e.pj):'<span class="hk-sub">Belum ada</span>'}</td>
    <td>${e.kasir.map(k=>`<span class="badge badge-role">${hkEsc(k.split(' ')[0])}</span>`).join('')||'<span class="hk-sub">Belum ada</span>'}</td>
    <td class="hk-num">${s.length}</td><td class="hk-num">${hkRp(hkSum(s,'kotor'))}</td><td class="hk-num">›</td></tr>`; }).join('');
  return `<div class="page-head"><span class="page-title">Event</span><span class="help-icon" title="Setiap event adalah lokasi jualan sementara dengan stok, kasir, dan laporan sendiri.">?</span><div class="spacer"></div><button class="btn btn-primary" data-hk-act="ev-new">+ Buat Event</button></div>
  <div class="page-sub">Event menggantikan konsep outlet tetap. Stok dikirim dari ${HK_GUDANG} sebelum event, lalu sisanya ditarik kembali saat event ditutup.</div>
  ${liveEventsHTML()}
  <div class="tabs">${tabs.map(t=>`<div class="tab ${state.hk.evTab===t?'active':''}" data-hk-act="ev-tab" data-hk-arg="${t}">${t} <span class="hk-sub">${t==='Semua'?all.length:all.filter(e=>hkStatusEvent(e)===t).length}</span></div>`).join('')}</div>
  <div class="card" style="padding:0;overflow:hidden;"><table><thead><tr><th>Event</th><th>Tanggal</th><th>Status</th><th>Penanggung jawab</th><th>Kasir</th><th class="hk-num">Transaksi</th><th class="hk-num">Penjualan</th><th></th></tr></thead>
  <tbody>${rows||`<tr><td colspan="8" class="hk-empty">Tidak ada event di tab ini</td></tr>`}</tbody></table></div>`;
}
function evMenungguPS(id){ return state.posTrx.filter(t=>t.eventId===id&&t.pengambilan&&t.pengambilan.status==='Menunggu'&&t.status==='Lunas').length; }
/* produk yang dijual: tabel per varian, ditambah lewat halaman "+ Produk" */
const evCatAktif=()=>hkCatalog(state.products.filter(p=>p.status==='Aktif'&&p.tampilPos!==false));
function evVarianAwal(f){ if(Array.isArray(f.varian)) return; const c=evCatAktif(); f.varian=Array.isArray(f.produk)?c.filter(x=>f.produk.includes(x.parent)).map(x=>x.sku):[]; }
function evProdukForm(f){
  f.kirim=f.kirim||{}; f.harga={...(f.harga||{})}; evVarianAwal(f);
  const cat=evCatAktif(), rows=cat.filter(c=>f.varian.includes(c.sku)), totKirim=rows.reduce((a,c)=>a+(+f.kirim[c.sku]||0),0), gd=sku=>hkStokDi(state.stokItems,sku,HK_GUDANG);
  return `<div class="form-section-title">Produk yang Dijual</div>
    <div class="help-text">Hanya varian di tabel ini yang tampil di POS event. Harga event boleh kosong (memakai harga normal). Stok dikirim setelah event disimpan, lewat tombol Kirim Stok di halaman event.</div>
    <div class="card" style="padding:0;overflow:auto;margin-top:8px;"><table class="hk-varian hk-evtabel"><thead><tr><th>Nama Produk</th><th>Varian</th><th class="hk-num">Harga Normal</th><th class="hk-num">Stok ${HK_GUDANG}</th>${f.id?'<th class="hk-num">Di event</th>':''}<th class="hk-num">Harga Event</th><th></th></tr></thead><tbody>
    ${rows.map(c=>`<tr><td><b>${hkEsc(c.produk)}</b><div class="hk-sub">${c.sku}</div></td><td>${hkEsc(c.varNama||'Tanpa varian')}</td><td class="hk-num">${hkRp(c.harga)}</td><td class="hk-num">${gd(c.sku)}</td>${f.id?`<td class="hk-num">${hkStokDi(state.stokItems,c.sku,f.nama)}</td>`:''}
      <td class="hk-num"><input type="number" min="0" style="width:110px;text-align:right;" data-hk-bind="hk.evForm.harga.${c.sku}" value="${hkEsc(f.harga[c.sku]||'')}" placeholder="${c.harga}"></td>
      <td class="hk-num"><span class="hk-row-link" style="color:var(--danger-text);" title="Hapus dari event" data-hk-act="ev-var-hapus" data-hk-arg="${c.sku}">✕</span></td></tr>`).join('')}
    <tr><td colspan="${f.id?7:6}" style="padding:8px;"><button class="btn hk-evtambah" style="width:100%;border-style:dashed;" data-hk-act="evp-buka">+ Produk</button></td></tr></tbody></table></div>
    <div class="hk-sub" id="hkEvProdSum" style="margin:6px 0 4px;">${rows.length} varian dari ${new Set(rows.map(c=>c.parent)).size} produk</div>`;
}
/* ── pemilih produk umum: tabel + tombol "+ Produk" membuka halaman ini. Dipakai di form event, kirim/tarik stok, pesanan manual, dan promo ── */
const gdStok=sku=>hkStokDi(state.stokItems,sku,HK_GUDANG);
function pilihDef(M){
  const varRow=(c,extra)=>({key:c.sku, cari:(c.nama+' '+c.sku).toLowerCase(), cells:[`<b>${hkEsc(c.produk)}</b><div class="hk-sub">${c.sku}</div>`, hkEsc(c.varNama||'Tanpa varian'), ...extra]});
  if(M.ctx==='event'){ const f=state.hk.evForm;
    return {judul:`Pilih produk untuk ${hkEsc(f.nama||'event baru')}`, cols:['Nama Produk','Varian','Harga Normal',`Stok ${HK_GUDANG}`], help:'Centang varian yang dijual, lalu Simpan. Jumlah kirim dan harga event diisi di tabel form event.',
      rows:evCatAktif().map(c=>varRow(c,[hkRp(c.harga), gdStok(c.sku)])),
      simpan:keys=>{ const cat=evCatAktif(); f.varian=cat.filter(c=>keys.includes(c.sku)).map(c=>c.sku); f.produk=[...new Set(cat.filter(c=>keys.includes(c.sku)).map(c=>c.parent))];
        ['kirim','harga'].forEach(k=>Object.keys(f[k]).forEach(sku=>{ if(!f.varian.includes(sku)) delete f[k][sku]; })); } }; }
  if(M.ctx==='alok'){ const A=M.prev, e=evById(state.hk.evId), kirim=A.mode==='kirim', dEv=sku=>hkStokDi(state.stokItems,sku,e.nama);
    const L=kirim?evCatAktif().filter(c=>!Array.isArray(e.varian)?(!e.produk||e.produk.includes(c.parent)):e.varian.includes(c.sku)):cat().filter(c=>dEv(c.sku)>0).map(c=>({...c, produk:c.produk||c.nama}));
    return {judul:kirim?`Pilih barang yang dikirim ke ${hkEsc(e.nama)}`:`Pilih barang yang ditarik ke ${HK_GUDANG}`, cols:['Nama Produk','Varian',`Stok ${HK_GUDANG}`,'Di event'],
      help:kirim?'Hanya varian yang dijual di event ini. Tambah varian lain lewat Ubah Event.':'Hanya barang yang masih ada stoknya di event.',
      rows:L.map(c=>varRow(c,[gdStok(c.sku), dEv(c.sku)])),
      simpan:keys=>{ A.pilih=keys; Object.keys(A.qty).forEach(sku=>{ if(!keys.includes(sku)) delete A.qty[sku]; }); } }; }
  if(M.ctx==='order'){ const f=state.po.form, out=state.po.form.outlet||HK_GUDANG, L=evCatAktif().filter(c=>hkDiSaluran(f.saluran,c.sku)), harga=sku=>window.hkPOImpor.hargaSaluran(f.saluran,sku);
    return {judul:`Pilih produk pesanan ${hkEsc(f.saluran)}`, cols:['Nama Produk','Varian',`Harga ${hkEsc(f.saluran)}`,`Stok ${hkEsc(out)}`], help:`Hanya produk yang aktif di ${hkEsc(f.saluran)}. Jumlah dan harga diisi di tabel pesanan.`,
      rows:L.map(c=>varRow(c,[hkRp(harga(c.sku)), hkStokDi(state.stokItems,c.sku,out)])),
      simpan:keys=>{ const lama=f.items.filter(i=>i.sku&&keys.includes(i.sku)); keys.filter(k=>!lama.some(i=>i.sku===k)).forEach(k=>lama.push({sku:k, qty:1, harga:harga(k)})); f.items=lama; } }; }
  if(M.ctx==='promo'){ const f=state[M.form], tunggal=M.key==='bonusProduk', prods=state.products.filter(p=>p.status==='Aktif'&&p.tampilPos!==false);
    return {judul:tunggal?'Pilih produk bonus':'Pilih produk promo', tunggal, cols:['Nama Produk','Kategori','Varian','Harga Normal'], help:tunggal?'Pilih satu produk bonus. Ukurannya dipilih kasir di POS.':'Promo berlaku untuk semua varian produk yang dipilih.',
      rows:prods.map(p=>{ const vs=hkCatalog([p]), h=vs.map(v=>v.harga); return {key:p.nama, cari:(p.nama+' '+p.sku).toLowerCase(), cells:[`<b>${hkEsc(p.nama)}</b><div class="hk-sub">${p.sku}</div>`, hkEsc(p.kategori), vs.length>1?vs.map(v=>hkEsc(v.varNama)).join(', '):'Tanpa varian', Math.min(...h)===Math.max(...h)?hkRp(h[0]):`${hkRp(Math.min(...h))} – ${hkRp(Math.max(...h))}`]}; }),
      simpan:keys=>{ f[M.key]=keys; } }; }
}
function pilihModal(){
  const M=state.hk.modal, D=pilihDef(M), q=(M.cari||'').toLowerCase(), L=D.rows.filter(r=>!q||r.cari.includes(q)), n=Object.values(M.sel).filter(Boolean).length, semua=L.length&&L.every(r=>M.sel[r.key]);
  return `<div class="confirm-box hk-modal hk-page"><div class="hk-mh"><span class="close" data-hk-act="pil-batal">✕</span><h4>${D.judul}</h4></div><div class="hk-mb">
    <div class="toolbar"><input class="search-input" placeholder="Cari nama produk atau SKU..." value="${hkEsc(M.cari||'')}" data-hk-bind="hk.modal.cari" data-hk-live="1"></div>
    <div class="card" style="padding:0;overflow:auto;"><table class="hk-varian hk-pilih"><thead><tr><th style="width:36px;">${D.tunggal?'':`<input type="checkbox" ${semua?'checked':''} data-hk-act="pil-semua" title="Pilih semua yang tampil">`}</th>${D.cols.map((c,i)=>`<th class="${i>=2?'hk-num':''}">${c}</th>`).join('')}</tr></thead><tbody>
    ${L.map(r=>`<tr class="${M.sel[r.key]?'hk-row-on':''}"><td><input type="${D.tunggal?'radio':'checkbox'}" ${M.sel[r.key]?'checked':''} data-hk-act="pil-cek" data-hk-arg="${hkEsc(r.key)}"></td>${r.cells.map((c,i)=>`<td class="${i>=2?'hk-num':''}" ${i<2?`data-hk-act="pil-cek" data-hk-arg="${hkEsc(r.key)}" style="cursor:pointer;"`:''}>${c}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${D.cols.length+1}" class="hk-empty">Produk tidak ditemukan</td></tr>`}
    </tbody></table></div>
    <div class="hk-sub" style="margin-top:6px;">${D.help}</div>
  </div><div class="hk-mf"><span class="hk-sub">${n} dipilih</span><div class="spacer"></div><button class="btn" data-hk-act="pil-batal">Batal</button><button class="btn btn-primary" data-hk-act="pil-simpan">Simpan</button></div></div>`;
}
/* tabel produk promo (pengganti chip pilihan produk) */
window.hkProdukTabel=(f,key,rmAttr)=>{ const form=f===state.promoTotalForm?'promoTotalForm':'promoProdukForm', sel=f[key]||[];
  const rows=sel.map(nama=>{ const p=state.products.find(x=>x.nama===nama); const vs=p?hkCatalog([p]):[];
    return `<tr><td><b>${hkEsc(nama)}</b>${p?`<div class="hk-sub">${p.sku}</div>`:''}</td><td>${p?hkEsc(p.kategori):'-'}</td><td>${vs.length>1?vs.map(v=>hkEsc(v.varNama)).join(', '):'Tanpa varian'}</td><td class="hk-num"><span class="hk-row-link" style="color:var(--danger-text);" title="Hapus" data-${rmAttr}="${hkEsc(nama)}">✕</span></td></tr>`; }).join('');
  return `<div class="card" style="padding:0;overflow:auto;"><table class="hk-varian"><thead><tr><th>Nama Produk</th><th>Kategori</th><th>Varian</th><th></th></tr></thead><tbody>${rows}
    <tr><td colspan="4" style="padding:8px;"><button type="button" class="btn" style="width:100%;border-style:dashed;" data-hk-act="pil-buka" data-hk-arg="promo|${form}|${key}">+ Produk</button></td></tr></tbody></table></div>`; };
function viewEventForm(){
  const f=state.hk.evForm; if(!f) return viewEventList();
  const kasirOpts=state.staff.filter(s=>s.aktif!==false&&s.role.some(r=>['Kasir','Admin','Owner'].includes(r)));
  return `${backButtonHTML()}<div class="page-head"><span class="page-title">${f.id?'Ubah Event':'Buat Event'}</span></div>
  <div class="card" style="max-width:760px;margin:0 auto;">
    <div class="form-section-title">Informasi Event</div>
    <div class="field"><label>Nama Event<span class="req">*</span></label><input data-hk-bind="hk.evForm.nama" value="${hkEsc(f.nama)}" placeholder="Contoh: Hikayat Fest Bandung"></div>
    <div class="field"><label>Tempat</label><input data-hk-bind="hk.evForm.venue" value="${hkEsc(f.venue)}" placeholder="Contoh: Sabuga ITB, Bandung"></div>
    <div class="row-2"><div class="field"><label>Tanggal Mulai<span class="req">*</span></label><input type="date" data-hk-bind="hk.evForm.mulai" value="${f.mulai}"></div>
      <div class="field"><label>Tanggal Selesai<span class="req">*</span></label><input type="date" data-hk-bind="hk.evForm.selesai" value="${f.selesai}"></div></div>
    <div class="field"><label>Catatan</label><input data-hk-bind="hk.evForm.catatan" value="${hkEsc(f.catatan)}" placeholder="Nomor booth, PIC panitia, dsb."></div>
    <div class="form-section-title">Pre-sale (sebelum event dimulai)</div>
    <div class="toggle-row">${tg('hk.evForm.presaleAktif', f.presaleAktif)}<span>${f.presaleAktif?'Pre-sale aktif':'Pre-sale nonaktif'}</span></div>
    <div class="help-text">${f.presaleAktif?'Owner bisa berjualan di event ini sebelum tanggal mulai.':'Event baru bisa dijual di POS mulai tanggal mulai.'}${!f.presaleAktif&&f.id&&evMenungguPS(f.id)?` Masih ada ${evMenungguPS(f.id)} pesanan pre-sale yang menunggu diambil; pesanan itu tetap bisa diserahkan.`:''}</div>
    ${f.presaleAktif?`<div class="row-2">${[['ambil','Pesanan diambil nanti','Stok tidak berkurang saat transaksi. Barang diserahkan di booth saat event, baru stok berkurang.'],['stok','Kurangi stok saat transaksi','Barang langsung diserahkan. Stok event harus sudah dikirim dan diterima.']].map(([k,l,d])=>`<div class="hk-check ${f.presale===k?'on':''}" data-hk-act="ev-presale" data-hk-arg="${k}"><input type="radio" ${f.presale===k?'checked':''} style="pointer-events:none;"><div><b>${l}</b><div class="hk-sub">${d}</div></div></div>`).join('')}</div>`:''}
    ${evProdukForm(f)}
    <div class="form-section-title">Kasir yang Bertugas</div>
    <div class="help-text">Hanya kasir yang dipilih yang bisa membuka shift untuk event ini di POS.</div>
    <div class="grid-3">${kasirOpts.map(s=>{ const on=f.kasir.includes(s.nama); return `<div class="hk-check ${on?'on':''}" data-hk-act="ev-kasir" data-hk-arg="${hkEsc(s.nama)}"><input type="checkbox" ${on?'checked':''} style="pointer-events:none;"><div><b>${hkEsc(s.nama)}</b><div class="hk-sub">${s.role.join(', ')}</div></div></div>`; }).join('')}</div>
    <div class="form-section-title">Penanggung Jawab Event<span class="req">*</span></div>
    <div class="help-text">Satu orang yang bertanggung jawab atas stok dan barang di event ini. Namanya otomatis jadi penanggung jawab awal kalau ada selisih stok saat opname atau Tutup Event (masih bisa diganti saat itu).</div>
    <div style="margin-top:8px;max-width:420px;"><select class="hk-sel" style="width:100%;padding:9px 10px;border:1px solid var(--border-strong);border-radius:8px;font-size:13px;" data-hk-bind="hk.evForm.pj"><option value="">Pilih penanggung jawab</option>${state.staff.filter(x=>x.aktif!==false).map(x=>`<option ${f.pj===x.nama?'selected':''} value="${hkEsc(x.nama)}">${hkEsc(x.nama)} · ${x.role.join(', ')}</option>`).join('')}</select></div>
    <div class="form-actions"><button class="btn" data-nav="${f.id?'event-detail':'event'}">Batal</button><div class="spacer"></div><button class="btn btn-primary" data-hk-act="ev-save">${f.id?'Simpan Perubahan':'Buat Event'}</button></div>
  </div>`;
}
function viewEventDetail(){
  const e=evById(state.hk.evId); if(!e) return viewEventList();
  const st=hkStatusEvent(e), s=evSales(e), kotor=hkSum(s,'kotor');
  const trx=state.posTrx.filter(t=>t.eventId===e.id).sort((a,b)=>b.waktu.localeCompare(a.waktu));
  const shifts=state.posShift.filter(x=>x.eventId===e.id).sort((a,b)=>b.buka.localeCompare(a.buka));
  const metode=new Map(); s.forEach(x=>x.bayar.forEach(b=>metode.set(b.metode,(metode.get(b.metode)||0)+b.jumlah)));
  const stokRows=cat().map(c=>{ const it=hkStokRow(state.stokItems,c.sku); const p=it&&it.perOutlet.find(x=>x.outlet===e.nama); return p?{c,p}:null; }).filter(Boolean);
  const kembali=e.tutup&&e.tutup.kembali||{};
  const shiftRow=x=>{
    const K=hkShiftKas(data(),x), tunai=K.tunai, harus=K.harus, sel=K.selisih, kasNet=K.masuk-K.keluar;
    return `<tr><td>${hkEsc(x.kasir)}</td><td>${hkTgl(x.buka)}, ${hkJam(x.buka)}</td><td>${x.tutup?hkJam(x.tutup)+(x.ditutupOleh&&x.ditutupOleh!==x.kasir?`<div class="hk-sub">ditutup ${hkEsc(x.ditutupOleh)}</div>`:''):'<span class="badge badge-success">Terbuka</span>'}</td>
      <td class="hk-num">${hkRp(x.modal)}</td><td class="hk-num">${hkRp(tunai)}</td><td class="hk-num" title="${hkEsc((x.kas||[]).map(k=>`${k.jenis==='masuk'?'+':'-'}${hkRp(k.jumlah)} ${k.nama}`).join('\n'))}">${kasNet?(kasNet>0?'+':'')+hkRp(kasNet):'–'}</td><td class="hk-num">${hkRp(harus)}</td>
      <td class="hk-num">${x.tutup?hkRp(x.kasHitung):'–'}</td><td class="hk-num" style="font-weight:700;color:${sel?'var(--danger-text)':'var(--success-text)'};">${sel==null?'–':(sel===0?'Pas':(sel>0?'+':'')+hkRp(sel))}</td>
      <td>${x.catatan?`<span class="hk-sub">${hkEsc(x.catatan)}</span>`:''}${x.kasKurang?`<div class="hk-sub" style="color:var(--danger-text);">PJ ${hkEsc(x.kasKurang.pj)}: ${hkEsc(x.kasKurang.alasan)} · ${hkEsc(x.kasKurang.status)}</div>`:''}</td></tr>`;
  };
  return `<div class="back-btn" data-nav="event"><span class="arrow">←</span> Semua Event</div>
  <div class="page-head"><span class="page-title">${hkEsc(e.nama)}</span>${statusBadge(st)}<div class="spacer"></div>
    ${akun()&&akun().role.includes('Owner')?`<button class="btn" data-ku="ev-lap" data-ku-arg="${e.id}">Laporan Keuangan</button>`:''}${e.ditutup?'':`<button class="btn" data-hk-act="ev-edit">Ubah</button><button class="btn" data-hk-act="alok-open" data-hk-arg="kirim">Kirim Stok</button><button class="btn" data-hk-act="alok-open" data-hk-arg="tarik">Tarik ke Gudang</button><button class="btn btn-primary" data-hk-act="tutup-open">Tutup Event</button>`}</div>
  <div class="page-sub">${e.venue?hkEsc(e.venue)+' · ':''}${tglRange(e.mulai,e.selesai)}${e.catatan?` · ${hkEsc(e.catatan)}`:''} · Penanggung jawab: <b>${hkEsc(e.pj||'-')}</b> · Kasir: ${e.kasir.map(hkEsc).join(', ')||'-'} · Pre-sale: ${e.presaleAktif===false?'nonaktif':e.presale==='stok'?'aktif, kurangi stok saat transaksi':'aktif, pesanan diambil nanti'} · Produk: ${e.produk?`${e.produk.length} dipilih`:'semua produk'}</div>
  ${(()=>{ const ps=hkPreSaleMenunggu(data(),e.id); return ps.length?`<div class="hk-note">${ps.length} pesanan pre-sale (${ps.reduce((a,t)=>a+t.items.reduce((x,i)=>x+i.qty,0),0)} pcs) belum diambil pembeli. Pastikan stoknya ikut dikirim ke event. Kasir menyerahkan barang lewat POS › Penjualan › Pre-sale. <span class="hk-row-link" style="font-weight:700;text-decoration:underline;" data-hk-act="ps-buka" data-hk-arg="${e.id}">Lihat daftar pembeli</span></div>`:''; })()}
  ${!e.ditutup&&!state.mutasi.some(m=>m.eventId===e.id)&&!cat().some(c=>hkStokDi(state.stokItems,c.sku,e.nama)>0)?`<div class="hk-note" style="display:flex;align-items:center;gap:10px;cursor:default;"><div style="flex:1;">Belum ada stok di event ini. Kirim barang dari ${HK_GUDANG}, lalu kasir menerimanya di POS.</div><button class="btn btn-primary" data-hk-act="alok-open" data-hk-arg="kirim">Kirim Stok</button></div>`:''}
  ${st==='Perlu Ditutup'?`<div class="hk-note">Tanggal event sudah lewat tapi event belum ditutup. Sisa stok masih tercatat di lokasi event. Tutup event untuk menarik sisa stok ke ${HK_GUDANG}.</div>`:''}
  ${!e.ditutup&&hkSOAkhir(data(),e.id)?(so=>so.status==='Perlu opname ulang'?`<div class="hk-note">Opname ulang diminta ${hkEsc(so.ulang.oleh)}: "${hkEsc(so.ulang.catatan)}". Menunggu kasir menghitung ulang.</div>`:so.status==='Disetujui'?'':`<div class="hk-note" style="display:flex;align-items:center;gap:10px;cursor:default;"><div style="flex:1;">Stok opname ${so.no} dari ${hkEsc(so.oleh)} (${hkTgl(so.waktu)} ${hkJam(so.waktu)}) menunggu persetujuan.</div><button class="btn" data-inv="o-ke" data-inv-arg="${hkEsc(e.nama)}">Buka di Stok Opname</button></div>`)(hkSOAkhir(data(),e.id)):''}
  ${e.ditutup?`<div class="hk-note" style="background:#F1F2EF;border-color:var(--border);color:var(--text-2);">Ditutup ${hkTgl(e.tutup.waktu)} oleh ${hkEsc(e.tutup.oleh)}.${e.tutup.opnameNo?((o=>o&&o.dihitungOleh?` Stok opname dihitung ${hkEsc(o.dihitungOleh)}, disetujui ${hkEsc(e.tutup.oleh)}.`:'')(state.posOpname.find(x=>x.no===e.tutup.opnameNo))):''} ${Object.values(kembali).reduce((a,b)=>a+b,0)} pcs stok fisik dikembalikan ke ${HK_GUDANG}.${e.tutup.selisih&&Object.keys(e.tutup.selisih).length?` Stok opname: selisih ${Object.values(e.tutup.selisih).reduce((a,b)=>a+b,0)} pcs, kerugian <b style="color:var(--danger-text);">${hkRp(e.tutup.kerugian||0)}</b>.`:' Stok opname penutupan cocok, tidak ada selisih.'}${(()=>{ const L=state.posOpname.filter(o=>o.eventId===e.id&&o.jenis==='Akhir Event'&&o.status==='Disetujui'&&o.kerugian>0&&!state.posOpname.some(t=>t.dariSO===o.no)); return L.length?` Selisih selama event sudah dicatat lewat opname ${L.map(o=>`${o.no} (${hkRp(o.kerugian)})`).join(', ')}.`:''; })()}</div>`:''}
  <div class="hk-kpis">
    <div class="metric-card"><div class="metric-label">Penjualan</div><div class="metric-value">${hkRp(kotor)}</div></div>
    <div class="metric-card"><div class="metric-label">Transaksi</div><div class="metric-value">${s.length}</div></div>
    <div class="metric-card"><div class="metric-label">Produk Terjual</div><div class="metric-value">${hkSum(s,'qty')} pcs</div></div>
    <div class="metric-card"><div class="metric-label">Rata-rata / Transaksi</div><div class="metric-value">${hkRp(s.length?kotor/s.length:0)}</div></div>
    <div class="metric-card"><div class="metric-label">Laba Kotor</div><div class="metric-value">${hkRp(hkSum(s,'laba'))}</div>${e.ditutup&&e.tutup.kerugian?`<div class="hk-sub">Setelah selisih stok ${hkRp(hkSum(s,'laba')-e.tutup.kerugian)}</div>`:''}</div>
  </div>
  <div class="hk-grid2">
    <div class="card"><div class="widget-title">Metode Pembayaran</div>${bars(metode,hkRp)}</div>
    <div class="card" style="padding:0;overflow:auto;max-height:330px;"><div class="widget-title" style="padding:14px 16px 0;">Stok di Event</div>
      <table><thead><tr><th>Barang</th><th class="hk-num">Dikirim</th><th class="hk-num">Ditarik</th><th class="hk-num">Terjual</th>${e.ditutup?'<th class="hk-num">Selisih</th>':''}<th class="hk-num">${e.ditutup?'Kembali':'Sisa'}</th></tr></thead><tbody>
      ${stokRows.map(({c,p})=>`<tr><td>${hkEsc(c.nama)}<div class="hk-sub">${c.sku}</div></td><td class="hk-num">${p.masuk}</td><td class="hk-num">${p.keluar-(kembali[c.sku]||0)}</td><td class="hk-num">${p.terjual}</td>${e.ditutup?`<td class="hk-num" style="${(e.tutup.selisih||{})[c.sku]<0?'color:var(--danger-text);font-weight:700;':''}">${(e.tutup.selisih||{})[c.sku]||0}</td>`:''}<td class="hk-num"><b style="${!e.ditutup&&p.akhir<=2?'color:var(--danger-text);':''}">${e.ditutup?(kembali[c.sku]||0):p.akhir}</b></td></tr>`).join('')||`<tr><td colspan="5" class="hk-empty">Belum ada stok dikirim. Klik "Kirim Stok".</td></tr>`}
      </tbody></table></div>
  </div>
  ${mutasiCard(e)}
  ${window.kuKartuEvent?kuKartuEvent(e):''}
  <div class="card" style="padding:0;overflow:auto;margin-bottom:14px;"><div class="widget-title" style="padding:14px 16px 0;">Shift Kasir & Setoran</div>
    <table><thead><tr><th>Kasir</th><th>Buka</th><th>Tutup</th><th class="hk-num">Modal Awal</th><th class="hk-num">Tunai Masuk</th><th class="hk-num">Kas Masuk/Keluar</th><th class="hk-num">Seharusnya</th><th class="hk-num">Uang Dihitung</th><th class="hk-num">Selisih</th><th>Catatan</th></tr></thead>
    <tbody>${shifts.map(shiftRow).join('')||`<tr><td colspan="10" class="hk-empty">Belum ada shift. Kasir membuka shift dari aplikasi POS.</td></tr>`}</tbody></table></div>
  <div class="card" style="padding:0;overflow:auto;"><div class="widget-title" style="padding:14px 16px 0;">Transaksi (${trx.length})</div>
    <table><thead><tr><th>Waktu</th><th>No.</th><th>Kasir</th><th>Barang</th><th>Metode</th><th class="hk-num">Total</th><th>Status</th></tr></thead>
    <tbody>${trx.slice(0,40).map(t=>`<tr><td>${hkTgl(t.waktu)}, ${hkJam(t.waktu)}</td><td>${t.no}</td><td>${hkEsc(t.kasir)}</td><td>${t.items.map(i=>`${hkEsc(i.nama)} ×${i.qty}`).join(', ')}</td><td>${t.metode}${hkRefQris(t)?`<div class="hk-sub">${hkRefQris(t)}</div>`:''}</td><td class="hk-num">${hkRp(t.total)}</td>
      <td>${t.status==='Void'?`<span class="badge badge-danger" title="${hkEsc(t.void&&t.void.alasan)}">Void</span>`:'<span class="badge badge-success">Lunas</span>'}</td></tr>`).join('')||`<tr><td colspan="7" class="hk-empty">Belum ada transaksi</td></tr>`}</tbody></table></div>`;
}
function kirimStok(ev, list){ return hkKirimStok({stok:state.stokItems, mutasi:state.mutasi}, ev, list, akunNama()); }
function mutasiCard(e){
  const list=state.mutasi.filter(m=>m.eventId===e.id).sort((a,b)=>b.tglKirim.localeCompare(a.tglKirim));
  if(!list.length) return '';
  const badge=m=>m.status==='Dikirim'?'<span class="badge badge-warn">Dalam pengiriman</span>':m.status==='Diterima'?'<span class="badge badge-success">Diterima</span>':'<span class="badge badge-mut">'+m.status+'</span>';
  return `<div class="card" style="padding:0;overflow:auto;margin-bottom:14px;"><div class="widget-title" style="padding:14px 16px 0;">Mutasi Stok ke Event</div>
    <table><thead><tr><th>No.</th><th>Dikirim</th><th>Diterima</th><th class="hk-num">Qty Kirim</th><th class="hk-num">Qty Terima</th><th>Status</th><th>Catatan</th></tr></thead><tbody>
    ${list.map(m=>{ const k=m.items.reduce((a,i)=>a+i.dikirim,0), t=m.items.reduce((a,i)=>a+(i.diterima||0),0);
      return `<tr><td>${m.no}</td><td>${hkTgl(m.tglKirim)}, ${hkJam(m.tglKirim)}<div class="hk-sub">${hkEsc(m.oleh)}</div></td><td>${m.tglTerima?`${hkTgl(m.tglTerima)}, ${hkJam(m.tglTerima)}<div class="hk-sub">${hkEsc(m.penerima||'')}</div>`:'–'}</td>
      <td class="hk-num">${k}</td><td class="hk-num" style="${m.status==='Diterima'&&t<k?'color:var(--danger-text);font-weight:700;':''}">${m.status==='Diterima'?t+(t<k?` (kurang ${k-t})`:''):'–'}</td><td>${badge(m)}</td><td class="hk-sub">${hkEsc(m.catatan||'')}</td></tr>`; }).join('')}
    </tbody></table></div>`;
}
function hargaModal(){
  const m=state.hk.modal, e=m.target==='gudang'?{nama:'jual langsung Gudang Pusat'}:evById(m.target);
  const rows=cat().filter(c=>c.aktif).map(c=>`<tr><td>${hkEsc(c.nama)}<div class="hk-sub">${c.sku}</div></td><td class="hk-num">${hkRp(c.harga)}</td>
    <td class="hk-num"><input class="hk-qty" style="width:120px;" type="number" min="0" value="${m.harga[c.sku]||''}" placeholder="Harga normal" data-hk-harga="${c.sku}"></td></tr>`).join('');
  return `<div class="confirm-box hk-modal hk-page"><div class="hk-mh"><h4>Harga khusus ${hkEsc(e.nama)}</h4><div class="spacer"></div><span class="close" style="cursor:pointer;" data-hk-act="modal-close">✕</span></div>
    <div class="hk-mb"><div class="hk-sub" style="margin-bottom:10px;">Kosongkan untuk memakai harga normal. Harga ini hanya berlaku di POS untuk ${m.target==='gudang'?'penjualan langsung dari Gudang Pusat (khusus Owner)':'event ini'}. Semua harga diatur dari dashboard; kasir tidak bisa mengubah harga. Promo tetap bisa dipakai di atasnya.</div>
      <table><thead><tr><th>Barang</th><th class="hk-num">Harga Normal</th><th class="hk-num">${m.target==='gudang'?'Harga Gudang':'Harga Event'}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="hk-mf"><div class="spacer"></div><button class="btn" data-hk-act="modal-close">Batal</button><button class="btn btn-primary" data-hk-act="harga-save">Simpan Harga</button></div></div>`;
}
function alokasiModal(){
  const m=state.hk.modal, e=evById(state.hk.evId), kirim=m.mode==='kirim'; m.pilih=m.pilih||[];
  const rows=m.pilih.map(sku=>cat().find(c=>c.sku===sku)).filter(Boolean).map(c=>{
    const g=gdStok(c.sku), d=hkStokDi(state.stokItems,c.sku,e.nama), maks=kirim?g:d, cv=hkCatalog(state.products).find(x=>x.sku===c.sku)||{};
    return `<tr><td><b>${hkEsc(cv.produk||c.nama)}</b><div class="hk-sub">${c.sku}</div></td><td>${hkEsc(cv.varNama||'Tanpa varian')}</td><td class="hk-num">${g}</td><td class="hk-num">${d}</td>
      <td class="hk-num"><input class="hk-qty" type="number" min="0" max="${maks}" data-batas="stok tersedia" value="${m.qty[c.sku]||''}" placeholder="0" data-hk-alok="${c.sku}" ${maks<=0?'disabled':''}></td>
      <td class="hk-num"><span class="hk-row-link" style="color:var(--danger-text);" data-hk-act="alok-hapus" data-hk-arg="${c.sku}">✕</span></td></tr>`; }).join('');
  return `<div class="confirm-box hk-modal hk-page"><div class="hk-mh"><h4>${kirim?`Kirim stok ke ${hkEsc(e.nama)}`:`Tarik stok ke ${HK_GUDANG}`}</h4><div class="spacer"></div><span class="close" style="cursor:pointer;" data-hk-act="modal-close">✕</span></div>
    <div class="hk-mb">${kirim?`<div class="hk-sub" style="margin-bottom:10px;">Tambah barang lewat + Produk lalu isi jumlahnya. Stok keluar dari ${HK_GUDANG} sebagai mutasi "Dikirim", lalu masuk ke stok event setelah kasir menerimanya di POS.</div>`:`<div class="hk-sub" style="margin-bottom:10px;">Tambah barang lewat + Produk lalu isi jumlah yang dibawa pulang ke ${HK_GUDANG}.</div>`}
      <div style="display:flex;gap:8px;margin-bottom:10px;"><button class="btn" data-hk-act="alok-semua">${kirim?'Isi 30% stok gudang':'Tarik semua sisa'}</button><button class="btn" data-hk-act="alok-kosong">Kosongkan</button></div>
      <div class="card" style="padding:0;overflow:auto;"><table class="hk-varian"><thead><tr><th>Nama Produk</th><th>Varian</th><th class="hk-num">Stok ${HK_GUDANG}</th><th class="hk-num">Di Event</th><th class="hk-num">${kirim?'Kirim':'Tarik'}</th><th></th></tr></thead><tbody>${rows}
      <tr><td colspan="6" style="padding:8px;"><button class="btn" style="width:100%;border-style:dashed;" data-hk-act="pil-buka" data-hk-arg="alok">+ Produk</button></td></tr></tbody></table></div></div>
    <div class="hk-mf"><span class="hk-sub" id="hkAlokTotal">${Object.values(m.qty).reduce((a,b)=>a+(+b||0),0)} pcs</span><div class="spacer"></div><button class="btn" data-hk-act="modal-close">Batal</button><button class="btn btn-primary" data-hk-act="alok-save">${kirim?'Kirim Stok':'Tarik Stok'}</button></div></div>`;
}
function soSetujuModal(){
  const m=state.hk.modal, so=state.posOpname.find(o=>o.no===m.no), r=hkSORingkas(so), fis=hkSOFisik(data(),so), ev=evById(so.eventId);
  return `<div class="confirm-box hk-modal hk-page"><div class="hk-mh"><span class="close" data-hk-act="modal-close">✕</span><h4>Setujui stok opname ${so.no} · ${hkEsc(so.lokasi)}</h4></div><div class="hk-mb">
    <div class="hk-sub" style="margin-bottom:10px;">Dihitung oleh <b>${hkEsc(so.oleh)}</b> ${so.jenis==='Gudang'?'di dashboard':'di POS'} · ${hkTgl(so.waktu)} ${hkJam(so.waktu)}${so.catatan?` · "${hkEsc(so.catatan)}"`:''}. ${so.jenis==='Gudang'?'Stok '+HK_GUDANG+' disesuaikan ke hasil hitung (memperhitungkan barang yang keluar-masuk setelah opname)':'Event tetap berjalan; stok event disesuaikan ke hasil hitung (memperhitungkan penjualan setelah opname)'}.</div>
    <table class="hk-varian"><thead><tr><th>Barang</th><th class="hk-num">Sistem saat dihitung</th><th class="hk-num">Fisik</th><th class="hk-num">Selisih</th><th class="hk-num">Stok setelah disetujui</th><th class="hk-num">Kerugian</th></tr></thead><tbody>
    ${so.produk.filter(p=>p.selisih).map(p=>`<tr><td>${hkEsc(p.nama)}<div class="hk-sub">${p.sku}</div></td><td class="hk-num">${p.sistem}</td><td class="hk-num">${p.fisik}</td><td class="hk-num" style="${p.selisih<0?'color:var(--danger-text);font-weight:700;':''}">${p.selisih>0?'+':''}${p.selisih}</td><td class="hk-num">${fis[p.sku]}</td><td class="hk-num">${p.selisih<0?hkRp(-p.selisih*(p.hpp||0)):'–'}</td></tr>`).join('')||'<tr><td colspan="6" class="hk-empty">Semua barang sesuai sistem</td></tr>'}</tbody></table>
    <div class="hk-sub" style="margin:8px 0 14px;">${so.produk.length} barang dihitung · kurang ${r.kurang} pcs · lebih ${r.lebih} pcs · kerugian <b style="color:var(--danger-text);">${hkRp(r.kerugian)}</b></div>
    ${r.kerugian?`<div class="form-section-title">Pertanggungjawaban selisih</div>
    <div class="field"><label>Penanggung jawab<span class="req">*</span></label><select data-hk-bind="hk.modal.pj">${state.staff.filter(x=>x.aktif!==false).map(x=>`<option ${m.pj===x.nama?'selected':''}>${hkEsc(x.nama)}</option>`).join('')}</select></div>
    <div class="field"><label>Penjelasan selisih<span class="req">*</span></label><textarea rows="2" data-hk-bind="hk.modal.alasan">${hkEsc(m.alasan||'')}</textarea></div>`:''}
    <div class="form-section-title">Atau minta opname ulang</div>
    <div class="field"><label>Alasan opname ulang</label><input data-hk-bind="hk.modal.ulang" value="${hkEsc(m.ulang||'')}" placeholder="Wajib kalau minta ulang"></div>
  </div><div class="hk-mf"><button class="btn" data-hk-act="so-ulang">Minta opname ulang</button><div class="spacer"></div><button class="btn" data-hk-act="modal-close">Batal</button><button class="btn btn-primary" data-hk-act="so-setuju">Setujui opname</button></div></div>`;
}
function soKartuDash(e){ const so=hkSOAkhir(data(),e.id);
  if(so&&so.status==='Disetujui') return `<div class="hk-note">Opname terakhir ${so.no} (dihitung ${hkEsc(so.oleh)}) sudah disetujui ${hkEsc(so.disetujui.oleh)} pada ${hkTgl(so.disetujui.waktu)} ${hkJam(so.disetujui.waktu)}, stok sudah disesuaikan. Untuk penutupan, hitung sisa barang di bawah atau minta kasir opname lagi.</div>`;
  if(!so) return `<div class="hk-note">Belum ada stok opname dari kasir. Kasir bisa menghitung di POS › Inventori › Stok Opname, atau isi hitungan langsung di bawah.</div>`;
  if(so.status==='Perlu opname ulang') return `<div class="hk-note">Opname ulang sudah diminta ${hkEsc(so.ulang.oleh)} pada ${hkTgl(so.ulang.waktu)} ${hkJam(so.ulang.waktu)}: "${hkEsc(so.ulang.catatan)}". Menunggu kasir menghitung ulang di POS.</div>`;
  const r=hkSORingkas(so);
  return `<div class="hk-note" style="display:flex;align-items:center;gap:10px;cursor:default;background:var(--danger-bg);color:var(--danger-text);"><div style="flex:1;">Opname ${so.no} dari ${hkEsc(so.oleh)} (${r.kurang||r.lebih?`kurang ${r.kurang}, lebih ${r.lebih} pcs`:'sesuai sistem'}) masih menunggu persetujuan. Setujui atau minta hitung ulang di Inventori › Stok Opname dulu, baru event bisa ditutup.</div><button class="btn" data-inv="o-ke" data-inv-arg="${hkEsc(so.lokasi)}">Buka di Stok Opname</button></div>`;
}

function tutupModal(){
  const e=evById(state.hk.evId), m=state.hk.modal; m.fisik=m.fisik||{};
  const C=hkCekTutupEvent(data(),e.id), buka=C.shiftBuka, tertunda=C.mutasiTunda, soT=hkSOAkhir(data(),e.id), tunggu=soT&&soT.status==='Menunggu persetujuan';
  const hpp=sku=>{ const k=hkCatalog(state.products).find(x=>x.sku===sku); return k?k.hpp:0; };
  const rows=C.sisa.map(x=>({sku:x.it.sku, nama:x.it.nama, q:x.q, hpp:hpp(x.it.sku)}));
  return `<div class="confirm-box hk-modal hk-page"><div class="hk-mh"><span class="close" data-hk-act="modal-close">✕</span><h4>Tutup ${hkEsc(e.nama)}: stok opname akhir event</h4></div>
    <div class="hk-mb">
      ${buka.length?`<div class="hk-note" style="background:var(--danger-bg);border-color:#F3C2BC;color:var(--danger-text);">Masih ada ${buka.length} shift terbuka (${buka.map(b=>hkEsc(b.kasir)).join(', ')}). Minta kasir menutup shift di POS dulu supaya setoran tercatat.</div>`:''}
      ${tertunda.length?`<div class="hk-note">${tertunda.length} mutasi stok belum diterima kasir (${tertunda.map(m=>m.no).join(', ')}). Barangnya dikembalikan ke ${HK_GUDANG}.</div>`:''}
      ${C.preSale.length?`<div class="hk-note">${C.preSale.length} pesanan pre-sale belum diambil. Pembeli masih bisa mengambil di ${HK_GUDANG} selama ${HK_BATAS_AMBIL_HARI} hari. Lewat dari itu, pesanan otomatis berstatus "Perlu Refund".</div>`:''}
      ${soKartuDash(e)}
      <p style="margin:0 0 10px;color:var(--text-2);">Hitung barang yang tersisa di booth, lalu isi stok fisik. Selisih dicatat sebagai stok opname dan kerugian (selisih × HPP). Setelah itu stok fisik kembali ke ${HK_GUDANG} dan event tidak bisa dipakai lagi di POS.</p>
      <table class="hk-varian"><thead><tr><th>Barang</th><th class="hk-num">Stok sistem</th><th class="hk-num">Stok fisik</th><th class="hk-num">Selisih</th><th class="hk-num">HPP</th><th class="hk-num">Kerugian</th></tr></thead><tbody>
      ${rows.map(r=>{ const f=m.fisik[r.sku]!=null&&m.fisik[r.sku]!==''?+m.fisik[r.sku]:r.q, d=f-r.q; return `<tr><td>${hkEsc(r.nama)}<div class="hk-sub">${r.sku}</div></td><td class="hk-num">${r.q}</td>
        <td class="hk-num"><input type="number" min="0" style="width:90px;text-align:right;" data-hk-fisik="${r.sku}" data-sistem="${r.q}" data-hpp="${r.hpp}" value="${hkEsc(m.fisik[r.sku]??'')}" placeholder="${r.q}"></td>
        <td class="hk-num" id="hkSel-${r.sku}" style="${d<0?'color:var(--danger-text);font-weight:700;':''}">${d>0?'+':''}${d}</td><td class="hk-num">${hkRp(r.hpp)}</td><td class="hk-num" id="hkRugi-${r.sku}">${d<0?hkRp(-d*r.hpp):'–'}</td></tr>`; }).join('')||`<tr><td colspan="6" class="hk-empty">Tidak ada sisa stok di event</td></tr>`}
      </tbody></table>
      ${rows.length?`<div class="form-section-title">Pertanggungjawaban selisih</div>
      <div class="help-text">Wajib diisi kalau ada barang kurang. Kerugian tercatat atas nama penanggung jawab dan bisa dilihat semua Admin dan Owner di Laporan › Selisih & Kerugian sampai diselesaikan.</div>
      <div class="field"><label>Penanggung jawab<span class="req">*</span></label><select data-hk-bind="hk.modal.pj"><option value="">Pilih karyawan</option>${state.staff.filter(x=>x.aktif!==false).map(x=>`<option ${m.pj===x.nama?'selected':''}>${hkEsc(x.nama)}</option>`).join('')}</select></div>
      <div class="field"><label>Penjelasan selisih<span class="req">*</span></label><textarea rows="2" data-hk-bind="hk.modal.alasan" placeholder="Contoh: 2 kaos S tidak ditemukan saat bongkar booth">${hkEsc(m.alasan||'')}</textarea></div>`:''}
      ${rows.length?`<div class="hk-line" style="border:none;"><div class="grow"><b>Total kerugian</b><div class="hk-sub">Barang lebih dari sistem tidak mengurangi kerugian</div></div><b id="hkRugiTotal" style="color:var(--danger-text);">${hkRp(rows.reduce((a,r)=>{ const f=m.fisik[r.sku]!=null&&m.fisik[r.sku]!==''?+m.fisik[r.sku]:r.q; return a+Math.max(0,r.q-f)*r.hpp; },0))}</b></div>`:''}
    </div>
    <div class="hk-mf"><div class="spacer"></div><button class="btn" data-hk-act="modal-close">Batal</button><button class="btn btn-primary" data-hk-act="tutup-save" ${buka.length||tunggu?'disabled style="opacity:.5;cursor:not-allowed;"':''}>Simpan opname & tutup event</button></div></div>`;
}

/* ════════ SELISIH & KERUGIAN STOK ════════ */
const KR_STATUS={'Belum diselesaikan':'badge-danger','Diganti':'badge-success','Diganti sebagian':'badge-warn','Dibebankan perusahaan':'badge-mut'};
function viewKerugian(){
  const L=hkKerugianSemua(data()), tot=L.reduce((a,o)=>a+o.kerugian,0), sisa=L.reduce((a,o)=>a+hkKerugianSisa(o),0);
  const diganti=L.reduce((a,o)=>a+hkKerugianJumlah(o,'Diganti'),0), beban=L.reduce((a,o)=>a+hkKerugianJumlah(o,'Dibebankan perusahaan'),0);
  const rows=L.map(o=>{ const tj=o.tanggungJawab||{}, st=tj.status||'Belum diselesaikan', R=hkKerugianRiwayat(o);
    return `<tr><td>${hkTgl(o.waktu)}<div class="hk-sub">${hkEsc(o.no)}</div></td><td><span class="badge ${o.jenis==='Kas'?'badge-warn':o.jenis==='Terbuang'?'badge-info':'badge-mut'}">${o.jenis==='Kas'?'Kas laci':o.jenis==='Terbuang'?'Barang terbuang':'Stok'}</span></td><td><b>${hkEsc(o.lokasi)}</b><div class="hk-sub">${o.jenis==='Kas'?'Ditutup':o.jenis==='Terbuang'?'Dicatat':'Disetujui'} oleh ${hkEsc(o.oleh)}</div></td>
      <td>${o.rincian.map(x=>hkEsc(x).replace(/(-\d+)$/,'<b style="color:var(--danger-text);">$1</b>')).join('<br>')}</td>
      <td><b>${hkEsc(tj.pj||'-')}</b><div class="hk-sub">${hkEsc(tj.alasan||'')}</div></td><td class="hk-num"><b>${hkRp(o.kerugian)}</b>${R.length&&hkKerugianSisa(o)?`<div class="hk-sub">sisa ${hkRp(hkKerugianSisa(o))}</div>`:''}</td>
      <td><span class="badge ${KR_STATUS[st]||'badge-mut'}">${st}</span>${R.map(r=>`<div class="hk-sub">${hkTgl(r.waktu)} · ${r.jenis==='Diganti'?`Diganti ${hkRp(r.jumlah)} (${hkEsc(r.cara)})`:`Dibebankan perusahaan ${hkRp(r.jumlah)}`} · ${hkEsc(r.oleh)}${r.catatan?` · ${hkEsc(r.catatan)}`:''}</div>`).join('')}</td>
      <td>${hkKerugianSisa(o)?`<button class="btn" data-hk-act="kr-open" data-hk-arg="${hkEsc(o.key)}">Selesaikan</button>`:''}</td></tr>`; }).join('');
  return `<div class="page-head"><span class="page-title">Selisih & Kerugian</span></div>
  <div class="page-sub">Kerugian dari selisih stok opname, barang terbuang yang dicatat manual, dan kas laci yang kurang saat tutup kasir. Setiap kerugian punya penanggung jawab dan harus diselesaikan: diganti oleh penanggung jawab, atau dibebankan ke perusahaan atas persetujuan Owner. Semua langkah tercatat beserta akun yang menandainya.</div>
  <div class="hk-kpis">
    <div class="metric-card"><div class="metric-label">Total kerugian</div><div class="metric-value">${hkRp(tot)}</div><div class="hk-sub">${L.length} catatan</div></div>
    <div class="metric-card"><div class="metric-label">Belum diselesaikan</div><div class="metric-value" style="color:var(--danger-text);">${hkRp(sisa)}</div></div>
    <div class="metric-card"><div class="metric-label">Sudah diganti</div><div class="metric-value">${hkRp(diganti)}</div></div>
    <div class="metric-card"><div class="metric-label">Dibebankan perusahaan</div><div class="metric-value">${hkRp(beban)}</div></div>
  </div>
  <div class="card" style="padding:0;overflow:auto;"><table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Lokasi</th><th>Rincian</th><th>Penanggung jawab</th><th class="hk-num">Kerugian</th><th>Status & riwayat</th><th></th></tr></thead>
  <tbody>${rows||'<tr><td colspan="8" class="hk-empty">Belum ada kerugian. Kerugian muncul dari selisih stok opname, barang terbuang yang dicatat manual, dan kas laci yang kurang saat tutup kasir.</td></tr>'}</tbody></table></div>`;
}
function viewRetur(){
  const D=data(), cat=hkCatalog(D.produk), hpp=sku=>(cat.find(c=>c.sku===sku)||{}).hpp||0, L=hkReturList(D);
  const pcs=L.reduce((a,r)=>a+r.items.reduce((b,i)=>b+i.qty,0),0), uang=L.filter(r=>r.cara==='Uang kembali').reduce((a,r)=>a+r.nilai,0), rusak=L.reduce((a,r)=>a+r.items.reduce((b,i)=>b+i.qty*hpp(i.sku),0),0);
  const per={}; L.forEach(r=>r.items.forEach(i=>{ per[i.nama]=(per[i.nama]||0)+i.qty; })); const top=Object.entries(per).sort((a,b)=>b[1]-a[1]);
  const rows=L.map(r=>`<tr><td>${hkTgl(r.waktu)} ${hkJam(r.waktu)}<div class="hk-sub">${hkEsc(r.no)}</div></td><td>${hkEsc(r.trx.no)}<div class="hk-sub">dibeli ${hkTgl(r.trx.waktu)}</div></td><td>${hkEsc(r.lokasi)}</td>
    <td>${r.items.map(i=>`${i.qty}× ${hkEsc(i.nama)}`).join('<br>')}</td><td>${hkEsc(r.alasan)}${r.foto?`<div><img src="${r.foto}" style="max-width:64px;border-radius:6px;margin-top:4px;"></div>`:''}</td>
    <td><span class="badge ${r.cara==='Tukar barang'?'badge-mut':'badge-warn'}">${r.cara==='Tukar barang'?'Tukar barang sama':'Uang kembali'}</span>${r.cara==='Uang kembali'?`<div class="hk-sub">${hkEsc(r.metode)}</div>`:''}</td>
    <td class="hk-num">${r.nilai?hkRp(r.nilai):'–'}</td><td>${hkEsc(r.oleh)}<div class="hk-sub">disetujui ${hkEsc(r.disetujui)}</div></td></tr>`).join('');
  return `<div class="page-head"><span class="page-title">Retur Barang Cacat</span></div>
  <div class="page-sub">Retur hanya untuk barang cacat dan dicatat dari POS dengan PIN Admin/Owner. Barang cacat tidak kembali ke stok jual. Uang kembali mengurangi penjualan; tukar barang mengurangi stok sebanyak barang pengganti.</div>
  <div class="hk-kpis">
    <div class="metric-card"><div class="metric-label">Barang cacat</div><div class="metric-value">${pcs} pcs</div><div class="hk-sub">${L.length} retur</div></div>
    <div class="metric-card"><div class="metric-label">Uang dikembalikan</div><div class="metric-value" style="color:var(--danger-text);">${hkRp(uang)}</div></div>
    <div class="metric-card"><div class="metric-label">Modal barang rusak</div><div class="metric-value">${hkRp(rusak)}</div><div class="hk-sub">HPP barang cacat</div></div>
    <div class="metric-card"><div class="metric-label">Paling sering cacat</div><div class="metric-value" style="font-size:16px;">${top.length?hkEsc(top[0][0]):'–'}</div>${top.length?`<div class="hk-sub">${top[0][1]} pcs</div>`:''}</div>
  </div>
  <div class="card" style="padding:0;overflow:auto;"><table><thead><tr><th>Waktu retur</th><th>Transaksi</th><th>Lokasi</th><th>Barang</th><th>Kerusakan</th><th>Penyelesaian</th><th class="hk-num">Uang kembali</th><th>Kasir</th></tr></thead>
  <tbody>${rows||'<tr><td colspan="8" class="hk-empty">Belum ada retur. Retur dicatat dari POS lewat Riwayat Penjualan › detail transaksi › Retur barang cacat.</td></tr>'}</tbody></table></div>`;
}
function kerugianModal(){
  const m=state.hk.modal, o=hkKerugianSemua(data()).find(x=>x.key===m.no), tj=o.tanggungJawab, owner=akun()&&akun().role.includes('Owner'), sisa=hkKerugianSisa(o);
  return `<div class="confirm-box hk-modal hk-page"><div class="hk-mh"><span class="close" data-hk-act="modal-close">✕</span><h4>Selesaikan kerugian ${hkEsc(o.lokasi)}</h4></div><div class="hk-mb">
    <div class="hk-sub" style="margin-bottom:12px;">${o.no} · Penanggung jawab <b>${hkEsc(tj.pj)}</b> · Kerugian ${hkRp(o.kerugian)} · Sisa <b style="color:var(--danger-text);">${hkRp(sisa)}</b> · ${hkEsc(tj.alasan)}</div>
    <div class="field"><label>Penyelesaian<span class="req">*</span></label><div class="row-2">${[['Diganti','Diganti penanggung jawab','Uang diganti tunai, transfer, atau potong gaji. Boleh dicicil.'],['Dibebankan perusahaan','Dibebankan ke perusahaan','Sisa kerugian ditanggung perusahaan. Hanya Owner.']].map(([k,l,d])=>`<div class="hk-check ${m.jenis===k?'on':''}" ${k==='Dibebankan perusahaan'&&!owner?'style="opacity:.5;cursor:not-allowed;" title="Hanya Owner"':`data-hk-act="kr-jenis" data-hk-arg="${k}"`}><input type="radio" ${m.jenis===k?'checked':''} style="pointer-events:none;"><div><b>${l}</b><div class="hk-sub">${d}</div></div></div>`).join('')}</div></div>
    ${m.jenis==='Diganti'?`<div class="field"><label>Jumlah diganti<span class="req">*</span></label><input type="number" min="0" max="${sisa}" data-batas="sisa kerugian" data-hk-bind="hk.modal.jumlah" value="${hkEsc(m.jumlah)}"></div>
    <div class="field"><label>Cara</label><select data-hk-bind="hk.modal.cara">${['Tunai','Transfer','Potong gaji'].map(c=>`<option ${m.cara===c?'selected':''}>${c}</option>`).join('')}</select></div>`:`<div class="field"><label>Jumlah dibebankan</label><div class="hk-ro"><b>${hkRp(sisa)}</b> <span class="hk-sub">seluruh sisa kerugian</span></div></div>`}
    <div class="field"><label>Catatan</label><textarea rows="2" data-hk-bind="hk.modal.catatan" placeholder="Opsional">${hkEsc(m.catatan||'')}</textarea></div>
    <div class="field"><label>Ditandai oleh</label><div class="hk-ro"><b>${hkEsc(akunNama())}</b> <span class="hk-sub">akun yang sedang masuk</span></div></div>
  </div><div class="hk-mf"><div class="spacer"></div><button class="btn" data-hk-act="modal-close">Batal</button><button class="btn btn-primary" data-hk-act="kr-save">Simpan</button></div></div>`;
}

/* ════════ PROMOSI: validasi, draf, status, pemakaian ════════ */
const hkHargaTermurah=nama=>{ const p=state.products.find(x=>x.nama===nama); if(!p) return 0; return p.varian&&p.varian.length?Math.min(...p.varian.map(v=>hkNum(v.jual))):hkNum(p.jual); };
window.hkPaketNormal=f=>{ const L=f.produkPromo||[]; if(L.length<2) return ''; const n=L.reduce((a,x)=>a+hkHargaTermurah(x),0), h=hkNum(f.hargaPaket);
  return `<div class="help-text" style="margin-top:4px;">Harga normal paket (varian termurah): ${hkRp(n)}${h?` · pembeli hemat ${hkRp(Math.max(0,n-h))}`:''}</div>`; };
/* "Berlaku di": bisa pilih beberapa lokasi, atau Semua lokasi */
function lokasiAwal(f){ if(Array.isArray(f.lokasi)) return; f.lokasi=f.outlet&&!/^semua/i.test(f.outlet)?f.outlet.split(', ').filter(Boolean):[]; f.lokasiSemua=!f.lokasi.length; }
window.hkLokasiPilih=(f,prefix)=>{ lokasiAwal(f); const chip=(arg,label,on,sub)=>`<div class="hk-check ${on?'on':''}" data-hk-act="pr-lok" data-hk-arg="${prefix}|${hkEsc(arg)}"><input type="checkbox" ${on?'checked':''} style="pointer-events:none;"><div><b>${hkEsc(label)}</b>${sub?`<div class="hk-sub">${sub}</div>`:''}</div></div>`;
  return `<div id="${prefix}LokasiPilih" class="hk-lokasi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;border-radius:10px;">${chip('*','Semua lokasi',f.lokasiSemua,'Semua event dan Gudang Pusat')}${OUTLETS.map(o=>chip(o,o,!f.lokasiSemua&&f.lokasi.includes(o),o===HK_GUDANG?'Jual langsung dari gudang':'Event')).join('')}</div>`; };
/* halaman 1 promo: semua isian wajib harus terisi sebelum Selanjutnya */
window.hkPromoCek1=(f,prefix)=>{ lokasiAwal(f); const a=hkParseTgl(f.tglMulai), b=hkParseTgl(f.tglSelesai);
  const cek=[[!f.lokasiSemua&&!f.lokasi.length,'LokasiPilih','Pilih lokasi promo berlaku (boleh lebih dari satu)'],[!(f.nama||'').trim(),'NamaInput','Isi nama promo'],[!(f.deskripsi||'').trim(),'DeskripsiInput','Isi deskripsi promo'],
    [!a,'TglMulaiInput','Isi tanggal mulai dengan benar, contoh: 6 Okt 2026'],[!b,'TglSelesaiInput','Isi tanggal berakhir dengan benar, contoh: 6 Okt 2026'],[a&&b&&b<a,'TglSelesaiInput','Tanggal berakhir tidak boleh sebelum tanggal mulai'],
    [!/^\d{1,2}:\d{2}$/.test(f.jamMulai||''),'JamMulaiInput','Isi jam mulai, contoh: 08:00'],[!/^\d{1,2}:\d{2}$/.test(f.jamSelesai||''),'JamSelesaiInput','Isi jam selesai, contoh: 21:00'],[(f.jamSelesai||'')<=(f.jamMulai||''),'JamSelesaiInput','Jam selesai harus setelah jam mulai'],
    [!(f.hari||[]).length,'HariPilih','Pilih minimal satu hari']];
  document.querySelectorAll('.hk-invalid').forEach(x=>x.classList.remove('hk-invalid'));
  const salah=cek.filter(c=>c[0]); if(!salah.length) return true;
  salah.forEach(c=>{ const el=c[1]==='HariPilih'?document.querySelector(`[data-toggle-${prefix}-semua-hari]`)?.closest('.field'):document.getElementById(prefix+c[1]); if(el) el.classList.add('hk-invalid'); });
  const first=document.querySelector('.hk-invalid'); if(first){ first.scrollIntoView({block:'center',behavior:'smooth'}); if(first.tagName==='INPUT') first.focus(); }
  toast(salah.length>1?`${salah[0][2]}. Masih ada ${salah.length-1} isian wajib lain yang ditandai merah`:salah[0][2]); return false; };
document.addEventListener('input',e=>{ if(e.target.classList&&e.target.classList.contains('hk-invalid')) e.target.classList.remove('hk-invalid'); });
window.hkPromoCek=(f,kind)=>{
  { const px=kind==='produk'?'promoProduk':'promoTotal'; if(!hkPromoCek1(f,px)){ f.step=1; renderPromoFormModal(); setTimeout(()=>hkPromoCek1(f,px),30); return 'Lengkapi isian wajib di halaman Informasi Promo'; } }
  const besar=hkNum(f.besaranPotongan), persen=f.jenisBonus==='persen';
  if(f.jenisBonus==='bonus-produk'){
    if(!(f.produkPromo||[]).length) return 'Pilih produk yang harus dibeli';
    if(!hkNum(f.minKuantitas)) return 'Isi jumlah minimal beli';
    if((f.bonusProduk||[]).length!==1) return 'Pilih satu produk bonus';
    if(!hkNum(f.jumlahBonus)) f.jumlahBonus='1';
    f.promoBerdasarkan='kuantitas'; f.besaranPotongan=''; }
  else if(f.jenisBonus==='bundling'){
    if((f.produkPromo||[]).length<2) return 'Paket minimal berisi dua produk';
    const h=hkNum(f.hargaPaket), n=(f.produkPromo||[]).reduce((a,x)=>a+hkHargaTermurah(x),0);
    if(!h) return 'Isi harga paket';
    if(h>=n) return `Harga paket harus lebih murah dari harga normal ${hkRp(n)}`;
    f.promoBerdasarkan=''; f.besaranPotongan=''; }
  else if(!besar) return 'Isi besaran potongan';
  if(f.jenisBonus==='bonus-produk'||f.jenisBonus==='bundling'){
    const a=hkParseTgl(f.tglMulai), b=hkParseTgl(f.tglSelesai);
    if(!a||!b) return 'Isi tanggal mulai dan selesai';
    if(b<a) return 'Tanggal selesai tidak boleh sebelum tanggal mulai';
    if((f.jamSelesai||'23:59')<=(f.jamMulai||'00:00')) return 'Jam selesai harus setelah jam mulai';
    if(!(f.hari||[]).length) return 'Pilih minimal satu hari';
    return null; }
  if(persen&&besar>100) return 'Potongan persen maksimal 100%';
  if(kind==='produk'&&!(f.produkPromo||[]).length) return 'Pilih minimal satu produk promo';
  const a=hkParseTgl(f.tglMulai), b=hkParseTgl(f.tglSelesai);
  if(!a||!b) return 'Isi tanggal mulai dan selesai';
  if(b<a) return 'Tanggal selesai tidak boleh sebelum tanggal mulai';
  if((f.jamSelesai||'23:59')<=(f.jamMulai||'00:00')) return 'Jam selesai harus setelah jam mulai';
  if(!(f.hari||[]).length) return 'Pilih minimal satu hari';
  if(persen&&f.izinkanKasirUbah){ const bt=hkNum(f.batasKasirPersen); if(!bt) return 'Isi batas potongan yang boleh diubah kasir'; if(bt>100) return 'Batas potongan kasir maksimal 100%'; if(bt<besar) return 'Batas potongan kasir tidak boleh lebih kecil dari potongan promo'; }
  if(persen&&f.maksimalPotongan&&!hkNum(f.maksimalPotonganNominal)) return 'Isi nominal maksimal potongan';
  if(f.promoBerdasarkan==='kuantitas'&&kind==='produk'&&!hkNum(f.minKuantitas)) return 'Isi minimal kuantitas';
  if(!persen&&hkNum(f.minPembelian)&&besar>hkNum(f.minPembelian)) return 'Potongan tidak boleh lebih besar dari minimal pembelian';
  return null; };
window.hkPromoDraf=kind=>{
  const f=kind==='produk'?state.promoProdukForm:state.promoTotalForm; if(!f) return false;
  if(!f.nama.trim()){ toast('Isi nama promo dulu'); return false; }
  const row={nama:f.nama, tipe:f.aktivasi==='otomatis'?'Otomatis':'Manual', ...(kind==='produk'?{produk:(f.produkPromo||[]).join(', ')||'-'}:{}),
    kriteria:kind==='produk'?promoKriteriaLabel(f):promoKriteriaLabelTotal(f), bonus:promoBonusLabel(f), durasi:f.tglMulai===f.tglSelesai?f.tglMulai:`${f.tglMulai} - ${f.tglSelesai}`,
    outlet:f.outlet||'Semua lokasi', status:'Draf', detail:JSON.parse(JSON.stringify({...f, statusPromo:false, platform:['POS']}))};
  const L=kind==='produk'?state.promoProdukList:state.promoTotalList;
  if(f.mode==='edit'&&f.index!=null) L[f.index]=row; else L.unshift(row);
  if(kind==='produk') state.promoProdukForm=null; else state.promoTotalForm=null;
  toast('Disimpan sebagai draf. Belum dipakai di POS sampai diaktifkan'); return true; };
window.hkPromoStatus=p=>{
  if(p.status!=='Aktif') return p.status;
  const d=p.detail||{}, a=hkParseTgl(d.tglMulai), b=hkParseTgl(d.tglSelesai)||a, t=hkYmd(new Date());
  if(b&&t>b) return 'Berakhir'; if(a&&t<a) return 'Terjadwal'; return 'Aktif'; };
window.hkPromoPakai=nama=>{
  const L=state.posTrx.filter(t=>t.status==='Lunas'&&t.promo===nama);
  return L.length?`${L.length}× <div class="hk-sub">potongan ${hkRp(L.reduce((a,t)=>a+(t.diskon||0),0))}</div>`:'<span class="hk-sub">Belum</span>'; };

/* ════════ PESANAN PRE-SALE ════════ */
const PS_STATUS={'Menunggu':['badge-warn','Menunggu diambil'],'Diambil':['badge-success','Sudah diambil'],'Perlu Refund':['badge-danger','Perlu transfer kembali'],'Refund':['badge-mut','Sudah ditransfer kembali'],'Batal':['badge-mut','Void']};
function psStatus(t){ return t.status==='Void'?'Batal':t.status==='Refund'?'Refund':t.pengambilan.status; }
function psList(){ return state.posTrx.filter(t=>t.pengambilan).sort((a,b)=>b.waktu.localeCompare(a.waktu)); }
function viewPreSale(){
  const H=state.hk, all=psList();
  const tabs=[['Menunggu','Menunggu Diambil'],['Perlu Refund','Perlu Refund'],['Diambil','Sudah Diambil'],['Refund','Sudah Refund'],['Semua','Semua']];
  const list=all.filter(t=>(H.psTab==='Semua'||psStatus(t)===H.psTab)&&(!H.psEvent||t.eventId===H.psEvent));
  const evs=[...new Set(all.map(t=>t.eventId))].map(id=>evById(id)).filter(Boolean);
  const rows=list.map(t=>{ const st=psStatus(t), [cls,lbl]=PS_STATUS[st]||['badge-mut',st]; const e=evById(t.eventId);
    const aksi=st==='Menunggu'?`<button class="btn" data-hk-act="ps-refund" data-hk-arg="${t.id}">Batalkan & refund</button>`:st==='Perlu Refund'?`<button class="btn btn-primary" data-hk-act="ps-refund" data-hk-arg="${t.id}">Tandai sudah ditransfer</button>`:'';
    return `<tr><td><b>${t.no}</b><div class="hk-sub">${hkTgl(t.waktu)}, ${hkJam(t.waktu)} · ${hkEsc(t.kasir)}</div></td><td>${hkEsc(e?e.nama:t.lokasi)}<div class="hk-sub">${e?statusBadge(hkStatusEvent(e)):''}</div></td>
      <td><b>${hkEsc(t.pelanggan?t.pelanggan.nama:'-')}</b><div class="hk-sub">${hkEsc(t.pelanggan&&t.pelanggan.telepon||'Tanpa no HP')}</div>${t.struk?`<div class="hk-sub" style="color:var(--success-text,#1E8E4E);">✓ Struk PDF terkirim ke WA ${hkTgl(t.struk.waktu)} ${hkJam(t.struk.waktu)}</div>`:'<div class="hk-sub" style="color:var(--danger-text);">Struk belum dikirim ke WA</div>'}</td>
      <td>${t.items.map(i=>`${i.qty}× ${hkEsc(i.nama)}`).join('<br>')}</td><td class="hk-num">${hkRp(t.total)}<div class="hk-sub">${hkBayar(t).map(b=>b.metode+(b.ref?' ref …'+b.ref:'')).join(' + ')}</div></td>
      <td><span class="badge ${cls}">${lbl}</span>${t.pengambilan.status==='Menunggu'&&t.pengambilan.batas?`<div class="hk-sub">Ambil di ${HK_GUDANG} sampai ${hkTgl(t.pengambilan.batas)}</div>`:''}${t.pengambilan.status==='Perlu Refund'&&t.pengambilan.catatan?`<div class="hk-sub">${hkEsc(t.pengambilan.catatan)}</div>`:''}${t.pengambilan.status==='Diambil'?`<div class="hk-sub">${hkTgl(t.pengambilan.waktu)} di ${hkEsc(t.pengambilan.lokasi||t.lokasi)} · ${hkEsc(t.pengambilan.oleh)} · ${t.pengambilan.cara==='Manual'?'verifikasi manual':'scan QR'}</div>${t.pengambilan.catatan?`<div class="hk-sub">${hkEsc(t.pengambilan.catatan)}</div>`:''}`:''}${t.refund?`<div class="hk-sub">${hkTgl(t.refund.waktu)} ke ${hkEsc(t.refund.bank)} ${hkEsc(t.refund.norek)} · oleh ${hkEsc(t.refund.oleh)}</div><span class="hk-row-link" style="color:var(--accent-text);font-size:12px;font-weight:600;" data-hk-act="ps-bukti" data-hk-arg="${t.id}">Lihat bukti transfer</span>`:''}${t.pengambilan.catatan&&st==='Perlu Refund'?`<div class="hk-sub">${hkEsc(t.pengambilan.catatan)}</div>`:''}</td><td>${aksi}</td></tr>`; }).join('');
  const n=st=>all.filter(t=>psStatus(t)===st).length;
  return `<div class="page-head"><span class="page-title">Pesanan Pre-sale</span><div class="spacer"></div><button class="btn" data-hk-act="ps-csv">⭳ Unduh CSV</button></div>
  <div class="page-sub">Pesanan yang dibayar sebelum event dimulai. Struk pembeli memuat QR yang di-scan kasir saat pengambilan. Setelah event ditutup, pesanan yang belum diambil masih bisa diambil di Gudang Pusat selama belum di-refund.</div>
  <div class="hk-kpis" style="grid-template-columns:repeat(4,1fr);">
    <div class="metric-card"><div class="metric-label">Menunggu diambil</div><div class="metric-value">${n('Menunggu')}</div><div class="hk-sub">${hkRp(hkSum(all.filter(t=>psStatus(t)==='Menunggu'),'total'))}</div></div>
    <div class="metric-card"><div class="metric-label">Perlu transfer kembali</div><div class="metric-value" style="color:var(--danger-text);">${n('Perlu Refund')}</div><div class="hk-sub">${hkRp(hkSum(all.filter(t=>psStatus(t)==='Perlu Refund'),'total'))}</div></div>
    <div class="metric-card"><div class="metric-label">Sudah diambil</div><div class="metric-value">${n('Diambil')}</div></div>
    <div class="metric-card"><div class="metric-label">Sudah di-refund</div><div class="metric-value">${n('Refund')}</div></div></div>
  <div class="hk-tabsrow"><div class="tabs">${tabs.map(([k,l])=>`<div class="tab ${H.psTab===k?'active':''}" data-hk-act="ps-tab" data-hk-arg="${k}">${l}</div>`).join('')}</div>
    <select class="hk-sel" data-hk-bind="hk.psEvent"><option value="">Semua event</option>${evs.map(e=>`<option value="${e.id}" ${H.psEvent===e.id?'selected':''}>${hkEsc(e.nama)}</option>`).join('')}</select></div>
  <div class="card" style="padding:0;overflow:auto;"><table><thead><tr><th>No. Transaksi</th><th>Event</th><th>Pembeli</th><th>Barang</th><th class="hk-num">Total</th><th>Status</th><th></th></tr></thead>
  <tbody>${rows||`<tr><td colspan="7" class="hk-empty">Tidak ada pesanan di tab ini</td></tr>`}</tbody></table></div>
  <div class="hk-sub" style="margin-top:10px;">Setelah event ditutup, pesanan yang belum diambil masih bisa diambil di ${HK_GUDANG} selama ${HK_BATAS_AMBIL_HARI} hari. Lewat dari itu, statusnya otomatis menjadi "Perlu Refund". Selama uang belum ditransfer, Owner atau Admin tetap bisa menyerahkannya dari POS Gudang Pusat dan statusnya berubah menjadi Sudah diambil. Setelah uang di-transfer kembali, tandai di sini beserta foto bukti transfer.</div>`;
}
function refundModal(){
  const m=state.hk.modal, t=state.posTrx.find(x=>x.id===m.id), batal=psStatus(t)==='Menunggu';
  return `<div class="confirm-box hk-modal hk-page" style="width:500px;"><div class="hk-mh"><span class="close" data-hk-act="modal-close">✕</span><h4>${batal?'Batalkan pre-sale & transfer kembali':'Tandai sudah ditransfer kembali'}</h4></div><div class="hk-mb">
    <div class="hk-sub" style="margin-bottom:10px;">${t.no} · ${hkEsc(t.pelanggan?t.pelanggan.nama:'-')} (${hkEsc(t.pelanggan&&t.pelanggan.telepon||'-')}) · <b>${hkRp(t.total)}</b></div>
    <div class="row-2"><div class="field"><label>Bank tujuan<span class="req">*</span></label><input data-hk-bind="hk.modal.bank" value="${hkEsc(m.bank)}" placeholder="BCA / BSI / ..."></div>
      <div class="field"><label>No. rekening<span class="req">*</span></label><input data-hk-bind="hk.modal.norek" value="${hkEsc(m.norek)}"></div></div>
    <div class="field"><label>Atas nama</label><input data-hk-bind="hk.modal.an" value="${hkEsc(m.an)}"></div>
    <div class="field"><label>Catatan</label><input data-hk-bind="hk.modal.catatan" value="${hkEsc(m.catatan)}" placeholder="Contoh: pembeli berhalangan hadir"></div>
    <div class="row-2"><div class="field"><label>Ditandai oleh</label><div class="hk-akun-ro"><b>${hkEsc(akunNama())}</b> <span class="hk-sub">akun yang sedang masuk</span></div></div>
      <div class="field"><label>Bukti transfer (foto)<span class="req">*</span></label><label class="btn" style="display:inline-block;cursor:pointer;">${m.bukti?'Ganti foto':'Unggah foto'}<input type="file" accept="image/*" data-hk-file="bukti" hidden></label></div></div>
    ${m.bukti?`<img src="${m.bukti}" style="max-width:100%;max-height:220px;border-radius:8px;border:1px solid var(--border);display:block;margin-bottom:8px;">`:`<div class="hk-sub" style="margin-bottom:8px;">Wajib. Screenshot atau foto bukti transfer dari m-banking.</div>`}
    <div class="hk-sub">Setelah disimpan, transaksi berstatus Refund dan tidak dihitung di penjualan maupun laporan.</div></div>
    <div class="hk-mf"><div class="spacer"></div><button class="btn" data-hk-act="modal-close">Batal</button><button class="btn btn-primary" data-hk-act="ps-refund-ok">Simpan, sudah ditransfer</button></div></div>`;
}

/* ════════ LAPORAN ════════ */
function lapRange(){
  const t=hkToday(), p=state.hk.lapPeriode;
  if(p==='hari') return [hkYmd(t),hkYmd(t)];
  if(p==='7') return [hkYmd(hkAddDays(t,-6)),hkYmd(t)];
  if(p==='bulan') return [hkYmd(new Date(t.getFullYear(),t.getMonth(),1)),hkYmd(t)];
  if(p==='30') return [hkYmd(hkAddDays(t,-29)),hkYmd(t)];
  if(p==='rentang') return [state.hk.lapDari||null, state.hk.lapSampai||null];
  return [null,null];
}
function lapTable(head, rows, foot){
  return `<div class="card" style="padding:0;overflow:auto;"><table><thead><tr>${head.map((h,i)=>`<th class="${i?'hk-num':''}">${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${i?'hk-num':''}">${c}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${head.length}" class="hk-empty">Tidak ada penjualan di periode ini</td></tr>`}</tbody>
    ${foot&&rows.length?`<tfoot><tr>${foot.map((c,i)=>`<td class="${i?'hk-num':''}" style="font-weight:700;background:#FAFAF8;">${c}</td>`).join('')}</tr></tfoot>`:''}</table></div>`;
}
function lapData(){
  const [dari,sampai]=lapRange(); const S=hkSales(data(),dari,sampai); const tab=state.hk.lapTab;
  const agg=list=>({n:list.filter(x=>!x.retur).length, qty:hkSum(list,'qty'), kotor:hkSum(list,'kotor'), pot:hkSum(list,'potongan'), bersih:hkSum(list,'bersih'), hpp:hkSum(list,'hpp'), laba:hkSum(list,'laba')});
  const moneyRow=(nama,a)=>[nama,a.n,a.qty,hkRp(a.kotor),hkRp(a.pot),hkRp(a.bersih),hkRp(a.hpp),hkRp(a.laba),a.bersih?Math.round(a.laba/a.bersih*100)+'%':'–'];
  const head=['','Transaksi','Qty','Penjualan Kotor','Potongan','Bersih','HPP','Laba Kotor','Margin'];
  const tot=agg(S);
  if(tab==='saluran'){ const g=hkGroup(S,s=>s.jenis==='Offline'?(s.eventId===HK_GUDANG_ID?`Jual langsung · ${s.saluran}`:`Event · ${s.saluran}`):s.saluran);
    return {head:['Saluran',...head.slice(1)], rows:[...g.entries()].map(([k,l])=>moneyRow(hkEsc(k),agg(l))).sort((a,b)=>b[1]-a[1]), foot:moneyRow('Total',tot), csv:'saluran'}; }
  if(tab==='event'){ const evs=[...state.events, hkTempat(data(),HK_GUDANG_ID)].filter(e=>S.some(s=>s.eventId===e.id));
    return {head:['Event','Transaksi','Qty','Penjualan','Tunai','QRIS','Transfer','Laba Kotor','Selisih Kas'], rows:evs.map(e=>{ const l=S.filter(s=>s.eventId===e.id); const by=m=>hkRp(l.reduce((a,s)=>a+s.bayar.filter(b=>b.metode===m).reduce((x,b)=>x+b.jumlah,0),0));
      const sel=state.posShift.filter(x=>x.eventId===e.id&&x.tutup).reduce((a,x)=>a+hkShiftKas(data(),x).selisih,0);
      return [e.gudang?`${hkEsc(e.nama)} <span class="hk-sub">(jual langsung)</span>`:`<span class="hk-row-link" data-hk-act="ev-open" data-hk-arg="${e.id}" style="color:var(--accent-text);font-weight:600;">${hkEsc(e.nama)}</span>`,l.length,hkSum(l,'qty'),hkRp(hkSum(l,'kotor')),by('Tunai'),by('QRIS'),by('Transfer'),hkRp(hkSum(l,'laba')),`<span style="color:${sel?'var(--danger-text)':'inherit'}">${sel?hkRp(sel):'Pas'}</span>`]; })}; }
  if(tab==='kasir'){ const g=hkGroup(S,s=>s.kasir), inR=w=>{ const d=w.slice(0,10); return (!dari||d>=dari)&&(!sampai||d<=sampai); };
    const nama=[...new Set([...state.staff.map(x=>x.nama), ...g.keys()])].filter(n=>g.has(n)||state.posShift.some(x=>x.kasir===n&&inR(x.buka)));
    const by=(l,m)=>l.reduce((a,s)=>a+s.bayar.filter(b=>b.metode===m).reduce((x,b)=>x+b.jumlah,0),0);
    const rows=nama.map(n=>{ const l=g.get(n)||[], st=state.staff.find(x=>x.nama===n), off=l.filter(s=>s.jenis==='Offline'), on=l.filter(s=>s.jenis==='Online');
      const tempat=[...new Set(off.map(s=>s.saluran))], sh=state.posShift.filter(x=>x.kasir===n&&x.tutup&&inR(x.buka)), sel=sh.reduce((a,x)=>a+hkShiftKas(data(),x).selisih,0);
      const vd=state.posTrx.filter(t=>t.status==='Void'&&t.kasir===n&&inR(t.waktu)).length;
      return {k:hkSum(l,'kotor'), r:[`<div style="min-width:240px;"><b>${hkEsc(n)}</b><div class="hk-sub">${st?st.role.join(', '):''}${tempat.length?' · '+tempat.map(hkEsc).join(', '):''}${on.length?(tempat.length?', ':' · ')+'input online':''}</div></div>`,
        l.length, hkSum(l,'qty'), hkRp(hkSum(l,'kotor')), hkRp(hkSum(off,'kotor')), hkRp(hkSum(on,'kotor')), hkRp(by(off,'Tunai')), hkRp(by(off,'QRIS')+by(off,'Transfer')),
        `${sh.length} shift${sel?` · <span style="color:var(--danger-text);font-weight:700;">${sel>0?'+':''}${hkRp(sel)}</span>`:''}`, vd?`<span style="color:var(--danger-text);font-weight:700;">${vd}</span>`:'0', hkRp(hkSum(l,'laba'))]}; }).sort((a,b)=>b.k-a.k).map(x=>x.r);
    const off=S.filter(s=>s.jenis==='Offline'), on=S.filter(s=>s.jenis==='Online');
    return {head:['Kasir / Admin','Transaksi','Qty','Penjualan','Offline','Online','Tunai','QRIS + Transfer','Shift & Selisih Kas','Void','Laba Kotor'], rows,
      foot:['Total',S.length,hkSum(S,'qty'),hkRp(hkSum(S,'kotor')),hkRp(hkSum(off,'kotor')),hkRp(hkSum(on,'kotor')),hkRp(by(off,'Tunai')),hkRp(by(off,'QRIS')+by(off,'Transfer')),'',state.posTrx.filter(t=>t.status==='Void'&&inR(t.waktu)).length,hkRp(hkSum(S,'laba'))]}; }
  if(tab==='produk'){ const m=new Map(); S.forEach(s=>s.items.forEach(i=>{ const k=i.sku; if(!m.has(k)) m.set(k,{nama:i.nama,qty:0,kotor:0,hpp:0,off:0,on:0}); const x=m.get(k); x.qty+=i.qty; x.kotor+=i.qty*i.harga; x.hpp+=i.qty*(i.hpp||0); if(s.jenis==='Offline') x.off+=i.qty; else x.on+=i.qty; }));
    const rows=[...m.entries()].sort((a,b)=>b[1].qty-a[1].qty).map(([sku,x])=>[`${hkEsc(x.nama)}<div class="hk-sub">${sku}</div>`,x.qty,x.off,x.on,hkRp(x.kotor),hkRp(x.hpp),hkRp(x.kotor-x.hpp),hkStokRow(state.stokItems,sku)?hkStokRow(state.stokItems,sku).akhir:'–']);
    return {head:['Produk','Qty','Di Event','Online','Penjualan','HPP','Laba Kotor','Sisa Stok'], rows}; }
  const g=hkGroup(S,s=>s.waktu.slice(0,10));
  return {head:['Tanggal','Transaksi','Qty','Penjualan Kotor','Potongan','Bersih','HPP','Laba Kotor','Margin'], rows:[...g.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([d,l])=>moneyRow(hkTgl(d),agg(l))), foot:moneyRow('Total',tot)};
}
function viewLaporan(){
  const P=[['hari','Hari ini'],['7','7 hari'],['bulan','Bulan ini'],['30','30 hari'],['semua','Semua']];
  const JUDUL={saluran:'Laporan per Saluran', event:'Laporan per Event', kasir:'Laporan per Kasir', produk:'Laporan per Produk', harian:'Rekap Harian'};
  const L=lapData(); const [dari,sampai]=lapRange();
  return `<div class="page-head"><span class="page-title">${JUDUL[state.hk.lapTab]}</span><div class="spacer"></div><button class="btn" data-hk-act="lap-csv">⭳ Unduh CSV</button></div>
  <div class="page-sub">${dari?`${hkTgl(dari)} s/d ${hkTgl(sampai)}`:'Semua tanggal'} · Laba kotor = penjualan − potongan marketplace − HPP. Transaksi void dan pesanan batal tidak dihitung.${state.hk.lapTab==='kasir'?' Penjualan di event dan gudang dihitung atas nama kasir yang melayani. Pesanan online dihitung atas nama akun dashboard yang menginput atau mengimpornya.':''}</div>
  <div class="hk-tabsrow"><div class="tabs">${P.map(([k,l])=>`<div class="tab ${state.hk.lapPeriode===k?'active':''}" data-hk-act="lap-per" data-hk-arg="${k}">${l}</div>`).join('')}</div>
    <div class="hk-rentang ${state.hk.lapPeriode==='rentang'?'on':''}"><span>Dari</span><input type="date" data-hk-bind="hk.lapDari" value="${dari||''}" max="${sampai||hkYmd(hkToday())}"><span>s/d</span><input type="date" data-hk-bind="hk.lapSampai" value="${sampai||''}" min="${dari||''}" max="${hkYmd(hkToday())}">${state.hk.lapPeriode==='rentang'?'<span class="hk-rentang-x" data-hk-act="lap-per" data-hk-arg="semua" title="Hapus rentang">✕</span>':''}</div></div>
  ${lapTable(L.head,L.rows,L.foot)}`;
}

/* ════════ PENGATURAN POS ════════ */
function strukPreview(){
  const p=state.posSettings, s=p.struk;
  const r=(a,b)=>`<div class="r"><span>${a}</span><span>${b}</span></div>`;
  return `<div class="hk-struk"><div class="c"><b>${hkEsc(s.nama)}</b></div><div class="c">${hkEsc(s.info)}</div>${s.tampilEvent?`<div class="c">Hikayat Fest Bandung</div>`:''}<hr>
    ${r('HK-261005-31',hkJam(hkIso(new Date())))}${s.tampilKasir?r('Kasir','Budi'):''}<hr>
    ${r('Kaos Burtuqol L ×1','125.000')}${r('Tumbler Hikayat ×1','85.000')}<hr>
    ${r('Subtotal','210.000')}${p.pajakAktif?r(`PPN ${p.pajakPersen}%`,Math.round(210000*p.pajakPersen/100).toLocaleString('id-ID')):''}${r('<b>Total</b>','<b>'+(210000+(p.pajakAktif?Math.round(210000*p.pajakPersen/100):0)).toLocaleString('id-ID')+'</b>')}${r('Tunai','250.000')}${r('Kembali',(40000-(p.pajakAktif?Math.round(210000*p.pajakPersen/100):0)).toLocaleString('id-ID'))}<hr>
    <div class="c">${hkEsc(s.footer)}</div></div>`;
}
function tg(path, on){ return `<div class="toggle ${on?'on':''}" data-hk-toggle="${path}"></div>`; }
function viewPengaturanPOS(){
  const p=state.posSettings;
  return `<div class="page-head"><span class="page-title">Pengaturan POS</span><div class="spacer"></div><span class="hk-sub">Tersimpan otomatis. Berlaku di POS saat kasir membuka layar berikutnya.</span></div>
  <div class="page-sub">Semua yang tampil di aplikasi kasir HP diatur dari sini.</div>
  <div class="hk-set"><div>
    <div class="card"><div class="widget-title">Metode Pembayaran</div>
      <div class="hk-line"><div class="grow"><div class="lbl">Tunai</div><div class="hk-sub">Kasir memasukkan uang diterima, POS menghitung kembalian.</div></div>${tg('posSettings.metode.tunai',p.metode.tunai)}</div>
      ${p.metode.tunai?`<div class="field" style="margin:4px 0 8px;"><label>Tombol uang cepat (pisahkan dengan koma)</label><input data-hk-bind="posSettings._nominal" value="${p.nominalCepat.join(', ')}"></div>`:''}
      <div class="hk-line"><div class="grow"><div class="lbl">QRIS</div><div class="hk-sub">Saat ini hanya QRIS statis: gambar QRIS ditampilkan di HP kasir, pembeli mengetik nominal sendiri, lalu kasir mengisi 4 digit terakhir no. referensi dari notifikasi aplikasi merchant dan menekan Dana Sudah Masuk. Semua kasir boleh mengonfirmasi. Tidak ada cek pembayaran otomatis.</div></div>${tg('posSettings.metode.qris',p.metode.qris)}</div>
      ${p.metode.qris?`<div class="row-2" style="margin:4px 0 8px;"><div class="field"><label>Nama merchant</label><input data-hk-bind="posSettings.qrisNama" value="${hkEsc(p.qrisNama)}"></div><div class="field"><label>NMID</label><input data-hk-bind="posSettings.qrisNmid" value="${hkEsc(p.qrisNmid)}"></div></div><div class="hk-qris-up"><div class="hk-qris-prev">${p.qrisImg?`<img src="${p.qrisImg}" alt="QRIS">`:'<span style="color:var(--danger-text);">Belum ada gambar. POS menampilkan contoh dengan peringatan.</span>'}</div>
        <div><div class="lbl">Gambar QRIS statis</div><div class="hk-sub" style="margin:2px 0 8px;">Foto atau screenshot QRIS dari bank/penyedia. Gambar ini yang ditampilkan di HP kasir. JPG/PNG, akan dikecilkan otomatis.</div>
        <label class="btn" style="display:inline-block;cursor:pointer;">${p.qrisImg?'Ganti gambar':'Unggah gambar'}<input type="file" accept="image/*" data-hk-qris hidden></label>${p.qrisImg?` <button class="btn" data-hk-act="qris-hapus">Hapus</button>`:''}</div></div>`:''}
      <div class="hk-line"><div class="grow"><div class="lbl">Transfer Bank</div><div class="hk-sub">Rekening tampil di POS. Kasir mengonfirmasi setelah cek mutasi.</div></div>${tg('posSettings.metode.transfer',p.metode.transfer)}</div>
      ${p.metode.transfer?`<table class="hk-varian" style="margin:6px 0 4px;"><thead><tr><th>Bank</th><th>No. Rekening</th><th>Atas Nama</th><th></th></tr></thead><tbody>${p.rekening.map((r,i)=>`<tr><td><input data-hk-bind="posSettings.rekening.${i}.bank" value="${hkEsc(r.bank)}"></td><td><input data-hk-bind="posSettings.rekening.${i}.no" value="${hkEsc(r.no)}"></td><td><input data-hk-bind="posSettings.rekening.${i}.nama" value="${hkEsc(r.nama)}"></td><td><span class="icon-btn" data-hk-act="rek-del" data-hk-arg="${i}">🗑</span></td></tr>`).join('')}</tbody></table><span class="btn-text" data-hk-act="rek-add" style="cursor:pointer;">+ Tambah rekening</span>`:''}
    </div>
    <div class="card"><div class="widget-title">Harga, Diskon & Pajak</div>
      <div class="hk-line"><div class="grow"><div class="lbl">Kasir boleh memberi diskon manual</div><div class="hk-sub">Di atas batas ini kasir harus minta PIN Admin/Owner.</div></div>${tg('posSettings.diskonKasir',p.diskonKasir)}</div>
      ${p.diskonKasir?`<div class="field" style="max-width:200px;margin:4px 0 8px;"><label>Batas diskon kasir (%)</label><input type="number" data-hk-bind="posSettings.diskonMaks" value="${p.diskonMaks}"></div>`:''}
      <div class="hk-line"><div class="grow"><div class="lbl">Pembulatan total</div><div class="hk-sub">Dibulatkan ke bawah supaya tidak repot uang receh.</div></div>
        <select class="hk-sel" data-hk-bind="posSettings.pembulatan">${[[0,'Tanpa pembulatan'],[100,'Rp 100'],[500,'Rp 500'],[1000,'Rp 1.000']].map(([v,l])=>`<option value="${v}" ${+p.pembulatan===v?'selected':''}>${l}</option>`).join('')}</select></div>
      <div class="hk-line"><div class="grow"><div class="lbl">Pajak (PPN)</div><div class="hk-sub">Aktifkan hanya kalau perusahaan sudah PKP.</div></div>${tg('posSettings.pajakAktif',p.pajakAktif)}</div>
      ${p.pajakAktif?`<div class="field" style="max-width:200px;margin:4px 0 8px;"><label>Tarif (%)</label><input type="number" data-hk-bind="posSettings.pajakPersen" value="${p.pajakPersen}"></div>`:''}
    </div>
    <div class="card"><div class="widget-title">Keamanan Kasir</div>
      <div class="hk-line"><div class="grow"><div class="lbl">Kunci layar otomatis</div><div class="hk-sub">POS terkunci kalau tidak disentuh selama waktu ini. Dibuka dengan PIN kasir.</div></div>
        <select class="hk-sel" data-hk-bind="posSettings.kunciMenit">${[[0,'Mati'],[5,'5 menit'],[10,'10 menit'],[20,'20 menit'],[30,'30 menit']].map(([v,l])=>`<option value="${v}" ${+p.kunciMenit===v?'selected':''}>${l}</option>`).join('')}</select></div>
      <div class="hk-line"><div class="grow"><div class="lbl">Masuk POS dengan PIN</div><div class="hk-sub">PIN tiap karyawan diatur di menu Karyawan.</div></div>${tg('posSettings.wajibPin',p.wajibPin)}</div>
      <div class="hk-line"><div class="grow"><div class="lbl">Void transaksi butuh PIN Admin/Owner</div><div class="hk-sub">Mencegah kasir membatalkan transaksi tunai tanpa sepengetahuan atasan.</div></div>${tg('posSettings.voidPin',p.voidPin)}</div>
    </div>
    <div class="card"><div class="widget-title">Tampilan Katalog</div>
      <div class="hk-line"><div class="grow"><div class="lbl">Kolom produk di layar HP</div></div><select class="hk-sel" data-hk-bind="posSettings.gridKolom">${[2,3].map(v=>`<option value="${v}" ${+p.gridKolom===v?'selected':''}>${v} kolom</option>`).join('')}</select></div>
      <div class="hk-line"><div class="grow"><div class="lbl">Tampilkan sisa stok di kartu produk</div></div>${tg('posSettings.tampilStok',p.tampilStok)}</div>
      <div class="hk-line"><div class="grow"><div class="lbl">Produk yang tampil di POS</div><div class="hk-sub">${state.products.filter(x=>x.tampilPos!==false&&x.status==='Aktif').length} dari ${state.products.length} produk. Atur lewat kolom "Tampil di POS" di Daftar Produk.</div></div><button class="btn" data-nav="produk-list">Atur Produk</button></div>
    </div>
    <div class="card"><div class="widget-title">Data Prototipe</div>
      <div class="hk-line"><div class="grow"><div class="lbl">Kembalikan data contoh</div><div class="hk-sub">Menghapus semua perubahan di dashboard dan POS pada browser ini.</div></div><button class="btn" data-hk-act="reset">Reset Data</button></div>
    </div>
  </div>
  <div style="position:sticky;top:0;"><div class="card"><div class="widget-title">Struk</div>
    <div class="field"><label>Nama di struk</label><input data-hk-bind="posSettings.struk.nama" value="${hkEsc(p.struk.nama)}"></div>
    <div class="field"><label>Baris info</label><input data-hk-bind="posSettings.struk.info" value="${hkEsc(p.struk.info)}"></div>
    <div class="field"><label>Pesan penutup</label><input data-hk-bind="posSettings.struk.footer" value="${hkEsc(p.struk.footer)}"></div>
    <div class="hk-line"><div class="grow">Tampilkan nama kasir</div>${tg('posSettings.struk.tampilKasir',p.struk.tampilKasir)}</div>
    <div class="hk-line" style="margin-bottom:10px;"><div class="grow">Tampilkan nama event</div>${tg('posSettings.struk.tampilEvent',p.struk.tampilEvent)}</div>
    <div id="hkStrukPrev">${strukPreview()}</div></div></div>
  </div>`;
}

/* ════════ PRODUK ════════ */
viewProdukList=function(){
  const h=state.hk, q=h.prodSearch.toLowerCase();
  let list=state.products.map((p,i)=>({p,i}));
  if(h.prodTab==='pos') list=list.filter(x=>x.p.tampilPos!==false&&x.p.status==='Aktif');
  if(h.prodTab==='tidak') list=list.filter(x=>!(x.p.tampilPos!==false&&x.p.status==='Aktif'));
  if(h.prodKat) list=list.filter(x=>x.p.kategori===h.prodKat);
  if(q) list=list.filter(x=>x.p.nama.toLowerCase().includes(q)||x.p.sku.toLowerCase().includes(q));
  const lok=lokasiTerpilih();
  const stokOf=sku=>lok?hkStokDi(state.stokItems,sku,lok):(hkStokRow(state.stokItems,sku)||{akhir:0}).akhir;
  const rows=list.map(({p,i})=>{
    const vs=p.varian&&p.varian.length?p.varian:null;
    const harga=vs?(()=>{ const a=vs.map(v=>+v.jual); const mn=Math.min(...a), mx=Math.max(...a); return mn===mx?hkRp(mn):`${hkRp(mn)} – ${hkRp(mx)}`; })():hkRp(p.jual);
    const minJual=vs?Math.min(...vs.map(v=>+v.jual)):+p.jual;
    const margin=minJual?Math.round((minJual-p.modal)/minJual*100):0;
    const stok=vs?vs.reduce((a,v)=>a+stokOf(v.sku),0):stokOf(p.sku);
    let row=`<tr><td>${vs?`<span class="chevron" data-toggle-varian="${i}" style="display:inline-block;transform:rotate(${p.expanded?90:0}deg);">›</span>`:''}</td>
      <td><span class="hk-row-link" data-hk-act="prod-edit" data-hk-arg="${i}" style="font-weight:600;">${hkEsc(p.nama)}</span>${vs?`<div class="hk-sub">${vs.length} varian</div>`:''}</td><td>${p.sku}</td><td>${hkEsc(p.kategori)}</td>
      <td class="hk-num">${hkRp(p.modal)}</td><td class="hk-num">${harga}</td><td class="hk-num">${margin}%</td><td class="hk-num" style="${stok<=(p.stokMin||0)?'color:var(--danger-text);font-weight:700;':''}">${stok}</td>
      <td>${mpProduk(p).map(n=>`<span class="badge badge-mp">${hkEsc(n)}</span>`).join(' ')||'<span class="hk-sub">–</span>'}</td><td>${tg('products.'+i+'.tampilPos',p.tampilPos!==false)}</td><td><span class="badge ${p.status==='Aktif'?'badge-success':'badge-warn'}">${p.status}</span></td></tr>`;
    if(vs&&p.expanded) vs.forEach(v=>{ row+=`<tr class="varian-row"><td></td><td style="padding-left:26px;">${hkEsc(v.nama)}</td><td>${v.sku}</td><td></td><td></td><td class="hk-num">${hkRp(v.jual)}</td><td></td><td class="hk-num">${stokOf(v.sku)}</td><td>${state.marketplaceChannels.filter(ch=>ch.produk.some(x=>x.sku===v.sku)).map(ch=>{ const e=ch.produk.find(x=>x.sku===v.sku); return `<span class="hk-sub">${hkEsc(ch.nama)} ${hkRp(e.hargaJual)}</span>`; }).join('<br>')}</td><td></td><td></td></tr>`; });
    return row; }).join('');
  return `<div class="page-head"><span class="page-title">Daftar Produk</span><div class="spacer"></div><button class="btn" data-hk-act="harga-open" data-hk-arg="gudang">Harga Jual Langsung Gudang${Object.keys(state.posSettings.hargaGudang||{}).length?` (${Object.keys(state.posSettings.hargaGudang).length})`:''}</button><button class="btn btn-primary" data-hk-act="prod-new">+ Tambah Produk</button></div>
  <div class="page-sub">${state.products.length} produk · Stok: ${lok?hkEsc(lok):'semua lokasi'} · Klik nama produk untuk mengubah</div>
  <div class="toolbar"><input class="search-input" placeholder="Cari nama atau SKU..." value="${hkEsc(h.prodSearch)}" data-hk-bind="hk.prodSearch" data-hk-live="1"><select class="btn" data-hk-bind="hk.prodKat"><option value="">Semua Kategori</option>${categoryNames().map(c=>`<option ${h.prodKat===c?'selected':''}>${c}</option>`).join('')}</select></div>
  <div class="tabs">${[['semua','Semua'],['pos','Tampil di POS'],['tidak','Tidak Tampil di POS']].map(([k,l])=>`<div class="tab ${h.prodTab===k?'active':''}" data-hk-act="prod-tab" data-hk-arg="${k}">${l}</div>`).join('')}</div>
  <div class="card" style="padding:0;overflow:hidden;"><table><thead><tr><th></th><th>Nama Produk</th><th>SKU</th><th>Kategori</th><th class="hk-num">HPP</th><th class="hk-num">Harga Jual</th><th class="hk-num">Margin</th><th class="hk-num">Stok</th><th>Marketplace</th><th>Tampil di POS</th><th>Status</th></tr></thead><tbody>${rows||`<tr><td colspan="11" class="hk-empty">Tidak ada produk</td></tr>`}</tbody></table></div>`;
};
/* harga marketplace per produk: toggle per marketplace, harga per varian */
window.hkDiSaluran=(saluran,sku)=>{ const ch=state.marketplaceChannels.find(m=>m.nama===saluran); return !ch||ch.produk.some(x=>x.sku===sku); };
function mpDari(p){ const cat=p?hkCatalog([p]):[];
  return state.marketplaceChannels.map(ch=>{ const harga={}; let aktif=false;
    cat.forEach(c=>{ const e=ch.produk.find(x=>x.sku===c.sku); if(!e) return; aktif=true; const key=p.varian&&p.varian.length?'v'+p.varian.findIndex(v=>v.sku===c.sku):'p'; if(+e.hargaJual!==c.harga) harga[key]=String(e.hargaJual); });
    return {aktif, harga}; }); }
/* impor pesanan: SKU yang belum terdaftar di marketplace tujuan */
window.hkMpBelum=()=>{ const im=state.po&&state.po.importer; if(!im||!im.orders) return []; const ch=state.marketplaceChannels.find(m=>m.nama===im.saluran); if(!ch) return [];
  const out=new Map(); im.orders.forEach(o=>{ if(!o.include||o.duplikat||o.batal) return; hkPOImpor.resolvedLines(o).forEach(l=>{ if(!ch.produk.some(x=>x.sku===l.sku)&&!out.has(l.sku)) out.set(l.sku,{sku:l.sku, nama:l.nama, hargaFile:+l.harga||0, pesanan:0}); if(out.has(l.sku)) out.get(l.sku).pesanan++; }); });
  return [...out.values()]; };
window.hkMpBelumHTML=()=>{ const b=hkMpBelum(); if(!b.length) return ''; const sal=state.po.importer.saluran;
  return `<div class="po-unknown" style="background:#FFF6E5;border-color:#F5D9A8;"><b>${b.length} produk belum terdaftar di ${hkEsc(sal)}:</b> ${b.map(x=>hkEsc(x.nama)).join(', ')}. Daftarkan harga ${hkEsc(sal)}-nya dulu. Setelah disimpan, file ini langsung diimpor.
    <div style="margin-top:8px;"><button class="btn btn-primary" data-hk-act="mpreg-open">Daftarkan harga ${hkEsc(sal)}</button></div></div>`; };
function mpregModal(){
  const sal=state.po.importer.saluran, b=hkMpBelum(), m=state.hk.modal, cat=hkCatalog(state.products);
  return `<div class="confirm-box hk-modal hk-page"><div class="hk-mh"><span class="close" data-hk-act="modal-close">✕</span><h4>Daftarkan harga ${hkEsc(sal)}</h4></div>
    <div class="hk-mb"><div class="help-text" style="margin-bottom:10px;">Produk ini ada di file impor ${hkEsc(sal)} tapi sakelar ${hkEsc(sal)}-nya belum aktif di Daftar Produk. Harga terisi dari file. Setelah disimpan, produk aktif di ${hkEsc(sal)} dan file langsung diimpor.</div>
    <table class="hk-varian"><thead><tr><th>Produk</th><th class="hk-num">Harga jual</th><th class="hk-num">Harga di file</th><th class="hk-num">Harga ${hkEsc(sal)}</th></tr></thead><tbody>
    ${b.map(x=>{ const c=cat.find(k=>k.sku===x.sku); return `<tr><td>${hkEsc(x.nama)}<div class="hk-sub">${x.sku} · ${x.pesanan} baris di file</div></td><td class="hk-num">${hkRp(c?c.harga:0)}</td><td class="hk-num">${hkRp(x.hargaFile)}</td>
      <td class="hk-num"><input type="number" min="0" style="width:140px;text-align:right;" data-hk-harga="${x.sku}" value="${hkEsc(m.harga[x.sku]??x.hargaFile)}"></td></tr>`; }).join('')}</tbody></table></div>
    <div class="hk-mf"><div class="spacer"></div><button class="btn" data-hk-act="modal-close">Batal</button><button class="btn btn-primary" data-hk-act="mpreg-save">Simpan harga & impor</button></div></div>`;
}
function mpProduk(p){ const skus=new Set([p.sku,...hkCatalog([p]).map(c=>c.sku)]); return state.marketplaceChannels.filter(ch=>ch.produk.some(x=>skus.has(x.sku))).map(ch=>ch.nama); }
function mpFormHTML(f){
  const rows=f.varianAktif?f.varian.map((v,i)=>({key:'v'+i, nama:v.nama.trim(), normal:+(v.jual||f.jual)||0})).filter(r=>r.nama):[{key:'p', nama:f.nama.trim()||'Produk', normal:+f.jual||0}];
  return `<div class="form-section-title">Harga Marketplace</div>
    <div class="help-text">Aktifkan hanya di marketplace tempat produk ini dijual. Harga yang dikosongkan memakai harga jual.</div>
    ${state.marketplaceChannels.map((ch,i)=>{ const m=f.mp[i]||(f.mp[i]={aktif:false,harga:{}}); return `<div class="hk-mp ${m.aktif?'on':''}">
      <div class="hk-line"><div class="grow"><div class="lbl">${hkEsc(ch.nama)}${ch.status?'':' <span class="badge badge-warn">Toko nonaktif</span>'}</div><div class="hk-sub">${m.aktif?`Dijual di ${hkEsc(ch.nama)}`:`Tidak dijual di ${hkEsc(ch.nama)}`}</div></div>${tg('hk.prodForm.mp.'+i+'.aktif',m.aktif)}</div>
      ${m.aktif?`<table class="hk-varian"><thead><tr><th>${f.varianAktif?'Varian':'Produk'}</th><th class="hk-num">Harga Jual</th><th class="hk-num">Harga ${hkEsc(ch.nama)}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${hkEsc(r.nama)}</td><td class="hk-num">${hkRp(r.normal)}</td><td class="hk-num"><input type="number" min="0" style="width:140px;text-align:right;" data-hk-bind="hk.prodForm.mp.${i}.harga.${r.key}" value="${hkEsc(m.harga[r.key]||'')}" placeholder="${r.normal}"></td></tr>`).join('')||'<tr><td colspan="3" class="hk-empty">Isi varian dulu</td></tr>'}</tbody></table>`:''}</div>`; }).join('')}`;
}
function newProdForm(){ return {index:null, nama:'', deskripsi:'', kategori:'', satuan:'Pcs', sku:'', jual:'', modal:'', stokMin:'5', tampilPos:true, aktif:true, varianAktif:false, atribut:'Ukuran', varian:[{nama:'S',sku:'',jual:''},{nama:'M',sku:'',jual:''},{nama:'L',sku:'',jual:''}], stokAwal:{}, mp:mpDari(null)}; }
function varianRowsHTML(){
  const f=state.hk.prodForm;
  return f.varian.map((v,i)=>`<tr><td><input data-hk-bind="hk.prodForm.varian.${i}.nama" value="${hkEsc(v.nama)}" placeholder="S / M · Hitam"></td><td><input data-hk-bind="hk.prodForm.varian.${i}.sku" value="${hkEsc(v.sku)}" placeholder="${hkEsc((f.sku||'SKU')+'-'+(v.nama||'X')).toUpperCase().replace(/[^A-Z0-9-]+/g,'-')}"></td>
    <td><input type="number" data-hk-bind="hk.prodForm.varian.${i}.jual" value="${hkEsc(v.jual)}" placeholder="${hkEsc(f.jual||'0')}"></td>
    ${f.index==null?`<td><input type="number" data-hk-bind="hk.prodForm.stokAwal.v${i}" value="${hkEsc(f.stokAwal['v'+i]||'')}" placeholder="0"></td>`:''}<td><span class="icon-btn" data-hk-act="var-del" data-hk-arg="${i}">🗑</span></td></tr>`).join('');
}
viewProdukForm=function(){
  const f=state.hk.prodForm||(state.hk.prodForm=newProdForm()); const baru=f.index==null; if(!f.mp) f.mp=mpDari(baru?null:state.products[f.index]);
  return `${backButtonHTML()}<div class="page-head"><span class="page-title">${baru?'Tambah Produk':'Ubah Produk'}</span></div>
  <div class="card" style="max-width:860px;margin:0 auto;">
    <div class="form-section-title">Informasi Produk</div>
    <div class="field"><label>Nama Produk<span class="req">*</span></label><input data-hk-bind="hk.prodForm.nama" value="${hkEsc(f.nama)}" placeholder="Contoh: Kaos Burtuqol Palestina"></div>
    <div class="field"><label>Deskripsi</label><textarea rows="2" data-hk-bind="hk.prodForm.deskripsi" placeholder="Opsional">${hkEsc(f.deskripsi)}</textarea></div>
    <div class="row-2"><div class="field"><label>Kategori<span class="req">*</span></label><select data-hk-bind="hk.prodForm.kategori"><option value="">Pilih kategori</option>${categoryNames().map(c=>`<option ${f.kategori===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="field"><label>SKU Induk<span class="req">*</span></label><input data-hk-bind="hk.prodForm.sku" value="${hkEsc(f.sku)}" placeholder="Contoh: KBP-005" ${baru?'':'disabled'}></div></div>
    <div class="row-2"><div class="field"><label>HPP / Harga Pokok<span class="req">*</span><div class="help-text" style="margin:2px 0 0;">Biaya per pcs sampai barang siap jual. Dipakai untuk laba kotor.</div></label><input type="number" data-hk-bind="hk.prodForm.modal" value="${hkEsc(f.modal)}" placeholder="0"></div>
      <div class="field"><label>Harga Jual${f.varianAktif?' (default varian)':''}<span class="req">*</span><div class="help-text" style="margin:2px 0 0;">Harga di event dan Gudang Pusat. Harga marketplace diatur di bagian bawah.</div></label><input type="number" data-hk-bind="hk.prodForm.jual" value="${hkEsc(f.jual)}" placeholder="0"></div></div>
    <div class="row-2"><div class="field"><label>Satuan</label><select data-hk-bind="hk.prodForm.satuan">${['Pcs','Pack','Set','Box'].map(s=>`<option ${f.satuan===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>Batas stok menipis</label><input type="number" data-hk-bind="hk.prodForm.stokMin" value="${hkEsc(f.stokMin)}"></div></div>
    <div class="hk-line"><div class="grow"><div class="lbl">Tampil di POS</div><div class="hk-sub">Matikan untuk produk yang hanya dijual online.</div></div>${tg('hk.prodForm.tampilPos',f.tampilPos)}</div>
    <div class="hk-line"><div class="grow"><div class="lbl">Produk aktif</div></div>${tg('hk.prodForm.aktif',f.aktif)}</div>
    <div class="form-section-title">Varian</div>
    <div class="hk-line"><div class="grow"><div class="lbl">Produk ini punya varian (ukuran, warna)</div><div class="hk-sub">Stok dihitung terpisah untuk tiap varian.</div></div>${tg('hk.prodForm.varianAktif',f.varianAktif)}</div>
    ${f.varianAktif?`<table class="hk-varian" style="margin-top:6px;"><thead><tr><th>Varian</th><th>SKU Varian</th><th>Harga Jual</th>${baru?`<th>Stok Awal di ${HK_GUDANG}</th>`:''}<th></th></tr></thead><tbody id="hkVarBody">${varianRowsHTML()}</tbody></table>
      <span class="btn-text" style="cursor:pointer;" data-hk-act="var-add">+ Tambah varian</span><div class="help-text" style="margin-top:6px;">SKU varian yang dikosongkan akan dibuat otomatis. Harga kosong memakai harga jual default.</div>`
      :(baru?`<div class="field" style="max-width:240px;margin-top:8px;"><label>Stok awal di ${HK_GUDANG}</label><input type="number" data-hk-bind="hk.prodForm.stokAwal.p" value="${hkEsc(f.stokAwal.p||'')}" placeholder="0"></div>`:'')}
    ${baru?'':`<div class="help-text" style="margin-top:8px;">Perubahan stok dilakukan lewat Faktur Pembelian, Stok Opname, atau Kirim Stok di Event.</div>`}
    ${mpFormHTML(f)}
    <div class="form-actions"><button class="btn" data-nav="produk-list">Batal</button><div class="spacer"></div><button class="btn btn-primary" data-hk-act="prod-save">Simpan</button></div>
  </div>`;
};
function saveProduk(){
  const f=state.hk.prodForm, baru=f.index==null;
  if(!f.nama.trim()||!f.kategori||!f.sku.trim()||f.modal===''||(f.jual===''&&!f.varianAktif)){ toast('Lengkapi nama, kategori, SKU, HPP, dan harga jual'); return; }
  const sku=f.sku.trim().toUpperCase();
  if(baru&&state.products.some(p=>p.sku===sku)){ toast('SKU sudah dipakai produk lain'); return; }
  const varian=f.varianAktif?f.varian.filter(v=>v.nama.trim()).map(v=>({nama:v.nama.trim(), sku:(v.sku.trim()||`${sku}-${v.nama}`).toUpperCase().replace(/[^A-Z0-9-]+/g,'-'), jual:Number(v.jual||f.jual)||0})):null;
  if(f.varianAktif&&(!varian.length||varian.some(v=>!v.jual))){ toast('Isi minimal satu varian beserta harganya'); return; }
  const prod={nama:f.nama.trim(), sku, kategori:f.kategori, satuan:f.satuan, modal:Number(f.modal)||0, beli:Number(f.modal)||0, jual:varian?null:Number(f.jual)||0,
    status:f.aktif?'Aktif':'Nonaktif', tampilPos:f.tampilPos, stokMin:Number(f.stokMin)||0, deskripsi:f.deskripsi, varian:varian||undefined};
  if(baru) state.products.unshift(prod); else Object.assign(state.products[f.index], prod);
  hkCatalog([prod]).forEach((c,ci)=>{
    let it=hkStokRow(state.stokItems,c.sku);
    if(!it){ it={sku:c.sku, nama:c.nama, parent:c.parent, jenis:'Produk', kategori:c.kategori, awal:0, masuk:0, terjual:0, akhir:0, keluar:0, terbuang:0, terproduksi:0, transit:0, satuan:prod.satuan, perOutlet:[]}; state.stokItems.unshift(it); }
    it.nama=c.nama; it.kategori=c.kategori;
    const awal=Number(baru?(varian?f.stokAwal['v'+f.varian.findIndex(v=>v.nama.trim()===c.varNama)]:f.stokAwal.p):0)||0;
    if(awal){ const p=hkPO(it,HK_GUDANG); p.awal+=awal; p.akhir+=awal; it.awal+=awal; it.akhir+=awal; }
  });
  const catP=hkCatalog([prod]), skusP=new Set([sku,...catP.map(c=>c.sku)]);
  state.marketplaceChannels.forEach((ch,ci)=>{ ch.produk=ch.produk.filter(x=>!skusP.has(x.sku)); const m=f.mp&&f.mp[ci]; if(!m||!m.aktif) return;
    catP.forEach(c=>{ const key=varian?'v'+f.varian.findIndex(v=>v.nama.trim()===c.varNama):'p'; ch.produk.push({sku:c.sku, nama:c.nama, satuan:prod.satuan, hargaAwal:c.harga, hargaJual:Number(m.harga[key])||c.harga}); }); });
  state.hk.prodForm=null; state.view='produk-list'; toast(baru?'Produk ditambahkan dan langsung tersedia di POS':'Produk diperbarui'); render();
}

/* ════════ KARYAWAN (PIN POS) ════════ */
viewKaryawan=function(){
  const M=state.masukPos||[], H=state.hk, f=H.msNama||'';
  const rows=state.staff.map((s,i)=>{ const ev=state.events.filter(e=>!e.ditutup&&e.kasir.includes(s.nama)).map(e=>e.nama);
    const last=M.find(m=>m.nama===s.nama&&m.aksi!=='PIN salah'&&!m.aksi.startsWith('PIN salah'));
    const owner=ownerLogin();
    return `<tr class="${owner?'hk-row-link':''}" ${owner?`data-hk-act="staff-edit" data-hk-arg="${i}"`:''}><td><b>${hkEsc(s.nama)}</b><div class="hk-sub">${hkEsc(s.telp||'')}</div></td><td>${hkAksesDashboard(s)?hkEsc(s.email||'-'):'<span class="hk-sub">POS saja</span>'}</td><td>${s.role.map(r=>`<span class="badge badge-role">${r}</span>`).join('')}</td>
    <td>${hkAksesDashboard(s)?(s.pwBaru?'<span class="badge badge-warn">Password sementara</span>':'<span class="badge badge-success">Password diganti</span>'):''}<div style="margin-top:3px;">${s.pinBaru?'<span class="badge badge-warn">PIN sementara</span>':'<span class="badge badge-success">PIN diganti</span>'}</div></td><td>${ev.map(hkEsc).join(', ')||'<span class="hk-sub">–</span>'}</td>
    <td>${last?`${hkTgl(last.waktu)} ${hkJam(last.waktu)}<div class="hk-sub">${hkEsc(last.aksi)}${last.tempat?' · '+hkEsc(last.tempat):''}</div>`:'<span class="hk-sub">Belum pernah</span>'}</td>
    <td><span class="badge ${s.aktif!==false?'badge-success':'badge-warn'}">${s.aktif!==false?'Aktif':'Nonaktif'}</span></td></tr>`; }).join('');
  const L=M.filter(m=>!f||m.nama===f).slice(0,60), salah=M.filter(m=>m.aksi.startsWith('PIN salah')&&m.waktu.slice(0,10)===hkYmd(new Date())).length;
  return `<div class="page-head"><span class="page-title">Karyawan</span><div class="spacer"></div>${ownerLogin()?'<button class="btn btn-primary" data-hk-act="staff-new">+ Tambah Karyawan</button>':''}</div>
  <div class="page-sub">Semua karyawan didaftarkan Owner di sini. Admin dan Owner masuk dashboard dengan email dan password; semua karyawan masuk POS dengan PIN 6 angka. Password dan PIN dari Owner bersifat sementara dan wajib diganti karyawan saat pertama kali masuk. Tidak ada verifikasi email.${ownerLogin()?'':' <b>Hanya Owner yang bisa menambah dan mengubah karyawan.</b>'}</div>
  <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px;"><table><thead><tr><th>Nama</th><th>Email dashboard</th><th>Role</th><th>Status akun</th><th>Bertugas di Event</th><th>Terakhir di POS</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="page-head"><span class="page-title" style="font-size:15px;">Riwayat Masuk POS</span>${salah?`<span class="badge badge-danger" style="margin-left:8px;">${salah}× PIN salah hari ini</span>`:''}<div class="spacer"></div>
    <select class="btn" data-hk-bind="hk.msNama"><option value="">Semua karyawan</option>${state.staff.map(x=>`<option ${f===x.nama?'selected':''}>${hkEsc(x.nama)}</option>`).join('')}</select></div>
  <div class="card" style="padding:0;overflow:auto;"><table><thead><tr><th>Waktu</th><th>Karyawan</th><th>Aktivitas</th><th>Tempat</th><th>Perangkat</th></tr></thead><tbody>
  ${L.map(m=>`<tr><td>${hkTgl(m.waktu)} ${hkJam(m.waktu)}</td><td><b>${hkEsc(m.nama)}</b><div class="hk-sub">${hkEsc(m.role)}</div></td><td><span class="badge ${m.aksi.startsWith('PIN salah')?'badge-danger':m.aksi==='Masuk'||m.aksi==='Buka kasir'||m.aksi==='Gabung kasir'?'badge-success':'badge-mut'}">${hkEsc(m.aksi)}</span></td><td>${hkEsc(m.tempat||'–')}</td><td>${hkEsc(m.perangkat||'–')}</td></tr>`).join('')||'<tr><td colspan="5" class="hk-empty">Belum ada riwayat</td></tr>'}
  </tbody></table></div><div class="hk-sub" style="margin-top:8px;">Menampilkan ${L.length} kejadian terakhir.</div>`;
};
function ownerLogin(){ const a=akun(); return !!a&&a.role.includes('Owner'); }
const acakPw=()=>{ const h='abcdefghjkmnpqrstuvwxyz', d='23456789'; let p=''; for(let i=0;i<6;i++) p+=h[Math.floor(Math.random()*h.length)]; return p+d[Math.floor(Math.random()*d.length)]+d[Math.floor(Math.random()*d.length)]; };
const acakPin=()=>{ for(let i=0;i<200;i++){ const p=String(Math.floor(Math.random()*1e6)).padStart(6,'0'); if(!hkPinLemah(p,state.staff)) return p; } return ''; };
function staffModal(){
  const f=state.hk.staffForm, dash=f.role.some(r=>r==='Admin'||r==='Owner'), baru=f.index==null, lama=baru?null:state.staff[f.index];
  const perluPw=dash&&(baru||f.resetPw||!lama.pw), perluPin=baru||f.resetPin;
  return `<div class="confirm-box hk-modal hk-page" style="width:560px;"><div class="hk-mh"><span class="close" data-hk-act="modal-close">✕</span><h4>${baru?'Tambah Karyawan':'Ubah Karyawan'}</h4></div><div class="hk-mb">
    <div class="field"><label>Nama<span class="req">*</span></label><input id="hkStNama" data-hk-bind="hk.staffForm.nama" value="${hkEsc(f.nama)}"></div>
    <div class="field"><label>Telepon</label><input data-hk-bind="hk.staffForm.telp" value="${hkEsc(f.telp)}"></div>
    <div class="field"><label>Role<span class="req">*</span><div class="help-text">Admin dan Owner bisa masuk dashboard. Semua role bisa masuk POS.</div></label><div class="hk-chiplist">${['Owner','Admin','Kasir'].map(r=>`<div class="hk-check ${f.role.includes(r)?'on':''}" data-hk-act="staff-role" data-hk-arg="${r}">${r}</div>`).join('')}</div></div>
    ${dash?`<div class="form-section-title">Akun dashboard</div>
    <div class="field"><label>Email<span class="req">*</span><div class="help-text">Dipakai untuk masuk. Tidak perlu verifikasi.</div></label><input id="hkStEmail" type="email" data-hk-bind="hk.staffForm.email" value="${hkEsc(f.email||'')}" placeholder="nama@hikayat.id"></div>
    ${perluPw?`<div class="field"><label>Password sementara<span class="req">*</span><div class="help-text">Minimal 8 karakter, huruf dan angka. Karyawan wajib menggantinya saat pertama masuk.</div></label><div style="display:flex;gap:8px;"><input id="hkStPw" data-hk-bind="hk.staffForm.pw" value="${hkEsc(f.pw||'')}" autocomplete="off"><button type="button" class="btn" style="white-space:nowrap;" data-hk-act="staff-acak" data-hk-arg="pw">Buat acak</button></div></div>`
      :`<div class="field"><label>Password</label><div style="display:flex;gap:8px;align-items:center;"><span class="hk-sub" style="flex:1;">${lama.pwBaru?'Masih sementara, belum diganti karyawan':'Sudah diganti karyawan'}</span><button type="button" class="btn" style="white-space:nowrap;" data-hk-act="staff-reset" data-hk-arg="pw">Reset password</button></div></div>`}`:''}
    <div class="form-section-title">PIN POS</div>
    ${perluPin?`<div class="field"><label>PIN sementara<span class="req">*</span><div class="help-text">6 angka, tidak boleh sama semua atau berurutan, dan unik. Karyawan wajib menggantinya saat pertama masuk POS.</div></label><div style="display:flex;gap:8px;"><input id="hkStPin" data-hk-bind="hk.staffForm.pin" value="${hkEsc(f.pin||'')}" maxlength="6" inputmode="numeric" style="letter-spacing:6px;"><button type="button" class="btn" style="white-space:nowrap;" data-hk-act="staff-acak" data-hk-arg="pin">Buat acak</button></div></div>`
      :`<div class="field"><label>PIN</label><div style="display:flex;gap:8px;align-items:center;"><span class="hk-sub" style="flex:1;">${lama.pinBaru?'Masih sementara, belum diganti karyawan':'Sudah diganti karyawan'}</span><button type="button" class="btn" style="white-space:nowrap;" data-hk-act="staff-reset" data-hk-arg="pin">Reset PIN</button></div></div>`}
    <div class="hk-line"><div class="grow">Aktif<div class="hk-sub">Karyawan nonaktif tidak bisa masuk dashboard maupun POS.</div></div>${tg('hk.staffForm.aktif',f.aktif)}</div></div>
    <div class="hk-mf"><div class="spacer"></div><button class="btn" data-hk-act="modal-close">Batal</button><button class="btn btn-primary" data-hk-act="staff-save">Simpan</button></div></div>`;
}
function staffInfoModal(){ const m=state.hk.modal;
  return `<div class="confirm-box hk-modal" style="width:480px;"><div class="hk-mh"><h4>Berikan ke ${hkEsc(m.nama)}</h4><div class="spacer"></div><span class="close" style="cursor:pointer;" data-hk-act="modal-close">✕</span></div><div class="hk-mb">
    <div class="hk-sub" style="margin-bottom:10px;">Catat dan berikan langsung ke karyawan. Data sementara ini hanya tampil sekali dan wajib diganti karyawan saat pertama masuk.</div>
    <table class="hk-varian"><tbody>${m.email?`<tr><td>Email dashboard</td><td><b>${hkEsc(m.email)}</b></td></tr>`:''}${m.pw?`<tr><td>Password sementara</td><td><b style="font-family:monospace;font-size:14px;">${hkEsc(m.pw)}</b></td></tr>`:''}${m.pin?`<tr><td>PIN POS sementara</td><td><b style="font-family:monospace;font-size:14px;letter-spacing:3px;">${hkEsc(m.pin)}</b></td></tr>`:''}</tbody></table>
  </div><div class="hk-mf"><div class="spacer"></div><button class="btn btn-primary" data-hk-act="modal-close">Sudah dicatat</button></div></div>`; }

/* ════════ STOK PER LOKASI ════════ */
const _getFilteredStok=getFilteredStok;
getFilteredStok=function(){
  const list=_getFilteredStok(); const l=lokasiTerpilih(); if(!l) return list;
  return list.map(it=>{ const p=it.perOutlet.find(x=>x.outlet===l)||{awal:0,masuk:0,keluar:0,terjual:0,akhir:0}; return {...it, awal:p.awal, masuk:p.masuk, keluar:p.keluar||0, terjual:p.terjual, akhir:p.akhir}; });
};

/* ════════ ESTIMASI POTONGAN MARKETPLACE ════════ */
window.hkEstimasiPotongan=function(saluran, kotor){
  const c=state.marketplaceChannels.find(m=>m.nama===saluran); if(!c||!c.komisiAktif) return 0;
  return Math.round(kotor*((+c.biayaAdmin||0)+(+c.biayaLayanan||0))/100+(+c.biayaPesanan||0));
};

/* ════════ RENDER ════════ */
const _renderMain=renderMain;
renderMain=function(){
  const m=document.getElementById('main'), v=state.view;
  if(v==='event') m.innerHTML=viewEventList();
  else if(v==='event-form') m.innerHTML=viewEventForm();
  else if(v==='event-detail') m.innerHTML=viewEventDetail();
  else if(v==='presale') m.innerHTML=viewPreSale();
  else if(v.startsWith('lap-')&&['lap-saluran','lap-event','lap-kasir','lap-produk','lap-harian'].includes(v)){ state.hk.lapTab=v.slice(4); m.innerHTML=viewLaporan(); }
  else if(v==='lap-kerugian') m.innerHTML=viewKerugian();
  else if(v==='lap-retur'){ IV().tJenis='Barang cacat (retur)'; state.view='stok-terbuang'; state.openGroups.inventori=true; renderMain(); }
  else if(v==='laporan'){ state.view='lap-saluran'; state.hk.lapTab='saluran'; m.innerHTML=viewLaporan(); }
  else if(v==='pengaturan-pos') m.innerHTML=viewPengaturanPOS();
  else _renderMain();
};
function renderHkModal(){
  const m=state.hk.modal;
  if(!m){ modalRoot.classList.remove('open'); modalRoot.innerHTML=''; return; }
  modalRoot.classList.add('open');
  modalRoot.innerHTML=m.type==='pilih'?pilihModal():m.type==='bukti'?`<div class="confirm-box hk-modal" style="width:520px;"><div class="hk-mh"><h4>Bukti transfer ${m.t.no}</h4><div class="spacer"></div><span class="close" style="cursor:pointer;" data-hk-act="modal-close">✕</span></div><div class="hk-mb"><div class="hk-sub" style="margin-bottom:8px;">${hkTgl(m.t.refund.waktu)} ${hkJam(m.t.refund.waktu)} · ${hkEsc(m.t.refund.oleh)} · ${hkEsc(m.t.refund.bank)} ${hkEsc(m.t.refund.norek)} a.n. ${hkEsc(m.t.refund.an||'-')} · ${hkRp(m.t.total)}</div>${m.t.refund.bukti?`<img src="${m.t.refund.bukti}" style="max-width:100%;border-radius:8px;">`:'<div class="hk-empty">Tidak ada foto</div>'}</div></div>`:m.type==='refund'?refundModal():m.type==='harga'?hargaModal():m.type==='alok'?alokasiModal():m.type==='tutup'?tutupModal():m.type==='mpreg'?mpregModal():m.type==='sosetuju'?soSetujuModal():m.type==='kerugian'?kerugianModal():m.type==='staff'?staffModal():m.type==='staffinfo'?staffInfoModal():
    `<div class="confirm-box"><h4>Reset data prototipe?</h4><p>Semua produk, event, transaksi POS, dan pengaturan kembali ke data contoh.</p><div class="confirm-actions"><button class="btn" data-hk-act="modal-close">Batal</button><button class="btn btn-danger" data-hk-act="reset-ok">Reset</button></div></div>`;
}
const _render=render;
render=function(){ syncOutlets(); state.outletMode='all'; state.outletPanelOpen=false; _render(); renderHkModal(); renderAkun(); renderLogin(); hkSaveAll(data()); };

/* data dari POS masuk (tab lain di browser yang sama) */
window.addEventListener('storage', e=>{
  if(!e.key||!e.key.startsWith('hk2:')) return;
  clearTimeout(window._hkSync);
  window._hkSync=setTimeout(()=>{
    const focused=document.activeElement&&['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);
    pull(hkLoad()); if(!focused) render(); if(e.key==='hk2:trx') toast('Transaksi baru dari POS');
  },150);
});

/* ════════ INPUT ════════ */
function setPath(path, val){
  const parts=path.split('.'); let o=state;
  for(let i=0;i<parts.length-1;i++){ if(o[parts[i]]==null) o[parts[i]]={}; o=o[parts[i]]; }
  o[parts[parts.length-1]]=val;
}
function getPath(path){ return path.split('.').reduce((o,k)=>o==null?o:o[k],state); }
function onBind(t, live){
  const path=t.getAttribute('data-hk-bind'); if(!path) return false;
  if(path==='posSettings._nominal'){ state.posSettings.nominalCepat=t.value.split(',').map(x=>Number(x.replace(/\D/g,''))).filter(Boolean); hkSaveAll(data()); return true; }
  let v=t.value;
  if(['posSettings.pembulatan','posSettings.gridKolom','posSettings.diskonMaks','posSettings.pajakPersen','posSettings.kunciMenit'].includes(path)) v=Number(v)||0;
  setPath(path,v);
  if(path.startsWith('posSettings')){ hkSaveAll(data()); const pv=$('hkStrukPrev'); if(pv) pv.innerHTML=strukPreview(); return true; }
  if(path==='hk.psEvent'){ renderMain(); return true; }
  if(path==='hk.lapDari'||path==='hk.lapSampai'){ if(!v) return true; const H=state.hk, [d0,s0]=lapRange(); if(H.lapPeriode!=='rentang'){ H.lapDari=path==='hk.lapDari'?v:d0; H.lapSampai=path==='hk.lapSampai'?v:s0; H.lapPeriode='rentang'; }
    const today=hkYmd(hkToday()); if(H.lapSampai&&H.lapSampai>today) H.lapSampai=today; if(H.lapDari&&H.lapDari>today) H.lapDari=today;
    if(H.lapDari&&H.lapSampai&&H.lapDari>H.lapSampai){ if(path==='hk.lapDari') H.lapSampai=H.lapDari; else H.lapDari=H.lapSampai; toast('Tanggal "dari" tidak boleh setelah "sampai"'); }
    renderMain(); return true; }
  if(path==='hk.modal.cari'){ const pos=t.selectionStart; renderHkModal(); const el=document.querySelector('[data-hk-bind="hk.modal.cari"]'); if(el){ el.focus(); if(pos!=null) el.setSelectionRange(pos,pos); } return true; }
  if(path.startsWith('hk.evForm.kirim')||path.startsWith('hk.evForm.harga')){ const f=state.hk.evForm, el=document.getElementById('hkEvProdSum'); if(el){ const n=f.varian.length, k=f.varian.reduce((a,x)=>a+(+f.kirim[x]||0),0); el.textContent=`${n} varian dari ${f.produk.length} produk${k?` · ${k} pcs akan dikirim`:''}`; } return true; }
  if(path==='hk.prodKat'||path==='hk.msNama'||(live&&t.hasAttribute('data-hk-live'))){ const pos=t.selectionStart; renderMain(); const el=document.querySelector(`[data-hk-bind="${path}"]`); if(el&&el.setSelectionRange&&pos!=null){ el.focus(); el.setSelectionRange(pos,pos); } }
  if(path.startsWith('hk.prodForm.sku')){ const b=$('hkVarBody'); if(b&&document.activeElement===t){} }
  return true;
}
document.addEventListener('input', e=>{
  const t=e.target;
  const fs=t.closest&&t.closest('[data-hk-fisik]');
  if(fs){ const m=state.hk.modal; m.fisik[fs.getAttribute('data-hk-fisik')]=fs.value;
    document.querySelectorAll('[data-hk-fisik]').forEach(x=>{ const sku=x.getAttribute('data-hk-fisik'), q=+x.dataset.sistem, h=+x.dataset.hpp, f=x.value===''?q:Math.max(0,+x.value||0), d=f-q;
      const se=$('hkSel-'+sku); if(se){ se.textContent=(d>0?'+':'')+d; se.style.color=d<0?'var(--danger-text)':''; se.style.fontWeight=d<0?'700':''; }
      const ru=$('hkRugi-'+sku); if(ru) ru.textContent=d<0?hkRp(-d*h):'–'; });
    const tot=[...document.querySelectorAll('[data-hk-fisik]')].reduce((a,x)=>{ const q=+x.dataset.sistem, f=x.value===''?q:Math.max(0,+x.value||0); return a+Math.max(0,q-f)*(+x.dataset.hpp); },0);
    const te=$('hkRugiTotal'); if(te) te.textContent=hkRp(tot); return; }
  const hh=t.closest&&t.closest('[data-hk-harga]'); if(hh){ state.hk.modal.harga[hh.getAttribute('data-hk-harga')]=hh.value; return; }
  const a=t.closest&&t.closest('[data-hk-alok]');
  if(a){ state.hk.modal.qty[a.getAttribute('data-hk-alok')]=Math.max(0,Math.min(+a.max,+a.value||0)); const el=$('hkAlokTotal'); if(el) el.textContent=Object.values(state.hk.modal.qty).reduce((x,y)=>x+(+y||0),0)+' pcs'; return; }
  if(t.tagName!=='SELECT') onBind(t,true);
});
document.addEventListener('change', e=>{
  const q=e.target.closest&&e.target.closest('[data-hk-qris]');
  if(q&&q.files[0]){ const img=new Image(); img.onload=()=>{ const k=Math.min(1,900/Math.max(img.width,img.height)); const cv=document.createElement('canvas'); cv.width=Math.round(img.width*k); cv.height=Math.round(img.height*k);
    const cx=cv.getContext('2d'); cx.fillStyle='#fff'; cx.fillRect(0,0,cv.width,cv.height); cx.drawImage(img,0,0,cv.width,cv.height); state.posSettings.qrisImg=cv.toDataURL('image/jpeg',.92); toast('Gambar QRIS tersimpan dan langsung dipakai di POS'); render(); }; img.src=URL.createObjectURL(q.files[0]); }
});
document.addEventListener('change', e=>{
  const fi=e.target.closest&&e.target.closest('[data-hk-file]');
  if(fi&&fi.files[0]&&state.hk.modal){ const img=new Image(); img.onload=()=>{ const k=Math.min(1,900/Math.max(img.width,img.height)); const cv=document.createElement('canvas'); cv.width=img.width*k; cv.height=img.height*k; cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height); state.hk.modal[fi.getAttribute('data-hk-file')]=cv.toDataURL('image/jpeg',.72); renderHkModal(); }; img.src=URL.createObjectURL(fi.files[0]); return; }
});
document.addEventListener('change', e=>{ const t=e.target; if(t.tagName==='SELECT'&&t.hasAttribute('data-hk-bind')){ onBind(t,false); if(t.getAttribute('data-hk-bind').startsWith('posSettings')) render(); } });

/* ════════ KLIK ════════ */
document.addEventListener('click', e=>{
  const tgEl=e.target.closest('[data-hk-toggle]');
  if(tgEl){ const p=tgEl.getAttribute('data-hk-toggle'); setPath(p,!getPath(p)); render(); return; }
  const el=e.target.closest('[data-hk-act]'); if(!el) return;
  const act=el.getAttribute('data-hk-act'), arg=el.getAttribute('data-hk-arg'), H=state.hk;
  const go=v=>{ state.view=v; render(); };
  switch(act){
    case 'ev-tab': H.evTab=arg; render(); break;
    case 'ev-open': H.evId=arg; Object.keys(state.openGroups).forEach(k=>state.openGroups[k]=false); go('event-detail'); break;
    case 'ev-new': { const t=hkYmd(hkAddDays(hkToday(),7)); H.evForm={id:null,nama:'',venue:'',mulai:t,selesai:t,catatan:'',kasir:[],pj:'',presaleAktif:false,presale:'ambil',produk:[],kirim:{},harga:{},cariProduk:''}; go('event-form'); break; }
    case 'ev-edit': { const ev=evById(H.evId); H.evForm={...ev, kasir:[...ev.kasir], presaleAktif:ev.presaleAktif!==false, presale:ev.presale||'ambil', produk:ev.produk?[...ev.produk]:state.products.filter(p=>p.status==='Aktif'&&p.tampilPos!==false).map(p=>p.sku), kirim:{}, harga:{...(ev.harga||{})}, cariProduk:''}; FORM_VIEWS['event-form']='event-detail'; go('event-form'); break; }
    case 'pr-lok': { const [prefix,nama]=arg.split('|'), f=state[prefix+'Form']; lokasiAwal(f);
      if(nama==='*'){ f.lokasiSemua=true; f.lokasi=[]; } else { f.lokasiSemua=false; const i=f.lokasi.indexOf(nama); if(i>-1) f.lokasi.splice(i,1); else f.lokasi.push(nama); }
      f.outlet=f.lokasiSemua?'':f.lokasi.join(', '); renderPromoFormModal(); document.getElementById(prefix+'LokasiPilih')?.classList.remove('hk-invalid'); break; }
    case 'evp-buka': { const f=H.evForm; evVarianAwal(f); const sel={}; f.varian.forEach(x=>sel[x]=true); H.modal={type:'pilih', ctx:'event', cari:'', sel}; render(); break; }
    case 'pil-buka': { const [ctx,form,key]=arg.split('|'), sel={};
      if(ctx==='alok'){ (H.modal.pilih||[]).forEach(x=>sel[x]=true); H.modal={type:'pilih', ctx, cari:'', sel, prev:H.modal}; }
      else if(ctx==='order'){ state.po.form.items.filter(i=>i.sku).forEach(i=>sel[i.sku]=true); H.modal={type:'pilih', ctx, cari:'', sel}; }
      else { (state[form][key]||[]).forEach(x=>sel[x]=true); H.modal={type:'pilih', ctx, form, key, cari:'', sel}; }
      render(); break; }
    case 'pil-cek': { const M=H.modal; if(pilihDef(M).tunggal){ const on=!M.sel[arg]; M.sel={}; if(on) M.sel[arg]=true; } else M.sel[arg]=!M.sel[arg]; renderHkModal(); break; }
    case 'pil-semua': { const M=H.modal, D=pilihDef(M), q=(M.cari||'').toLowerCase(), L=D.rows.filter(r=>!q||r.cari.includes(q)), on=!L.every(r=>M.sel[r.key]); L.forEach(r=>M.sel[r.key]=on); renderHkModal(); break; }
    case 'pil-batal': { const M=H.modal; H.modal=M.prev||null; render(); if(M.ctx==='promo'&&window.renderPromoFormModal) renderPromoFormModal(); break; }
    case 'pil-simpan': { const M=H.modal, D=pilihDef(M), keys=D.rows.map(r=>r.key).filter(k=>M.sel[k]); D.simpan(keys); H.modal=M.prev||null; render();
      if(M.ctx==='order') window.hkPOImpor.refreshItems(); if(M.ctx==='promo'&&window.renderPromoFormModal) renderPromoFormModal(); break; }
    case 'ev-var-hapus': { const f=H.evForm; evVarianAwal(f); f.varian=f.varian.filter(x=>x!==arg); delete f.kirim[arg]; delete f.harga[arg]; const cat=evCatAktif(); f.produk=[...new Set(cat.filter(c=>f.varian.includes(c.sku)).map(c=>c.parent))]; render(); break; }
    case 'ev-prod': { const L=H.evForm.produk, i=L.indexOf(arg); if(i>-1) L.splice(i,1); else L.push(arg); render(); break; }
    case 'ev-prod-semua': H.evForm.produk=state.products.filter(p=>p.status==='Aktif'&&p.tampilPos!==false).map(p=>p.sku); render(); break;
    case 'ev-prod-kosong': H.evForm.produk=[]; render(); break;
    case 'ev-presale': H.evForm.presale=arg; render(); break;
    case 'ev-kasir': { const k=H.evForm.kasir, i=k.indexOf(arg); if(i>-1) k.splice(i,1); else k.push(arg); render(); break; }
    case 'ev-save': {
      const f=H.evForm; if(!f.nama.trim()||!f.mulai||!f.selesai){ toast('Nama dan tanggal event wajib diisi'); return; }
      if(f.selesai<f.mulai){ toast('Tanggal selesai harus setelah tanggal mulai'); return; }
      const nama=f.nama.trim();
      if(state.events.some(x=>x.nama===nama&&x.id!==f.id)||nama===HK_GUDANG){ toast('Nama event sudah dipakai'); return; }
      evVarianAwal(f); if(!f.varian.length){ toast('Tambahkan minimal satu produk yang dijual'); return; }
      if(!f.pj){ toast('Pilih penanggung jawab event'); return; }
      const dipilih=new Set(f.varian);
      const kirimList=[];
      const lebih=kirimList.find(([sku,q])=>q>hkStokDi(state.stokItems,sku,HK_GUDANG));
      if(lebih){ toast(`Kirim ${hkStokRow(state.stokItems,lebih[0]).nama} melebihi stok gudang (${hkStokDi(state.stokItems,lebih[0],HK_GUDANG)})`); return; }
      const harga={}; Object.entries(f.harga).forEach(([sku,v])=>{ v=Number(v)||0; const c=cat().find(x=>x.sku===sku); if(v>0&&c&&v!==c.harga&&dipilih.has(sku)) harga[sku]=v; });
      if(f.id){ const ev=evById(f.id); if(ev.nama!==nama){ state.stokItems.forEach(it=>it.perOutlet.forEach(p=>{ if(p.outlet===ev.nama) p.outlet=nama; })); state.posTrx.forEach(t=>{ if(t.eventId===ev.id) t.lokasi=nama; }); }
        Object.assign(ev,{nama,venue:f.venue,mulai:f.mulai,selesai:f.selesai,catatan:f.catatan,kasir:f.kasir,pj:f.pj,varian:[...f.varian],presaleAktif:!!f.presaleAktif,presale:f.presale||'ambil',produk:[...f.produk],harga}); kirimStok(ev,kirimList); toast(`Event diperbarui${kirimList.length?` · ${kirimList.reduce((a,x)=>a+x[1],0)} pcs dikirim`:''}`); }
      else { const ev={id:'ev'+Date.now(),nama,venue:f.venue,mulai:f.mulai,selesai:f.selesai,catatan:f.catatan,kasir:f.kasir,pj:f.pj,varian:[...f.varian],presaleAktif:!!f.presaleAktif,presale:f.presale||'ambil',produk:[...f.produk],harga,ditutup:false,tutup:null}; state.events.push(ev); H.evId=ev.id; kirimStok(ev,kirimList); toast('Event dibuat. Kirim stok dari Gudang Pusat lewat tombol Kirim Stok.'); }
      H.evForm=null; FORM_VIEWS['event-form']='event'; go('event-detail'); break; }
    case 'ps-tab': H.psTab=arg; render(); break;
    case 'ps-buka': H.psEvent=arg; H.psTab='Menunggu'; go('presale'); break;
    case 'ps-refund': H.modal={type:'refund', id:arg, bank:'', norek:'', an:'', catatan:'', bukti:null}; render(); break;
    case 'ps-bukti': { const t=state.posTrx.find(x=>x.id===arg); H.modal={type:'bukti', t}; render(); break; }
    case 'ps-refund-ok': { const m=H.modal, t=state.posTrx.find(x=>x.id===m.id);
      if(!m.bank.trim()||!m.norek.trim()){ toast('Isi bank dan no. rekening tujuan'); return; }
      if(!m.bukti){ toast('Unggah foto bukti transfer dulu'); return; }
      if(t.pengambilan.status==='Menunggu') t.pengambilan.catatan=m.catatan||'Dibatalkan sebelum diambil';
      t.status='Refund'; t.pengambilan.status='Refund'; t.refund={waktu:hkIso(new Date()), oleh:akunNama(), bank:m.bank.trim(), norek:m.norek.trim(), an:m.an.trim(), catatan:m.catatan.trim(), bukti:m.bukti};
      H.modal=null; toast(`${t.no} ditandai sudah ditransfer kembali`); render(); break; }
    case 'ps-csv': { const L=psList(); download(`pre-sale-${hkYmd(new Date())}.csv`,[['No','Waktu','Event','Pembeli','No HP','Barang','Total','Metode','Status'],
      ...L.map(t=>[t.no,`${hkTgl(t.waktu)} ${hkJam(t.waktu)}`,t.lokasi,t.pelanggan?t.pelanggan.nama:'',t.pelanggan&&t.pelanggan.telepon||'',t.items.map(i=>`${i.qty}x ${i.nama}`).join('; '),t.total,hkBayar(t).map(b=>b.metode).join('+'),(PS_STATUS[psStatus(t)]||[,''])[1]])]); break; }
    case 'harga-open': { const tg=arg||H.evId; H.modal={type:'harga', target:tg, harga:{...((tg==='gudang'?state.posSettings.hargaGudang:evById(tg).harga)||{})}}; render(); break; }
    case 'harga-save': { const tg=H.modal.target, ev=tg==='gudang'?{nama:HK_GUDANG}:evById(tg), h={}; Object.entries(H.modal.harga).forEach(([sku,v])=>{ v=Number(v)||0; const c=cat().find(x=>x.sku===sku); if(v>0&&c&&v!==c.harga) h[sku]=v; });
      if(tg==='gudang') state.posSettings.hargaGudang=h; else ev.harga=h; H.modal=null; toast(Object.keys(h).length?`${Object.keys(h).length} harga khusus disimpan. POS memakai harga ini di ${ev.nama}.`:'Semua kembali ke harga normal'); render(); break; }
    case 'alok-open': H.modal={type:'alok', mode:arg, qty:{}, pilih:[]}; render(); break;
    case 'alok-hapus': { const m=H.modal; m.pilih=m.pilih.filter(x=>x!==arg); delete m.qty[arg]; render(); break; }
    case 'alok-semua': { const ev=evById(H.evId), dijual=c=>Array.isArray(ev.varian)?ev.varian.includes(c.sku):(!ev.produk||ev.produk.includes(c.parent)); cat().filter(c=>c.aktif&&(H.modal.mode!=='kirim'||dijual(c))).forEach(c=>{ const q=H.modal.mode==='kirim'?Math.floor(hkStokDi(state.stokItems,c.sku,HK_GUDANG)*.3):hkStokDi(state.stokItems,c.sku,ev.nama); if(q>0){ H.modal.qty[c.sku]=q; if(!H.modal.pilih.includes(c.sku)) H.modal.pilih.push(c.sku); } }); render(); break; }
    case 'alok-kosong': H.modal.qty={}; H.modal.pilih=[]; render(); break;
    case 'alok-save': { const ev=evById(H.evId), kirim=H.modal.mode==='kirim'; let n=0;
      const items=[];
      Object.entries(H.modal.qty).forEach(([sku,q])=>{ q=+q||0; if(q<=0) return;
        if(kirim){ const it=hkStokRow(state.stokItems,sku), g=hkPO(it,HK_GUDANG); g.keluar+=q; g.akhir-=q; it.transit+=q; items.push({sku, nama:it.nama, dikirim:q, diterima:null}); }
        else hkPindah(state.stokItems,sku,ev.nama,HK_GUDANG,q); n+=q; });
      if(!n){ toast('Isi jumlah barang dulu'); return; }
      if(kirim){ const d=new Date(); const pre=`MT/${hkYmd(d).slice(2).replace(/-/g,'')}/`; state.mutasi.unshift({no:pre+hkPad(state.mutasi.filter(m=>m.no.startsWith(pre)).reduce((a,m)=>Math.max(a,+m.no.slice(pre.length)||0),0)+1), dari:HK_GUDANG, ke:ev.nama, eventId:ev.id, tglKirim:hkIso(d), tglTerima:null, oleh:akunNama(), penerima:null, status:'Dikirim', catatan:'', items}); }
      H.modal=null; toast(kirim?`${n} pcs dikirim. Stok masuk ke event setelah kasir menerima di POS (Inventori › Terima Mutasi).`:`${n} pcs ditarik ke ${HK_GUDANG}`); render(); break; }
    case 'kr-open': { const o=hkKerugianSemua(data()).find(x=>x.key===arg); H.modal={type:'kerugian', no:arg, jenis:'Diganti', jumlah:String(hkKerugianSisa(o)), cara:'Potong gaji', catatan:''}; render(); break; }
    case 'kr-jenis': H.modal.jenis=arg; render(); break;
    case 'kr-save': { const M=H.modal, o=hkKerugianSemua(data()).find(x=>x.key===M.no);
      if(M.jenis==='Dibebankan perusahaan'&&!(akun()&&akun().role.includes('Owner'))){ toast('Hanya Owner yang bisa membebankan ke perusahaan'); return; }
      if(M.jenis==='Diganti'&&!(+M.jumlah>0)){ toast('Isi jumlah yang diganti'); return; }
      hkSelesaikanKerugian(o, {jenis:M.jenis, jumlah:+M.jumlah||0, cara:M.jenis==='Diganti'?M.cara:'', catatan:(M.catatan||'').trim(), oleh:akunNama(), waktu:hkIso(new Date())});
      H.modal=null; hkSaveAll(data()); toast(`Dicatat. ${o.tanggungJawab.status}`); render(); break; }
    case 'mpreg-open': H.modal={type:'mpreg', harga:{}}; render(); break;
    case 'mpreg-save': { const im=state.po.importer, ch=state.marketplaceChannels.find(m=>m.nama===im.saluran), cat=hkCatalog(state.products), b=hkMpBelum();
      if(b.some(x=>!(+(H.modal.harga[x.sku]??x.hargaFile)>0))){ toast('Isi semua harga'); return; }
      b.forEach(x=>{ const c=cat.find(k=>k.sku===x.sku); ch.produk.push({sku:x.sku, nama:x.nama, satuan:'Pcs', hargaAwal:c?c.harga:x.hargaFile, hargaJual:+(H.modal.harga[x.sku]??x.hargaFile)}); });
      H.modal=null; hkSaveAll(data()); const n=hkPOImpor.importStats().siap; if(n){ hkPOImpor.doImport(); toast(`${b.length} harga ${im.saluran} didaftarkan, ${n} pesanan diimpor`); } else render(); break; }
    case 'tutup-open': { const ev=evById(H.evId); H.modal={type:'tutup', fisik:{}, pj:ev.pj||ev.kasir[0]||'', alasan:'', soNo:null, ulang:''}; render(); break; }
    case 'so-buka': { const so=state.posOpname.find(o=>o.no===arg), e=evById(so.eventId); H.modal={type:'sosetuju', no:arg, soNo:arg, pj:(e&&e.pj)||so.oleh, alasan:so.catatan||'', ulang:''}; render(); break; }
    case 'so-setuju': { const M=H.modal, so=state.posOpname.find(o=>o.no===M.no), r=hkSORingkas(so);
      if(r.kerugian&&!(M.alasan||'').trim()){ toast('Ada barang kurang. Isi penjelasan selisih'); return; }
      if(!hkSetujuiSO(data(), M.no, akunNama(), {nama:M.pj, alasan:(M.alasan||'').trim()})){ toast('Opname ini sudah tidak menunggu persetujuan'); return; }
      H.modal=null; hkSaveAll(data()); toast(r.kerugian?`Opname disetujui, stok disesuaikan. Kerugian ${hkRp(r.kerugian)} masuk Selisih & Kerugian`:'Opname disetujui, stok event disesuaikan'); render(); break; }
    case 'so-ulang': { const so=state.posOpname.find(o=>o.no===H.modal.soNo); if(!so) return; if(!(H.modal.ulang||'').trim()){ toast('Tulis alasan opname ulang'); return; }
      so.status='Perlu opname ulang'; so.ulang={oleh:akunNama(), waktu:hkIso(new Date()), catatan:H.modal.ulang.trim()}; H.modal=null; hkSaveAll(data()); toast(so.jenis==='Gudang'?`${so.oleh} diminta menghitung ulang gudang`:'Kasir diminta menghitung ulang di POS'); render(); break; }
    case 'tutup-save': { const M=H.modal, C=hkCekTutupEvent(data(),H.evId), cat=hkCatalog(state.products), soT=hkSOAkhir(data(),H.evId);
      if(soT&&soT.status==='Menunggu persetujuan'){ toast(`Opname ${soT.no} masih menunggu persetujuan. Selesaikan di Inventori › Stok Opname dulu`); return; }
      const rugi=C.sisa.reduce((a,x)=>{ const f=M.fisik[x.it.sku]!=null&&M.fisik[x.it.sku]!==''?Math.max(0,+M.fisik[x.it.sku]||0):x.q, k=cat.find(c=>c.sku===x.it.sku); return a+Math.max(0,x.q-f)*(k?k.hpp:0); },0);
      if(rugi&&(!M.pj||!(M.alasan||'').trim())){ toast('Ada selisih kurang. Isi penanggung jawab dan penjelasannya'); return; }
      if(!hkTutupEvent(data(), H.evId, akunNama(), M.fisik, {nama:M.pj, alasan:(M.alasan||'').trim()}, M.soNo)){ toast('Masih ada kasir terbuka'); return; } const ev=evById(H.evId); H.modal=null; toast(ev.tutup.kerugian?`Event ditutup. Kerugian selisih stok ${hkRp(ev.tutup.kerugian)}`:'Event ditutup, stok fisik kembali ke gudang'); render(); break; }
    case 'modal-close': H.modal=null; H.staffForm=null; render(); break;
    case 'lap-per': H.lapPeriode=arg; render(); break;
    case 'lap-tab': H.lapTab=arg; state.view='lap-'+arg; state.openGroups.laporan=true; render(); break;
    case 'lap-csv': { const L=lapData(); const strip=s=>String(s).replace(/<div[^>]*>.*?<\/div>/g,'').replace(/<[^>]+>/g,'').replace(/^Rp /,'').replace(/\./g,'');
      download(`laporan-${H.lapTab}-${hkYmd(new Date())}.csv`,[L.head.map(h=>h||'Nama'),...L.rows.map(r=>r.map(strip))]); break; }
    case 'akun-menu': document.getElementById('hkAkunMenu').classList.toggle('open'); break;
    case 'dash-gantipw': document.getElementById('hkAkunMenu').classList.remove('open'); dashLogin={email:'', pw:'', err:'', ganti:true, lama:'', baru:'', ulang:''}; renderLogin(); break;
    case 'dash-logout': localStorage.removeItem(DASH_KEY); document.getElementById('hkAkunMenu').classList.remove('open'); render(); break;
    case 'qris-hapus': state.posSettings.qrisImg=''; toast('Gambar QRIS dihapus. POS menampilkan contoh QRIS dengan peringatan sampai gambar baru diunggah'); render(); break;
    case 'rek-add': state.posSettings.rekening.push({bank:'',no:'',nama:''}); render(); break;
    case 'rek-del': state.posSettings.rekening.splice(+arg,1); render(); break;
    case 'reset': H.modal={type:'reset'}; render(); break;
    case 'reset-ok': hkReset(); pull(hkLoad()); H.modal=null; toast('Data contoh dipulihkan'); go('dashboard'); break;
    case 'prod-tab': H.prodTab=arg; render(); break;
    case 'prod-new': H.prodForm=newProdForm(); go('produk-form'); break;
    case 'prod-edit': { const p=state.products[+arg]; H.prodForm={index:+arg, nama:p.nama, deskripsi:p.deskripsi||'', kategori:p.kategori, satuan:p.satuan||'Pcs', sku:p.sku, jual:p.jual!=null?String(p.jual):String(p.varian&&p.varian[0]?p.varian[0].jual:''), modal:String(p.modal), stokMin:String(p.stokMin||0), tampilPos:p.tampilPos!==false, aktif:p.status==='Aktif', varianAktif:!!(p.varian&&p.varian.length), atribut:'Ukuran', varian:(p.varian||[]).map(v=>({nama:v.nama, sku:v.sku, jual:String(v.jual)})), stokAwal:{}}; go('produk-form'); break; }
    case 'var-add': H.prodForm.varian.push({nama:'',sku:'',jual:''}); render(); break;
    case 'var-del': { const d=+arg; H.prodForm.varian.splice(d,1); (H.prodForm.mp||[]).forEach(m=>{ const h={}; Object.entries(m.harga).forEach(([k,v])=>{ if(k[0]!=='v') { h[k]=v; return; } const j=+k.slice(1); if(j<d) h[k]=v; else if(j>d) h['v'+(j-1)]=v; }); m.harga=h; }); render(); break; }
    case 'prod-save': saveProduk(); break;
    case 'staff-new': if(!ownerLogin()){ toast('Hanya Owner yang bisa menambah karyawan'); return; } H.staffForm={index:null,nama:'',telp:'',email:'',role:['Kasir'],pw:'',pin:acakPin(),aktif:true}; H.modal={type:'staff'}; render(); break;
    case 'staff-edit': { if(!ownerLogin()){ toast('Hanya Owner yang bisa mengubah karyawan'); return; } const s=state.staff[+arg]; H.staffForm={index:+arg,nama:s.nama,telp:s.telp||'',email:s.email||'',role:[...s.role],pw:'',pin:'',resetPw:false,resetPin:false,aktif:s.aktif!==false}; H.modal={type:'staff'}; render(); break; }
    case 'staff-role': { const r=H.staffForm.role, i=r.indexOf(arg); if(i>-1) r.splice(i,1); else r.push(arg); render(); break; }
    case 'staff-acak': if(arg==='pw') H.staffForm.pw=acakPw(); else H.staffForm.pin=acakPin(); render(); break;
    case 'staff-reset': if(arg==='pw'){ H.staffForm.resetPw=true; H.staffForm.pw=acakPw(); } else { H.staffForm.resetPin=true; H.staffForm.pin=acakPin(); } render(); break;
    case 'staff-save': { if(!ownerLogin()){ toast('Hanya Owner yang bisa menyimpan karyawan'); return; }
      const f=H.staffForm, baru=f.index==null, lama=baru?null:state.staff[f.index], nama=(f.nama||'').trim(), dash=f.role.some(r=>r==='Admin'||r==='Owner'), email=(f.email||'').trim().toLowerCase();
      const perluPw=dash&&(baru||f.resetPw||!lama.pw), perluPin=baru||f.resetPin;
      const salah=(id,msg)=>{ document.querySelectorAll('.hk-invalid').forEach(x=>x.classList.remove('hk-invalid')); const el=document.getElementById(id); if(el) el.classList.add('hk-invalid'); toast(msg); };
      if(!nama) return salah('hkStNama','Isi nama karyawan');
      if(state.staff.some((x,i)=>x.nama.toLowerCase()===nama.toLowerCase()&&i!==f.index)) return salah('hkStNama','Nama karyawan sudah ada');
      if(!f.role.length){ toast('Pilih minimal satu role'); return; }
      if(dash){ if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return salah('hkStEmail','Isi email yang benar');
        if(state.staff.some((x,i)=>(x.email||'').toLowerCase()===email&&i!==f.index)) return salah('hkStEmail','Email sudah dipakai karyawan lain'); }
      if(perluPw){ const e=hkPwLemah(f.pw); if(e) return salah('hkStPw',e); }
      if(perluPin){ const e=hkPinLemah(f.pin,state.staff,lama&&lama.nama); if(e) return salah('hkStPin',e); }
      const sisaOwner=state.staff.filter((x,i)=>i!==f.index&&x.aktif!==false&&x.role.includes('Owner')).length;
      if(!baru&&lama.role.includes('Owner')&&(!f.role.includes('Owner')||!f.aktif)&&!sisaOwner){ toast('Harus ada minimal satu Owner yang aktif'); return; }
      const d=baru?{pwBaru:false, pinBaru:true}:{...lama};
      Object.assign(d,{nama, telp:f.telp, role:f.role, email:dash?email:'', aktif:f.aktif});
      if(!dash){ d.pw=''; d.pwBaru=false; }
      if(perluPw){ d.pw=hkHashPw(f.pw); d.pwBaru=true; }
      if(perluPin){ d.pin=f.pin; d.pinBaru=true; }
      if(baru) state.staff.push(d); else { if(lama.nama!==nama){ state.events.forEach(ev=>{ ev.kasir=ev.kasir.map(k=>k===lama.nama?nama:k); if(ev.pj===lama.nama) ev.pj=nama; }); } state.staff[f.index]=d; }
      if(!baru&&akunSesi()&&akunSesi().nama===lama.nama&&lama.nama!==nama) localStorage.setItem(DASH_KEY, JSON.stringify({...akunSesi(), nama}));
      H.staffForm=null; hkSaveAll(data());
      if(perluPw||perluPin){ H.modal={type:'staffinfo', nama, email:perluPw?email:'', pw:perluPw?f.pw:'', pin:perluPin?f.pin:''}; }
      else H.modal=null;
      toast(baru?`${nama} terdaftar`:'Karyawan disimpan'); render(); break; }
  }
});
/* tombol "+ Buat Event" di pemilih lokasi, dan kembali dari form produk */
document.addEventListener('click', e=>{
  const n=e.target.closest('[data-nav]'); if(!n) return;
  const t=n.getAttribute('data-nav');
  if(t==='produk-list') state.hk.prodForm=null;
  if(t==='event'||t==='event-detail') FORM_VIEWS['event-form']='event';
  if(t.startsWith('lap-')){ setTimeout(()=>{ state.openGroups.laporan=true; render(); },0); }
  if(t==='pengaturan-pos'){ Object.keys(state.openGroups).forEach(k=>state.openGroups[k]=false); }
}, true);

render();
})();
