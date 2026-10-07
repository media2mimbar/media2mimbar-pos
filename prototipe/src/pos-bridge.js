/* ════════════════════════════════════════════════════════════
   JEMBATAN POS ⇄ DASHBOARD
   Prototipe kasir tetap memakai alur dan tampilan aslinya. Script ini:
   - mengganti data contoh (Snack Corner) dengan data bersama shared.js
   - menambah masuk kasir + buka kasir per event, varian, cek stok, edit keranjang
   - mencatat transaksi, kas kasir, tutup kasir, opname, terima mutasi, riwayat masuk POS
     ke data yang sama dengan dashboard
   ════════════════════════════════════════════════════════════ */
(function(){
let D = hkLoad();

/* ── layar & sheet tambahan, memakai kelas CSS prototipe ── */
const HK_CSS=`
  .app{overflow:clip!important;}
  .pcard{position:relative;}
  .hk-habis{opacity:.45;}
  .hk-tag.link{background:#fff; border:1px solid var(--line); color:#C0392B; cursor:pointer;}
  .hk-evprice{color:var(--primary-dark); font-weight:700;}
  .hk-tags{display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;}
  .hk-tag{font-size:9.5px; font-weight:700; padding:2px 7px; border-radius:8px; background:#EEEFEC; color:var(--ink-soft);}
  .hk-tag.ok{background:#E4F7EF; color:#00734E;} .hk-tag.warn{background:#FDF2DD; color:#9A6312;}
  .hk-cam{position:relative; background:#111; border-radius:18px; overflow:hidden; aspect-ratio:1;}
  .hk-cam video{width:100%; height:100%; object-fit:cover; display:block;}
  .hk-cam-frame{position:absolute; inset:18%; border:3px solid #fff; border-radius:16px; box-shadow:0 0 0 999px rgba(0,0,0,.35);}
  .hk-cam-msg{position:absolute; inset:0; display:flex; align-items:center; justify-content:center; text-align:center; padding:24px; color:#fff; font-size:12.5px; background:rgba(0,0,0,.55);}
  .hk-filebtn{display:flex; align-items:center; justify-content:center; width:100%; cursor:pointer;}
  .hk-rowin{display:flex; gap:8px;} .hk-rowin input{flex:1; min-width:0; padding:11px 12px; border:1px solid var(--line); border-radius:12px; font-family:inherit; font-size:14px;}
  .hk-qr-mini{display:flex; align-items:center; gap:10px; background:#fff; border:1px solid var(--line); border-radius:12px; padding:8px 10px; margin:8px 0; font-size:11px; color:var(--ink-soft);}
  .hk-qr-mini span{font-weight:700; color:var(--ink);} .hk-qr-mini svg{flex-shrink:0;}
  .hk-struk-qr{display:flex; justify-content:center; margin:6px 0;}
  .hk-ms-row{display:flex; align-items:center; gap:10px; background:#fff; border:1px solid #E7E9E4; border-radius:12px; padding:10px 12px; margin-bottom:8px;}
  .hk-ms-av{width:34px; height:34px; border-radius:50%; background:#FFF1E8; color:#E65700; font-weight:800; font-size:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0;}
  .hk-ms-main{flex:1; min-width:0;} .hk-ms-nama{font-weight:700; font-size:14px;} .hk-ms-nama span{font-weight:500; font-size:11px; color:#8A8F87;}
  .hk-ms-sub{font-size:12px; color:#8A8F87; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;} .hk-ms-kanan{text-align:right; flex-shrink:0;} .hk-ms-jam{font-size:12px; color:#5B6158; margin-top:3px; font-weight:600;}
  .hk-pd{cursor:pointer; align-items:center;} .hk-pd.on{border-color:#FF6100; background:#FFF6EF;}
  .hk-pd-tag{display:inline-block; font-size:10px; font-weight:700; color:#1E8E4E; background:#E6F6EC; border-radius:6px; padding:1px 6px; vertical-align:middle;}
  .hk-pd-syarat{font-size:11.5px; color:#E65700; font-weight:600; margin-top:4px;}
  .hk-pd-aksi{flex-shrink:0; font-size:12px; font-weight:700; padding:7px 12px; border-radius:999px; border:1px solid #DADDD6; color:#5B6158; margin-left:8px;}
  .hk-pd-aksi.ok{background:#FF6100; border-color:#FF6100; color:#fff;} .hk-pd-aksi.on{background:#E6F6EC; border-color:#BFE6CC; color:#1E8E4E;}
  .hk-wabox{width:100%; background:#fff; border:1px solid #E7E9E4; border-radius:12px; padding:12px; margin:10px 0; text-align:left;}
  .hk-wa-lbl{font-size:12px; font-weight:700; color:#5B6158; margin-bottom:8px;}
  .hk-wa-row{display:flex; gap:8px;} .hk-wa-row input{flex:1; min-width:0; padding:10px; border:1px solid #DADDD6; border-radius:8px; font-size:14px;}
  .hk-wa-row .btn-confirm-primary{width:auto; padding:0 16px; margin:0;}
  .hk-wa-link{display:inline-block; margin-top:8px; font-size:12px; font-weight:700; color:#FF6100; cursor:pointer;}
  .hk-wa-ok{font-size:13px; font-weight:700; color:#1E8E4E; margin-bottom:8px;}
  .hk-wabox .confirm-actions{margin:0;}
  .hk-manual{margin:6px 0 10px; font-size:12px;} .hk-manual summary{cursor:pointer; color:var(--primary-dark); font-weight:700;}
  .hk-split-hint{font-size:11.5px; color:var(--ink-soft); text-align:center; margin:-4px 0 12px; line-height:1.4;}
  .hk-low{color:#C0392B; font-weight:700;}
  .hk-stok{font-size:10.5px; color:var(--ink-soft); margin-top:2px;}
  .hk-varbadge{position:absolute; top:8px; left:8px; z-index:2; font-size:9.5px; font-weight:700; background:rgba(30,35,33,.55); color:#fff; padding:2px 7px; border-radius:9px;}
  .hk-vgrid{display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:14px; padding-top:2px;}
  .hk-vbtn{position:relative; background:#fff; border:1.5px solid var(--line); border-radius:14px; padding:12px 4px; font-family:inherit; cursor:pointer;}
  .hk-vbtn b{display:block; font-size:16px; color:var(--ink);} .hk-vbtn small{font-size:10.5px; color:var(--ink-soft);}
  .hk-vbtn.on{border-color:var(--primary); background:var(--primary-tint);} .hk-vbtn:disabled{opacity:.4; cursor:not-allowed;}
  .hk-vq{position:absolute; top:6px; right:6px; background:#FF6100; color:#fff; border-radius:11px; min-width:22px; height:22px; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center;}
  .hk-ci{display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--line);}
  .hk-ci-info{flex:1; min-width:0;} .hk-ci-name{font-weight:600; font-size:13px;} .hk-ci-name span{color:var(--ink-soft); font-weight:500;}
  .hk-ci-sub{font-size:11.5px; color:var(--ink-soft);} .hk-ci-q{min-width:22px; text-align:center; font-weight:800;}
  .hk-cart-foot{display:flex; justify-content:space-between; align-items:center; padding:12px 0 4px; font-weight:800; font-size:15px;}
  .hk-rek{margin:-2px 0 8px; padding:10px 12px; background:var(--primary-tint); border-radius:12px;}
  .hk-rek-row{display:flex; justify-content:space-between; align-items:center; gap:8px; padding:6px 0; font-size:11.5px; color:var(--ink-soft);}
  .hk-rek-row b{font-size:14px; color:var(--ink); letter-spacing:.5px;} .hk-rek-row button{border:none; background:#fff; color:var(--primary-dark); font-weight:700; border-radius:8px; padding:6px 10px; font-family:inherit;}
  .hk-rek-note{font-size:10.5px; color:var(--ink-soft); margin-top:4px;}
  .hk-struk-head{text-align:center; font-size:11.5px; color:var(--ink-soft); margin-bottom:8px;} .hk-struk-head b{color:var(--ink); font-size:13px;}
  .hk-struk-foot{text-align:center; font-size:11px; color:var(--ink-soft);}
  .hk-note{background:#FFF6E5; color:#8A5A00; border-radius:12px; padding:10px 12px; font-size:12px; margin:10px 0; cursor:pointer;}
  .hk-chips{display:flex; flex-wrap:wrap; gap:8px; align-self:stretch;}
  .hk-brand{display:flex; align-items:center; gap:12px; align-self:stretch; text-align:left; margin-bottom:22px;}
  .hk-brand-logo{width:48px; height:48px; border-radius:14px; background:var(--primary); color:#fff; font-weight:800; display:flex; align-items:center; justify-content:center; font-size:16px;}
  .hk-av{background:var(--primary-tint)!important; color:var(--primary-dark); font-weight:800; font-size:13px; border-radius:50%!important;}
  .hk-card{background:var(--card); border:1px solid var(--line);}
  .hk-rw{margin-bottom:10px; cursor:pointer;} .hk-rw .lap-card-kasir{white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:70%;}
  #view-hk-login .lock-view{overflow-y:auto;}
`;
document.head.insertAdjacentHTML('beforeend', `<style>${HK_CSS}</style>`);
const sheet=(id,inner)=>`<div class="sheet-overlay" id="overlayHk${id}" onclick="closeSheet('sheetHk${id}')"></div><div class="sheet" id="sheetHk${id}"><div class="sheet-handle"></div>${inner}</div>`;
const back=(fn,title,subId)=>`<div class="subbar"><div class="subbar-back-row"><button class="icon-btn" style="background:var(--paper); color:var(--ink);" onclick="${fn}">←</button><div style="min-width:0;"><div class="subbar-title">${title}</div><div class="subbar-sub" id="${subId}"></div></div></div></div>`;
document.querySelector('.app').insertAdjacentHTML('beforeend', `
  <div class="view" id="view-hk-login"><div class="lock-view" id="hkLoginBody"></div></div>
  <div class="view" id="view-hk-scan">${back('hkScanTutup()','Scan QR Pre-sale','hkScanSub')}<div class="lap-scroll">
    <div class="hk-cam"><video id="hkVid" playsinline muted></video><div class="hk-cam-frame"></div><div class="hk-cam-msg" id="hkCamMsg">Mengaktifkan kamera...</div></div>
    <div class="pin-hint" style="text-align:center;margin:8px 0 12px;">Arahkan kamera ke QR di struk pembeli. Pesanan langsung terbuka kalau QR terbaca.</div>
    <label class="btn-outline hk-filebtn">📷 Ambil foto QR<input type="file" accept="image/*" capture="environment" id="hkScanFile" onchange="hkScanFoto(this)" hidden></label>
    <div class="so-section-label" style="margin-top:16px;">Tidak bisa scan? Cari nomor transaksi</div>
    <div class="hk-rowin"><input id="hkScanManual" placeholder="Contoh: HK-261004-56"><button class="btn-outline" onclick="hkScanCari()">Cari</button></div>
    <div class="pin-hint" style="margin-top:6px;">Pencarian manual tetap perlu verifikasi 4 digit no HP dan PIN atasan.</div></div></div>
  <div class="view" id="view-hk-tutup">${back('hkTutupBack()','Tutup Kasir','hkTutupSub')}<div class="lap-scroll" id="hkTutupBody" style="padding-bottom:110px;"></div><div class="bottom-cta"><button class="btn-primary" id="hkTutupBtn" onclick="hkTutupLanjut()">Lanjut, Masukkan PIN</button></div></div>
  <div class="view" id="view-hk-terima">${back("hkTerimaKembali()",'Terima Kiriman Stok','hkTmSub')}<div class="lap-scroll" id="hkTmBody" style="padding-bottom:110px;"></div><div class="bottom-cta"><button class="btn-primary" onclick="hkTerimaSimpan()">Terima barang</button></div></div>
  <div class="view" id="view-hk-so">${back("hkSOKembali()",'Stok Opname','hkSoSub')}<div class="lap-scroll" id="hkSoBody" style="padding-bottom:110px;"></div><div class="bottom-cta"><button class="btn-primary" onclick="hkSOKirim()">Kirim hasil opname</button></div></div>
  <div class="view" id="view-hk-masuk">${back("hkGo('view-home')",'Riwayat Masuk','hkMsSub')}<div class="lap-scroll"><div class="lap-cat-chips" id="hkMsChips" style="margin-bottom:4px;"></div><div id="hkMsList"></div></div></div>
  <div class="view" id="view-hk-riwayat">${back("hkGo('view-home')",'Penjualan','hkRwSub').replace(/<\/div><\/div>$/,'</div><button class="sheet-add-btn" onclick="hkScanBuka()">📷 Scan QR</button></div>')}<div class="lap-scroll"><div class="lap-cat-chips" id="hkRwChips" style="margin-bottom:12px;"></div><div id="hkRwList"></div></div></div>
  ${sheet('Varian',`<div class="sheet-title" id="hkVarTitle"></div><div class="sheet-sub">Pilih ukuran. Ketuk lagi untuk menambah jumlah.</div><div class="sheet-body" id="hkVarBody"></div><button class="btn-primary" onclick="closeSheet('sheetHkVarian')">Selesai</button>`)}
  ${sheet('Cart',`<div class="sheet-title">Keranjang</div><div class="sheet-sub">Ubah jumlah atau hapus barang</div><div class="sheet-body" id="hkCartBody"></div><div class="hk-cart-foot"><span>Total</span><span id="hkCartTotal"></span></div><div class="confirm-actions"><button class="btn-outline" onclick="closeSheet('sheetHkCart')">Tutup</button><button class="btn-confirm-primary" onclick="closeSheet('sheetHkCart'); goToPayment()">Bayar</button></div>`)}
  ${sheet('Event',`<div class="sheet-title" id="hkEvTitle"></div><div class="sheet-sub">Info event dan sisa stok di booth</div><div class="sheet-body" id="hkEvBody"></div>`)}
  ${sheet('Trx',`<div class="sheet-title" id="hkTrxTitle"></div><div class="sheet-sub">Detail transaksi</div><div class="sheet-body" id="hkTrxBody"></div>`)}
  ${sheet('TutupEv',`<div class="sheet-title" id="hkTevTitle"></div><div class="sheet-sub">Khusus Owner. Sama dengan Tutup Event di dashboard.</div><div class="sheet-body" id="hkTevBody"></div>`)}
  ${sheet('Retur',`<div class="sheet-title" id="hkRtTitle">Retur barang cacat</div><div class="sheet-sub">Hanya untuk barang cacat. Barang cacat tidak kembali ke stok jual.</div><div class="sheet-body" id="hkRtBody"></div>`)}
  ${sheet('SOSetuju',`<div class="sheet-title" id="hkSsTitle">Periksa stok opname</div><div class="sheet-sub">Khusus Owner dan Admin. Event tetap berjalan.</div><div class="sheet-body" id="hkSsBody"></div>`)}
  ${sheet('Setelan',`<div class="sheet-title">Pengaturan</div><div class="sheet-sub">Dibaca dari dashboard</div><div class="sheet-body" id="hkSetBody"></div>`)}
  ${sheet('Sup',`<div class="sheet-title" id="hkSupTitle" style="text-align:center;"></div><div class="sheet-sub" id="hkSupSub" style="text-align:center;"></div><div style="display:flex;flex-direction:column;align-items:center;"><div class="pin-dots" id="hkSupDots"></div><div class="pin-hint">Masukkan PIN Admin atau Owner</div><div class="pin-keypad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="pin-key" onclick="hkSupKey('${n}')">${n}</button>`).join('')}<button class="pin-key func" onclick="closeSheet('sheetHkSup')">Batal</button><button class="pin-key" onclick="hkSupKey('0')">0</button><button class="pin-key func" onclick="hkSupKey('<')">⌫</button></div></div>`)}
  `);

const SES_KEY='hk2pos:sesi2', HELD_KEY='hk2pos:held2';
const ls={ get(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } }, set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} } };
let ses = ls.get(SES_KEY) || {kasir:null, shiftId:null};
function saveSes(){ ses.cart=cart; ses.customItems=customItems; ses.promo=appliedPromo; ses.customer=selectedCustomer?selectedCustomer.code:null; ses.resumed=resumedFrom; ls.set(SES_KEY, ses); }
function save(...keys){ keys.forEach(k=>hkSave(k, D[k])); }

/* ── data turunan ── */
const shift = ()=>D.shift.find(s=>s.id===ses.shiftId);
const ev = ()=>{ const s=shift(); return s?hkTempat(D, s.eventId):null; };
const evNama = ()=>{ const e=ev(); return e?e.nama:'-'; };
const staff = n=>D.staff.find(s=>s.nama===n);
const isSup = s=>!!s&&s.role.some(r=>r==='Admin'||r==='Owner');
const isOwner = s=>!!s&&s.role.includes('Owner');
const ambilNanti = ()=>hkAmbilNanti(ev());
const stokEv = sku=>{ const e=ev(); return e?hkStokDi(D.stok, sku, e.nama):0; };
const pid = sku=>{ let h=7; for(const c of sku) h=(h*31+c.charCodeAt(0))%1999999973; return h+100; };
const CAT_EMOJI={Pakaian:'👕', Aksesoris:'🧢', Tas:'👜', Konsumsi:'☕'};
const BGS=['#FFE9DA','#E3F1EC','#E4ECFB','#F6E3EF','#F4EBD6','#E1F2F4','#ECE6F8','#FBE4DC'];
const bgFor = s=>{ let h=0; for(const c of s) h=(h*31+c.charCodeAt(0))%997; return BGS[h%BGS.length]; };
const initials2 = n=>n.split(/\s+/).filter(w=>/^[A-Za-z]/.test(w)).slice(0,2).map(w=>w[0]).join('').toUpperCase();
let resumedFrom = ses.resumed || null;

/* ════════ 1. DATA KE PROTOTIPE ════════ */
function loadProducts(){
  const sold={}; D.trx.filter(t=>t.status!=='Void').forEach(t=>t.items.forEach(i=>{ if(i.sku){ const c=hkCatalog(D.produk).find(x=>x.sku===i.sku); if(c) sold[c.parent]=(sold[c.parent]||0)+i.qty; } }));
  const top=new Set(Object.entries(sold).sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0]));
  PRODUCTS.length=0;
  const evx=ev(), pilihan=evx&&!evx.gudang&&evx.produk?new Set(evx.produk):null, varPil=evx&&!evx.gudang&&Array.isArray(evx.varian)?new Set(evx.varian):null;
  hkCatalog(D.produk).filter(c=>c.aktif&&c.tampilPos&&(varPil?varPil.has(c.sku):(!pilihan||pilihan.has(c.parent)))).forEach(c=>PRODUCTS.push({id:pid(c.sku), name:c.nama, varNama:c.varNama, parent:c.parent, parentName:c.produk,
    price:hkHarga(ev(),c.sku,c.harga), normal:c.harga, hpp:c.hpp, emoji:CAT_EMOJI[c.kategori]||'🎁', bg:bgFor(c.parent), sku:c.sku, category:c.kategori, favorite:top.has(c.parent), isPaket:false}));
  const kats=[...new Set(PRODUCTS.map(p=>p.category))];
  CATEGORY_LIST.length=0;
  CATEGORY_LIST.push({key:'semua', label:'Semua', icon:'🔲'},{key:'favorit', label:'Terlaris', icon:'🔥'},{key:'promo', label:'Promo', icon:'🏷️'},
    ...kats.map(k=>({key:k, label:k, icon:CAT_EMOJI[k]||'🎁'})));
  if(!CATEGORY_LIST.some(c=>c.key===activeCat)) activeCat='semua';
}
function loadPayMethods(){
  const m=D.pos.metode; PAY_METHODS.length=0;
  if(m.tunai) PAY_METHODS.push({id:'cash', name:'Tunai', ic:'💵'});
  if(m.qris) PAY_METHODS.push({id:'qris', name:'QRIS', ic:'🔳'});
  if(m.transfer) PAY_METHODS.push({id:'transfer', name:'Transfer', ic:'🏦'});
}
function loadPromos(){
  const e=ev(); PROMO_PROGRAMS.length=0; if(!e) return;
  hkPromoAktif(D, e.nama).forEach(p=>{
    if(p.scope==='product'){ p.productIds=PRODUCTS.filter(x=>p.parents.includes(x.parentName)).map(x=>x.id); p.productId=p.productIds[0]; if(!p.productIds.length) return; }
    if(p.type==='bonus'){ p.bonusIds=PRODUCTS.filter(x=>p.bonusParents.includes(x.parentName)).map(x=>x.id); if(!p.bonusIds.length) return; }
    if(p.type==='bundle'&&(p.parents.length<2||!p.parents.every(n=>PRODUCTS.some(x=>x.parentName===n)))) return;
    PROMO_PROGRAMS.push(p);
  });
  if(D.pos.diskonKasir) PROMO_PROGRAMS.push({id:'manual', name:'Diskon Manual Kasir', scope:'order', type:'percent', percent:5, maxPotongan:0, minPembelian:0, editable:true, maxPercent:D.pos.diskonMaks||10,
    desc:`Kasir boleh memberi diskon sampai ${D.pos.diskonMaks}% (diatur di dashboard)`, periode:'Selama shift'});
  PROMO_LIST.length=0;
  PROMO_PROGRAMS.forEach(p=>PROMO_LIST.push({icon:p.scope==='product'?'🏷️':'🎉', title:p.name, sub:`${p.desc}${p.periode?' · '+p.periode:''}`}));
  if(appliedPromo&&!PROMO_PROGRAMS.some(p=>p.id===appliedPromo.id)) appliedPromo=null;
}
function loadCustomers(){
  customers=D.pelanggan.map(c=>({code:c.kode, name:c.nama, group:c.grup||'Tanpa Grup', poin:c.poin||0, phone:c.telepon}));
  const g=[...new Set(customers.map(c=>c.group).filter(x=>x&&x!=='Tanpa Grup'))];
  CUSTOMER_GROUPS.length=0; CUSTOMER_GROUPS.push('Semua','Tanpa Grup',...g);
  const wrap=document.getElementById('custChips'); wrap.innerHTML='';
  CUSTOMER_GROUPS.forEach(gr=>{ const chip=document.createElement('div'); chip.className='cust-chip'+(gr===activeCustGroup?' active':''); chip.textContent=gr;
    chip.onclick=()=>{ document.querySelectorAll('.cust-chip').forEach(c=>c.classList.remove('active')); chip.classList.add('active'); activeCustGroup=gr; renderCustomerList(); }; wrap.appendChild(chip); });
  renderCustomerList();
}
function loadAll(){ loadProducts(); loadPayMethods(); loadPromos(); loadCustomers(); }

/* promo produk: berlaku untuk semua varian dari produk induknya, plus syarat jumlah minimum */
promoBase=function(promo, items){
  if(!promo) return 0;
  if(promo.scope==='product'){
    const ids=promo.productIds||[promo.productId];
    const its=items.filter(i=>!i.custom&&ids.includes(i.id));
    if(promo.minQty && its.reduce((a,i)=>a+i.qty,0)<promo.minQty) return 0;
    return its.reduce((a,i)=>a+itemUnitPrice(i)*i.qty,0);
  }
  if(promo.minQty && items.reduce((a,i)=>a+i.qty,0)<promo.minQty) return 0;
  return itemsTotal(items);
};
/* potongan Rp "berlaku kelipatan": dikali berapa kali minimal pembelian terpenuhi */
const _promoDisc=promoDiscountAmount;
promoDiscountAmount=function(promo, items){
  if(!promo||!promo.kelipatan||promo.type!=='nominal'||!promo.minPembelian) return _promoDisc(promo, items);
  const base=promoBase(promo, items); if(base<promo.minPembelian) return 0;
  return Math.min(base, (promo.nominal||0)*Math.floor(base/promo.minPembelian));
};
/* tab Promo: kartu bisa diketuk untuk memasang promo, atau melihat syarat yang belum terpenuhi */
function syaratPromo(pr){
  if(pr.type==='bonus') return `Beli ${pr.minQty} ${pr.parents.join('/')} gratis ${pr.bonusQty} ${pr.bonusParents.join('/')}${pr.kelipatan?' · berlaku kelipatan':''}`;
  if(pr.type==='bundle') return `Paket ${pr.parents.join(' + ')} jadi ${fmt(pr.hargaPaket)}${pr.kelipatan?' per paket':''}`;
  const pot=pr.id==='manual'?`Diskon sampai ${pr.maxPercent}%`:pr.type==='percent'?`Potongan ${pr.percent}%${pr.maxPotongan?' maks '+fmt(pr.maxPotongan):''}`:`Potongan ${fmt(pr.nominal)}${pr.kelipatan?' per kelipatan':''}`;
  const syarat=[pr.scope==='product'?`untuk ${(pr.parents||[]).join(', ')}`:'', pr.minQty?`min ${pr.minQty} pcs`:'', pr.minPembelian?`min belanja ${fmt(pr.minPembelian)}`:''].filter(Boolean).join(', ');
  return pot+(syarat?' · '+syarat:'');
}
function kurangPromo(pr, items){
  if(pr.type==='bonus'){ const b=bonusInfo(pr,items); return b.qSyarat<pr.minQty?`Kurang ${pr.minQty-b.qSyarat} pcs ${pr.parents.join('/')} lagi`:null; }
  if(pr.type==='bundle'){ const k=paketInfo(pr,items).kurang; return k.length?`Tambahkan ${k.join(' dan ')} ke keranjang`:null; }
  if(promoMeetsMinimum(pr,items)) return null;
  const qty=pr.scope==='product'?items.filter(i=>(pr.productIds||[]).includes(i.id)).reduce((a,i)=>a+i.qty,0):items.reduce((a,i)=>a+i.qty,0), base=promoBase({...pr,minQty:0},items);
  return pr.minQty&&qty<pr.minQty?`Kurang ${pr.minQty-qty} pcs${pr.scope==='product'?' '+(pr.parents||[]).join('/'):''} lagi`:pr.scope==='product'&&!base?`Tambahkan ${(pr.parents||[]).join('/')} ke keranjang`:`Kurang belanja ${fmt(Math.max(0,(pr.minPembelian||0)-base))} lagi`;
}
const promoRelevan=(pr,items)=>pr.scope!=='product'||items.some(i=>(pr.productIds||[]).includes(i.id));
/* tombol Promosi langsung membuka Promo Tersedia (promo untuk isi keranjang). Semua promo aktif dilihat di Tab Promo. */
openPromoQuickMenu=function(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); closePromoQuickMenu(); openPromoListSheet(); };
(function(){
  document.getElementById('promoQuickMenu').innerHTML=`<div class="quick-menu-item" onclick="closePromoQuickMenu(); openSheet('sheetPromoTersedia'); renderPromoTersedia();">List Promo</div>
    <div class="quick-menu-item" onclick="closePromoQuickMenu(); openPromoListSheet();">Promo Tersedia</div>`;
  const a=document.querySelector('#sheetPromoTersedia .sheet-title'), b=document.querySelector('#sheetPromoTersedia .sheet-sub'); if(a) a.textContent='List Promo'; if(b) b.id='hkListPromoSub';
  const c=document.querySelector('#sheetListPromo .sheet-title'), d=document.querySelector('#sheetListPromo .sheet-sub'); if(c) c.textContent='Promo Tersedia'; if(d) d.textContent='Promo yang berlaku untuk produk di keranjang. Pilih salah satu.';
})();
renderPromoTersedia=function(){
  const items=promoSessionItems(), sub=document.getElementById('hkListPromoSub'); if(sub) sub.textContent=`Semua promo yang aktif di ${evNama()} saat ini`;
  document.getElementById('promoTersediaBody').innerHTML=PROMO_PROGRAMS.map(p=>{ const on=appliedPromo&&appliedPromo.id===p.id;
    return `<div class="promo-card" style="cursor:default;${on?'border-color:#FF6100;background:#FFF6EF;':''}"><div style="font-size:18px;">${p.scope==='product'?'🏷️':'🎉'}</div><div class="promo-body">
      <div class="promo-name">${hkEsc(p.name)} <span class="promo-scope-tag">${p.scope==='product'?'Per Produk':'Total Belanja'}</span>${p.auto?' <span class="hk-pd-tag">Otomatis</span>':''}${on?' <span class="hk-pd-tag">✓ Dipakai</span>':''}</div>
      <div class="promo-desc">${hkEsc(p.desc)}</div><div class="hk-pd-syarat">${hkEsc(syaratPromo(p))}</div><div class="promo-period">Periode: ${hkEsc(p.periode)}</div></div></div>`; }).join('')||'<div class="pt-list-empty">Tidak ada promo aktif di tempat ini</div>';
};
renderPromoListBody=function(){
  const items=promoSessionItems(), L=PROMO_PROGRAMS.filter(p=>promoRelevan(p,items));
  document.getElementById('promoListBody').innerHTML=L.map(p=>{ const kurang=kurangPromo(p,items), sel=tempPromoSelId===p.id;
    return `<div class="promo-card ${sel?'selected':''} ${kurang?'disabled':''}" onclick="${kurang?`showToast('${hkEsc(kurang).replace(/'/g,'')}')`:`pilihPromoSementara('${p.id}')`}"><div class="promo-radio"></div><div class="promo-body">
      <div class="promo-name">${hkEsc(p.name)} <span class="promo-scope-tag">${p.scope==='product'?'Per Produk':'Total Belanja'}</span>${p.auto?' <span class="hk-pd-tag">Otomatis</span>':''}</div>
      <div class="hk-pd-syarat">${hkEsc(syaratPromo(p))}</div>${kurang?`<div class="promo-note">${hkEsc(kurang)}</div>`:`<div class="promo-desc" style="color:#1E8E4E;font-weight:700;">${p.type==='bonus'&&!promoDiscountAmount(p,items)?`Dapat ${p.bonusQty} ${hkEsc(p.bonusParents.join('/'))} gratis`:'Hemat '+fmt(promoDiscountAmount(p,items))}</div>`}</div></div>`; }).join('')
    ||'<div class="pt-list-empty">Belum ada promo untuk produk di keranjang. Semua promo aktif ada di tab Promo.</div>';
};
window.hkPakaiPromo=id=>{
  const pr=PROMO_PROGRAMS.find(x=>x.id===id); if(!pr) return; const items=promoSessionItems();
  if(appliedPromo&&appliedPromo.id===id){ showToast(`${pr.name} sudah dipakai. Hapus lewat tombol Promosi di atas total`); return; }
  if(!items.length){ showToast(`Masukkan produk dulu. Syarat: ${syaratPromo(pr)}`); return; }
  if(!promoMeetsMinimum(pr,items)){ showToast(`${kurangPromo(pr,items)} untuk ${pr.name}`); return; }
  tempPromoSelId=id; simpanPromoSelection(); renderProductArea(); };
/* bar ••• / Promosi / Simpan selalu tepat di atas bar total belanja, berapa pun tingginya */
function posisiMiniBar(){ const cb=document.getElementById('cartBar'), mb=document.getElementById('miniActionsBar'); if(!cb||!mb) return;
  const bawah=parseFloat(getComputedStyle(cb).bottom)||14; mb.style.bottom=(bawah+cb.offsetHeight+8)+'px';
  /* ruang kosong di bawah daftar supaya item terakhir tidak tertutup kedua bar */
  const tampil=cb.classList.contains('show'), ruang=tampil?bawah+cb.offsetHeight+8+(mb.classList.contains('show')?mb.offsetHeight+8:0)+16:24;
  ['productGrid','skuList','promoDepositList'].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.paddingBottom=ruang+'px'; }); }
window.addEventListener('resize', posisiMiniBar);
/* aktivasi "Otomatis": promo terbaik yang syaratnya terpenuhi langsung dipasang, kecuali kasir sudah memilih atau menghapusnya */
let promoDilepasKasir=false;
function cekPromoOtomatis(){
  const items=promoSessionItems(); if(!items.length){ promoDilepasKasir=false; if(appliedPromo&&appliedPromo.auto){ appliedPromo=null; } return; }
  if(appliedPromo&&!appliedPromo.auto) return; if(promoDilepasKasir) return;
  const best=PROMO_PROGRAMS.filter(p=>p.auto&&promoMeetsMinimum(p,items)).map(p=>({p,d:promoDiscountAmount(p,items)})).filter(x=>x.d>0).sort((a,b)=>b.d-a.d)[0];
  if(best&&(!appliedPromo||appliedPromo.id!==best.p.id)){ appliedPromo={...best.p, auto:true}; refreshPromoUI(); showToast(`🏷️ ${best.p.name} otomatis dipakai`); }
  else if(!best&&appliedPromo&&appliedPromo.auto){ appliedPromo=null; refreshPromoUI(); }
}
const _updCartBar=updateCartBar;
updateCartBar=function(){ _updCartBar(); try{ cekPromoOtomatis(); }catch(e){} posisiMiniBar(); requestAnimationFrame(posisiMiniBar); if(activeCat==='promo') renderProductArea(); };
const _simpanPromoSel=simpanPromoSelection;
simpanPromoSelection=function(){ if(!tempPromoSelId&&appliedPromo) promoDilepasKasir=true; _simpanPromoSel(); if(appliedPromo&&tempPromoSelId){ appliedPromo.auto=false; promoDilepasKasir=false; } };
promoMeetsMinimum=function(promo, items){ if(!promo) return true; const b=promoBase(promo,items); return promo.scope==='product'?b>0&&b>=(promo.minPembelian||0):b>=(promo.minPembelian||0); };
const _ubahPercent=ubahPercentPromo;
ubahPercentPromo=function(delta){ _ubahPercent(delta); const max=appliedPromo&&appliedPromo.maxPercent; if(max&&tempPromoEditPercent>max){ tempPromoEditPercent=max; updateUbahPercentDisplay(); showToast(`Batas potongan kasir ${max}%`); } };

/* bonus produk (beli X gratis Y) dan bundling (harga paket). Barang gratis tetap masuk keranjang supaya stoknya berkurang. */
const unitHarga=(items,ids,urut)=>{ const u=[]; items.filter(i=>!i.custom&&ids.includes(i.id)).forEach(i=>{ for(let k=0;k<i.qty;k++) u.push({id:i.id, harga:itemUnitPrice(i)}); }); return u.sort((a,b)=>urut*(a.harga-b.harga)); };
function bonusInfo(pr, items){
  const sy=pr.productIds||[], bo=pr.bonusIds||[], sama=sy.some(id=>bo.includes(id));
  const qSyarat=items.filter(i=>!i.custom&&sy.includes(i.id)).reduce((a,i)=>a+i.qty,0);
  let set=Math.floor(qSyarat/(sama?pr.minQty+pr.bonusQty:pr.minQty)); if(!pr.kelipatan) set=Math.min(set,1);
  const hak=set*pr.bonusQty, gratis=unitHarga(items,bo,1).slice(0,hak);
  const perlu=qSyarat<pr.minQty?0:sama?(hak?0:pr.bonusQty):Math.max(0,(pr.kelipatan?hak:pr.bonusQty)-gratis.length);
  return {qSyarat, hak, gratis, perlu, potongan:gratis.reduce((a,u)=>a+u.harga,0)};
}
function paketInfo(pr, items){
  const g=pr.parents.map(n=>({n, u:unitHarga(items,PRODUCTS.filter(x=>x.parentName===n).map(x=>x.id),-1)}));
  let n=Math.min(...g.map(x=>x.u.length)); if(!pr.kelipatan) n=Math.min(n,1);
  const normal=g.reduce((a,x)=>a+x.u.slice(0,n).reduce((b,u)=>b+u.harga,0),0);
  return {n, kurang:g.filter(x=>!x.u.length).map(x=>x.n), normal, potongan:Math.max(0,normal-n*pr.hargaPaket)};
}
const _meets2=promoMeetsMinimum;
promoMeetsMinimum=function(promo, items){ if(promo&&promo.type==='bonus') return bonusInfo(promo,items).qSyarat>=promo.minQty; if(promo&&promo.type==='bundle') return paketInfo(promo,items).n>0; return _meets2(promo,items); };
const _disc2=promoDiscountAmount;
promoDiscountAmount=function(promo, items){ if(promo&&promo.type==='bonus') return bonusInfo(promo,items).potongan; if(promo&&promo.type==='bundle') return paketInfo(promo,items).potongan; return _disc2(promo,items); };
/* setelah promo bonus dipasang: barang gratis langsung ditambahkan; kalau ada beberapa ukuran, kasir memilih */
function tambahBonus(pr){ const b=bonusInfo(pr,promoSessionItems()); if(!b.perlu) return;
  const pil=PRODUCTS.filter(x=>pr.bonusIds.includes(x.id)&&(ambilNanti()||stokEv(x.sku)-(cart[x.id]||0)>0));
  if(!pil.length){ showToast(`Stok ${pr.bonusParents.join('/')} habis, bonus tidak bisa diberikan`); return; }
  if(pil.length===1){ for(let k=0;k<b.perlu;k++) addToCart(pil[0].id); showToast(`🎁 ${b.perlu} ${pil[0].name} gratis ditambahkan`); return; }
  hkOpenVarian(pil[0].parent); showToast(`🎁 Pilih ${b.perlu} ${pr.bonusParents.join('/')} yang gratis`); }
window.hkPromoHitung={syaratPromo, kurangPromo, bonusInfo, paketInfo};
const _simpanPromoSel2=simpanPromoSelection;
simpanPromoSelection=function(){ _simpanPromoSel2(); if(appliedPromo&&appliedPromo.type==='bonus') tambahBonus(appliedPromo); };

/* ════════ 2. TAMPILAN PRODUK: satu kartu per produk, varian lewat sheet ════════ */
function groups(list){ const m=new Map(); list.forEach(p=>{ if(!m.has(p.parent)) m.set(p.parent,{parent:p.parent, name:p.parentName, emoji:p.emoji, bg:p.bg, items:[]}); m.get(p.parent).items.push(p); }); return [...m.values()]; }
renderProductArea=function(){
  const gridEl=document.getElementById('productGrid'), skuEl=document.getElementById('skuList'), pdEl=document.getElementById('promoDepositList'), emptyEl=document.getElementById('emptyCatState');
  [gridEl,skuEl,pdEl,emptyEl].forEach(el=>el.style.display='none');
  if(activeCat==='promo'){
    pdEl.style.display='flex';
    const items=promoSessionItems();
    pdEl.innerHTML=PROMO_PROGRAMS.length?PROMO_PROGRAMS.map(pr=>{ const on=appliedPromo&&appliedPromo.id===pr.id, ok=items.length&&promoMeetsMinimum(pr,items);
      return `<div class="pd-card hk-pd ${on?'on':''}" onclick="hkPakaiPromo('${hkEsc(pr.id)}')"><div class="pd-ic">${pr.scope==='product'?'🏷️':'🎉'}</div><div class="pd-info">
        <div class="pd-title">${hkEsc(pr.name)} ${pr.auto?'<span class="hk-pd-tag">Otomatis</span>':''}</div><div class="pd-sub">${hkEsc(pr.desc)}${pr.periode?' · '+hkEsc(pr.periode):''}</div>
        <div class="hk-pd-syarat">${hkEsc(syaratPromo(pr))}</div></div>
        <div class="hk-pd-aksi ${on?'on':ok?'ok':''}">${on?'✓ Dipakai':ok?'Pakai':'Lihat'}</div></div>`; }).join('')
      :'<div class="pt-list-empty">Tidak ada promo aktif untuk event ini</div>';
    return;
  }
  const q=document.getElementById('productSearch').value.trim().toLowerCase();
  const filtered=PRODUCTS.filter(p=>(activeCat==='semua'||(activeCat==='favorit'?p.favorite:p.category===activeCat)) && (!q||p.name.toLowerCase().includes(q)||p.sku.toLowerCase().includes(q)));
  if(!filtered.length){ emptyEl.style.display='flex'; emptyEl.innerHTML='<div class="ecs-ic">🔍</div><div class="ecs-title">Produk tidak ditemukan</div><div>Coba kata kunci lain atau pilih kategori berbeda.</div>'; return; }
  if(currentMode==='SKU'){
    skuEl.style.display='flex';
    skuEl.innerHTML=filtered.map(p=>{ const st=stokEv(p.sku), qty=cart[p.id]||0; return `<div class="sku-row ${st<=0&&!ambilNanti()?'hk-habis':''}" onclick="addToCart(${p.id})"><div class="sku-row-thumb" style="background:${p.bg}">${p.emoji}</div>
      <div class="sku-row-info"><div class="sku-row-name">${hkEsc(p.name)}</div><div class="sku-row-code">SKU ${p.sku} · <span class="${st<=3&&!ambilNanti()?'hk-low':''}">${ambilNanti()?'Pre-sale':st<=0?'Habis':'Sisa '+st}</span>${p.price!==p.normal?' · harga event':''}</div></div>
      <div class="sku-row-right"><div class="sku-row-price">${fmt(p.price)}</div>${qty?`<div class="sku-row-qty">×${qty}</div>`:''}</div></div>`; }).join('');
    return;
  }
  gridEl.style.display='grid';
  gridEl.innerHTML=groups(filtered).map(g=>{
    const st=g.items.reduce((a,p)=>a+Math.max(0,stokEv(p.sku)),0), qty=g.items.reduce((a,p)=>a+(cart[p.id]||0),0);
    const hs=g.items.map(p=>p.price), mn=Math.min(...hs), mx=Math.max(...hs);
    const tap=g.items.length>1?`hkOpenVarian('${g.parent}')`:`addToCart(${g.items[0].id})`;
    return `<div class="pcard ${st<=0&&!ambilNanti()?'hk-habis':''}" onclick="${tap}">
      <div class="pcard-qty ${qty>0?'show':''}">${qty}</div>${g.items.length>1?`<div class="hk-varbadge">${g.items.length} varian</div>`:''}
      <div class="pcard-thumb" style="background:${g.bg}">${g.emoji}</div>
      <div class="pcard-name">${hkEsc(g.name)}</div>
      <div class="pcard-price">${mn===mx?fmt(mn):fmt(mn)+'+'}</div>
      <div class="hk-stok ${st>0&&st<=3&&!ambilNanti()?'hk-low':''}">${ambilNanti()?'Pre-sale · ambil saat event':hkPreSaleTutup(ev())?`Dijual mulai ${hkTgl(ev().mulai)}`:st<=0?'Stok habis':`Sisa ${st}`}${g.items.some(p=>p.price!==p.normal)?' · <span class="hk-evprice">harga event</span>':''}</div></div>`; }).join('');
};
let varParent=null;
window.hkOpenVarian=function(parent){ varParent=parent; renderVarian(); openSheet('sheetHkVarian'); };
function renderVarian(){
  const items=PRODUCTS.filter(p=>p.parent===varParent); if(!items.length) return;
  document.getElementById('hkVarTitle').textContent=items[0].parentName;
  document.getElementById('hkVarBody').innerHTML=`<div class="hk-vgrid">${items.map(p=>{ const st=stokEv(p.sku), q=cart[p.id]||0;
    return `<button class="hk-vbtn ${q?'on':''}" ${st-q<=0&&!ambilNanti()?'disabled':''} onclick="addToCart(${p.id})">${q?`<span class="hk-vq">${q}</span>`:''}<b>${hkEsc(p.varNama)}</b><small>${fmt(p.price).replace('Rp ','')}${ambilNanti()?' · pre-sale':` · sisa ${Math.max(0,st-q)}`}</small></button>`; }).join('')}</div>`;
}
const _addToCart=addToCart;
addToCart=function(id){
  const p=PRODUCTS.find(x=>x.id===id);
  if(hkPreSaleTutup(ev())){ showToast(`Pre-sale nonaktif, dijual mulai ${hkTgl(ev().mulai)}`); return; }
  if(gudangSerahSaja()){ showToast('Admin di Gudang Pusat hanya untuk serah terima pre-sale'); return; }
  if(p&&!ambilNanti()){ const sisa=stokEv(p.sku)-(cart[id]||0); if(sisa<=0){ showToast(`Stok ${p.name} di event habis`); return; } }
  _addToCart(id);
  if(document.getElementById('sheetHkVarian').classList.contains('show')) renderVarian();
  saveSes();
};

/* ── keranjang: ubah jumlah atau hapus per barang ── */
function renderCartSheet(){
  const rows=[...Object.entries(cart).map(([id,qty])=>{ const p=PRODUCTS.find(x=>x.id==id); return p?{key:'p'+id, name:p.parentName, sub:p.varNama, price:p.price, qty, emoji:p.emoji, bg:p.bg, max:stokEv(p.sku)}:null; }).filter(Boolean),
    ...customItems.map((c,i)=>({key:'c'+i, name:c.name, sub:'Custom amount', price:c.price, qty:c.qty, emoji:'✏️', bg:'#EEE', max:999}))];
  document.getElementById('hkCartBody').innerHTML=rows.length?rows.map(r=>`<div class="hk-ci"><div class="so-produk-thumb" style="background:${r.bg}">${r.emoji}</div>
    <div class="hk-ci-info"><div class="hk-ci-name">${hkEsc(r.name)}${r.sub?` <span>· ${hkEsc(r.sub)}</span>`:''}</div><div class="hk-ci-sub">${fmt(r.price)}${r.qty>=r.max?` · <span class="hk-low">stok maks ${r.max}</span>`:''}</div></div>
    <div class="qty-stepper"><button class="qty-btn" onclick="hkCartQty('${r.key}',-1)">−</button><span class="hk-ci-q">${r.qty}</span><button class="qty-btn" onclick="hkCartQty('${r.key}',1)">+</button></div></div>`).join('')
    :'<div class="pt-list-empty">Keranjang kosong</div>';
  document.getElementById('hkCartTotal').textContent=fmt(cartTotalValue());
}
window.hkOpenCart=function(){ renderCartSheet(); openSheet('sheetHkCart'); };
window.hkCartQty=function(key, d){
  if(key[0]==='p'){ const id=Number(key.slice(1)); if(d>0){ addToCart(id); } else { cart[id]--; if(cart[id]<=0) delete cart[id]; renderProductArea(); updateCartBar(); } }
  else { const c=customItems[Number(key.slice(1))]; c.qty+=d; if(c.qty<=0) customItems.splice(Number(key.slice(1)),1); updateCartBar(); }
  saveSes();
  if(cartCount()===0){ closeSheet('sheetHkCart'); return; }
  renderCartSheet();
};

/* ════════ 3. PEMBAYARAN ════════ */
/* pre-sale "ambil nanti" wajib data pembeli (nama + no HP) untuk verifikasi saat pengambilan atau refund */
const _goPay=goToPayment;
goToPayment=function(){
  if(hkPreSaleTutup(ev())&&cartCount()>0){ showToast(`Pre-sale nonaktif, dijual mulai ${hkTgl(ev().mulai)}`); return; }
  if(ambilNanti()&&cartCount()>0){
    const c=selectedCustomer, hp=c&&(c.phone||((D.pelanggan.find(x=>x.kode===c.code)||{}).telepon));
    if(!c){ showToast('Pre-sale wajib pilih pelanggan (nama & no HP)'); openSheet('sheetPelangganList'); return; }
    if(!hp){ showToast(`No HP ${c.name} belum ada. Tambah pelanggan baru dengan no HP`); openSheet('sheetPelangganList'); return; }
  }
  _goPay();
};
const _renderPayment=renderPayment;
renderPayment=function(){
  loadPayMethods(); _renderPayment();
  document.querySelector('#view-pay .subbar-sub').textContent=`${evNama()} · ${ses.kasir}`;
  const ctx=billCtx();
  if(ctx.pajak||ctx.bulat){ const box=document.getElementById('paySummary'); const now=box.querySelector('.pay-summary-row.now');
    const extra=(ctx.pajak?`<div class="pay-summary-row"><span>PPN ${D.pos.pajakPersen}%</span><b>${fmt(ctx.pajak)}</b></div>`:'')+(ctx.bulat?`<div class="pay-summary-row"><span>Pembulatan</span><b>-${fmt(ctx.bulat)}</b></div>`:'');
    if(now) now.insertAdjacentHTML('beforebegin', extra); }
};
/* pajak dan pembulatan dari Pengaturan POS dihitung di atas total setelah promo */
const _billCtx=billCtx;
billCtx=function(){
  const c=_billCtx();
  const base=itemsTotal(c.items)-c.discount;
  const pajak=D.pos.pajakAktif?Math.round(base*D.pos.pajakPersen/100):0;
  const unit=+D.pos.pembulatan||0, kotor=base+pajak, bulat=unit?kotor-Math.floor(kotor/unit)*unit:0;
  const total=kotor-bulat, sisaSebelum=total-c.alreadyPaid;
  let amountNow=sisaSebelum;
  if(splitMode==='jumlah') amountNow=Math.min(splitAmount, sisaSebelum); else if(splitMode==='produk') amountNow=Math.min(splitProdukTotal(), sisaSebelum);
  return {...c, pajak, bulat, total, sisaSebelum, amountNow, sisaSetelah:Math.max(0,sisaSebelum-amountNow)};
};
const _selectPayment=selectPayment;
selectPayment=function(id){
  _selectPayment(id);
  document.querySelectorAll('.hk-rek').forEach(x=>x.remove());
  if(id==='transfer'){ const el=document.getElementById('pm-transfer');
    el.insertAdjacentHTML('afterend', `<div class="hk-rek">${D.pos.rekening.map(r=>`<div class="hk-rek-row"><div><b>${hkEsc(r.no)}</b><div>${hkEsc(r.bank)} · a.n. ${hkEsc(r.nama)}</div></div><button onclick="event.stopPropagation(); navigator.clipboard&&navigator.clipboard.writeText('${hkEsc(r.no).replace(/\s/g,'')}'); showToast('Nomor rekening disalin')">Salin</button></div>`).join('')}<div class="hk-rek-note">Proses bayar setelah dana terlihat di mutasi rekening.</div></div>`); }
};
/* QRIS hanya statis: gambar QRIS dari dashboard dipindai pembeli, pembeli mengetik nominal sendiri, kasir konfirmasi setelah dana masuk.
   Belum ada gambar di dashboard: tampil contoh QRIS statis (prototipe) dengan peringatan. */
openQrisSheet=function(){
  const ctx=billCtx(), sh=document.getElementById('sheetQris'), ada=!!D.pos.qrisImg;
  document.getElementById('qrisAmountVal').textContent=fmt(ctx.amountNow);
  document.getElementById('qrisMerchantName').textContent=`${D.pos.qrisNama}${D.pos.qrisNmid?' · NMID '+D.pos.qrisNmid:''}`;
  sh.querySelector('.sheet-title').textContent='QRIS';
  sh.querySelector('.sheet-sub').textContent='Pembeli memindai QRIS, lalu mengetik sendiri nominal di bawah ini';
  const badge=sh.querySelector('.qris-brand-badge'); if(badge) badge.textContent='QRIS statis';
  let contoh=''; if(!ada){ try{ const q=qrcode(0,'M'); q.addData('00020101021126570011ID.CO.QRIS.WWW0118ID1026XXXXXXXX0215HIKAYATMERCH01520459455303360580'+'2ID5919HIKAYAT MERCHANDISE6007BANDUNG6304ABCD'); q.make(); contoh=q.createSvgTag({cellSize:4, margin:2, scalable:true}); }catch(e){} }
  document.getElementById('qrisCodeBox').innerHTML=ada?`<img src="${D.pos.qrisImg}" alt="QRIS" style="width:100%;height:100%;object-fit:contain;">`:`<div style="position:relative;width:100%;height:100%;">${contoh}<div class="hk-qris-contoh">CONTOH</div></div>`;
  document.getElementById('qrisCodeBox').classList.remove('checking'); document.getElementById('qrisCheckingOverlay').classList.remove('show');
  document.getElementById('qrisStatusRow').innerHTML=ada?'<span class="qris-status-dot pulse"></span><span>Pastikan pembeli mengetik nominal yang sama, lalu cek notifikasi dana masuk di aplikasi merchant</span>'
    :'<span class="qris-status-dot" style="background:#C0392B;"></span><span style="color:#C0392B;">Gambar QRIS belum diunggah. Minta Admin mengunggahnya di Dashboard › Pengaturan POS</span>';
  const btn=document.getElementById('btnCekPembayaranQris'); btn.textContent='Dana Sudah Masuk';
  if(!document.getElementById('hkQrisRef')) btn.insertAdjacentHTML('beforebegin', `<div class="hk-qris-ref"><label for="hkQrisRef">4 digit terakhir no. referensi di notifikasi dana masuk <span style="color:#C0392B;">*</span></label>
    <input id="hkQrisRef" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="Contoh: 4821" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4); hkQrisRefCek()"><div class="hk-qris-ref-help">Semua kasir boleh mengonfirmasi. Angka ini dicatat di transaksi untuk dicocokkan dengan laporan aplikasi merchant.</div></div>`);
  document.getElementById('hkQrisRef').value=''; hkQrisRefCek();
  openSheet('sheetQris');
};
window.hkQrisRefCek=()=>{ const v=document.getElementById('hkQrisRef').value; document.getElementById('btnCekPembayaranQris').disabled=!/^\d{4}$/.test(v); };
/* tidak ada cek otomatis: kasir menekan Dana Sudah Masuk setelah melihat notifikasi dan mengisi 4 digit terakhir no. referensi */
checkQrisPayment=function(){ const el=document.getElementById('hkQrisRef'), v=el?el.value:'';
  if(!/^\d{4}$/.test(v)){ showToast('Isi 4 digit terakhir no. referensi dari notifikasi'); if(el) el.focus(); return; }
  qrisConfirmed=true; qrisIssuer='QRIS statis'; qrisReferensi=v; closeSheet('sheetQris'); prosesBayar(); };
document.head.insertAdjacentHTML('beforeend','<style>.hk-qris-ref{margin:4px 0 10px;text-align:left;}.hk-qris-ref label{display:block;font-size:12.5px;font-weight:700;margin-bottom:6px;}.hk-qris-ref input{width:100%;box-sizing:border-box;font-size:22px;letter-spacing:8px;text-align:center;padding:10px;border:1.5px solid var(--line,#ddd);border-radius:8px;font-weight:700;}.hk-qris-ref-help{font-size:11.5px;color:var(--ink-soft,#777);margin-top:6px;}.hk-qris-contoh{position:absolute;inset:auto 0 42% 0;text-align:center;font-weight:800;font-size:22px;letter-spacing:4px;color:rgba(192,57,43,.85);background:rgba(255,255,255,.75);transform:rotate(-12deg);}</style>');

/* ── pisah bayar: hanya sebagian tagihan, pelunasan tetap lewat bayar biasa ── */
const sisaTagihan=()=>{ const c=_billCtx(); const base=itemsTotal(c.items)-c.discount; const pajak=D.pos.pajakAktif?Math.round(base*D.pos.pajakPersen/100):0; const unit=+D.pos.pembulatan||0, k=base+pajak; return k-(unit?k-Math.floor(k/unit)*unit:0)-c.alreadyPaid; };
function splitHint(id, html){ let el=document.getElementById(id); if(!el) return; el.innerHTML=html; }
document.getElementById('splitKeypadDisplay').insertAdjacentHTML('afterend','<div class="hk-split-hint" id="hkSplitJmlHint"></div>');
document.getElementById('splitProdukTotalVal').closest('div').insertAdjacentHTML('afterend','<div class="hk-split-hint" id="hkSplitPrdHint"></div>');
updateSplitKeypadDisplay=function(){
  let val=parseInt(splitKeypadValue||'0',10); const sisa=sisaTagihan(), maks=sisa-1;
  if(val>maks){ val=Math.max(0,maks); splitKeypadValue=String(val); showToast(`Maksimal ${fmt(val)}, sisakan tagihan untuk bayar biasa`); }
  document.getElementById('splitKeypadDisplay').textContent=val.toLocaleString('id-ID');
  const lewat=val>=sisa;
  document.getElementById('btnProsesPisahJumlah').disabled=val<=0||lewat;
  splitHint('hkSplitJmlHint', lewat?`<span class="hk-low">Harus kurang dari sisa tagihan ${fmt(sisa)}. Untuk melunasi, pakai bayar biasa.</span>`:`Sisa tagihan ${fmt(sisa)} · maksimal ${fmt(Math.max(0,maks))}`);
};
prosesPisahJumlah=function(){
  const val=parseInt(splitKeypadValue||'0',10), sisa=sisaTagihan();
  if(val<=0||val>=sisa){ showToast('Nominal pisah bayar harus kurang dari sisa tagihan'); return; }
  splitAmount=val; splitMode='jumlah'; closeSheet('sheetPisahJumlah'); renderPayment(); showToast('✓ Pisah Jumlah diterapkan');
};
splitProdukQty=function(key, delta, maxQty){
  const cur=splitProdukSel[key]||0, next=Math.max(0,Math.min(maxQty,cur+delta));
  splitProdukSel[key]=next;
  if(delta>0&&next>cur&&splitProdukTotal()>=sisaTagihan()){ splitProdukSel[key]=cur; showToast('Sisakan sebagian untuk dibayar nanti'); }
  renderSplitProdukList();
};
updateSplitProdukTotal=function(){
  const total=splitProdukTotal(), sisa=sisaTagihan();
  document.getElementById('splitProdukTotalVal').textContent=fmt(total);
  document.getElementById('btnProsesPisahProduk').disabled=total<=0||total>=sisa;
  document.getElementById('sheetPisahProdukTitle').textContent='Pisah Produk · '+fmt(total);
  splitHint('hkSplitPrdHint', `Sisa tagihan ${fmt(sisa)}. Pilih sebagian produk saja, sisanya dibayar nanti.`);
};
prosesPisahProduk=function(){
  const t=splitProdukTotal(); if(t<=0||t>=sisaTagihan()){ showToast('Pilih sebagian produk saja'); return; }
  splitMode='produk'; closeSheet('sheetPisahProduk'); renderPayment(); showToast('✓ Pisah Produk diterapkan');
};
const _pilihSplit=pilihSplitMode;
pilihSplitMode=function(mode){
  if(mode!=='jumlah'){ const items=currentItems(); const qty=items.reduce((a,i)=>a+i.qty,0);
    const termurah=Math.min(...items.map(i=>itemUnitPrice(i)));
    if(qty<=1||termurah>=sisaTagihan()){ closeSheet('sheetPisahBayarMenu'); showToast('Tidak bisa pisah produk, pakai Pisah Jumlah'); return; } }
  if(sisaTagihan()<=1){ closeSheet('sheetPisahBayarMenu'); showToast('Sisa tagihan terlalu kecil untuk dipisah'); return; }
  _pilihSplit(mode);
};
const _simpanPisah=konfirmasiSimpanPisahBayar;
konfirmasiSimpanPisahBayar=function(){ _simpanPisah(); const d=new Date(); if(HELD_ORDERS[0]){ HELD_ORDERS[0].noTransaksi=`PSN/${hkYmd(d).slice(2).replace(/-/g,'')}/${hkPad(HELD_ORDERS.length)}`; renderHeldOrders(); renderPayment(); } saveSes(); };

/* simpan transaksi saat tagihan lunas, kurangi stok event */
const _prosesBayar=prosesBayar;
prosesBayar=function(){
  if(!selectedPayment) return _prosesBayar();
  const ctx=billCtx();
  if(selectedPayment==='cash'&&cashTendered<ctx.amountNow) return _prosesBayar();
  if(selectedPayment==='qris'&&!qrisConfirmed) return _prosesBayar();
  const lunas=ctx.sisaSetelah===0;
  if(lunas&&!ambilNanti()){ for(const it of ctx.items){ if(it.custom) continue; const p=PRODUCTS.find(x=>x.id===it.id); if(p&&it.qty>stokEv(p.sku)){ showToast(`Stok ${p.name} tinggal ${stokEv(p.sku)}`); return; } } }
  const metode=PAY_METHODS.find(m=>m.id===selectedPayment).name;
  const tendered=cashTendered, items=ctx.items.map(x=>({...x})), cust=ctx.order?ctx.order.customer:selectedCustomer;
  const hist=ctx.order?(ctx.order.paidHistory||[]).map(h=>({metode:h.method, jumlah:h.amount, ...(h.ref?{ref:h.ref}:{})})):[];
  const noLama=ctx.order?ctx.order.noTransaksi:(resumedFrom&&resumedFrom.noTransaksi);
  const qrisRef=selectedPayment==='qris'?qrisReferensi:null;
  _prosesBayar();
  if(lunas) lastTrx=catatTrx({items, ctx, pembayaran:[...hist,{metode, jumlah:ctx.amountNow, ...(qrisRef?{ref:qrisRef}:{})}], tendered:selectedPayment==='cash'?tendered:0, cust, noLama});
  else lastTrx=null;
  resumedFrom=null; saveHeld(); saveSes();
  /* keranjang sudah dibayar: jangan dipulihkan kalau halaman dimuat ulang di layar sukses */
  ls.set(SES_KEY, {...ses, cart:{}, customItems:[], promo:null, customer:null, resumed:null});
  if(lastTrx&&lastTrx.pengambilan&&lastTrx.pelanggan&&kirimStrukWA(lastTrx,lastTrx.pelanggan.telepon)) setTimeout(()=>showToast(`Struk PDF pre-sale dikirim ke WA ${waTampil(lastTrx.struk.wa)}`),600);
  tambahStrukInfo();
};
let lastTrx=null;
/* ── struk PDF dikirim ke WhatsApp pembeli. Prototipe: PDF dibuat di HP, pengiriman disimulasikan (produksi lewat WhatsApp Business API) ── */
const waNorm=n=>{ let d=String(n||'').replace(/\D/g,''); if(d.startsWith('0')) d='62'+d.slice(1); return d.length>=10?d:''; };
const waTampil=d=>d?'+'+d.slice(0,2)+' '+d.slice(2,5)+' '+d.slice(5,9)+' '+d.slice(9):'';
/* ── pembuat PDF mini untuk struk (teks Helvetica, garis, kotak). Pengganti jsPDF supaya file POS tetap kecil ── */
const HkPdf=(()=>{
  const WR=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const WB=[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
  const EXTRA={'·':[183,278,278],'×':[215,584,584],'–':[150,556,556],'—':[151,1000,1000]};
  const K=72/25.4;
  return class{
    constructor(wmm,hmm){ this.w=wmm; this.h=hmm; this.ops=[]; this.bold=false; this.size=10; }
    setFont(_,st){ this.bold=st==='bold'; } setFontSize(n){ this.size=n; }
    setDrawColor(g){ this.ops.push(`${(g/255).toFixed(3)} G`); } setFillColor(g){ this.ops.push(`${(g/255).toFixed(3)} g`); }
    width(str){ let u=0; for(const ch of String(str)){ const c=ch.charCodeAt(0); u+=c>=32&&c<=126?(this.bold?WB:WR)[c-32]:EXTRA[ch]?EXTRA[ch][this.bold?2:1]:556; } return u/1000*this.size/K; }
    enc(str){ let o=''; for(const ch of String(str)){ const c=ch.charCodeAt(0); if(ch==='('||ch===')'||ch==='\\') o+='\\'+ch; else if(c>=32&&c<=126) o+=ch; else if(EXTRA[ch]) o+='\\'+EXTRA[ch][0].toString(8); else o+='?'; } return o; }
    text(str,x,y,o){ o=o||{}; const w=this.width(str), x0=o.align==='right'?x-w:o.align==='center'?x-w/2:x;
      this.ops.push(`BT /${this.bold?'F2':'F1'} ${this.size} Tf ${(x0*K).toFixed(2)} ${((this.h-y)*K).toFixed(2)} Td (${this.enc(str)}) Tj ET`); }
    line(x1,y1,x2,y2){ this.ops.push(`0.3 w ${(x1*K).toFixed(2)} ${((this.h-y1)*K).toFixed(2)} m ${(x2*K).toFixed(2)} ${((this.h-y2)*K).toFixed(2)} l S`); }
    rect(x,y,w,h){ this.ops.push(`${(x*K).toFixed(2)} ${((this.h-y-h)*K).toFixed(2)} ${(w*K).toFixed(2)} ${(h*K).toFixed(2)} re f`); }
    splitTextToSize(str,max){ const out=[]; let cur=''; String(str).split(/\s+/).filter(Boolean).forEach(wd=>{ const t=cur?cur+' '+wd:wd; if(this.width(t)>max&&cur){ out.push(cur); cur=wd; } else cur=t; }); if(cur) out.push(cur); return out; }
    build(){ const st=this.ops.join('\n'), objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${(this.w*K).toFixed(2)} ${(this.h*K).toFixed(2)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
      `<< /Length ${st.length} >>\nstream\n${st}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
      let pdf='%PDF-1.4\n'; const off=[]; objs.forEach((o,i)=>{ off.push(pdf.length); pdf+=`${i+1} 0 obj\n${o}\nendobj\n`; });
      const xref=pdf.length; pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+off.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return pdf; }
    output(type){ const s=this.build(), b=new Uint8Array(s.length); for(let i=0;i<s.length;i++) b[i]=s.charCodeAt(i)&255; return type==='blob'?new Blob([b],{type:'application/pdf'}):b.buffer; }
    save(name){ const a=document.createElement('a'); a.href=URL.createObjectURL(this.output('blob')); a.download=name; document.body.appendChild(a); a.click(); a.remove(); }
  };
})();
function strukPdf(t){
  const W=80, L=5, R=W-5, e=hkTempat(D,t.eventId)||{nama:t.lokasi}, bayar=hkBayar(t);
  const tinggi=70+t.items.length*9+bayar.length*5+(t.diskon?5:0)+(t.bonus||[]).length*5+(t.pajak?5:0)+(t.pengambilan?62:0);
  const doc=new HkPdf(W, Math.max(120,tinggi)); let y=8;
  const tx=(s,x,o)=>doc.text(String(s),x,y,o||{}); const row=(a,b,bold)=>{ doc.setFont('helvetica',bold?'bold':'normal'); tx(a,L); tx(b,R,{align:'right'}); y+=5; };
  const garis=()=>{ doc.setDrawColor(200); doc.line(L,y-2,R,y-2); y+=2; };
  doc.setFont('helvetica','bold'); doc.setFontSize(11); tx(D.pos.struk.nama,W/2,{align:'center'}); y+=5;
  doc.setFont('helvetica','normal'); doc.setFontSize(8); tx(D.pos.struk.info,W/2,{align:'center'}); y+=4; tx(e.nama,W/2,{align:'center'}); y+=6; garis();
  row('No. transaksi',t.no); row('Waktu',`${hkTgl(t.waktu)} ${hkJam(t.waktu)}`); row('Kasir',t.kasir); if(t.pelanggan) row('Pembeli',t.pelanggan.nama); garis();
  t.items.forEach(i=>{ doc.setFont('helvetica','normal'); tx(doc.splitTextToSize(i.nama,R-L)[0],L); y+=4; row(`  ${i.qty} x ${fmt(i.harga)}`,fmt(i.qty*i.harga)); });
  garis(); row('Subtotal',fmt(t.subtotal)); if(t.diskon) row(t.promo||'Diskon','-'+fmt(t.diskon)); (t.bonus||[]).forEach(b=>row(`  Gratis ${b.nama} x${b.qty}`,'')); if(t.pajak) row('PPN',fmt(t.pajak));
  doc.setFontSize(10); row('TOTAL',fmt(t.total),true); doc.setFontSize(8); bayar.forEach(b=>row(b.metode,fmt(b.jumlah))); if(t.kembalian) row('Kembalian',fmt(t.kembalian));
  if(t.pengambilan){ garis(); doc.setFont('helvetica','bold'); tx('PRE-SALE · QR PENGAMBILAN',W/2,{align:'center'}); y+=3;
    const q=qrcode(0,'M'); q.addData(QR_PREFIX+t.id+'|'+t.no); q.make(); const n=q.getModuleCount(), sz=40/n, x0=(W-40)/2; doc.setFillColor(0);
    for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(q.isDark(r,c)) doc.rect(x0+c*sz, y+r*sz, sz, sz);
    y+=44; doc.setFont('helvetica','normal'); doc.splitTextToSize(`Tunjukkan QR ini saat mengambil barang di booth ${e.nama} mulai ${hkTgl(e.mulai)}. Ukuran tidak bisa ditukar.`, R-L).forEach(l=>{ tx(l,W/2,{align:'center'}); y+=4; }); }
  y+=2; garis(); doc.splitTextToSize(D.pos.struk.footer||'', R-L).forEach(l=>{ tx(l,W/2,{align:'center'}); y+=4; });
  return doc;
}
window.hkStrukPdfUnduh=id=>{ const t=D.trx.find(x=>x.id===id)||lastTrx; if(!t) return; try{ strukPdf(t).save(`Struk-${t.no}.pdf`); }catch(err){ showToast('PDF gagal dibuat'); } };
function kirimStrukWA(t, nomor){ const wa=waNorm(nomor); if(!wa) return false;
  try{ t.struk={wa, waktu:hkIso(new Date()), status:'Terkirim', ukuran:Math.round(strukPdf(t).output('arraybuffer').byteLength/1024)+' KB'}; }catch(err){ return false; }
  save('trx'); return true; }
window.hkKirimStruk=id=>{ const t=D.trx.find(x=>x.id===id); if(!t) return;
  const inp=document.getElementById('hkWaNo-'+id), nomor=inp?inp.value:(t.pelanggan&&t.pelanggan.telepon);
  if(!kirimStrukWA(t,nomor)){ showToast('Nomor WhatsApp belum benar'); return; }
  showToast(`Struk PDF dikirim ke WA ${waTampil(t.struk.wa)}`); const b=document.getElementById('hkWaBox-'+id); if(b) b.outerHTML=waBox(t); };
/* tanpa layanan API: PDF dibagikan lewat WhatsApp di HP kasir (Android/iOS share sheet). Kalau tidak didukung, PDF diunduh dan chat WA pembeli dibuka */
window.hkBagikanWA=async id=>{ const t=D.trx.find(x=>x.id===id); if(!t) return;
  const inp=document.getElementById('hkWaNo-'+id), wa=waNorm(inp?inp.value:(t.struk&&t.struk.wa)||(t.pelanggan&&t.pelanggan.telepon));
  let blob; try{ blob=strukPdf(t).output('blob'); }catch(err){ showToast('PDF gagal dibuat'); return; }
  const file=new File([blob], `Struk-${t.no}.pdf`, {type:'application/pdf'}), pesan=`Struk ${D.pos.struk.nama} ${t.no}${t.pengambilan?'. Tunjukkan QR di PDF saat mengambil barang.':''}`;
  const catat=via=>{ t.struk={wa:wa||'', waktu:hkIso(new Date()), status:'Dibagikan', via}; save('trx'); const b=document.getElementById('hkWaBox-'+id); if(b) b.outerHTML=waBox(t); };
  if(navigator.canShare&&navigator.canShare({files:[file]})){ try{ await navigator.share({files:[file], text:pesan}); catat('WhatsApp HP kasir'); }catch(err){} return; }
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=file.name; a.click();
  if(wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(pesan)}`,'_blank');
  catat('WhatsApp HP kasir'); showToast(wa?'PDF diunduh. Lampirkan di chat WA yang terbuka':'PDF diunduh'); };
function waBox(t){
  return `<div class="hk-wabox" id="hkWaBox-${t.id}">${t.struk?`<div class="hk-wa-ok">✓ Struk PDF ${t.struk.status==='Dibagikan'?'dibagikan lewat '+hkEsc(t.struk.via):'terkirim'}${t.struk.wa?' ke WA '+waTampil(t.struk.wa):''} · ${hkJam(t.struk.waktu)}</div>
      <div class="confirm-actions"><button class="btn-outline" onclick="hkStrukPdfUnduh('${t.id}')">Lihat PDF</button><button class="btn-outline" onclick="hkKirimStruk('${t.id}')">Kirim ulang</button></div>
      <span class="hk-wa-link" onclick="hkBagikanWA('${t.id}')">Kirim dari WhatsApp HP ini</span>`
    :`<div class="hk-wa-lbl">Kirim struk PDF ke WhatsApp${t.pengambilan?' (wajib untuk pre-sale)':''}</div>
      <div class="hk-wa-row"><input id="hkWaNo-${t.id}" inputmode="tel" placeholder="08xx atau +62" value="${hkEsc(t.pelanggan&&t.pelanggan.telepon||'')}"><button class="btn-confirm-primary" onclick="hkKirimStruk('${t.id}')">Kirim</button></div>
      <span class="hk-wa-link" onclick="hkStrukPdfUnduh('${t.id}')">Lihat PDF</span> · <span class="hk-wa-link" onclick="hkBagikanWA('${t.id}')">Kirim dari WhatsApp HP ini</span>`}</div>`;
}
function nomorBaru(){ const d=new Date(); const pre=`HK-${hkYmd(d).slice(2).replace(/-/g,'')}-`; return pre+hkPad(D.trx.filter(t=>t.no.startsWith(pre)).length+1); }
function catatTrx({items, ctx, pembayaran, tendered, cust, noLama}){
  const e=ev(), now=new Date();
  const lines=items.map(it=>{ if(it.custom) return {sku:null, nama:it.name, qty:it.qty, harga:it.price, hpp:0};
    const p=PRODUCTS.find(x=>x.id===it.id); return p?{sku:p.sku, nama:p.name, qty:it.qty, harga:p.price, hpp:p.hpp}:null; }).filter(Boolean);
  const metodes=[...new Set(pembayaran.map(b=>b.metode))];
  const t={id:'t'+Date.now(), no:nomorBaru(), noPesanan:noLama||null, eventId:e.id, lokasi:e.nama, shiftId:ses.shiftId, kasir:ses.kasir, waktu:hkIso(now), items:lines,
    subtotal:itemsTotal(items), diskon:ctx.discount, promo:ctx.promo?ctx.promo.name:null, pajak:ctx.pajak||0, pembulatan:ctx.bulat||0, total:ctx.total,
    metode:metodes.length>1?'Campuran':metodes[0], pembayaran, dibayar:pembayaran.reduce((a,b)=>a+b.jumlah,0)+(tendered?Math.max(0,tendered-ctx.amountNow):0), kembalian:tendered?Math.max(0,tendered-ctx.amountNow):0,
    pelanggan:cust?{kode:cust.code, nama:cust.name, telepon:cust.phone||((D.pelanggan.find(x=>x.kode===cust.code)||{}).telepon)||''}:null, status:'Lunas', void:null};
  if(ctx.promo&&ctx.promo.type==='bonus'){ const g={}; bonusInfo(ctx.promo,items).gratis.forEach(u=>{ g[u.id]=(g[u.id]||0)+1; });
    t.bonus=Object.entries(g).map(([id,q])=>{ const p=PRODUCTS.find(x=>x.id==id); return {sku:p.sku, nama:p.name, qty:q, harga:p.price}; }); }
  if(ctx.promo&&ctx.promo.type==='bundle'){ const k=paketInfo(ctx.promo,items); t.paket={nama:ctx.promo.name, jumlah:k.n, harga:ctx.promo.hargaPaket}; }
  if(hkAmbilNanti(e)) t.pengambilan={status:'Menunggu', waktu:null, oleh:null};
  else lines.forEach(l=>{ if(l.sku) hkJual(D.stok, l.sku, e.nama, l.qty); });
  D.trx.push(t);
  if(cust){ const c=D.pelanggan.find(x=>x.kode===cust.code); if(c){ c.transaksi=c.transaksi||[]; c.transaksi.unshift({tanggal:hkTgl(t.waktu), produk:lines.map(l=>l.nama).join(', '), jumlah:lines.reduce((a,l)=>a+l.qty,0), total:t.total, nomorTransaksi:t.no, kasir:t.kasir, order:'-', pelayan:'-', nomorUrut:'-', poinDidapat:0}); save('pelanggan'); } }
  save('trx','stok');
  loadProducts();
  return t;
}
function tambahStrukInfo(){
  const box=document.getElementById('miniReceipt'); if(!box) return;
  const t=lastTrx;
  box.insertAdjacentHTML('afterbegin', `<div class="hk-struk-head"><b>${hkEsc(D.pos.struk.nama)}</b><div>${hkEsc(D.pos.struk.info)}</div>${D.pos.struk.tampilEvent?`<div>${hkEsc(evNama())}</div>`:''}</div>
    ${t?`<div class="mr-row"><span>No. transaksi</span><b>${t.no}</b></div>`:''}${D.pos.struk.tampilKasir?`<div class="mr-row"><span>Kasir</span><b>${hkEsc(ses.kasir)}</b></div>`:''}<hr>`);
  box.insertAdjacentHTML('beforeend', `${t&&t.pengambilan?`<hr><div class="hk-struk-qr">${qrSvg(t,4)}</div><div class="hk-struk-foot"><b>PRE-SALE</b> · tunjukkan QR ini di booth ${hkEsc(evNama())} mulai ${hkTgl(ev().mulai)}. Barang sesuai pesanan, ukuran tidak bisa ditukar.</div>`:''}<hr><div class="hk-struk-foot">${hkEsc(D.pos.struk.footer)}</div>`);
  const old=document.querySelector('#view-success .hk-wabox'); if(old) old.remove();
  if(t) box.insertAdjacentHTML('afterend', waBox(t));
}

document.querySelector('#view-success .success-wrap .btn-primary').insertAdjacentHTML('beforebegin', `<div class="confirm-actions" style="width:100%;margin-bottom:10px;"><button class="btn-outline" onclick="showToast('Mencetak struk ke printer Bluetooth...')">🖨️ Cetak</button><button class="btn-outline" onclick="lastTrx?hkStrukPdfUnduh(lastTrx.id):showToast('Belum ada transaksi')">📄 PDF</button></div>`);
document.querySelector('#view-success .success-ring svg path').setAttribute('stroke','#FF6100');

/* ════════ 4. DAFTAR ORDER: tersimpan di HP, tidak hilang saat dibuka lalu batal ════════ */
function saveHeld(){ if(!ses.shiftId) return; const all=ls.get(HELD_KEY)||{}; if(all.list) delete all.list; all[ses.shiftId]=HELD_ORDERS; ls.set(HELD_KEY, all); }
const _renderHeld=renderHeldOrders;
renderHeldOrders=function(){ _renderHeld(); saveHeld(); };
ORDER_CATEGORIES.length=0; ORDER_CATEGORIES.push('Semua','Belum Bayar','Bayar Sebagian');
heldOrderCategory=o=>o.status==='partial'?'Bayar Sebagian':'Belum Bayar';
heldOrderTypeLabel=o=>o.status==='partial'?'💳 Bayar Sebagian':'🧾 Belum Bayar';
heldOrderTitle=o=>o.offlineNama||(o.customer?o.customer.name:'Tanpa Pelanggan');
const _resume=resumeOrder;
resumeOrder=function(id){ const o=HELD_ORDERS.find(x=>x.id===id); if(o) resumedFrom=JSON.parse(JSON.stringify(o)); _resume(id); saveSes(); };
const _simpanOrder=simpanOrderKeDaftarOrder;
simpanOrderKeDaftarOrder=function(){
  const r=resumedFrom; _simpanOrder();
  if(r&&HELD_ORDERS[0]&&HELD_ORDERS[0].id!==r.id){ HELD_ORDERS[0].noTransaksi=r.noTransaksi; renderHeldOrders(); }
  else if(HELD_ORDERS[0]&&!r){ const d=new Date(); HELD_ORDERS[0].noTransaksi=`PSN/${hkYmd(d).slice(2).replace(/-/g,'')}/${hkPad(HELD_ORDERS.length)}`; renderHeldOrders(); }
  resumedFrom=null; saveSes(); setHeader();
};
const _hapusPesanan=konfirmasiHapusPesanan;
konfirmasiHapusPesanan=function(){
  _hapusPesanan();
  if(resumedFrom){ HELD_ORDERS.unshift(resumedFrom); renderOrderCatChips(); renderHeldOrders(); showToast(`${resumedFrom.noTransaksi} kembali ke Daftar Order`); resumedFrom=null; }
  saveSes();
};
const _finish=finishOrder;
finishOrder=function(){ _finish(); saveSes(); setHeader(); };
const _custSelect=selectCustomer;
selectCustomer=function(code){ _custSelect(code); saveSes(); };
const _quickTanpa=quickTanpaPelanggan;
quickTanpaPelanggan=function(){ _quickTanpa(); saveSes(); };

/* pelanggan baru dari kasir ikut masuk ke dashboard */
const _simpanPelanggan=simpanPelangganBaru;
simpanPelangganBaru=function(){
  const v=id=>(document.getElementById(id)||{}).value||'';
  const kode=v('inputKodePelanggan'), nama=v('inputNamaPelanggan').trim();
  _simpanPelanggan();
  if(nama&&!D.pelanggan.some(c=>c.kode===kode)){
    D.pelanggan.unshift({kode, nama, telepon:v('inputTeleponPelanggan'), email:v('inputEmailPelanggan'), jenisKelamin:selectedGender, tanggalLahir:v('inputTglLahirPelanggan'), grup:v('inputGrupPelanggan'), kota:v('inputKotaPelanggan'), alamat:v('inputAlamatPelanggan'), catatan:v('inputCatatanPelanggan'), poin:0, deposit:0, transaksi:[]});
    save('pelanggan');
  }
};

/* ════════ 5. MASUK KASIR, BUKA KASIR, KUNCI LAYAR ════════ */
function goView(id){ document.querySelectorAll('.app > .view').forEach(v=>v.classList.toggle('active', v.id===id)); updateHint(); }
let login={step:'kasir', kasir:null, pin:'', eventId:null, modal:'300000'};
/* Owner: semua event yang belum ditutup + Gudang Pusat. Admin: semua event berlangsung. Kasir: event berlangsung tempat ia ditugaskan. */
function eventsUntuk(nama){ const s=staff(nama);
  if(isOwner(s)) return [hkTempat(D,HK_GUDANG_ID), ...D.events.filter(e=>!e.ditutup).sort((a,b)=>a.mulai.localeCompare(b.mulai))];
  const evs=D.events.filter(e=>hkStatusEvent(e)==='Berlangsung'&&(e.kasir.includes(nama)||isSup(s)));
  return isSup(s)?[...evs, hkTempat(D,HK_GUDANG_ID)]:evs; }
/* Admin di Gudang Pusat hanya untuk menyerahkan pesanan pre-sale; jual langsung dari gudang khusus Owner */
const gudangSerahSaja = ()=>{ const e=ev(); return !!e&&e.gudang&&!isOwner(staff(ses.kasir)); };
const tempatAktif = id=>{ const e=hkTempat(D,id); return !!e&&!e.ditutup; };
const shiftDi = id=>D.shift.find(s=>!s.tutup&&s.eventId===id);
function shiftTerbuka(nama){ return D.shift.filter(s=>!s.tutup&&tempatAktif(s.eventId)&&(s.kasir===nama||(hkTempat(D,s.eventId)||{kasir:[]}).kasir.includes(nama))).sort((a,b)=>b.buka.localeCompare(a.buka))[0]; }
function renderLogin(){
  const el=document.getElementById('hkLoginBody'), L=login;
  const keypad=fn=>`<div class="pin-keypad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="pin-key" onclick="${fn}('${n}')">${n}</button>`).join('')}<button class="pin-key func" onclick="${fn}('C')">C</button><button class="pin-key" onclick="${fn}('0')">0</button><button class="pin-key func" onclick="${fn}('<')">⌫</button></div>`;
  if(L.step==='kasir'){
    const list=D.staff.filter(s=>s.aktif!==false&&s.role.some(r=>['Kasir','Admin','Owner'].includes(r)));
    el.innerHTML=`<div class="hk-brand"><div class="hk-brand-logo">HK</div><div><div class="lock-title" style="margin:0;">Hikayat Merchandise</div><div class="lock-sub" style="margin:0;">Aplikasi kasir event</div></div></div>
      <div class="so-section-label" style="align-self:stretch;text-align:left;">Siapa yang bertugas?</div>
      <div class="order-type-list" style="align-self:stretch;">${list.map(s=>{ const evs=eventsUntuk(s.nama); return `<div class="order-type-item hk-card" onclick="hkLoginPilih('${hkEsc(s.nama)}')"><div class="oti-ic hk-av">${initials2(s.nama)}</div><div style="text-align:left;"><div class="oti-name">${hkEsc(s.nama)}</div><div class="oti-desc">${s.role.join(', ')}${evs.length?' · '+evs.map(e=>e.nama).join(', '):''}</div></div><div class="oti-arrow">›</div></div>`; }).join('')}</div>
      <div class="pin-hint" style="margin-top:16px;">Kasir dan PIN diatur di Dashboard › Karyawan</div>`;
  } else if(L.step==='pinbaru'||L.step==='pinlama'){
    const sukarela=!!L.sukarela, tahap=L.step==='pinlama'?'lama':L.pin1?'ulang':'baru';
    const judul={lama:'Masukkan PIN sekarang', baru:sukarela?'Buat PIN baru':'Buat PIN Anda sendiri', ulang:'Ulangi PIN baru'}[tahap];
    const sub={lama:'Untuk keamanan, masukkan PIN yang dipakai sekarang', baru:sukarela?'6 angka, tidak sama semua dan tidak berurutan':'PIN dari Owner hanya sementara. Buat PIN baru 6 angka untuk melanjutkan.', ulang:'Ketik sekali lagi untuk memastikan'}[tahap];
    el.innerHTML=`<div class="lock-title">${judul}</div><div class="lock-sub">${sub}</div><div class="lock-ganti" onclick="hkPinBatal()">${sukarela?'Batal':'Keluar'}</div>
      <div class="lock-illustration">🔑</div><div class="pin-dots">${[0,1,2,3,4,5].map(i=>`<div class="pin-dot ${i<L.pin.length?'filled':''}"></div>`).join('')}</div>
      <div class="pin-hint">${L.err?`<span style="color:#C0392B;font-weight:600;">${hkEsc(L.err)}</span>`:'Jangan pakai tanggal lahir atau angka yang mudah ditebak'}</div>${keypad('hkPinBaruKey')}`;
  } else if(L.step==='pin'){
    el.innerHTML=`<div class="lock-title">Halo, ${hkEsc(L.kasir.split(' ')[0])}</div><div class="lock-sub">Masukkan PIN 6 angka</div><div class="lock-ganti" onclick="hkLoginStep('kasir')">Bukan Anda? Ganti kasir</div>
      <div class="lock-illustration">🔐</div><div class="pin-dots">${[0,1,2,3,4,5].map(i=>`<div class="pin-dot ${i<L.pin.length?'filled':''}"></div>`).join('')}</div>
      <div class="pin-hint">PIN demo: Rina 111111 · Dimas 222222 · Sari 333333 · Budi 444444 · Laila 582914 (sementara)</div>${keypad('hkLoginPin')}`;
  } else {
    const evs=eventsUntuk(L.kasir), owner=isOwner(staff(L.kasir));
    if(!L.eventId&&evs.length===1) L.eventId=evs[0].id;
    const buka=L.eventId?shiftDi(L.eventId):null;
    const badge=e=>{ const st=hkStatusEvent(e), sh=shiftDi(e.id);
      return `${owner&&!e.gudang?`<span class="hk-tag link" onclick="event.stopPropagation(); hkTutupEventOpen('${e.id}')">Tutup event</span>`:''}${e.gudang?(owner?'<span class="hk-tag">Jual langsung</span>':'<span class="hk-tag">Serah terima pre-sale</span>'):st==='Berlangsung'?'<span class="hk-tag ok">Berlangsung</span>':st==='Akan Datang'?(e.presaleAktif===false?'<span class="hk-tag">Belum mulai · pre-sale nonaktif</span>':'<span class="hk-tag">Pre-sale</span>'):'<span class="hk-tag warn">Perlu ditutup</span>'}${sh?`<span class="hk-tag ok">Kasir terbuka · ${hkEsc(sh.kasir.split(' ')[0])}</span>`:''}`; };
    el.innerHTML=`<div class="lock-title">${owner?'Pilih Tempat Jualan':'Buka Kasir'}</div><div class="lock-sub" style="margin-bottom:16px;">${owner?'Owner bisa berjualan di event mana pun atau langsung dari gudang':'Pilih event dan hitung modal awal di laci'}</div>
      ${evs.length?`<div class="so-section-label" style="align-self:stretch;text-align:left;">${owner?'Event & tempat jualan':'Event'}</div><div class="order-type-list" style="align-self:stretch;">${evs.map(e=>`<div class="order-type-item hk-card ${L.eventId===e.id?'featured':''}" ${hkPreSaleTutup(e)?'style="opacity:.55;"':''} onclick="hkLoginEvent('${e.id}')"><div class="oti-ic">${e.gudang?'🏬':'📍'}</div><div style="text-align:left;min-width:0;"><div class="oti-name">${hkEsc(e.nama)}</div><div class="oti-desc">${hkEsc(e.venue)}${e.gudang?'':` · ${hkTgl(e.mulai)} – ${hkTgl(e.selesai)}`}</div><div class="hk-tags">${badge(e)}</div></div></div>`).join('')}</div>
        ${buka?`<div class="hk-note" style="align-self:stretch;text-align:left;cursor:default;">Kasir di tempat ini sudah dibuka oleh ${hkEsc(buka.kasir)} jam ${hkJam(buka.buka)}. Anda akan bergabung ke laci yang sama.</div>`
        :`<div class="field" style="align-self:stretch;text-align:left;margin-top:16px;"><label>Modal awal di laci</label><input id="hkModalInput" inputmode="numeric" value="${(+L.modal||0).toLocaleString('id-ID')}" oninput="hkModalIn(this)"></div>
        <div class="hk-chips">${[0,200000,300000,500000].map(v=>`<div class="chip ${+L.modal===v?'active':''}" onclick="hkModalSet(${v})">${v?fmt(v).replace('Rp ',''):'Tanpa modal'}</div>`).join('')}</div>`}
        <button class="btn-primary" style="margin-top:18px;" ${L.eventId?'':'disabled'} onclick="hkBukaKasir()">${buka?'Masuk ke Kasir':'Buka Kasir'}</button>`
      :`<div class="pt-list-empty" style="align-self:stretch;">Tidak ada event berlangsung untuk ${hkEsc(L.kasir)}.<br>Minta admin menambahkan Anda sebagai kasir di Dashboard › Event.</div>`}
      ${ses.shiftId&&shift()&&!shift().tutup&&ses.kasir===L.kasir?`<button class="btn-ghost" onclick="hkGo('view-home')">Batal, kembali ke ${hkEsc(evNama())}</button>`:`<button class="btn-ghost" onclick="hkLoginStep('kasir')">Keluar</button>`}`;
  }
}
window.hkLoginStep=s=>{ login.step=s; login.pin=''; renderLogin(); };
window.hkLoginPilih=n=>{ login.kasir=n; login.pin=''; login.step='pin'; renderLogin(); };
window.hkLoginPin=k=>{
  if(k==='C') login.pin=''; else if(k==='<') login.pin=login.pin.slice(0,-1); else if(login.pin.length<6) login.pin+=k;
  renderLogin();
  if(login.pin.length===6){
    if(staff(login.kasir).pin!==login.pin){ catatMasuk(login.kasir,'PIN salah',''); showToast('PIN salah, coba lagi'); setTimeout(()=>{ login.pin=''; renderLogin(); },300); return; }
    if(staff(login.kasir).pinBaru){ catatMasuk(login.kasir,'Masuk dengan PIN sementara',''); login.step='pinbaru'; login.pin=''; login.pin1=''; login.err=''; login.sukarela=false; renderLogin(); return; }
    lanjutMasuk(); }
};
function lanjutMasuk(){
    ses.kasir=login.kasir;
    const buka=shiftTerbuka(login.kasir);
    catatMasuk(login.kasir,'Masuk',buka?hkTempat(D,buka.eventId).nama:'');
    if(buka&&!isOwner(staff(login.kasir))){ masuk(buka.id); showToast(`Melanjutkan kasir di ${hkTempat(D,buka.eventId).nama}`); return; }
    if(buka){ login.eventId=buka.eventId; }
    login.step='buka'; if(!buka) login.eventId=null; renderLogin();
}
window.hkPinBaruKey=k=>{ const L=login;
  if(k==='C') L.pin=''; else if(k==='<') L.pin=L.pin.slice(0,-1); else if(L.pin.length<6) L.pin+=k;
  L.err=''; renderLogin(); if(L.pin.length<6) return;
  const st=staff(L.kasir), ulang=()=>setTimeout(()=>{ L.pin=''; renderLogin(); },350);
  if(L.step==='pinlama'){ if(st.pin!==L.pin){ L.err='PIN sekarang salah'; catatMasuk(L.kasir,'PIN salah',''); ulang(); return; } L.step='pinbaru'; L.pin=''; L.pin1=''; renderLogin(); return; }
  if(!L.pin1){ const e=L.pin===st.pin?'PIN baru tidak boleh sama dengan PIN lama':hkPinLemah(L.pin,D.staff,st.nama); if(e){ L.err=e; ulang(); return; } L.pin1=L.pin; L.pin=''; renderLogin(); return; }
  if(L.pin!==L.pin1){ L.err='PIN tidak sama. Ulangi dari awal'; L.pin1=''; ulang(); return; }
  st.pin=L.pin; st.pinBaru=false; st.pinDiganti=hkIso(new Date()); save('staff'); catatMasuk(L.kasir,'Ganti PIN','');
  showToast(L.sukarela?'PIN berhasil diganti':'PIN tersimpan. Gunakan PIN ini mulai sekarang');
  const sukarela=L.sukarela; L.pin=''; L.pin1=''; L.err=''; L.sukarela=false;
  if(sukarela){ goView(L.balik||'view-home'); setHeader(); return; }
  lanjutMasuk(); };
window.hkPinBatal=()=>{ const L=login; if(L.sukarela){ L.sukarela=false; L.pin=''; L.pin1=''; L.err=''; goView(L.balik||'view-home'); return; } login={step:'kasir', kasir:null, pin:'', eventId:null, modal:'300000'}; renderLogin(); };
window.hkGantiPin=()=>{ closeSheet('sheetMainMenu'); login.kasir=ses.kasir; login.step='pinlama'; login.pin=''; login.pin1=''; login.err=''; login.sukarela=true; login.balik=document.querySelector('.app > .view.active')?.id||'view-home'; setTimeout(()=>{ renderLogin(); goView('view-hk-login'); },240); };
window.hkLoginEvent=id=>{ const e=hkTempat(D,id); if(hkPreSaleTutup(e)){ showToast(`Pre-sale nonaktif, dijual mulai ${hkTgl(e.mulai)}`); return; } login.eventId=id; renderLogin(); };
window.hkModalSet=v=>{ login.modal=String(v); renderLogin(); };
window.hkModalIn=inp=>{ const n=parseRupiah(inp.value); login.modal=String(n); inp.value=n?n.toLocaleString('id-ID'):''; };
window.hkBukaKasir=()=>{
  const ada=shiftDi(login.eventId);
  if(ada){ catatMasuk(login.kasir,'Gabung kasir',hkTempat(D,ada.eventId).nama); masuk(ada.id); showToast(`Masuk ke kasir ${hkTempat(D,ada.eventId).nama}`); return; }
  const sh={id:'sh'+Date.now(), eventId:login.eventId, kasir:login.kasir, buka:hkIso(new Date()), modal:+login.modal||0, tutup:null, kasHitung:null, catatan:'', kas:[]};
  D.shift.push(sh); save('shift'); catatMasuk(login.kasir,'Buka kasir',hkTempat(D,sh.eventId).nama); masuk(sh.id); showToast('Kasir dibuka. Selamat berjualan!');
};
function masuk(shiftId){
  ses.shiftId=shiftId;
  HELD_ORDERS=(ls.get(HELD_KEY)||{})[shiftId]||[];
  loadAll(); setHeader(); renderCatChips(); renderProductArea(); renderOrderCatChips(); renderHeldOrders(); updateCartBar(); saveSes();
  goView('view-home');
}
function keluar(){ catatMasuk(ses.kasir,'Keluar',ev()?ev().nama:''); ses.kasir=null; saveSes(); login={step:'kasir', kasir:null, pin:'', eventId:null, modal:'300000'}; renderLogin(); goView('view-hk-login'); }
function setHeader(){
  const e=ev(); if(!e) return;
  document.querySelector('#view-home .shop-avatar').textContent='HK';
  document.querySelector('#view-home .shop-name').textContent=e.nama;
  document.querySelector('#view-home .shop-sub').innerHTML=`<span class="dot-live"></span> ${hkEsc(ses.kasir)} · ${navigator.onLine?'Online':'Offline, data aman di HP'}`;
  document.getElementById('orderPillIcon').textContent=e.gudang?'🏬':'📍';
  document.querySelector('#orderPill .l1').textContent=e.gudang?'Tempat Jualan':(hkStatusEvent(e)==='Akan Datang'?(e.presaleAktif===false?'Belum mulai':e.presale==='ambil'?'Pre-sale · ambil nanti':'Pre-sale · stok langsung'):'Event');
  const gm=document.getElementById('hkMenuGanti'); if(gm) gm.style.display=isOwner(staff(ses.kasir))?'':'none';
  document.getElementById('orderPillText').textContent=`${PRODUCTS.reduce((a,p)=>a+Math.max(0,stokEv(p.sku)),0)} pcs stok`;
  document.querySelector('#sheetMainMenu .sheet-title').textContent=e.nama;
  document.querySelector('#sheetMainMenu .sheet-sub').textContent=`${ses.kasir} · kasir dibuka ${hkJam(shift().buka)}`;
  document.querySelector('#view-lock .lock-footer').innerHTML=`<div class="lf-avatar">${initials2(ses.kasir)}</div><div>${hkEsc(ses.kasir)} · ${hkEsc(e.nama)}</div>`;
  document.querySelectorAll('.hk-evname').forEach(x=>x.textContent=e.nama);
  ['kkMerchant','ptMerchant','lapRingkasanMerchant','lapTutupMerchant','soPrintOutletName'].forEach(id=>{ const x=document.getElementById(id); if(x) x.textContent=e.nama; });
}
/* kunci layar memakai PIN kasir yang sedang login */
let lockedFrom='view-home', aktifTerakhir=Date.now();
const _kunci=konfirmasiKunciLayar;
konfirmasiKunciLayar=function(){ lockedFrom='view-home'; _kunci(); };
checkPin=function(){
  const ok=staff(ses.kasir)&&staff(ses.kasir).pin===pinInput;
  catatMasuk(ses.kasir, ok?'Buka kunci layar':'PIN salah (kunci layar)', ev()?ev().nama:'');
  showToast(ok?'✓ Layar dibuka':'PIN salah, coba lagi');
  setTimeout(()=>{ if(ok){ goView(lockedFrom); aktifTerakhir=Date.now(); } pinInput=''; updatePinDots(); }, ok?300:450);
};
/* kunci otomatis kalau HP tidak disentuh selama waktu di Pengaturan POS (default 20 menit) */
['pointerdown','keydown','touchstart'].forEach(ev_=>document.addEventListener(ev_,()=>{ aktifTerakhir=Date.now(); },{passive:true,capture:true}));
function cekKunci(){
  const menit=+D.pos.kunciMenit||0; if(!menit||!ses.shiftId||!ses.kasir) return;
  const aktif=document.querySelector('.app > .view.active'); if(!aktif||['view-lock','view-hk-login'].includes(aktif.id)) return;
  if(Date.now()-aktifTerakhir<menit*60000) return;
  lockedFrom=aktif.id; catatMasuk(ses.kasir,'Terkunci otomatis',ev()?ev().nama:''); document.querySelectorAll('.sheet.show').forEach(sh=>closeSheet(sh.id)); pinInput=''; updatePinDots(); goView('view-lock');
}
setInterval(cekKunci, 15000);
window.hkCekKunci=cekKunci;
document.querySelector('#view-lock .lock-ganti').onclick=()=>keluar();
document.querySelector('#view-lock .pin-hint').textContent='Masukkan PIN 6 angka kasir yang sedang bertugas. Layar juga terkunci otomatis kalau lama tidak dipakai.';

/* event pill: info event dan sisa stok */
window.hkOpenEventInfo=function(){
  const e=ev(), s=shift(), K=hkShiftKas(D,s);
  const rows=PRODUCTS.map(p=>({p,st:stokEv(p.sku)})).sort((a,b)=>a.st-b.st);
  document.getElementById('hkEvBody').innerHTML=`<div class="so-info-card"><div class="so-info-row"><span class="lbl">Tempat</span><span class="val">${hkEsc(e.venue)}</span></div>
    <div class="so-info-row"><span class="lbl">Tanggal</span><span class="val">${hkTgl(e.mulai)} – ${hkTgl(e.selesai)}</span></div>${e.pj?`<div class="so-info-row"><span class="lbl">Penanggung jawab</span><span class="val">${hkEsc(e.pj)}</span></div>`:''}
    <div class="so-info-row"><span class="lbl">Kasir dibuka</span><span class="val">${hkEsc(s.kasir)}, ${hkJam(s.buka)}</span></div>
    <div class="so-info-row"><span class="lbl">Penjualan kasir ini</span><span class="val">${fmt(K.penjualan)} · ${K.n} trx</span></div></div>
    ${presaleDiSini().length?`<button class="btn-confirm-primary" style="width:100%;margin:10px 0 0;" onclick="hkScanBuka()">📷 Scan QR pengambilan pre-sale (${presaleDiSini().length})</button>`:''}
    ${D.mutasi.some(m=>m.eventId===e.id&&m.status==='Dikirim')?`<div class="hk-note" onclick="closeSheet('sheetHkEvent'); hkBukaMutasi()">📦 Ada kiriman stok dari gudang yang belum diterima. Ketuk untuk menerima.</div>`:''}
    ${isOwner(staff(ses.kasir))?`<div class="confirm-actions" style="margin:6px 0 10px;"><button class="btn-confirm-primary" onclick="closeSheet('sheetHkEvent'); hkGantiTempat()">Ganti tempat</button>${e.gudang?'':`<button class="btn-outline" onclick="closeSheet('sheetHkEvent'); setTimeout(()=>hkTutupEventOpen('${e.id}'),250)">Tutup event</button>`}</div>`:''}
    <div class="so-section-label">Sisa stok di ${e.gudang?'gudang':'event'}</div>${rows.map(r=>`<div class="pt-row"><span class="pt-row-name">${hkEsc(r.p.name)}</span><span class="pt-row-qty ${r.st<=3?'hk-low':''}">${r.st}</span></div>`).join('')}`;
  document.getElementById('hkEvTitle').textContent=e.nama;
  openSheet('sheetHkEvent');
};
window.hkTutupEventOpen=id=>{
  const C=hkCekTutupEvent(D,id), e=C.ev, sayaDiSini=C.shiftBuka.some(s=>s.id===ses.shiftId);
  document.getElementById('hkTevTitle').textContent=`Tutup ${e.nama}`;
  document.getElementById('hkTevBody').innerHTML=`
    ${C.shiftBuka.length?`<div class="hk-note" style="background:#FDECEA;color:#C0392B;cursor:default;">Masih ada kasir terbuka: ${C.shiftBuka.map(s=>`${hkEsc(s.kasir)} (${hkJam(s.buka)})`).join(', ')}. Tutup kasir dulu supaya setoran tercatat.</div>
      ${C.shiftBuka.map(sh=>`<button class="btn-confirm-primary" style="width:100%;margin-bottom:6px;" onclick="hkTutupKasirDari('${sh.id}','${id}')">Tutup kasir ${hkEsc(sh.kasir)}${sh.id===ses.shiftId?' · laci yang sedang dipakai':''}</button>`).join('')}
      <div class="pin-hint" style="margin:2px 0 8px;">Hitung uang di laci lalu masukkan PIN. Setelah itu layar ini terbuka lagi untuk menyetujui opname.</div>`:''}
    ${C.mutasiTunda.length?`<div class="hk-note" style="cursor:default;">${C.mutasiTunda.length} kiriman stok belum diterima. Barangnya dikembalikan ke ${HK_GUDANG}.</div>`:''}
    ${C.preSale.length?`<div class="hk-note" style="cursor:default;">${C.preSale.length} pesanan pre-sale belum diambil. Pembeli masih bisa mengambil di ${HK_GUDANG} selama ${HK_BATAS_AMBIL_HARI} hari, setelah itu otomatis Perlu Refund.</div>`:''}
    ${soKartu(C.ev)}
    <div class="so-section-label">Stok opname akhir event</div>
    <div class="pin-hint" style="text-align:left;margin:0 0 6px;">Hitung barang di booth dan isi stok fisik. Kosong berarti sama dengan sistem. Selisih dicatat sebagai kerugian, stok fisik kembali ke ${HK_GUDANG}.</div>
    ${C.sisa.length?C.sisa.map(x=>`<div class="pt-row"><span class="pt-row-name">${hkEsc(x.it.nama)}<br><span style="font-size:11px;color:#8A8F87;">Sistem ${x.q} · <b id="hkTevSel-${x.it.sku}">sesuai</b></span></span><input type="number" min="0" inputmode="numeric" class="hk-fisik" data-sku="${x.it.sku}" data-sistem="${x.q}" data-hpp="${(hkCatalog(D.produk).find(c=>c.sku===x.it.sku)||{}).hpp||0}" placeholder="${x.q}" value="${soPrefill(C.ev,x.it.sku)}" style="width:76px;padding:8px;border:1px solid #DADDD6;border-radius:8px;text-align:right;font-size:15px;"></div>`).join(''):'<div class="pt-list-empty">Tidak ada sisa stok</div>'}
    ${C.sisa.length?`<div class="so-info-card" style="margin-top:12px;"><div class="so-info-row"><span class="lbl">Barang kurang</span><span class="val" id="hkTevKurang">0 pcs</span></div><div class="so-info-row"><span class="lbl">Barang lebih</span><span class="val" id="hkTevLebih">0 pcs</span></div><div class="so-info-row"><span class="lbl">Kerugian</span><span class="val" id="hkTevRugi">Rp 0</span></div></div>`:''}
    ${C.sisa.length?`<div class="so-section-label">Pertanggungjawaban selisih</div>
    <div class="pin-hint" style="text-align:left;margin:0 0 6px;">Wajib kalau ada barang kurang. Kerugian tercatat atas nama penanggung jawab dan terlihat oleh Admin dan Owner sampai diselesaikan.</div>
    <select id="hkTevPj" style="width:100%;padding:10px;border:1px solid #DADDD6;border-radius:8px;font-size:14px;margin-bottom:8px;"><option value="">Pilih penanggung jawab</option>${D.staff.filter(x=>x.aktif!==false).map(x=>`<option ${(e.pj||e.kasir[0])===x.nama?'selected':''}>${hkEsc(x.nama)}</option>`).join('')}</select>
    <textarea id="hkTevAlasan" rows="2" placeholder="Penjelasan selisih" style="width:100%;padding:10px;border:1px solid #DADDD6;border-radius:8px;font-size:14px;box-sizing:border-box;"></textarea>`:''}
    <div class="confirm-actions" style="margin-top:14px;"><button class="btn-outline" onclick="closeSheet('sheetHkTutupEv')">Batal</button><button class="btn-danger" ${C.shiftBuka.length||soPending(C.ev)?'disabled style="opacity:.45"':''} onclick="hkTutupEventOk('${id}')">Tutup Event</button></div>`;
  hitungTev(); openSheet('sheetHkTutupEv');
};
/* selisih per barang dan ringkasan kurang/lebih/kerugian langsung tampil saat stok fisik diketik */
function hitungTev(){ let k=0,l=0,rugi=0;
  document.querySelectorAll('#hkTevBody .hk-fisik').forEach(i=>{ const q=+i.dataset.sistem, f=i.value===''?q:Math.max(0,+i.value||0), d=f-q; if(d<0){ k+=-d; rugi+=-d*(+i.dataset.hpp||0); } else l+=d;
    const el=document.getElementById('hkTevSel-'+i.dataset.sku); if(el){ el.textContent=d===0?'sesuai':(d>0?'+':'')+d; el.style.color=d<0?'#C0392B':d>0?'#1E8E4E':''; }
    i.style.borderColor=d<0?'#C0392B':d>0?'#1E8E4E':'#DADDD6'; });
  const a=document.getElementById('hkTevKurang'); if(!a) return; a.textContent=k+' pcs'; a.style.color=k?'#C0392B':'';
  document.getElementById('hkTevLebih').textContent=l+' pcs'; const r=document.getElementById('hkTevRugi'); r.textContent=fmt(rugi); r.style.color=rugi?'#C0392B':''; }
document.addEventListener('input',e=>{ if(e.target.classList&&e.target.classList.contains('hk-fisik')&&e.target.closest('#hkTevBody')) hitungTev(); });
function soPending(e){ const so=hkSOAkhir(D,e.id); return so&&so.status==='Menunggu persetujuan'?so:null; }
function soPrefill(e,sku){ return ''; }
function soKartu(e){ const so=hkSOAkhir(D,e.id);
  if(so&&so.status==='Disetujui') return `<div class="hk-note" style="background:#E8F5EC;color:#1E6B3A;cursor:default;">Opname ${so.no} oleh ${hkEsc(so.oleh)} sudah disetujui ${hkEsc(so.disetujui.oleh)} (${hkTgl(so.disetujui.waktu)} ${hkJam(so.disetujui.waktu)}). Stok di bawah sudah memakai hasil opname itu${so.kerugian?`, kerugian ${fmt(so.kerugian)} tercatat`:''}. Hitung lagi barang yang tersisa untuk menutup event.</div>`;
  if(!so) return `<div class="hk-note" style="cursor:default;">Belum ada stok opname dari kasir. Minta kasir menghitung di Menu › Inventori › Stok Opname, atau hitung langsung di bawah.</div>`;
  if(so.status==='Perlu opname ulang') return `<div class="hk-note" style="cursor:default;">Opname ulang sudah diminta ${hkEsc(so.ulang.oleh)} (${hkJam(so.ulang.waktu)}): "${hkEsc(so.ulang.catatan)}". Menunggu kasir menghitung ulang.</div>`;
  const r=hkSORingkas(so);
  return `<div class="hk-note" style="background:#FDECEA;color:#C0392B;cursor:default;">Opname ${so.no} dari ${hkEsc(so.oleh)} (${r.kurang||r.lebih?`kurang ${r.kurang}, lebih ${r.lebih} pcs`:'sesuai sistem'}) masih menunggu persetujuan. Setujui atau minta hitung ulang dulu di Inventori › Stok Opname, baru event bisa ditutup.</div>
    <button class="btn-confirm-primary" style="width:100%;margin-bottom:8px;" onclick="closeSheet('sheetHkTutupEv'); setTimeout(()=>hkSOPeriksa('${so.no}','${e.id}'),250)">Periksa opname ${so.no}</button>`; }
const bolehSetujuSO=nama=>{ const s=staff(nama); return !!s&&(s.role.includes('Owner')||s.role.includes('Admin')); };
let soDariTutup=null;
window.hkSOPeriksa=(no,dariTutup)=>{ soDariTutup=dariTutup||null; const so=D.opname.find(o=>o.no===no); if(!so||so.status!=='Menunggu persetujuan') return; const r=hkSORingkas(so), kurang=r.kurang>0;
  document.getElementById('hkSsTitle').textContent=`Stok opname ${so.no}`;
  document.getElementById('hkSsBody').innerHTML=`<div class="so-info-card"><div class="so-info-row"><span class="lbl">Lokasi</span><span class="val">${hkEsc(so.lokasi)}</span></div>
    <div class="so-info-row"><span class="lbl">Dihitung oleh</span><span class="val">${hkEsc(so.oleh)} · ${hkJam(so.waktu)}</span></div>
    <div class="so-info-row"><span class="lbl">Hasil</span><span class="val" style="${kurang?'color:#C0392B;':''}">${kurang||r.lebih?`kurang ${r.kurang} · lebih ${r.lebih} pcs`:'sesuai sistem'}${r.kerugian?' · '+fmt(r.kerugian):''}</span></div>
    ${so.catatan?`<div class="so-info-row"><span class="lbl">Catatan</span><span class="val">${hkEsc(so.catatan)}</span></div>`:''}</div>
    <div class="so-section-label">Barang yang selisih</div>${so.produk.filter(p=>p.selisih).length?'':'<div class="pt-list-empty">Semua barang sesuai sistem</div>'}${so.produk.filter(p=>p.selisih).map(p=>`<div class="pt-row"><span class="pt-row-name">${hkEsc(p.nama)}<br><span style="font-size:11px;color:#8A8F87;">Sistem ${p.sistem} → fisik ${p.fisik}</span></span><span class="pt-row-qty ${p.selisih<0?'hk-low':''}">${(p.selisih>0?'+':'')+p.selisih}</span></div>`).join('')}<div class="pin-hint" style="text-align:left;margin:4px 0 0;">${so.produk.filter(p=>!p.selisih).length} barang lain sesuai sistem.</div>
    ${kurang?`<div class="so-section-label">Pertanggungjawaban selisih</div>
    <select id="hkSsPj" style="width:100%;padding:10px;border:1px solid #DADDD6;border-radius:8px;font-size:14px;margin-bottom:8px;">${D.staff.filter(x=>x.aktif!==false).map(x=>`<option ${x.nama===((hkTempat(D,so.eventId)||{}).pj||so.oleh)?'selected':''}>${hkEsc(x.nama)}</option>`).join('')}</select>
    <textarea id="hkSsAlasan" rows="2" placeholder="Penjelasan selisih (wajib)" style="width:100%;padding:10px;border:1px solid #DADDD6;border-radius:8px;font-size:14px;box-sizing:border-box;">${hkEsc(so.catatan||'')}</textarea>`:''}
    <div class="pin-hint" style="text-align:left;margin:8px 0 6px;">Kalau disetujui, stok event langsung disesuaikan dengan hasil hitung${kurang?' dan kerugian masuk ke Selisih & Kerugian':''}. Event tetap berjalan.</div>
    <textarea id="hkSsUlang" rows="2" placeholder="Alasan opname ulang (wajib kalau minta ulang)" style="width:100%;padding:10px;border:1px solid #DADDD6;border-radius:8px;font-size:14px;box-sizing:border-box;margin-bottom:6px;"></textarea>
    <div class="confirm-actions"><button class="btn-outline" onclick="hkSOUlangNo('${so.no}')">Minta ulang</button><button class="btn-confirm-primary" onclick="hkSOSetuju('${so.no}')">Setujui</button></div>`;
  openSheet('sheetHkSOSetuju'); };
window.hkSOSetuju=no=>{ const so=D.opname.find(o=>o.no===no), oleh=ses.kasir; if(!so) return;
  if(!bolehSetujuSO(oleh)){ showToast('Hanya Owner atau Admin yang bisa menyetujui'); return; }
  const kurang=hkSORingkas(so).kurang>0, pj=(document.getElementById('hkSsPj')||{}).value||so.oleh, alasan=((document.getElementById('hkSsAlasan')||{}).value||'').trim();
  if(kurang&&!alasan){ showToast('Ada barang kurang. Isi penjelasan selisih'); return; }
  if(!hkSetujuiSO(D,no,oleh,{nama:pj, alasan})){ showToast('Opname ini sudah tidak menunggu persetujuan'); return; }
  save('opname','stok'); if(ev()){ loadProducts(); loadInventori(); renderSoList(); } closeSheet('sheetHkSOSetuju');
  if(soDariTutup){ const id=soDariTutup; soDariTutup=null; setTimeout(()=>hkTutupEventOpen(id),300); }
  showToast(so.kerugian?`Opname disetujui. Kerugian ${fmt(so.kerugian)} dicatat atas nama ${pj}`:'Opname disetujui, stok disesuaikan'); };
window.hkSOUlangNo=no=>{ const so=D.opname.find(o=>o.no===no), cat=((document.getElementById('hkSsUlang')||{}).value||'').trim(); if(!so||so.status!=='Menunggu persetujuan') return;
  if(!cat){ showToast('Tulis alasan opname ulang'); return; }
  so.status='Perlu opname ulang'; so.ulang={oleh:ses.kasir, waktu:hkIso(new Date()), catatan:cat}; save('opname'); closeSheet('sheetHkSOSetuju'); if(ev()) renderSoList(); soDariTutup=null; showToast('Kasir diminta menghitung ulang'); };
window.hkSOUlang=id=>{ const e=hkTempat(D,id), so=soPending(e), cat=(document.getElementById('hkTevUlang')||{}).value||''; if(!so) return;
  if(!cat.trim()){ showToast('Tulis alasan opname ulang'); return; }
  so.status='Perlu opname ulang'; so.ulang={oleh:ses.kasir||login.kasir, waktu:hkIso(new Date()), catatan:cat.trim()}; save('opname'); closeSheet('sheetHkTutupEv'); showToast('Kasir diminta menghitung ulang'); };
window.hkTutupEventOk=id=>{
  const oleh=ses.kasir||login.kasir;
  const fisik={}; let kurang=false; document.querySelectorAll('#hkTevBody .hk-fisik').forEach(i=>{ if(i.value!==''){ fisik[i.dataset.sku]=i.value; if(+i.value<+i.dataset.sistem) kurang=true; } });
  const pj=(document.getElementById('hkTevPj')||{}).value||'', alasan=((document.getElementById('hkTevAlasan')||{}).value||'').trim();
  if(kurang&&(!pj||!alasan)){ showToast('Ada barang kurang. Isi penanggung jawab dan penjelasan'); return; }
  if(soPending(hkTempat(D,id))){ showToast('Masih ada opname menunggu persetujuan'); return; }
  if(!hkTutupEvent(D,id,oleh,fisik,{nama:pj, alasan},null)){ showToast('Masih ada kasir terbuka'); return; }
  const k=hkTempat(D,id).tutup.kerugian;
  save('events','stok','mutasi','opname','trx'); closeSheet('sheetHkTutupEv'); showToast(k?`Event ditutup. Kerugian selisih ${fmt(k)}`:'Event ditutup, stok kembali ke gudang');
  if(document.getElementById('view-hk-login').classList.contains('active')){ if(login.eventId===id) login.eventId=null; renderLogin(); }
};
window.hkGantiTempat=()=>{
  if(cartCount()>0){ showToast('Simpan atau selesaikan keranjang dulu'); return; }
  closeSheet('sheetMainMenu');
  login={step:'buka', kasir:ses.kasir, pin:'', eventId:null, modal:'300000'}; renderLogin(); setTimeout(()=>goView('view-hk-login'),200);
};

/* ════════ 6. RIWAYAT PENJUALAN + VOID ════════ */
let rwScope='shift', rwSel=null, voidAlasan=null, supPin='', supCb=null;
function renderRiwayat(){
  const e=ev(); const list=(rwScope==='presale'?presaleDiSini():D.trx).filter(t=>rwScope==='presale'?true:rwScope==='shift'?t.shiftId===ses.shiftId:t.eventId===e.id).sort((a,b)=>b.waktu.localeCompare(a.waktu));
  const ok=list.filter(t=>t.status!=='Void');
  document.getElementById('hkRwSub').textContent=`${ok.length} transaksi · ${fmt(ok.reduce((a,t)=>a+t.total,0))}`;
  document.getElementById('hkRwChips').innerHTML=[['shift','Shift ini'],['event','Semua di event'],...(presaleDiSini().length||rwScope==='presale'?[['presale',`${e.gudang?'Ambil di kantor':'Pre-sale'} (${presaleDiSini().length})`]]:[])].map(([k,l])=>`<div class="lap-cat-chip ${rwScope===k?'active':''}" onclick="hkRwScope('${k}')">${l}</div>`).join('');
  document.getElementById('hkRwList').innerHTML=list.length?list.map(t=>`<div class="lap-card hk-rw" onclick="hkRwOpen('${t.id}')"><div class="lap-card-top"><div><div class="lap-card-buka-label">${hkJam(t.waktu)} · ${hkTgl(t.waktu)} · ${hkEsc(t.kasir)}</div><div class="lap-card-buka">${t.no}</div></div>
      ${t.status==='Void'?'<span class="lap-status-badge void">Void</span>':t.status==='Refund'?'<span class="lap-status-badge void">Refund</span>':t.pengambilan&&t.pengambilan.status==='Perlu Refund'?'<span class="lap-status-badge void">Belum diambil · event ditutup</span>':t.pengambilan&&t.pengambilan.status==='Menunggu'?'<span class="lap-status-badge open">Belum diambil</span>':`<span class="lap-status-badge closed">${t.metode}</span>`}</div>
      <div class="lap-card-bottom"><div class="lap-card-kasir">${t.items.map(i=>`${i.qty}× ${hkEsc(i.nama)}`).join(', ')}</div><b>${fmt(t.total)}</b></div></div>`).join('')
    :'<div class="lap-empty">Belum ada transaksi</div>';
}
window.hkRwScope=s=>{ rwScope=s; renderRiwayat(); };
window.hkBukaRiwayat=()=>{ closeSheet('sheetMainMenu'); setTimeout(()=>{ renderRiwayat(); goView('view-hk-riwayat'); },240); };
window.hkRwOpen=(id, verified)=>{
  const t=D.trx.find(x=>x.id===id); rwSel=t; voidAlasan=null;
  const r=(a,b)=>`<div class="mr-row"><span>${a}</span><span>${b}</span></div>`;
  document.getElementById('hkTrxTitle').textContent=t.no;
  document.getElementById('hkTrxBody').innerHTML=`<div class="mini-receipt" style="width:100%;">
    ${r('Waktu',`${hkTgl(t.waktu)} ${hkJam(t.waktu)}`)}${r('Kasir',hkEsc(t.kasir))}${t.pelanggan?r('Pelanggan',hkEsc(t.pelanggan.nama)):''}<hr>
    ${t.items.map(i=>r(`${hkEsc(i.nama)} ×${i.qty}`,fmt(i.qty*i.harga))).join('')}<hr>
    ${r('Subtotal',fmt(t.subtotal))}${t.diskon?r(t.promo?hkEsc(t.promo):'Diskon','-'+fmt(t.diskon)):''}${(t.bonus||[]).map(b=>r(`🎁 Gratis ${hkEsc(b.nama)} ×${b.qty}`,'')).join('')}${t.pajak?r('PPN',fmt(t.pajak)):''}${t.pembulatan?r('Pembulatan','-'+fmt(t.pembulatan)):''}
    <div class="mr-total"><span>Total</span><span>${fmt(t.total)}</span></div>${hkBayar(t).map(b=>r(b.metode+(b.ref?` · ref …${hkEsc(b.ref)}`:''),fmt(b.jumlah))).join('')}${t.kembalian?r('Kembalian',fmt(t.kembalian)):''}</div>
    ${t.pelanggan?`<div class="so-info-card" style="margin:10px 0;"><div class="so-info-row"><span class="lbl">Pembeli</span><span class="val">${hkEsc(t.pelanggan.nama)}</span></div><div class="so-info-row"><span class="lbl">No HP</span><span class="val">${hkEsc(t.pelanggan.telepon||'-')}</span></div></div>`:''}
    ${t.pengambilan?presaleBlok(t, verified):''}
    ${t.status==='Lunas'?waBox(t):''}
    ${(t.retur||[]).map(r=>`<div class="hk-note" style="cursor:default;">Retur ${r.no} · ${hkTgl(r.waktu)} ${hkJam(r.waktu)}: ${r.items.map(i=>`${i.qty}× ${hkEsc(i.nama)}`).join(', ')} · ${r.cara==='Tukar barang'?'ditukar barang sama':`uang kembali ${fmt(r.nilai)} (${r.metode})`}. "${hkEsc(r.alasan)}" Disetujui ${hkEsc(r.disetujui)}.</div>`).join('')}
    ${t.status==='Lunas'&&(!t.pengambilan||t.pengambilan.status==='Diambil')&&t.items.some(i=>i.sku&&i.qty>hkSudahRetur(t,i.sku))?`<button class="btn-outline" style="width:100%;margin:10px 0 0;" onclick="hkReturBuka('${t.id}')">Retur barang cacat</button>`:''}
    ${t.status==='Refund'?'':t.status==='Void'?`<div class="hk-note" style="background:#FDECEA;color:#C0392B;">Dibatalkan oleh ${hkEsc(t.void.oleh)}: ${hkEsc(t.void.alasan)}</div>`
      :(t.retur||[]).length?`<div class="pin-hint" style="text-align:left;margin-top:10px;">Transaksi yang sudah diretur tidak bisa di-void.</div><button class="btn-outline" style="width:100%;margin-top:8px;" onclick="showToast('Mencetak ulang struk...')">Cetak Ulang</button>`
      :`<div class="so-section-label">Batalkan transaksi (void)</div><div class="hk-chips" id="hkVoidChips">${['Salah input','Pembeli batal','Salah metode bayar'].map(a=>`<div class="chip" onclick="hkVoidAlasan(this,'${a}')">${a}</div>`).join('')}</div>
       <div class="confirm-actions" style="margin-top:14px;"><button class="btn-outline" onclick="showToast('Mencetak ulang struk...')">Cetak Ulang</button><button class="btn-danger" id="hkVoidBtn" disabled style="opacity:.5" onclick="hkVoid()">Void</button></div>`}`;
  openSheet('sheetHkTrx');
};
/* ── pre-sale: serah barang setelah scan QR di struk; boleh di booth event atau di Gudang Pusat setelah event ditutup ── */
const QR_PREFIX='HKPS|';
function qrSvg(t, cell){ try{ const q=qrcode(0,'M'); q.addData(QR_PREFIX+t.id+'|'+t.no); q.make(); return q.createSvgTag({cellSize:cell||4, margin:2, scalable:false}); }catch(e){ return ''; } }
function presaleDiSini(){
  const e=ev(); if(!e) return [];
  const ok=t=>t.status==='Lunas'&&t.pengambilan;
  if(e.gudang) return D.trx.filter(t=>ok(t)&&['Menunggu','Perlu Refund'].includes(t.pengambilan.status)&&(hkTempat(D,t.eventId)||{}).ditutup);
  return D.trx.filter(t=>ok(t)&&t.eventId===e.id&&t.pengambilan.status==='Menunggu');
}
function alasanTidakBisa(t){
  const e=ev(), asal=hkTempat(D,t.eventId)||{nama:t.lokasi};
  if(t.status==='Void') return 'Transaksi sudah dibatalkan (void).';
  if(t.status==='Refund'||t.pengambilan.status==='Refund') return 'Pesanan sudah di-refund ke pembeli, barang tidak bisa diserahkan.';
  if(t.pengambilan.status==='Diambil') return `Sudah diambil ${hkTgl(t.pengambilan.waktu)} ${hkJam(t.pengambilan.waktu)} di ${hkEsc(t.pengambilan.lokasi||asal.nama)}, diserahkan oleh ${hkEsc(t.pengambilan.oleh)}.`;
  if(e.gudang) return asal.ditutup?null:`Pesanan ini diambil di booth ${hkEsc(asal.nama)} selama event berlangsung.`;
  if(t.eventId!==e.id) return `Pesanan ini untuk ${hkEsc(asal.nama)}, bukan event ini.`;
  if(ambilNanti()) return `Event belum dimulai. Barang diserahkan mulai ${hkTgl(e.mulai)}.`;
  if(t.pengambilan.status==='Perlu Refund') return 'Event sudah ditutup. Pengambilan hanya bisa di Gudang Pusat.';
  return null;
}
function presaleBlok(t, verified){
  const why=alasanTidakBisa(t), merah='background:#FDECEA;color:#C0392B;cursor:default;', hijau='background:#E4F7EF;color:#00734E;cursor:default;';
  const qr=t.status==='Lunas'&&['Menunggu','Perlu Refund'].includes(t.pengambilan.status)?`<div class="hk-qr-mini">${qrSvg(t,3)}<div>QR pengambilan<br><span>${t.no}</span></div></div>`:'';
  if(t.pengambilan.status==='Diambil') return `<div class="hk-note" style="${hijau}">Pre-sale · ${why}${t.pengambilan.cara==='Manual'?' Verifikasi manual.':''}</div>`;
  if(why) return `${qr}<div class="hk-note" style="${t.status!=='Lunas'||t.pengambilan.status==='Refund'?merah:'cursor:default;'}">${why}${t.pengambilan.status==='Perlu Refund'&&!ev().gudang?' Kalau belum ditransfer kembali, pembeli bisa mengambil di Gudang Pusat.':''}</div>`;
  const varian=`<div class="pin-hint" style="margin:4px 0 8px;">Barang diserahkan persis sesuai pesanan. Ukuran/varian tidak bisa ditukar.</div>`;
  if(verified) return `<div class="hk-note" style="${hijau}">✓ ${verified==='QR'?'QR di struk cocok':'Verifikasi manual disetujui'}. Serahkan barang berikut ke ${hkEsc(t.pelanggan?t.pelanggan.nama:'pembeli')}.</div>${varian}
    <button class="btn-confirm-primary" style="width:100%;margin:4px 0 10px;" onclick="hkSerahkan('${t.id}','${verified}')">Serahkan Barang ke Pembeli</button>`;
  return `${qr}<button class="btn-confirm-primary" style="width:100%;margin:6px 0;" onclick="closeSheet('sheetHkTrx'); setTimeout(hkScanBuka,250)">📷 Scan QR di Struk Pembeli</button>${varian}
    <details class="hk-manual"><summary>Struk hilang? Verifikasi manual</summary><div class="pin-hint" style="margin:6px 0;">Minta pembeli menyebutkan 4 digit terakhir no HP, lalu minta persetujuan Admin/Owner.</div>
    <div class="hk-rowin"><input id="hkHp4" inputmode="numeric" maxlength="4" placeholder="4 digit"><button class="btn-outline" onclick="hkManualCek('${t.id}')">Verifikasi</button></div></details>`;
}
window.hkManualCek=id=>{
  const t=D.trx.find(x=>x.id===id), v=(document.getElementById('hkHp4').value||'').trim(), hp=((t.pelanggan&&t.pelanggan.telepon)||'').replace(/\D/g,'');
  if(v.length!==4||!hp.endsWith(v)){ showToast('4 digit tidak cocok dengan no HP pembeli'); return; }
  closeSheet('sheetHkTrx'); mintaSup('Persetujuan pengambilan manual', `${t.no} · ${t.pelanggan?t.pelanggan.nama:''}`, ()=>setTimeout(()=>hkRwOpen(id,'Manual'),250));
};
window.hkSerahkan=(id, cara)=>{
  const t=D.trx.find(x=>x.id===id), e=ev(), why=alasanTidakBisa(t);
  if(why){ showToast(why); return; }
  const kurang=t.items.filter(i=>i.sku&&i.qty>hkStokDi(D.stok,i.sku,e.nama));
  if(kurang.length){ showToast(`Stok ${kurang[0].nama} di ${e.gudang?'gudang':'event'} tidak cukup. Ukuran tidak bisa ditukar.`); return; }
  t.items.forEach(i=>{ if(i.sku) hkJual(D.stok,i.sku,e.nama,i.qty); });
  const dariRefund=t.pengambilan.status==='Perlu Refund';
  t.pengambilan={status:'Diambil', waktu:hkIso(new Date()), oleh:ses.kasir, lokasi:e.nama, cara:cara||'QR', catatan:dariRefund?'Diambil di Gudang Pusat setelah event ditutup, refund dibatalkan':''};
  save('trx','stok'); loadProducts(); renderProductArea();
  closeSheet('sheetHkTrx'); rwScope='presale'; renderRiwayat(); showToast(`Barang diserahkan, stok ${e.gudang?'gudang':'event'} berkurang`);
};
/* ── scan QR: kamera langsung, atau foto dari kamera HP sebagai cadangan ── */
let camStream=null, camLoop=null;
function stopKamera(){ if(camLoop) cancelAnimationFrame(camLoop); camLoop=null; if(camStream) camStream.getTracks().forEach(tr=>tr.stop()); camStream=null; }
function hasilScan(data){
  if(!data||!data.startsWith(QR_PREFIX)){ showToast('QR bukan struk pre-sale Hikayat'); return false; }
  const id=data.split('|')[1], t=D.trx.find(x=>x.id===id);
  if(!t){ showToast('Transaksi tidak ditemukan di data'); return false; }
  stopKamera(); rwScope='presale'; renderRiwayat(); goView('view-hk-riwayat'); setTimeout(()=>hkRwOpen(id,'QR'),200);
  if(navigator.vibrate) navigator.vibrate(60); return true;
}
window.hkScanData=hasilScan;
window.hkScanBuka=()=>{
  closeSheet('sheetMainMenu'); closeSheet('sheetHkEvent');
  document.getElementById('hkScanSub').textContent=`${evNama()} · ${presaleDiSini().length} pesanan menunggu`;
  document.getElementById('hkScanManual').value='';
  goView('view-hk-scan');
  const msg=document.getElementById('hkCamMsg'), vid=document.getElementById('hkVid');
  msg.textContent='Mengaktifkan kamera...'; msg.style.display='flex';
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ msg.textContent='Kamera langsung tidak tersedia. Pakai tombol Ambil foto QR.'; return; }
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(st=>{
    camStream=st; vid.srcObject=st; vid.play(); msg.style.display='none';
    const cv=document.createElement('canvas'), cx=cv.getContext('2d',{willReadFrequently:true});
    const tick=()=>{ if(!camStream) return; if(vid.readyState===vid.HAVE_ENOUGH_DATA){ cv.width=vid.videoWidth; cv.height=vid.videoHeight; cx.drawImage(vid,0,0); const im=cx.getImageData(0,0,cv.width,cv.height); const c=jsQR(im.data,im.width,im.height); if(c&&hasilScan(c.data)) return; } camLoop=requestAnimationFrame(tick); };
    tick();
  }).catch(()=>{ msg.textContent='Izin kamera ditolak atau kamera tidak ada. Pakai tombol Ambil foto QR.'; });
};
window.hkScanTutup=()=>{ stopKamera(); goView('view-hk-riwayat'); renderRiwayat(); };
window.hkScanFoto=inp=>{
  const f=inp.files[0]; inp.value=''; if(!f) return;
  const img=new Image(); img.onload=()=>{ const k=Math.min(1,1400/Math.max(img.width,img.height)); const cv=document.createElement('canvas'); cv.width=img.width*k; cv.height=img.height*k;
    const cx=cv.getContext('2d'); cx.fillStyle='#fff'; cx.fillRect(0,0,cv.width,cv.height); cx.drawImage(img,0,0,cv.width,cv.height); const im=cx.getImageData(0,0,cv.width,cv.height);
    const c=jsQR(im.data,im.width,im.height,{inversionAttempts:'attemptBoth'}); if(!c){ showToast('QR tidak terbaca. Coba foto lebih dekat dan terang.'); return; } hasilScan(c.data); URL.revokeObjectURL(img.src); };
  img.src=URL.createObjectURL(f);
};
window.hkScanCari=()=>{
  const q=document.getElementById('hkScanManual').value.trim().toUpperCase(); if(!q) return;
  const t=D.trx.find(x=>x.no.toUpperCase()===q&&x.pengambilan);
  if(!t){ showToast('Nomor tidak ditemukan atau bukan pre-sale'); return; }
  stopKamera(); rwScope='presale'; renderRiwayat(); goView('view-hk-riwayat'); setTimeout(()=>hkRwOpen(t.id),200);
};
window.hkVoidAlasan=(el,a)=>{ voidAlasan=a; document.querySelectorAll('#hkVoidChips .chip').forEach(c=>c.classList.toggle('active',c===el)); const b=document.getElementById('hkVoidBtn'); b.disabled=false; b.style.opacity=1; };
window.hkVoid=()=>{
  const t=rwSel;
  const jalan=oleh=>{ t.status='Void'; t.void={oleh:oleh.nama, alasan:voidAlasan, waktu:hkIso(new Date())}; if(!t.pengambilan||t.pengambilan.status==='Diambil') t.items.forEach(i=>{ if(i.sku) hkJual(D.stok,i.sku,t.lokasi,-i.qty); }); if(t.pengambilan) t.pengambilan.status='Batal'; save('trx','stok'); loadProducts(); renderProductArea();
    closeSheet('sheetHkTrx'); renderRiwayat(); showToast('Transaksi di-void, stok dikembalikan'); };
  if(D.pos.voidPin&&!isSup(staff(ses.kasir))){ closeSheet('sheetHkTrx'); mintaSup('Persetujuan void', `${t.no} · ${fmt(t.total)}`, jalan); } else jalan(staff(ses.kasir));
};
/* ── retur barang cacat: pilih barang, alasan + foto, tukar barang sama atau uang kembali, PIN Admin/Owner ── */
let rt=null;
window.hkReturBuka=id=>{ const t=D.trx.find(x=>x.id===id); rt={t, qty:{}, cara:'Tukar barang', metode:'Tunai', alasan:'', foto:null}; closeSheet('sheetHkTrx'); setTimeout(()=>{ renderRetur(); openSheet('sheetHkRetur'); },250); };
function returItems(){ return rt.t.items.filter(i=>i.sku).map(i=>({...i, maks:i.qty-hkSudahRetur(rt.t,i.sku)})).filter(i=>i.maks>0); }
function returNilai(){ return returItems().reduce((a,i)=>a+hkNilaiRetur(rt.t,i,rt.qty[i.sku]||0),0); }
function renderRetur(){ const L=returItems(), n=Object.values(rt.qty).reduce((a,b)=>a+b,0), tukar=rt.cara==='Tukar barang';
  document.getElementById('hkRtTitle').textContent=`Retur barang cacat · ${rt.t.no}`;
  document.getElementById('hkRtBody').innerHTML=`<div class="so-section-label">Barang yang cacat</div>
    ${L.map(i=>{ const q=rt.qty[i.sku]||0; return `<div class="pt-row"><span class="pt-row-name">${hkEsc(i.nama)}<br><span style="font-size:11px;color:#8A8F87;">Dibeli ${i.qty}${i.maks<i.qty?` · sisa bisa diretur ${i.maks}`:''}${tukar?` · stok di sini ${stokEv(i.sku)}`:''}</span></span>
      <span style="display:flex;align-items:center;gap:8px;"><button class="btn-outline" style="width:34px;height:34px;padding:0;" onclick="hkReturQty('${i.sku}',-1)">−</button><b style="min-width:18px;text-align:center;">${q}</b><button class="btn-outline" style="width:34px;height:34px;padding:0;" onclick="hkReturQty('${i.sku}',1)">+</button></span></div>`; }).join('')}
    <div class="so-section-label">Penyelesaian</div>
    <div class="hk-chips">${['Tukar barang','Uang kembali'].map(c=>`<div class="chip ${rt.cara===c?'active':''}" onclick="hkReturSet('cara','${c}')">${c==='Tukar barang'?'Tukar barang yang sama':'Uang kembali'}</div>`).join('')}</div>
    ${tukar?`<div class="pin-hint" style="text-align:left;margin:6px 0 0;">Pembeli menerima barang pengganti yang sama dari stok di sini. Stok jual berkurang ${n} pcs.</div>`
      :`<div class="hk-chips" style="margin-top:8px;">${['Tunai','Transfer'].map(m=>`<div class="chip ${rt.metode===m?'active':''}" onclick="hkReturSet('metode','${m}')">${m==='Tunai'?'Tunai dari laci':'Transfer oleh Admin'}</div>`).join('')}</div>
      <div class="so-info-card" style="margin-top:8px;"><div class="so-info-row"><span class="lbl">Uang dikembalikan</span><span class="val" style="color:#C0392B;">${fmt(returNilai())}</span></div></div>
      <div class="pin-hint" style="text-align:left;margin:6px 0 0;">Sesuai harga yang dibayar setelah promo.${rt.metode==='Tunai'?' Uang diambil dari laci kasir ini.':''}</div>`}
    <div class="so-section-label">Kerusakan</div>
    <textarea id="hkRtAlasan" rows="2" oninput="rtAlasan(this)" placeholder="Contoh: jahitan lengan lepas, sablon retak (wajib)" style="width:100%;padding:10px;border:1px solid #DADDD6;border-radius:8px;font-size:14px;box-sizing:border-box;">${hkEsc(rt.alasan)}</textarea>
    <label class="btn-outline hk-filebtn" style="margin-top:8px;">${rt.foto?'✓ Foto tersimpan · ganti foto':'📷 Foto barang cacat'}<input type="file" accept="image/*" capture="environment" onchange="hkReturFoto(this)" hidden></label>
    ${rt.foto?`<img src="${rt.foto}" style="max-width:120px;border-radius:8px;margin-top:8px;">`:''}
    <div class="confirm-actions" style="margin-top:14px;"><button class="btn-outline" onclick="closeSheet('sheetHkRetur')">Batal</button><button class="btn-danger" ${n?'':'disabled style="opacity:.45"'} onclick="hkReturSimpan()">Retur ${n} barang</button></div>`; }
window.rtAlasan=el=>{ rt.alasan=el.value; };
window.hkReturQty=(sku,d)=>{ const i=returItems().find(x=>x.sku===sku); const q=Math.max(0,Math.min(i.maks,(rt.qty[sku]||0)+d));
  if(d>0&&q===(rt.qty[sku]||0)) showToast(`Maksimal ${i.maks} sesuai pembelian`);
  if(d>0&&rt.cara==='Tukar barang'&&q>stokEv(sku)){ showToast(`Stok ${i.nama} di sini tinggal ${stokEv(sku)}`); return; }
  rt.qty[sku]=q; renderRetur(); };
window.hkReturSet=(k,v)=>{ rt[k]=v; if(k==='cara'&&v==='Tukar barang') Object.keys(rt.qty).forEach(sku=>{ rt.qty[sku]=Math.min(rt.qty[sku],Math.max(0,stokEv(sku))); }); renderRetur(); };
window.hkReturFoto=inp=>{ const f=inp.files[0]; inp.value=''; if(!f) return; const img=new Image(); img.onload=()=>{ const k=Math.min(1,320/Math.max(img.width,img.height)), cv=document.createElement('canvas'); cv.width=img.width*k; cv.height=img.height*k; cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height); rt.foto=cv.toDataURL('image/jpeg',0.6); URL.revokeObjectURL(img.src); renderRetur(); }; img.src=URL.createObjectURL(f); };
window.hkReturSimpan=()=>{ const items=returItems().filter(i=>rt.qty[i.sku]>0).map(i=>({sku:i.sku, nama:i.nama, qty:rt.qty[i.sku], harga:i.harga}));
  if(!items.length){ showToast('Pilih barang yang cacat'); return; }
  if(!rt.alasan.trim()){ showToast('Tulis kerusakan barangnya'); return; }
  const uang=rt.cara==='Uang kembali', nilai=uang?returNilai():0, K=hkShiftKas(D,shift());
  if(uang&&rt.metode==='Tunai'&&nilai>K.harus){ showToast(`Uang di laci tidak cukup (${fmt(K.harus)})`); return; }
  if(!uang&&items.some(i=>i.qty>stokEv(i.sku))){ showToast('Stok pengganti tidak cukup'); return; }
  const t=rt.t, e=ev(), jalan=sup=>{
    const r={no:`RTR-${t.no.replace(/^HK-/,'')}-${(t.retur||[]).length+1}`, waktu:hkIso(new Date()), eventId:e.id, lokasi:e.nama, shiftId:ses.shiftId, oleh:ses.kasir, disetujui:sup.nama,
      items, cara:rt.cara, metode:uang?rt.metode:null, nilai, alasan:rt.alasan.trim(), foto:rt.foto};
    hkRetur(D,t,r); save('trx','stok'); loadProducts(); renderProductArea(); renderRiwayat(); closeSheet('sheetHkRetur');
    showToast(uang?`Retur tercatat. Kembalikan ${fmt(nilai)} ${rt.metode==='Tunai'?'dari laci':'lewat transfer'}`:`Retur tercatat. Berikan ${items.reduce((a,i)=>a+i.qty,0)} barang pengganti`); };
  closeSheet('sheetHkRetur'); mintaSup('Persetujuan retur barang cacat', `${t.no} · ${items.map(i=>i.qty+'× '+i.nama).join(', ')}`, jalan); };
function mintaSup(title, sub, cb){ supPin=''; supCb=cb; document.getElementById('hkSupTitle').textContent=title; document.getElementById('hkSupSub').textContent=sub; renderSupDots(); setTimeout(()=>openSheet('sheetHkSup'),250); }
function renderSupDots(){ document.getElementById('hkSupDots').innerHTML=[0,1,2,3,4,5].map(i=>`<div class="pin-dot ${i<supPin.length?'filled':''}"></div>`).join(''); }
window.hkSupKey=k=>{ if(k==='C') supPin=''; else if(k==='<') supPin=supPin.slice(0,-1); else if(supPin.length<6) supPin+=k; renderSupDots();
  if(supPin.length===6){ const s=D.staff.find(x=>x.pin===supPin&&isSup(x)&&x.aktif!==false); if(s){ closeSheet('sheetHkSup'); supCb(s); } else { showToast('PIN Admin/Owner salah'); supPin=''; setTimeout(renderSupDots,200); } } };

/* ════════ 7. LAPORAN KASIR, KAS KASIR, TUTUP KASIR ════════ */
function shiftRingkasan(s){
  const trx=D.trx.filter(t=>t.shiftId===s.id&&t.status!=='Void');
  const pm={}, em={}, bm={};
  trx.forEach(t=>{ t.items.forEach(i=>{ const m=i.sku?pm:em; m[i.nama]=(m[i.nama]||0)+i.qty; }); hkBayar(t).forEach(b=>{ bm[b.metode]=(bm[b.metode]||0)+b.jumlah; }); });
  return {produk:Object.entries(pm).map(([name,qty])=>({name,qty})).sort((a,b)=>b.qty-a.qty), ekstra:Object.entries(em).map(([name,qty])=>({name,qty})), bayar:Object.entries(bm).map(([method,amount])=>({method,amount}))};
}
const lbl=iso=>`${hkJam(iso)}, ${hkTgl(iso)}`;
function loadShifts(){
  const e=ev();
  CASHIER_SHIFTS=D.shift.filter(s=>s.eventId===e.id).sort((a,b)=>b.buka.localeCompare(a.buka)).map(s=>{ const K=hkShiftKas(D,s);
    return {id:s.id, waktuBuka:lbl(s.buka), saldoAwal:s.modal, kasirNama:s.kasir, waktuTutup:s.tutup?lbl(s.tutup):null, saldoAkhir:s.tutup?s.kasHitung:null, status:s.tutup?'closed':'open', ringkasan:shiftRingkasan(s), selisih:K.selisih}; });
  LAP_DATE_RANGES.length=0; LAP_DATE_RANGES.push(`${hkTgl(e.mulai)} – ${hkTgl(e.selesai)}`); lapDateRangeIdx=0; lapPeriodLabelVal='Selama event';
}
const _openLaporan=openLaporan;
openLaporan=function(){ loadShifts(); _openLaporan(); setHeader(); };
const _renderLapList=renderLapList;
renderLapList=function(){ _renderLapList();
  document.querySelectorAll('#lapList .lap-card').forEach((card,i)=>{ const s=CASHIER_SHIFTS.filter(x=>lapStatusFilter==='Belum Tutup Kasir'?x.status==='open':true)[i]; if(!s||s.selisih==null) return;
    card.querySelector('.lap-card-kasir').innerHTML+=` · <span class="${s.selisih?'hk-low':''}">${s.selisih===0?'Kas pas':(s.selisih>0?'Lebih ':'Kurang ')+fmt(Math.abs(s.selisih))}</span>`; }); };

/* kas kasir per shift */
function loadKas(){
  const s=shift(); KAS_KASIR_ITEMS=[{id:'modal', nama:'Modal Awal', jenis:'masuk', jumlah:s.modal, waktu:lbl(s.buka), foto:null, catatan:''},
    ...(s.kas||[]).map(k=>({...k, waktu:lbl(k.waktu)}))];
}
kkTotals=function(){
  const s=shift(), K=hkShiftKas(D,s);
  return {pemasukan:s.modal+K.masuk, pengeluaran:K.keluar+(K.retur||0), totalRefund:K.refund, totalKasKasir:K.harus, totalPenjualan:K.penjualan};
};
const _renderKkStats=renderKkStats;
renderKkStats=function(){ _renderKkStats(); const cards=document.querySelectorAll('#kkStatRow .kk-stat-card .kk-stat-label'); if(cards[3]) cards[3].textContent='Uang di Laci'; if(cards[4]) cards[4].textContent='Penjualan (semua metode)'; };
const _openKas=openKasKasir;
openKasKasir=function(){ loadKas(); _openKas(); setHeader(); };
simpanTransaksiKasKasir=function(){
  const nama=document.getElementById('kkNamaInput').value.trim(), nominal=parseRupiah(document.getElementById('kkNominalInput').value), catatan=document.getElementById('kkCatatanInput').value.trim();
  if(!nama||nominal<=0) return;
  if(kkJenisAktif==='keluar'&&nominal>hkShiftKas(D,shift()).harus){ showToast(`Uang keluar maksimal ${fmt(hkShiftKas(D,shift()).harus)} (uang di laci)`); return; }
  const s=shift(); s.kas=s.kas||[]; s.kas.push({id:'kk'+Date.now(), nama, jenis:kkJenisAktif, jumlah:nominal, waktu:hkIso(new Date()), catatan}); save('shift');
  loadKas(); closeSheet('sheetTambahKasKasir'); renderKkStats(); renderKkList(); showToast('✓ Transaksi kas kasir tersimpan');
};

/* tutup kasir: hitung uang fisik dulu, baru PIN */
let tutupId=null, tutupHitung='', tutupCatatan='';
function renderTutup(){
  const s=D.shift.find(x=>x.id===tutupId), K=hkShiftKas(D,s), n=tutupHitung===''?null:+tutupHitung, sel=n==null?null:n-K.harus;
  const r=(a,b,c='')=>`<div class="so-info-row"><span class="lbl">${a}</span><span class="val" ${c}>${b}</span></div>`;
  document.getElementById('hkTutupSub').textContent=`${s.kasir} · dibuka ${lbl(s.buka)}`;
  document.getElementById('hkTutupBody').innerHTML=`<div class="so-section-label">Penjualan</div><div class="so-info-card">${r('Transaksi',K.n)}${r('Tunai',fmt(K.tunai))}${r('QRIS',fmt(K.qris))}${r('Transfer',fmt(K.transfer))}${r('<b>Total</b>','<b>'+fmt(K.penjualan)+'</b>')}${K.refund?r('Void',fmt(K.refund)):''}</div>
    <div class="so-section-label">Uang di laci</div><div class="so-info-card">${r('Modal awal',fmt(s.modal))}${r('+ Penjualan tunai',fmt(K.tunai))}${K.masuk?r('+ Kas masuk',fmt(K.masuk)):''}${K.keluar?r('− Kas keluar',fmt(K.keluar)):''}${K.retur?r('− Retur uang kembali',fmt(K.retur)):''}${r('<b>Seharusnya</b>','<b>'+fmt(K.harus)+'</b>')}</div>
    <div class="field" style="margin-top:14px;"><label>Hitung uang fisik di laci</label><input id="hkTutupInput" inputmode="numeric" value="${n!=null?n.toLocaleString('id-ID'):''}" placeholder="0" oninput="hkTutupIn(this)" style="font-size:20px;font-weight:800;text-align:right;"></div>
    <div id="hkSelisih">${selisihNote(sel)}</div>
    <div class="field"><label>Catatan <span class="field-optional">(opsional)</span></label><input id="hkTutupCat" value="${hkEsc(tutupCatatan)}" placeholder="Contoh: kurang karena salah kembalian" oninput="hkTutupCatIn(this)"></div>`;
  document.getElementById('hkTutupBtn').disabled=n==null;
}
let tutupPj='', tutupAlasan='';
function selisihNote(sel){ if(sel==null) return ''; const s=D.shift.find(x=>x.id===tutupId);
  return `<div class="hk-note" style="${sel===0?'background:#E4F7EF;color:#00734E;':sel<0?'background:#FDECEA;color:#C0392B;':''}">${sel===0?'Pas, tidak ada selisih.':`${sel<0?'Kurang':'Lebih'} ${fmt(Math.abs(sel))}. ${sel<0?'Kekurangan wajib ada penanggung jawab dan dicatat di Selisih & Kerugian.':'Selisih tercatat di laporan event di dashboard.'}`}</div>
  ${sel<0?`<div class="so-section-label">Pertanggungjawaban kas kurang</div>
    <select id="hkKasPj" onchange="hkKasPjIn(this)" style="width:100%;padding:10px;border:1px solid #DADDD6;border-radius:8px;font-size:14px;margin-bottom:8px;">${D.staff.filter(x=>x.aktif!==false).map(x=>`<option ${(tutupPj||s.kasir)===x.nama?'selected':''}>${hkEsc(x.nama)}</option>`).join('')}</select>
    <textarea id="hkKasAlasan" rows="2" oninput="hkKasAlasanIn(this)" placeholder="Penjelasan kekurangan (wajib)" style="width:100%;padding:10px;border:1px solid #DADDD6;border-radius:8px;font-size:14px;box-sizing:border-box;">${hkEsc(tutupAlasan)}</textarea>`:''}`; }
window.hkKasPjIn=el=>{ tutupPj=el.value; };
window.hkKasAlasanIn=el=>{ tutupAlasan=el.value; };
window.hkTutupIn=inp=>{ const v=inp.value.replace(/\D/g,''); tutupHitung=v; inp.value=v?(+v).toLocaleString('id-ID'):''; const s=D.shift.find(x=>x.id===tutupId); document.getElementById('hkSelisih').innerHTML=selisihNote(v===''?null:+v-hkShiftKas(D,s).harus); document.getElementById('hkTutupBtn').disabled=v===''; };
window.hkTutupCatIn=inp=>{ tutupCatatan=inp.value; };
window.hkTutupLanjut=()=>{ const s=D.shift.find(x=>x.id===tutupId), sel=(+tutupHitung||0)-hkShiftKas(D,s).harus;
  if(sel<0&&!tutupAlasan.trim()){ showToast('Kas kurang. Isi penanggung jawab dan penjelasan dulu'); return; }
  loadShifts(); lapShowTutupKasirFor0(tutupId); };
function bukaTutup(id, from){ tutupId=id; tutupHitung=''; tutupCatatan=''; tutupPj=''; tutupAlasan=''; renderTutup(); tutupFrom=from; goView('view-hk-tutup'); }
let tutupFrom='view-home';
let lanjutTutupEvent=null;
window.hkTutupBack=()=>{ const lanjut=lanjutTutupEvent; lanjutTutupEvent=null; goView(tutupFrom); if(lanjut) setTimeout(()=>hkTutupEventOpen(lanjut),300); };
/* dari layar Tutup Event: tutup kasir yang masih terbuka (milik sendiri atau kasir lain, disetujui PIN Owner), lalu kembali ke Tutup Event */
window.hkTutupKasirDari=(shId,evId)=>{ lanjutTutupEvent=evId; closeSheet('sheetHkTutupEv'); const from=document.querySelector('.app > .view.active')?.id||'view-home'; setTimeout(()=>bukaTutup(shId, from),250); };
window.hkMenuTutup=()=>{ closeSheet('sheetMainMenu'); setTimeout(()=>bukaTutup(ses.shiftId,'view-home'),240); };
const lapShowTutupKasirFor0=lapShowTutupKasirFor;
lapShowTutupKasirFor=function(id){ bukaTutup(id,'view-laporan'); };
tkCheckPin=function(){
  const s=D.shift.find(x=>x.id===tutupId);
  const okStaff=D.staff.find(x=>x.pin===tkPinInput&&x.aktif!==false&&(x.nama===ses.kasir||isSup(x)));
  if(!okStaff){ catatMasuk(ses.kasir,'PIN salah (tutup kasir)',(hkTempat(D,s.eventId)||{}).nama); showToast('PIN salah, coba lagi'); setTimeout(()=>{ tkPinInput=''; updateTkPinDots(); },450); return; }
  s.tutup=hkIso(new Date()); s.kasHitung=+tutupHitung||0; s.catatan=tutupCatatan; s.ditutupOleh=okStaff.nama;
  { const sel=hkShiftKas(D,s).selisih; if(sel<0) s.kasKurang={pj:tutupPj||s.kasir, alasan:tutupAlasan.trim(), status:'Belum diselesaikan', riwayat:[]}; }
  save('shift'); catatMasuk(okStaff.nama,'Tutup kasir'+(okStaff.nama!==s.kasir?` (laci ${s.kasir})`:''),(hkTempat(D,s.eventId)||{}).nama);
  setTimeout(()=>{ closeSheet('sheetLapTutupKasir'); tkPinInput=''; updateTkPinDots();
    const K=hkShiftKas(D,s);
    showToast(`✓ Kasir ditutup · ${K.selisih===0?'kas pas':(K.selisih<0?'kurang ':'lebih ')+fmt(Math.abs(K.selisih))}`);
    const lanjut=lanjutTutupEvent; lanjutTutupEvent=null; const owner=isOwner(staff(ses.kasir));
    if(s.id===ses.shiftId){ ses.shiftId=null; HELD_ORDERS=[]; saveHeld(); cart={}; customItems=[]; appliedPromo=null;
      /* Owner tetap masuk dan kembali ke Pilih Tempat Jualan, supaya bisa langsung menutup event tanpa membuka kasir lagi */
      if(owner){ saveSes(); login={step:'buka', kasir:ses.kasir, pin:'', eventId:null, modal:'300000'}; renderLogin(); goView('view-hk-login'); }
      else { ses.kasir=null; saveSes(); keluar(); } }
    else if(lanjut){ if(ses.shiftId&&shift()&&!shift().tutup) goView(tutupFrom); else { login={step:'buka', kasir:ses.kasir, pin:'', eventId:null, modal:'300000'}; renderLogin(); goView('view-hk-login'); } }
    else { loadShifts(); renderLapList(); goView('view-laporan'); }
    if(lanjut&&owner) setTimeout(()=>hkTutupEventOpen(lanjut),450); }, 350);
};

/* ════════ 8. PRODUK TERJUAL ════════ */
let ptOff=0;
function ptRange(){ const t=hkToday(), p=ptPeriodLabelVal; let a=t,b=t;
  if(p==='Kemarin'){ a=b=hkAddDays(t,-1); } else if(p==='7 Hari Terakhir'){ a=hkAddDays(t,-6); } else if(p==='Minggu Ini'||p==='Minggu Lalu'){ const d=(t.getDay()||7)-1; a=hkAddDays(t,-d-(p==='Minggu Lalu'?7:0)); b=hkAddDays(a,6); } else if(p==='Selama Event'){ const e=ev(); return [e.mulai,e.selesai]; }
  const span=Math.round((b-a)/864e5)+1; return [hkYmd(hkAddDays(a,ptOff*span)), hkYmd(hkAddDays(b,ptOff*span))]; }
renderPtFilters=function(){ const [a,b]=ptRange(); document.getElementById('ptPeriodLabel').textContent=ptPeriodLabelVal; document.getElementById('ptDateRangeLabel').textContent=a===b?hkTgl(a):`${hkTgl(a)} – ${hkTgl(b)}`; document.getElementById('ptOutletLabel').textContent=ptOutletLabelVal; };
pilihPtPeriod=function(l){ closeAllQuickMenus(); ptPeriodLabelVal=l; ptOff=0; renderPtFilters(); renderPtLists(); };
ptShiftPeriod=function(d){ ptOff+=d; renderPtFilters(); renderPtLists(); };
renderPtLists=function(){
  const [a,b]=ptRange(), e=ev(), semua=ptOutletLabelVal==='Semua Event';
  const list=D.trx.filter(t=>(semua||t.eventId===e.id)&&t.waktu.slice(0,10)>=a&&t.waktu.slice(0,10)<=b);
  const agg=arr=>{ const m={}; arr.forEach(t=>t.items.forEach(i=>{ m[i.nama]=(m[i.nama]||0)+i.qty; })); return Object.entries(m).sort((x,y)=>y[1]-x[1]); };
  const sold=agg(list.filter(t=>t.status!=='Void')), ref=agg(list.filter(t=>t.status==='Void'));
  document.getElementById('ptSoldList').innerHTML=sold.length?sold.map(([n,q])=>`<div class="pt-row"><span class="pt-row-name">${hkEsc(n)}</span><span class="pt-row-qty">${q}</span></div>`).join(''):'<div class="pt-list-empty">Belum ada produk terjual untuk periode ini</div>';
  document.getElementById('ptRefundList').innerHTML=ref.length?ref.map(([n,q])=>`<div class="pt-row"><span class="pt-row-name">${hkEsc(n)}</span><span class="pt-row-qty">${q}</span></div>`).join(''):'<div class="pt-list-empty">Tidak ada produk void untuk periode ini</div>';
};
const _openPt=openProdukTerjual;
openProdukTerjual=function(){ ptOutletLabelVal=evNama(); ptPeriodLabelVal='Hari Ini'; ptOff=0;
  document.getElementById('ptOutletMenu').innerHTML=`<div class="quick-menu-item" onclick="pilihPtOutlet('${hkEsc(evNama())}')">${hkEsc(evNama())}</div><div class="quick-menu-item" onclick="pilihPtOutlet('Semua Event')">Semua Event</div>`;
  const pm=document.getElementById('ptPeriodMenu'); if(pm&&!pm.innerHTML.includes('Selama Event')) pm.insertAdjacentHTML('beforeend',`<div class="quick-menu-item" onclick="pilihPtPeriod('Selama Event')">Selama Event</div>`);
  _openPt(); setHeader(); };

/* semua isian angka yang punya batas: nilai di atas batas langsung diturunkan ke batas */
document.addEventListener('input',e=>{ const t=e.target; if(!t||t.tagName!=='INPUT') return;
  if(t.id==='kkNominalInput'&&typeof kkJenisAktif!=='undefined'&&kkJenisAktif==='keluar'&&shift()){ const mx=hkShiftKas(D,shift()).harus, v=parseRupiah(t.value); if(v>mx){ t.value=mx.toLocaleString('id-ID'); showToast(`Maksimal ${fmt(mx)} (uang di laci)`); } return; }
  if(t.type!=='number'||t.max==='') return; const mx=+t.max; if(t.value!==''&&+t.value>mx){ t.value=mx; showToast(`Maksimal ${mx}`); } },true);

/* ════════ 9. RIWAYAT MASUK POS (pengganti absensi) ════════ */
const PERANGKAT=(()=>{ let id=ls.get('hk2pos:perangkat'); if(!id){ id='HP-'+Math.random().toString(36).slice(2,6).toUpperCase(); ls.set('hk2pos:perangkat',id); } return id; })();
function catatMasuk(nama, aksi, tempat){ if(!nama) return; const s=staff(nama);
  D.masuk=D.masuk||[]; D.masuk.unshift({id:'m'+Date.now()+Math.random().toString(36).slice(2,5), nama, role:s?s.role.join(', '):'', aksi, tempat:tempat||'', waktu:hkIso(new Date()), perangkat:PERANGKAT});
  if(D.masuk.length>1000) D.masuk.length=1000; save('masuk'); }
let msScope='hari';
window.hkBukaMasuk=()=>{ closeSheet('sheetMainMenu'); setTimeout(()=>{ renderMasuk(); goView('view-hk-masuk'); },240); };
window.hkMsScope=s=>{ msScope=s; renderMasuk(); };
function renderMasuk(){
  const sup=isSup(staff(ses.kasir)), today=hkYmd(new Date()), batas=hkIso(hkAddDays(new Date(),-7));
  let L=(D.masuk||[]).filter(m=>sup||m.nama===ses.kasir);
  L=L.filter(m=>msScope==='hari'?m.waktu.slice(0,10)===today:msScope==='minggu'?m.waktu>=batas:true);
  document.getElementById('hkMsSub').textContent=sup?'Semua karyawan':'Hanya riwayat Anda';
  document.getElementById('hkMsChips').innerHTML=[['hari','Hari ini'],['minggu','7 hari'],['semua','Semua']].map(([k,l])=>`<div class="lap-cat-chip ${msScope===k?'active':''}" onclick="hkMsScope('${k}')">${l}</div>`).join('');
  const warna=a=>a==='PIN salah'||a.startsWith('PIN salah')?'void':a==='Keluar'||a==='Terkunci otomatis'?'':'lunas';
  let tgl='', html='';
  L.forEach(m=>{ const d=m.waktu.slice(0,10); if(d!==tgl){ tgl=d; html+=`<div class="so-section-label" style="margin-top:12px;">${hkTgl(m.waktu)}</div>`; }
    html+=`<div class="hk-ms-row"><div class="hk-ms-av">${initials2(m.nama)}</div><div class="hk-ms-main"><div class="hk-ms-nama">${hkEsc(m.nama)} <span>${hkEsc(m.role)}</span></div><div class="hk-ms-sub">${m.tempat?hkEsc(m.tempat)+' · ':''}${hkEsc(m.perangkat||'')}${m.perangkat===PERANGKAT?' (HP ini)':''}</div></div><div class="hk-ms-kanan"><span class="lap-status-badge ${warna(m.aksi)}">${hkEsc(m.aksi)}</span><div class="hk-ms-jam">${hkJam(m.waktu)}</div></div></div>`; });
  document.getElementById('hkMsList').innerHTML=html||'<div class="pt-list-empty">Belum ada riwayat di periode ini</div>';
}

/* ════════ 10. INVENTORI: STOK OPNAME & TERIMA MUTASI ════════ */
function loadInventori(){
  const e=ev();
  STOK_OPNAME_LIST=D.opname.filter(o=>o.lokasi===e.nama).map(o=>({...o, outlet:o.lokasi, tanggal:o.tanggal||hkTgl(o.waktu),
    produk:(o.produk||[]).map(x=>({...x, stok:x.fisik!=null?x.fisik:x.stok, kategori:x.kategori||'-', jenis:x.jenis||'Barang Jadi', satuan:x.satuan||'Pcs'}))}));
  MUTASI_PENDING_LIST.length=0;
  const pr=sku=>{ const p=PRODUCTS.find(x=>x.sku===sku)||{}; return {kategori:p.category||'-', hargaBeli:p.hpp||0, satuan:'Pcs', emoji:p.emoji||'📦', bg:p.bg}; };
  D.mutasi.filter(m=>m.ke===e.nama&&m.status==='Dikirim').forEach(m=>MUTASI_PENDING_LIST.push({no:m.no, noFaktur:'-', outletAsal:m.dari, outletTujuan:m.ke, tglKirim:hkTgl(m.tglKirim), produk:m.items.map(i=>({sku:i.sku, nama:i.nama, dikirim:i.dikirim, ...pr(i.sku)}))}));
  TERIMA_MUTASI_LIST=D.mutasi.filter(m=>m.ke===e.nama&&m.status!=='Dikirim'&&m.status!=='Batal').map(m=>({no:m.no, noFaktur:'-', outletAsal:m.dari, outletTujuan:m.ke, tglKirim:hkTgl(m.tglKirim), tglTerima:m.tglTerima?hkTgl(m.tglTerima):'-', catatan:m.catatan,
    status:m.status==='Diterima'?'Berhasil':m.status, totalHarga:m.items.reduce((a,i)=>a+(i.diterima||0)*(pr(i.sku).hargaBeli),0),
    produk:m.items.map(i=>({sku:i.sku, nama:i.nama, ...pr(i.sku), diterima:i.diterima||0, sisa:i.dikirim-(i.diterima||0)}))}));
  const opt=document.getElementById('soOutlet'); if(opt) opt.innerHTML=`<option>${hkEsc(e.nama)}</option>`;
}
const _bukaInv=bukaMenuInventori;
bukaMenuInventori=function(){ loadInventori(); _bukaInv(); setHeader(); };
window.hkBukaMutasi=()=>{ loadInventori(); goView('view-inventori'); switchInvTab('mutasi'); renderSoList(); renderMutasiList(); setHeader(); };
/* stok opname: semua barang di event langsung tampil (sama seperti Tutup Event), hasilnya dikirim untuk disetujui Owner/Admin */
let soFrom='view-inventori';
soOpenTambah=function(){ soFrom=document.querySelector('.app > .view.active')?.id||'view-inventori'; renderSOBaru(); goView('view-hk-so'); };
window.hkSOKembali=()=>{ loadInventori(); goView(soFrom); if(soFrom==='view-inventori'){ switchInvTab('stokopname'); renderSoList(); } };
function renderSOBaru(){
  const e=ev(), so=hkSOAkhir(D,e.id), rows=D.stok.map(it=>({it, q:hkStokDi(D.stok,it.sku,e.nama), po:(it.perOutlet||[]).find(o=>o.outlet===e.nama)})).filter(x=>x.po&&(x.q>0||x.po.masuk>0));
  document.getElementById('hkSoSub').textContent=e.nama;
  document.getElementById('hkSoBody').innerHTML=`
    ${so&&so.status==='Perlu opname ulang'?`<div class="hk-note" style="background:#FDECEA;color:#C0392B;cursor:default;">Opname ulang diminta oleh ${hkEsc(so.ulang.oleh)}: "${hkEsc(so.ulang.catatan)}"</div>`:''}
    ${so&&so.status==='Menunggu persetujuan'?`<div class="hk-note" style="cursor:default;">Opname ${so.no} oleh ${hkEsc(so.oleh)} (${hkJam(so.waktu)}) masih menunggu persetujuan. Mengirim opname baru akan menggantikannya.</div>`:''}
    <div class="so-section-label">Hitung barang di booth</div>
    <div class="pin-hint" style="text-align:left;margin:0 0 6px;">Isi stok fisik setiap barang. Kosong berarti sama dengan sistem. Hasilnya dikirim ke Owner/Admin untuk disetujui, bisa kapan saja selama event atau saat Tutup Event. Stok belum berubah sampai disetujui.</div>
    ${rows.length?rows.map(x=>`<div class="pt-row"><span class="pt-row-name">${hkEsc(x.it.nama)}<br><span style="font-size:11px;color:#8A8F87;">Sistem ${x.q} · <b id="hkSoSel-${x.it.sku}">sesuai</b></span></span><input type="number" min="0" inputmode="numeric" class="hk-so-fisik" data-sku="${x.it.sku}" data-sistem="${x.q}" placeholder="${x.q}" style="width:76px;padding:8px;border:1px solid #DADDD6;border-radius:8px;text-align:right;font-size:15px;"></div>`).join(''):'<div class="pt-list-empty">Belum ada stok di event ini</div>'}
    <div class="so-info-card" style="margin-top:12px;"><div class="so-info-row"><span class="lbl">Barang kurang</span><span class="val" id="hkSoKurang">0 pcs</span></div><div class="so-info-row"><span class="lbl">Barang lebih</span><span class="val" id="hkSoLebih">0 pcs</span></div></div>
    <div class="field" style="margin-top:12px;"><label>Catatan</label><textarea id="hkSoCatatan" rows="2" placeholder="Contoh: 2 kaos S tidak ditemukan" style="width:100%;padding:10px;border:1px solid #DADDD6;border-radius:8px;font-size:14px;box-sizing:border-box;"></textarea></div>`;
}
document.addEventListener('input',e=>{ const t=e.target; if(!t.classList||!t.classList.contains('hk-so-fisik')) return; let k=0,l=0;
  document.querySelectorAll('.hk-so-fisik').forEach(i=>{ const q=+i.dataset.sistem, f=i.value===''?q:Math.max(0,+i.value||0), d=f-q; if(d<0) k+=-d; else l+=d;
    const el=document.getElementById('hkSoSel-'+i.dataset.sku); if(el){ el.textContent=d===0?'sesuai':(d>0?'+':'')+d; el.style.color=d<0?'#C0392B':d>0?'#1E8E4E':''; } i.style.borderColor=d<0?'#C0392B':d>0?'#1E8E4E':'#DADDD6'; });
  document.getElementById('hkSoKurang').textContent=k+' pcs'; document.getElementById('hkSoLebih').textContent=l+' pcs'; });
window.hkSOKirim=()=>{
  const e=ev(), cat=hkCatalog(D.produk), produk=[...document.querySelectorAll('.hk-so-fisik')].map(i=>{ const q=+i.dataset.sistem, f=i.value===''?q:Math.max(0,Math.round(+i.value||0)), c=cat.find(x=>x.sku===i.dataset.sku)||{};
    return {sku:i.dataset.sku, nama:c.nama||i.dataset.sku, sistem:q, fisik:f, selisih:f-q, hpp:c.hpp||0, kerugian:Math.max(0,q-f)*(c.hpp||0)}; });
  if(!produk.length){ showToast('Tidak ada barang untuk dihitung'); return; }
  D.opname.filter(o=>o.eventId===e.id&&o.jenis==='Akhir Event'&&['Menunggu persetujuan','Perlu opname ulang'].includes(o.status)).forEach(o=>o.status='Diganti');
  const so={no:'SO/'+hkYmd(new Date()).replace(/-/g,'').slice(2)+'/'+String(D.opname.length+1).padStart(2,'0'), jenis:'Akhir Event', eventId:e.id, lokasi:e.nama, status:'Menunggu persetujuan', waktu:hkIso(new Date()), tanggal:hkTgl(new Date()), oleh:ses.kasir,
    catatan:document.getElementById('hkSoCatatan').value.trim(), produk, kerugian:produk.reduce((a,p)=>a+p.kerugian,0)};
  D.opname.unshift(so); save('opname'); const r=hkSORingkas(so);
  showToast(`✓ Opname terkirim${r.kurang?` · kurang ${r.kurang} pcs`:' · stok sesuai'}. Menunggu persetujuan`); hkSOKembali(); };
const _renderSoList=renderSoList;
renderSoList=function(){ _renderSoList(); const so=ev()&&hkSOAkhir(D,ev().id), el=document.getElementById('soList'); if(!so||!el) return;
  if(so.status==='Menunggu persetujuan') el.insertAdjacentHTML('afterbegin', bolehSetujuSO(ses.kasir)
    ?`<div class="hk-note" id="hkSoTunggu" onclick="hkSOPeriksa('${so.no}')">Opname ${so.no} oleh ${hkEsc(so.oleh)} menunggu persetujuan. Ketuk untuk memeriksa dan menyetujui.</div>`
    :`<div class="hk-note" id="hkSoTunggu" style="cursor:default;">Opname ${so.no} sudah dikirim dan menunggu persetujuan Owner/Admin.</div>`);
  if(so.status==='Perlu opname ulang') el.insertAdjacentHTML('afterbegin',`<div class="hk-note" style="background:#FDECEA;color:#C0392B;" onclick="soOpenTambah()">Opname ulang diminta oleh ${hkEsc(so.ulang.oleh)}: "${hkEsc(so.ulang.catatan)}". Ketuk untuk menghitung ulang.</div>`); };
const _soDetail=soOpenDetail;
soOpenDetail=function(no){ _soDetail(no); const s=STOK_OPNAME_LIST.find(x=>x.no===no); if(!s) return;
  document.querySelectorAll('#soDetailProdukList .so-produk-row').forEach((row,i)=>{ const p=s.produk[i]; if(p&&p.sistem!=null) row.querySelector('.so-produk-meta').innerHTML=`Sistem ${p.sistem} → fisik ${p.stok} · ${p.stok===p.sistem?'sesuai':`<span class="hk-low">${p.stok-p.sistem>0?'+':''}${p.stok-p.sistem}</span>`}`; });
  document.getElementById('soDetailCatatan').textContent=[s.catatan, `Dihitung oleh ${s.oleh}`, s.disetujui?`Disetujui ${s.disetujui.oleh}`:'', s.ulang?`Diminta ulang ${s.ulang.oleh}: ${s.ulang.catatan}`:''].filter(Boolean).join(' · '); };
soKonfirmasiPilihProduk=function(){
  Object.keys(soSelectedProdukIds).forEach(sku=>{ if(!soSelectedProdukIds[sku]||soDraft.produk.find(x=>x.sku===sku)) return; const p=PRODUCTS.find(x=>x.sku===sku); if(!p) return;
    const st=stokEv(sku); soDraft.produk.push({sku, nama:p.name, kategori:p.category, jenis:'Barang Jadi', stok:st, sistem:st, satuan:'Pcs', emoji:p.emoji, bg:p.bg}); });
  soDraft.produk=soDraft.produk.filter(p=>soSelectedProdukIds[p.sku]); closeSheet('sheetPilihProdukOpname'); renderSoProdukList();
};
const selisihTxt=p=>{ const d=p.stok-p.sistem; return d===0?'sesuai':`<span class="hk-low">${d>0?'+':''}${d}</span>`; };
const _renderSoProduk=renderSoProdukList;
renderSoProdukList=function(){ _renderSoProduk(); document.querySelectorAll('#soProdukList .so-produk-row').forEach((row,i)=>{ const p=soDraft.produk[i]; if(p&&p.sistem!=null) row.querySelector('.so-produk-meta').innerHTML=`Sistem ${p.sistem} · selisih <b id="hkSel-${p.sku}">${selisihTxt(p)}</b>`; }); };
const _soUpdate=soUpdateStok;
soUpdateStok=function(sku,val){ _soUpdate(sku,val); const p=soDraft.produk.find(x=>x.sku===sku), el=document.getElementById('hkSel-'+sku); if(p&&el) el.innerHTML=selisihTxt(p); };
const _soReview=renderSoReview;
renderSoReview=function(){ _soReview(); document.querySelectorAll('#soReviewProdukList .so-produk-row').forEach((row,i)=>{ const p=soDraft.produk[i]; if(p&&p.sistem!=null) row.querySelector('.so-produk-meta').innerHTML=`Sistem ${p.sistem} → fisik ${p.stok} · ${selisihTxt(p)}`; }); };
soKonfirmasiSimpan=function(){
  closeSheet('sheetKonfirmasiSO');
  const e=ev();
  soDraft.produk.forEach(p=>{ const it=hkStokRow(D.stok,p.sku); if(!it) return; const po=hkPO(it,e.nama); const d=p.stok-po.akhir; po.akhir+=d; it.akhir+=d; if(d<0) it.terbuang+=-d; p.sistem=p.stok-d; });
  D.opname.unshift({...soDraft, status:'Berhasil', tanggal:absTodayLabel(), waktu:hkIso(new Date()), lokasi:e.nama, oleh:ses.kasir});
  save('opname','stok'); loadProducts(); loadInventori();
  showToast('✓ Stok opname tersimpan, stok event disesuaikan');
  switchView('view-tambah-stokopname','view-inventori'); switchInvTab('stokopname'); renderSoList();
};
/* terima kiriman stok: kiriman hanya dibuat dari dashboard (Event › Kirim Stok). POS tidak bisa membuat mutasi sendiri. */
const mtTunggu=()=>{ const e=ev(); return e?D.mutasi.filter(m=>m.ke===e.nama&&m.status==='Dikirim'):[]; };
function terimaMutasi(m, got, catatan){ const e=ev();
  m.items.forEach(i=>{ const g=Math.max(0,Math.min(i.dikirim,got[i.sku]!=null?got[i.sku]:i.dikirim)); i.diterima=g;
    const it=hkStokRow(D.stok,i.sku); if(!it) return; const po=hkPO(it,e.nama);
    it.transit-=i.dikirim; po.masuk+=g; po.akhir+=g; const hilang=i.dikirim-g; if(hilang>0){ it.akhir-=hilang; it.terbuang+=hilang; } });
  m.status='Diterima'; m.tglTerima=hkIso(new Date()); m.penerima=ses.kasir; m.catatan=[m.catatan,catatan].filter(Boolean).join(' · ');
  save('mutasi','stok'); loadProducts(); loadInventori(); setHeader(); }
let tmNo=null;
mutasiOpenTambah=function(){ const L=mtTunggu();
  if(ev()&&ev().gudang){ showToast('Gudang Pusat tidak menerima kiriman. Kiriman dibuat dari gudang ke event lewat dashboard'); return; }
  if(!L.length){ showToast('Belum ada kiriman dari dashboard untuk tempat ini'); return; }
  hkTerimaBuka(L[0].no); };
window.hkTerimaBuka=no=>{ const m=D.mutasi.find(x=>x.no===no); if(!m||m.status!=='Dikirim') return; tmNo=no;
  document.getElementById('hkTmSub').textContent=`${m.no} · ${m.dari} → ${m.ke}`;
  document.getElementById('hkTmBody').innerHTML=`<div class="so-info-card"><div class="so-info-row"><span class="lbl">Dikirim oleh</span><span class="val">${hkEsc(m.oleh||'-')} (dashboard)</span></div>
    <div class="so-info-row"><span class="lbl">Tanggal kirim</span><span class="val">${hkTgl(m.tglKirim)} ${hkJam(m.tglKirim)}</span></div>
    <div class="so-info-row"><span class="lbl">Isi kiriman</span><span class="val">${m.items.length} barang · ${m.items.reduce((a,i)=>a+i.dikirim,0)} pcs</span></div>
    ${m.catatan?`<div class="so-info-row"><span class="lbl">Catatan</span><span class="val">${hkEsc(m.catatan)}</span></div>`:''}</div>
    <div class="so-section-label">Hitung barang yang datang</div>
    <div class="pin-hint" style="text-align:left;margin:0 0 6px;">Angka sudah terisi sesuai jumlah dikirim. Ubah kalau barang yang datang kurang. Tidak bisa lebih dari jumlah dikirim.</div>
    ${m.items.map(i=>`<div class="pt-row"><span class="pt-row-name">${hkEsc(i.nama)}<br><span style="font-size:11px;color:#8A8F87;">Dikirim ${i.dikirim} · <b id="hkTmSel-${i.sku}">lengkap</b></span></span><input type="number" min="0" max="${i.dikirim}" data-batas="jumlah dikirim" inputmode="numeric" class="hk-tm" data-sku="${i.sku}" data-kirim="${i.dikirim}" value="${i.dikirim}" style="width:76px;padding:8px;border:1px solid #DADDD6;border-radius:8px;text-align:right;font-size:15px;"></div>`).join('')}
    <div class="so-info-card" style="margin-top:12px;"><div class="so-info-row"><span class="lbl">Diterima</span><span class="val" id="hkTmTerima"></span></div><div class="so-info-row"><span class="lbl">Kurang dari kiriman</span><span class="val" id="hkTmKurang"></span></div></div>
    <div class="field" style="margin-top:12px;"><label>Catatan</label><textarea id="hkTmCatatan" rows="2" placeholder="Wajib kalau ada yang kurang. Contoh: 1 dus basah, 2 kaos tidak ada" style="width:100%;padding:10px;border:1px solid #DADDD6;border-radius:8px;font-size:14px;box-sizing:border-box;"></textarea></div>`;
  goView('view-hk-terima'); hitungTm(); };
function hitungTm(){ let t=0,k=0; document.querySelectorAll('.hk-tm').forEach(i=>{ const n=+i.dataset.kirim, g=i.value===''?0:Math.max(0,Math.min(n,+i.value||0)), d=n-g; t+=g; k+=d;
  const el=document.getElementById('hkTmSel-'+i.dataset.sku); el.textContent=d?`kurang ${d}`:'lengkap'; el.style.color=d?'#C0392B':'#1E8E4E'; i.style.borderColor=d?'#C0392B':'#DADDD6'; });
  const a=document.getElementById('hkTmTerima'); if(!a) return; a.textContent=t+' pcs'; const b=document.getElementById('hkTmKurang'); b.textContent=k+' pcs'; b.style.color=k?'#C0392B':''; }
document.addEventListener('input',e=>{ if(e.target.classList&&e.target.classList.contains('hk-tm')) hitungTm(); });
window.hkTerimaKembali=()=>{ tmNo=null; hkBukaMutasi(); };
window.hkTerimaSimpan=()=>{ const m=D.mutasi.find(x=>x.no===tmNo); if(!m||m.status!=='Dikirim'){ showToast('Kiriman ini sudah diterima atau dibatalkan'); hkTerimaKembali(); return; }
  const got={}; let kurang=0; document.querySelectorAll('.hk-tm').forEach(i=>{ const n=+i.dataset.kirim, g=i.value===''?0:Math.max(0,Math.min(n,Math.round(+i.value||0))); got[i.dataset.sku]=g; kurang+=n-g; });
  const cat=document.getElementById('hkTmCatatan').value.trim();
  if(kurang&&!cat){ showToast('Ada barang kurang. Tulis catatannya'); return; }
  terimaMutasi(m, got, cat); showToast(kurang?`✓ Diterima. ${kurang} pcs kurang dicatat hilang di perjalanan`:'✓ Kiriman diterima lengkap, stok bertambah'); hkTerimaKembali(); };
/* prototipe: simulasi kiriman seolah Admin menekan Kirim Stok di dashboard */
window.hkSimulasiKirim=()=>{ const e=ev(); if(!e||e.gudang) return;
  const pil=PRODUCTS.map(p=>({p, g:hkStokDi(D.stok,p.sku,HK_GUDANG)})).filter(x=>x.g>0).slice(0,3);
  if(!pil.length){ showToast('Stok Gudang Pusat kosong untuk produk event ini'); return; }
  const m=hkKirimStok(D, e, pil.map(x=>[x.p.sku, Math.min(5,x.g)]), 'Dimas Pratama', 'Simulasi kiriman dari dashboard');
  save('mutasi','stok'); loadInventori(); renderMutasiList(); setHeader(); showToast(`📦 ${m.no} dikirim dari dashboard (simulasi)`); };
const _switchInv=switchInvTab;
switchInvTab=function(tab){ _switchInv(tab); const b=document.getElementById('invAddBtn'); if(b) b.style.display=tab==='mutasi'?'none':''; };
document.querySelectorAll('#view-detail-mutasi .so-info-row .lbl').forEach(l=>{ const t=l.textContent.trim(); if(t==='No Faktur') l.parentElement.style.display='none'; if(t==='Outlet Asal') l.textContent='Dari'; if(t==='Outlet Tujuan') l.textContent='Ke'; });
const _renderMtList=renderMutasiList;
renderMutasiList=function(){ _renderMtList(); const el=document.getElementById('mutasiList'); if(!el) return; const e=ev(); if(!e) return;
  if(!TERIMA_MUTASI_LIST.length) el.innerHTML=`<div class="pt-list-empty">Belum ada kiriman yang diterima di ${hkEsc(e.nama)}.</div>`;
  let atas;
  if(e.gudang) atas=`<div class="hk-note" style="cursor:default;">Gudang Pusat tidak menerima kiriman di POS. Kiriman stok dibuat di dashboard dari Gudang Pusat ke event, lalu diterima kasir di event itu. Stok event kembali ke gudang otomatis saat Tutup Event.</div>`;
  else { const L=mtTunggu();
    atas=`<div class="so-section-label">Menunggu diterima (${L.length})</div>${L.length?L.map(m=>`<div class="lap-card hk-tm-card" style="margin-bottom:10px;border:1px solid #FFD2B3;cursor:pointer;" onclick="hkTerimaBuka('${m.no}')"><div class="lap-card-top"><div><div class="lap-card-buka-label">Dikirim ${hkTgl(m.tglKirim)} ${hkJam(m.tglKirim)} · ${hkEsc(m.oleh||'-')}</div><div class="lap-card-buka">${m.no}</div></div><span class="lap-status-badge open">Dikirim</span></div>
      <div class="lap-card-bottom"><div class="lap-card-kasir">${m.items.map(i=>`${i.dikirim}× ${hkEsc(i.nama)}`).join(', ')}</div><button class="lap-card-action">Terima ›</button></div></div>`).join('')
      :`<div class="hk-note" style="cursor:default;">Belum ada kiriman untuk ${hkEsc(e.nama)}. Kiriman stok hanya bisa dibuat dari dashboard: Event › detail event › Kirim Stok.</div>`}
      <button class="btn-outline" style="width:100%;margin:0 0 6px;border-style:dashed;" onclick="hkSimulasiKirim()">🧪 Simulasi: kirim stok dari dashboard</button>
      <div class="pin-hint" style="text-align:left;margin:0 0 10px;">Tombol simulasi hanya ada di prototipe, untuk mencoba alur tanpa membuka dashboard.</div>
      <div class="so-section-label">Sudah diterima</div>`; }
  el.insertAdjacentHTML('afterbegin', atas); };
mutasiSimpanDraf=function(){ showToast('Draf tidak disimpan di prototipe. Selesaikan penerimaan atau kembali.'); };
mutasiKonfirmasiVoid=function(){
  const d=mutasiCurrentDetail, m=d&&D.mutasi.find(x=>x.no===d.no), e=ev(); closeSheet('sheetVoidMutasi'); if(!m) return;
  if(m.items.some(i=>(i.diterima||0)>hkStokDi(D.stok,i.sku,e.nama))){ showToast('Tidak bisa void: sebagian barang sudah terjual'); return; }
  m.items.forEach(i=>{ const it=hkStokRow(D.stok,i.sku), po=hkPO(it,e.nama), got=i.diterima||0; po.masuk-=got; po.akhir-=got; const hilang=i.dikirim-got; if(hilang>0){ it.akhir+=hilang; it.terbuang-=hilang; } it.transit+=i.dikirim; i.diterima=null; });
  m.status='Dikirim'; m.tglTerima=null; m.penerima=null; save('mutasi','stok'); loadProducts(); loadInventori();
  showToast('Penerimaan dibatalkan, mutasi kembali ke daftar tunggu'); mutasiCloseDetail();
};

/* ════════ 11. MENU, PETUNJUK, PENGATURAN ════════ */
(function(){
  const list=document.querySelector('#sheetMainMenu .order-type-list'); const items=[...list.children];
  const find=t=>items.find(x=>x.textContent.includes(t));
  find('Penjualan').setAttribute('onclick','hkBukaRiwayat()'); find('Penjualan').querySelector('.oti-desc').textContent='Riwayat transaksi, cetak ulang, void';
  find('Inventori').querySelector('.oti-desc').textContent='Terima kiriman stok & stok opname';
  const ab=find('Absensi'); ab.setAttribute('onclick','hkBukaMasuk()'); ab.querySelector('.oti-ic').textContent='🔐'; ab.querySelector('.oti-name').textContent='Riwayat Masuk'; ab.querySelector('.oti-desc').textContent='Siapa masuk ke POS, kapan, dan di HP mana';
  find('Pengaturan').setAttribute('onclick',"closeSheet('sheetMainMenu'); setTimeout(hkBukaSetelan,240)");
  { const pg=find('Pengaturan'), gp=pg.cloneNode(true); gp.setAttribute('onclick','hkGantiPin()'); gp.querySelector('.oti-ic').textContent='🔑'; gp.querySelector('.oti-name').textContent='Ganti PIN'; const ds=gp.querySelector('.oti-desc'); if(ds) ds.textContent='Ubah PIN 6 angka Anda'; pg.parentNode.insertBefore(gp,pg); }
  find('Keluar Kasir').setAttribute('onclick',"closeSheet('sheetMainMenu'); setTimeout(()=>hkKeluar(),240)"); find('Keluar Kasir').querySelector('.oti-desc').textContent='Ganti kasir, kasir tetap terbuka';
  find('Kasir').insertAdjacentHTML('afterend',`<div class="order-type-item" id="hkMenuGanti" style="display:none;" onclick="hkGantiTempat()"><div class="oti-ic">🔀</div><div><div class="oti-name">Ganti Event / Tempat Jualan</div><div class="oti-desc">Khusus Owner, kasir sebelumnya tetap terbuka</div></div></div>`);
  find('Kunci Layar').insertAdjacentHTML('beforebegin',`<div class="order-type-item" onclick="hkMenuTutup()"><div class="oti-ic">🧮</div><div><div class="oti-name">Tutup Kasir</div><div class="oti-desc">Hitung uang laci dan setor</div></div></div>`);
  const fk=document.getElementById('catItemFaktur'); if(fk) fk.style.display='none';
  document.querySelectorAll('#moreMenu .quick-menu-item').forEach(x=>{ if(x.textContent.includes('Custom Amount')) x.style.display='none'; });
})();
window.hkKeluar=()=>keluar();
window.hkGo=id=>goView(id);
window.hkBukaSetelan=()=>{
  const p=D.pos, on=v=>v?'Aktif':'Mati';
  document.getElementById('hkSetBody').innerHTML=`<div class="so-info-card">
    <div class="so-info-row"><span class="lbl">Metode bayar</span><span class="val">${PAY_METHODS.map(m=>m.name).join(', ')}</span></div>
    <div class="so-info-row"><span class="lbl">Diskon manual kasir</span><span class="val">${p.diskonKasir?'Maks '+p.diskonMaks+'%':'Mati'}</span></div>
    <div class="so-info-row"><span class="lbl">PPN</span><span class="val">${p.pajakAktif?p.pajakPersen+'%':'Mati'}</span></div>
    <div class="so-info-row"><span class="lbl">Pembulatan</span><span class="val">${+p.pembulatan?fmt(+p.pembulatan):'Tidak ada'}</span></div>
    <div class="so-info-row"><span class="lbl">Void perlu PIN atasan</span><span class="val">${on(p.voidPin)}</span></div></div>
    <div class="pin-hint" style="margin:12px 0;">Pengaturan ini diubah dari Dashboard › Pengaturan POS dan otomatis terbaca di HP ini.</div>
    <div class="so-section-label">Perangkat</div><div class="so-info-card">
    <div class="so-info-row"><span class="lbl">Koneksi</span><span class="val">${navigator.onLine?'Online':'Offline'}</span></div>
    <div class="so-info-row"><span class="lbl">Transaksi tersimpan</span><span class="val">${D.trx.length}</span></div></div>
    <button class="btn-outline" style="width:100%;margin-top:14px;" onclick="showToast('Mencari printer Bluetooth...')">Hubungkan Printer Bluetooth</button>`;
  openSheet('sheetHkSetelan');
};
updateHint=function(){
  const h=document.getElementById('hintLine'); if(!h) return;
  const a=id=>document.getElementById(id)&&document.getElementById(id).classList.contains('active');
  h.innerHTML=a('view-hk-login')?'Masuk dengan PIN kasir, lalu buka kasir di event yang sedang berlangsung'
    :a('view-pay')?'Pilih metode bayar. Pisah Bayar untuk DP atau bayar campuran'
    :a('view-success')?'Transaksi tersimpan dan langsung muncul di dashboard'
    :a('view-home')?(cartCount()?'Ketuk total belanja untuk ubah jumlah, atau tekan Bayar':'Ketuk produk. Produk bervarian membuka pilihan ukuran')
    :'Hikayat Merchandise · POS event';
};

/* ════════ 12. OVERLAY, SINKRON, MULAI ════════ */
const _overlayFor=overlayFor;
overlayFor=id=>id.startsWith('sheetHk')?'overlayHk'+id.slice(7):_overlayFor(id);
document.getElementById('orderPill').setAttribute('onclick','hkOpenEventInfo()');
document.querySelector('#orderPill .l1').textContent='Event';
document.querySelector('.cartbar-left').setAttribute('onclick','hkOpenCart()');
document.querySelector('.cartbar-left').style.cursor='pointer';
document.querySelector('.cartbar-total-label').textContent='Total belanja · ketuk untuk ubah';

window.addEventListener('storage', e=>{
  if(!e.key||!e.key.startsWith('hk2:')) return;
  clearTimeout(window._hkSync);
  window._hkSync=setTimeout(()=>{ D=hkLoad();
    if(ses.shiftId&&(!shift()||shift().tutup)){ showToast('Kasir ini sudah ditutup dari perangkat lain'); ses.shiftId=null; keluar(); return; }
    if(!ses.shiftId){ if(document.getElementById('view-hk-login').classList.contains('active')) renderLogin(); return; }
    const typing=document.activeElement&&['INPUT','TEXTAREA'].includes(document.activeElement.tagName);
    loadAll(); setHeader(); if(!typing){ renderCatChips(); renderProductArea(); updateCartBar(); }
  },150);
});
window.addEventListener('online', setHeader); window.addEventListener('offline', setHeader);

/* pulihkan sesi (keranjang ikut kembali kalau halaman dimuat ulang) */
const s0=shift(), simpan={cart:ses.cart, customItems:ses.customItems, promo:ses.promo, customer:ses.customer};
if(ses.kasir&&s0&&!s0.tutup&&ev()&&!ev().ditutup){
  masuk(s0.id); Object.assign(ses, simpan);
  if(ses.cart){ cart={}; Object.entries(ses.cart).forEach(([id,q])=>{ if(PRODUCTS.some(p=>p.id==id)) cart[id]=q; }); }
  customItems=ses.customItems||[]; appliedPromo=ses.promo||null;
  if(ses.customer&&customers.some(c=>c.code===ses.customer)) selectCustomer(ses.customer);
  renderProductArea(); updateCartBar(); saveSes();
} else { ses.shiftId=null; keluar(); }
})();
