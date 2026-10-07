/* ════════════════════════════════════════════════════════════
   INVENTORI: Faktur Pembelian, Daftar Pemasok, Stok Opname,
   Stok Terbuang, Daftar Stok. Semua memakai data bersama (shared.js).
   Barang dari pemasok selalu masuk Gudang Pusat, lalu dikirim ke event lewat mutasi.
   ════════════════════════════════════════════════════════════ */
const IV=()=>{ state.hk.inv=state.hk.inv||{fTab:'Semua', oLok:'', oStatus:'', tJenis:'', tLok:'', sTab:'lokasi', sCari:'', sKat:'', sMin:false}; return state.hk.inv; };
const ivToday=()=>hkYmd(new Date());
const ivAwalBulan=()=>{ const d=new Date(); return hkYmd(new Date(d.getFullYear(), d.getMonth(), 1)); };
const ivCat=()=>hkCatalog(state.products);
const ivHpp=sku=>(ivCat().find(c=>c.sku===sku)||{}).hpp||0;
const ivSup=id=>state.pemasok.find(s=>s.id===id)||{nama:'-'};
const ivBadge=(t,k)=>`<span class="badge ${k}" style="white-space:nowrap;">${t}</span>`;
const FAKTUR_BADGE={'Lunas':'badge-success','Belum lunas':'badge-warn','Lewat jatuh tempo':'badge-danger','Dibatalkan':'badge-mut'};
const ivRentang=(dPath,sPath)=>`<span class="hk-sub">Dari</span><input type="date" class="hk-sel" style="width:auto;" data-hk-bind="${dPath}" data-hk-live="1" value="${hkEsc(getPath(dPath)||'')}" max="${ivToday()}"><span class="hk-sub">s/d</span><input type="date" class="hk-sel" style="width:auto;" data-hk-bind="${sPath}" data-hk-live="1" value="${hkEsc(getPath(sPath)||'')}" max="${ivToday()}">`;
const ivDalam=(ymd,dari,sampai)=>(!dari||ymd>=dari)&&(!sampai||ymd<=sampai);
function ivCsv(nama, rows){ const csv='﻿'+rows.map(r=>r.map(x=>`"${String(x==null?'':x).replace(/"/g,'""')}"`).join(',')).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=nama; a.click(); }
FORM_VIEWS['faktur-form']='faktur-list'; FORM_VIEWS['pemasok-form']='pemasok'; FORM_VIEWS['opname-gudang']='stok-opname'; FORM_VIEWS['terbuang-form']='stok-terbuang';

/* ════════ FAKTUR PEMBELIAN ════════ */
function viewFakturList(){
  const I=IV(), all=state.faktur.slice().sort((a,b)=>b.tanggal.localeCompare(a.tanggal)), tabs=['Semua','Belum lunas','Lewat jatuh tempo','Lunas','Dibatalkan'];
  const L=I.fTab==='Semua'?all:all.filter(f=>hkFakturStatus(f)===I.fTab);
  const hutang=all.reduce((a,f)=>a+hkFakturSisa(f),0), lewat=all.filter(f=>hkFakturStatus(f)==='Lewat jatuh tempo'), seminggu=hkYmd(hkAddDays(new Date(),7));
  const segera=all.filter(f=>hkFakturStatus(f)==='Belum lunas'&&f.jatuhTempo&&f.jatuhTempo<=seminggu);
  const bulan=all.filter(f=>!f.batal&&f.tanggal>=ivAwalBulan()).reduce((a,f)=>a+f.total,0);
  const rows=L.map(f=>{ const st=hkFakturStatus(f), q=f.items.reduce((a,i)=>a+i.qty,0);
    return `<tr class="hk-row-link" data-inv="f-buka" data-inv-arg="${f.no}" style="cursor:pointer;"><td>${hkTgl(f.tanggal)}</td><td><b>${f.no}</b></td><td>${hkEsc(ivSup(f.pemasokId).nama)}</td><td>${f.items.length} barang · ${q} pcs</td>
      <td class="hk-num">${f.batal?`<s>${hkRp(f.total)}</s>`:hkRp(f.total)}</td><td class="hk-num">${f.batal?'–':hkRp(hkFakturSisa(f))}</td><td>${f.jatuhTempo?hkTgl(f.jatuhTempo):'–'}</td><td>${ivBadge(st,FAKTUR_BADGE[st])}</td><td class="hk-num">›</td></tr>`; }).join('');
  return `<div class="page-head"><span class="page-title">Faktur Pembelian</span><div class="spacer"></div><button class="btn btn-primary" data-inv="f-baru">+ Tambah Faktur Pembelian</button></div>
  <div class="page-sub">Barang dari pemasok selalu masuk ke ${HK_GUDANG}. Stok gudang bertambah saat faktur disimpan, lalu dikirim ke event lewat Kirim Stok.</div>
  <div class="hk-kpis">
    <div class="metric-card"><div class="metric-label">Pembelian bulan ini</div><div class="metric-value">${hkRp(bulan)}</div></div>
    <div class="metric-card"><div class="metric-label">Belum dibayar</div><div class="metric-value" style="${hutang?'color:var(--danger-text);':''}">${hkRp(hutang)}</div><div class="hk-sub">${all.filter(f=>hkFakturSisa(f)>0).length} faktur</div></div>
    <div class="metric-card"><div class="metric-label">Lewat jatuh tempo</div><div class="metric-value" style="${lewat.length?'color:var(--danger-text);':''}">${hkRp(lewat.reduce((a,f)=>a+hkFakturSisa(f),0))}</div><div class="hk-sub">${lewat.length} faktur</div></div>
    <div class="metric-card"><div class="metric-label">Jatuh tempo 7 hari ke depan</div><div class="metric-value">${hkRp(segera.reduce((a,f)=>a+hkFakturSisa(f),0))}</div><div class="hk-sub">${segera.length} faktur</div></div>
  </div>
  <div class="tabs">${tabs.map(t=>`<div class="tab ${I.fTab===t?'active':''}" data-inv="f-tab" data-inv-arg="${t}">${t} <span class="hk-sub">${t==='Semua'?all.length:all.filter(f=>hkFakturStatus(f)===t).length}</span></div>`).join('')}</div>
  <div class="card" style="padding:0;overflow:auto;"><table><thead><tr><th>Tanggal</th><th>No. Faktur</th><th>Pemasok</th><th>Barang</th><th class="hk-num">Total</th><th class="hk-num">Sisa bayar</th><th>Jatuh tempo</th><th>Status</th><th></th></tr></thead>
  <tbody>${rows||'<tr><td colspan="9" class="hk-empty">Belum ada faktur di tab ini</td></tr>'}</tbody></table></div>`;
}
function fakturBaru(){ const d=new Date(), pre=`FA/${hkYmd(d).slice(2).replace(/-/g,'')}/`, n=state.faktur.reduce((a,f)=>Math.max(a,+f.no.split('/').pop()||0),0)+1;
  return {no:pre+String(n).padStart(4,'0'), tanggal:ivToday(), pemasokId:'', items:[], bayarStatus:'Lunas', cara:'Transfer', jatuhTempo:'', uangMuka:'', catatan:''}; }
function viewFakturForm(){
  const I=IV(); if(!I.faktur) I.faktur=fakturBaru(); const f=I.faktur, total=f.items.reduce((a,i)=>a+(+i.qty||0)*(+i.harga||0),0);
  const rows=f.items.map((i,k)=>{ const c=ivCat().find(x=>x.sku===i.sku)||{};
    return `<tr><td><b>${hkEsc(c.produk||i.nama)}</b><div class="hk-sub">${i.sku}</div></td><td>${hkEsc(c.varNama||'Tanpa varian')}</td><td class="hk-num">${gdStok(i.sku)}</td><td class="hk-num">${hkRp(c.hpp||0)}</td>
      <td class="hk-num"><input type="number" min="1" class="hk-qty" style="width:80px;" data-hk-bind="hk.inv.faktur.items.${k}.qty" value="${hkEsc(i.qty)}" data-iv-f="1"></td>
      <td class="hk-num"><input type="number" min="0" class="hk-qty" style="width:120px;" data-hk-bind="hk.inv.faktur.items.${k}.harga" value="${hkEsc(i.harga)}" placeholder="${c.hpp||0}" data-iv-f="1"></td>
      <td class="hk-num" id="ivFSub-${k}">${hkRp((+i.qty||0)*(+i.harga||0))}</td><td class="hk-num"><span class="hk-row-link" style="color:var(--danger-text);" data-inv="f-hapus" data-inv-arg="${k}">✕</span></td></tr>`; }).join('');
  const lunas=f.bayarStatus==='Lunas';
  return `${backButtonHTML()}<div class="page-head"><span class="page-title">Tambah Faktur Pembelian</span></div>
  <div class="card" style="max-width:1000px;margin:0 auto;">
    <div class="form-section-title">Informasi Faktur</div>
    <div class="field"><label>No. Faktur</label><input value="${f.no}" disabled></div>
    <div class="field"><label>Tanggal Faktur<span class="req">*</span></label><input type="date" id="ivFTgl" data-hk-bind="hk.inv.faktur.tanggal" value="${f.tanggal}" max="${ivToday()}"></div>
    <div class="field"><label>Pemasok<span class="req">*</span><div class="help-text">Belum ada di daftar? <span class="hk-row-link" style="color:var(--accent-text);font-weight:600;" data-inv="p-baru" data-inv-arg="faktur">Tambah pemasok baru</span></div></label><select id="ivFSup" data-hk-bind="hk.inv.faktur.pemasokId"><option value="">Pilih pemasok</option>${state.pemasok.map(s=>`<option value="${s.id}" ${f.pemasokId===s.id?'selected':''}>${hkEsc(s.nama)}</option>`).join('')}</select></div>
    <div class="field"><label>Masuk ke<div class="help-text">Barang pembelian selalu masuk gudang. Kirim ke event lewat Event › Kirim Stok.</div></label><input value="${HK_GUDANG}" disabled></div>
    <div class="form-section-title">Barang</div>
    <div class="card" style="padding:0;overflow:auto;" id="ivFBarang"><table class="hk-varian"><thead><tr><th>Nama Produk</th><th>Varian</th><th class="hk-num">Stok ${HK_GUDANG}</th><th class="hk-num">HPP sekarang</th><th class="hk-num">Jumlah</th><th class="hk-num">Harga Beli</th><th class="hk-num">Total</th><th></th></tr></thead><tbody>${rows}
      <tr><td colspan="8" style="padding:8px;"><button type="button" class="btn" style="width:100%;border-style:dashed;" data-inv="pilih" data-inv-arg="faktur">+ Produk</button></td></tr></tbody></table></div>
    <div class="help-text" style="margin-top:6px;">HPP produk dihitung ulang dengan rata-rata tertimbang: (stok lama × HPP lama + jumlah beli × harga beli) ÷ total stok.</div>
    <div class="form-section-title">Pembayaran</div>
    <div class="field"><label>Status Bayar<span class="req">*</span></label><div class="row-2">${['Lunas','Belum lunas'].map(k=>`<div class="hk-check ${f.bayarStatus===k?'on':''}" data-inv="f-bayar" data-inv-arg="${k}"><input type="radio" ${f.bayarStatus===k?'checked':''} style="pointer-events:none;"><div><b>${k==='Lunas'?'Lunas sekarang':'Bayar nanti (tempo)'}</b><div class="hk-sub">${k==='Lunas'?'Seluruh tagihan dibayar pada tanggal faktur':'Isi jatuh tempo, boleh dengan uang muka'}</div></div></div>`).join('')}</div></div>
    ${lunas?'':`<div class="field"><label>Jatuh Tempo<span class="req">*</span></label><input type="date" id="ivFTempo" data-hk-bind="hk.inv.faktur.jatuhTempo" value="${f.jatuhTempo||''}" min="${f.tanggal}"></div>
    <div class="field"><label>Uang Muka (Rp)<div class="help-text">Opsional. Harus lebih kecil dari total faktur.</div></label><input type="number" min="0" max="${Math.max(0,total-1)}" data-batas="total faktur" id="ivFDp" data-hk-bind="hk.inv.faktur.uangMuka" value="${hkEsc(f.uangMuka||'')}" placeholder="0"></div>`}
    <div class="field"><label>${lunas?'Cara Bayar':'Cara Bayar Uang Muka'}</label><select data-hk-bind="hk.inv.faktur.cara">${['Transfer','Tunai'].map(c=>`<option ${f.cara===c?'selected':''}>${c}</option>`).join('')}</select></div>
    <div class="field"><label>Catatan</label><textarea rows="2" data-hk-bind="hk.inv.faktur.catatan" placeholder="Opsional">${hkEsc(f.catatan||'')}</textarea></div>
    <div class="card" style="margin-top:14px;background:var(--bg);border:none;"><div style="display:flex;justify-content:space-between;font-weight:600;"><span>Total faktur</span><span id="ivFTotal">${hkRp(total)}</span></div></div>
    <div class="form-actions"><button class="btn" data-inv="f-batal">Batal</button><div class="spacer"></div><button class="btn btn-primary" data-inv="f-simpan">Simpan Faktur</button></div>
  </div>`;
}
function fakturDetailModal(){
  const m=state.hk.modal, f=state.faktur.find(x=>x.no===m.no), st=hkFakturStatus(f), sisa=hkFakturSisa(f), sup=ivSup(f.pemasokId);
  return `<div class="confirm-box hk-modal hk-page"><div class="hk-mh"><span class="close" data-hk-act="modal-close">✕</span><h4>Faktur ${f.no} ${ivBadge(st,FAKTUR_BADGE[st])}</h4></div><div class="hk-mb">
    <div class="hk-kpis" style="margin-bottom:12px;"><div class="metric-card"><div class="metric-label">Pemasok</div><div class="metric-value" style="font-size:16px;">${hkEsc(sup.nama)}</div><div class="hk-sub">${hkEsc(sup.telp||'')}</div></div>
      <div class="metric-card"><div class="metric-label">Tanggal</div><div class="metric-value" style="font-size:16px;">${hkTgl(f.tanggal)}</div><div class="hk-sub">dicatat ${hkEsc(f.oleh)}</div></div>
      <div class="metric-card"><div class="metric-label">Total</div><div class="metric-value" style="font-size:16px;">${hkRp(f.total)}</div><div class="hk-sub">dibayar ${hkRp(hkFakturDibayar(f))}</div></div>
      <div class="metric-card"><div class="metric-label">Sisa · jatuh tempo</div><div class="metric-value" style="font-size:16px;${sisa?'color:var(--danger-text);':''}">${hkRp(sisa)}</div><div class="hk-sub">${f.jatuhTempo?hkTgl(f.jatuhTempo):'–'}</div></div></div>
    ${f.batal?`<div class="hk-note" style="background:#F1F2EF;border-color:var(--border);color:var(--text-2);cursor:default;margin-bottom:12px;">Dibatalkan ${hkTgl(f.batal.waktu)} ${hkJam(f.batal.waktu)} oleh ${hkEsc(f.batal.oleh)}. Alasan: ${hkEsc(f.batal.alasan)}. Stok ${HK_GUDANG} dikurangi ${f.items.reduce((a,i)=>a+i.qty,0)} pcs.${f.batal.hpp.length?` HPP dihitung ulang: ${f.batal.hpp.map(h=>`${hkEsc(h.produk)} ${hkRp(h.lama)} → ${hkRp(h.baru)}`).join(' · ')}.`:''}${f.batal.kembali?` <b>Uang ${hkRp(f.batal.kembali)} yang sudah dibayar perlu diminta kembali ke pemasok.</b>`:''}</div>`:''}
    <table class="hk-varian"><thead><tr><th>Barang</th><th class="hk-num">Jumlah</th><th class="hk-num">Harga beli</th><th class="hk-num">Total</th></tr></thead><tbody>${f.items.map(i=>`<tr><td>${hkEsc(i.nama)}<div class="hk-sub">${i.sku}</div></td><td class="hk-num">${i.qty}</td><td class="hk-num">${hkRp(i.harga)}</td><td class="hk-num">${hkRp(i.qty*i.harga)}</td></tr>`).join('')}</tbody></table>
    <div class="hk-sub" style="margin:8px 0;">Masuk ke ${HK_GUDANG}.${(f.hpp||[]).length?` HPP diperbarui: ${f.hpp.map(h=>`${hkEsc(h.produk)} ${hkRp(h.lama)} → ${hkRp(h.baru)}`).join(' · ')}.`:''}${f.catatan?` Catatan: ${hkEsc(f.catatan)}`:''}</div>
    <div class="form-section-title">Riwayat pembayaran</div>
    ${(f.bayar||[]).length?`<table class="hk-varian"><thead><tr><th>Tanggal</th><th>Cara</th><th>Catatan</th><th>Dicatat oleh</th><th class="hk-num">Jumlah</th></tr></thead><tbody>${f.bayar.map(b=>`<tr><td>${hkTgl(b.tanggal)}</td><td>${hkEsc(b.cara)}</td><td>${hkEsc(b.catatan||'')}</td><td>${hkEsc(b.oleh)}</td><td class="hk-num">${hkRp(b.jumlah)}</td></tr>`).join('')}</tbody></table>`:'<div class="hk-sub">Belum ada pembayaran.</div>'}
    ${m.batalMode&&!f.batal?(()=>{ const kurang=hkFakturKurang(data(),f), dibayar=hkFakturDibayar(f);
      return `<div class="form-section-title">Batalkan faktur</div>${kurang.length?`<div class="hk-note" style="cursor:default;background:var(--danger-bg,#FDECEA);border-color:var(--danger-text);color:var(--danger-text);">Faktur tidak bisa dibatalkan karena sebagian barang sudah terpakai (dikirim ke event, dijual, atau terbuang): ${kurang.map(k=>`${hkEsc(k.nama)} tinggal ${k.ada} di gudang, faktur ${k.butuh}`).join(' · ')}.</div>`
      :`<div class="hk-sub" style="margin-bottom:8px;">Stok ${HK_GUDANG} akan berkurang ${f.items.reduce((a,i)=>a+i.qty,0)} pcs dan HPP dihitung ulang tanpa faktur ini. Faktur tetap tersimpan dengan status Dibatalkan.${dibayar?` Uang ${hkRp(dibayar)} yang sudah dibayar dicatat untuk diminta kembali ke pemasok.`:''}</div>
      <div class="field"><label>Alasan pembatalan<span class="req">*</span></label><textarea rows="2" id="ivFBatalAlasan" data-hk-bind="hk.modal.alasanBatal" placeholder="Contoh: salah input jumlah, barang dikembalikan ke pemasok">${hkEsc(m.alasanBatal||'')}</textarea></div>`}`; })()
    :sisa?`<div class="form-section-title">Catat pembayaran</div>
      <div class="row-2"><div class="field"><label>Jumlah (Rp)<span class="req">*</span></label><input type="number" min="1" max="${sisa}" data-batas="sisa tagihan" data-hk-bind="hk.modal.jumlah" value="${hkEsc(m.jumlah||'')}"></div><div class="field"><label>Tanggal<span class="req">*</span></label><input type="date" data-hk-bind="hk.modal.tanggal" value="${m.tanggal}" min="${f.tanggal}" max="${ivToday()}"></div></div>
      <div class="row-2"><div class="field"><label>Cara</label><select data-hk-bind="hk.modal.cara">${['Transfer','Tunai'].map(c=>`<option ${m.cara===c?'selected':''}>${c}</option>`).join('')}</select></div><div class="field"><label>Catatan</label><input data-hk-bind="hk.modal.catatan" value="${hkEsc(m.catatan||'')}" placeholder="Contoh: pelunasan"></div></div>`:''}
  </div><div class="hk-mf">${f.batal?'':m.batalMode?`<button class="btn" data-inv="f-batal-tidak">Kembali</button>`:`<button class="btn" style="color:var(--danger-text);" data-inv="f-batalkan">Batalkan faktur</button>`}<div class="spacer"></div><button class="btn" data-hk-act="modal-close">Tutup</button>${m.batalMode&&!f.batal?(hkFakturKurang(data(),f).length?'':`<button class="btn btn-danger" data-inv="f-batal-ok">Ya, batalkan faktur</button>`):sisa?`<button class="btn" data-inv="f-lunasi">Isi sisa ${hkRp(sisa)}</button><button class="btn btn-primary" data-inv="f-bayar-simpan">Simpan pembayaran</button>`:''}</div></div>`;
}

/* ════════ DAFTAR PEMASOK ════════ */
function viewPemasok(){
  const rows=state.pemasok.map(s=>{ const F=state.faktur.filter(f=>f.pemasokId===s.id), sisa=F.reduce((a,f)=>a+hkFakturSisa(f),0);
    return `<tr><td><b>${hkEsc(s.nama)}</b><div class="hk-sub">${hkEsc(s.alamat||'')}</div></td><td>${hkEsc(s.telp)}</td><td>${hkEsc(s.barang||'-')}</td><td class="hk-sub">${hkEsc(s.rekening||'-')}</td>
      <td class="hk-num">${F.length}</td><td class="hk-num">${hkRp(F.reduce((a,f)=>a+f.total,0))}</td><td class="hk-num" style="${sisa?'color:var(--danger-text);font-weight:700;':''}">${hkRp(sisa)}</td><td class="hk-num"><button class="btn" data-inv="p-ubah" data-inv-arg="${s.id}">Ubah</button></td></tr>`; }).join('');
  return `<div class="page-head"><span class="page-title">Daftar Pemasok</span><div class="spacer"></div><button class="btn btn-primary" data-inv="p-baru">+ Tambah Pemasok</button></div>
  <div class="page-sub">Pemasok dipilih saat mencatat faktur pembelian. Kolom belum dibayar menjumlahkan sisa tagihan semua faktur pemasok itu.</div>
  <div class="card" style="padding:0;overflow:auto;"><table><thead><tr><th>Nama</th><th>Telepon</th><th>Barang yang dipasok</th><th>Rekening</th><th class="hk-num">Faktur</th><th class="hk-num">Total pembelian</th><th class="hk-num">Belum dibayar</th><th></th></tr></thead>
  <tbody>${rows||'<tr><td colspan="8" class="hk-empty">Belum ada pemasok</td></tr>'}</tbody></table></div>`;
}
function viewPemasokForm(){ const p=IV().pem;
  return `${backButtonHTML()}<div class="page-head"><span class="page-title">${p.id?'Ubah Pemasok':'Tambah Pemasok'}</span></div>
  <div class="card" style="max-width:760px;margin:0 auto;">
    <div class="field"><label>Nama Pemasok<span class="req">*</span></label><input id="ivPNama" data-hk-bind="hk.inv.pem.nama" value="${hkEsc(p.nama)}" placeholder="Contoh: CV Konveksi Mitra"></div>
    <div class="field"><label>Telepon<span class="req">*</span></label><input id="ivPTelp" data-hk-bind="hk.inv.pem.telp" value="${hkEsc(p.telp)}" inputmode="tel" placeholder="08xx"></div>
    <div class="field"><label>Alamat</label><input data-hk-bind="hk.inv.pem.alamat" value="${hkEsc(p.alamat||'')}"></div>
    <div class="field"><label>Barang yang dipasok</label><input data-hk-bind="hk.inv.pem.barang" value="${hkEsc(p.barang||'')}" placeholder="Contoh: kaos, jersey"></div>
    <div class="field"><label>Rekening</label><input data-hk-bind="hk.inv.pem.rekening" value="${hkEsc(p.rekening||'')}" placeholder="Bank, nomor, atas nama"></div>
    <div class="field"><label>Catatan</label><textarea rows="2" data-hk-bind="hk.inv.pem.catatan">${hkEsc(p.catatan||'')}</textarea></div>
    <div class="form-actions"><button class="btn" data-inv="p-batal">Batal</button><div class="spacer"></div><button class="btn btn-primary" data-inv="p-simpan">Simpan</button></div>
  </div>`;
}

/* ════════ STOK OPNAME ════════ */
const SO_JENIS={'Gudang':'Opname gudang','Akhir Event':'Hitung kasir (POS)','Tutup Event':'Tutup Event'};
const SO_BADGE={'Menunggu persetujuan':'badge-warn','Perlu opname ulang':'badge-danger','Disetujui':'badge-success','Berhasil':'badge-success','Diganti':'badge-mut'};
function soDipakaiTutup(o){ return state.posOpname.find(x=>x.jenis==='Tutup Event'&&x.dariSO===o.no); }
function viewStokOpname(){
  const I=IV(); if(I.oDari==null){ I.oDari=''; I.oSampai=''; }
  const lokasi=[HK_GUDANG, ...state.events.map(e=>e.nama)];
  const L=state.posOpname.filter(o=>(!I.oLok||o.lokasi===I.oLok)&&(!I.oStatus||o.status===I.oStatus)&&ivDalam(o.waktu.slice(0,10),I.oDari,I.oSampai));
  const tunggu=state.posOpname.filter(o=>o.status==='Menunggu persetujuan');
  const rows=L.map(o=>{ const r=hkSORingkas(o), pakai=o.jenis==='Akhir Event'&&soDipakaiTutup(o);
    const st=pakai?'Dipakai Tutup Event':o.status;
    return `<tr><td>${hkTgl(o.waktu)}, ${hkJam(o.waktu)}</td><td><b>${o.no}</b></td><td>${hkEsc(o.lokasi)}</td><td>${SO_JENIS[o.jenis]||o.jenis}</td><td>${hkEsc(o.dihitungOleh||o.oleh)}</td><td>${o.disetujui?hkEsc(o.disetujui.oleh):o.jenis==='Tutup Event'?hkEsc(o.oleh):'–'}</td>
      <td>${r.kurang||r.lebih?`<span style="${r.kurang?'color:var(--danger-text);font-weight:700;':''}">kurang ${r.kurang}</span> · lebih ${r.lebih}`:'sesuai'}</td><td class="hk-num">${o.kerugian?hkRp(o.kerugian):'–'}</td><td>${ivBadge(st,pakai?'badge-mut':SO_BADGE[o.status]||'badge-mut')}</td>
      <td class="hk-num" style="white-space:nowrap;">${o.status==='Menunggu persetujuan'?`<button class="btn btn-primary" data-inv="o-periksa" data-inv-arg="${o.no}">Periksa & setujui</button>`:o.status==='Perlu opname ulang'&&o.jenis==='Gudang'?`<button class="btn" data-inv="o-baru">Hitung ulang</button>`:`<button class="btn" data-inv="o-detail" data-inv-arg="${o.no}">Detail</button>`}</td></tr>`; }).join('');
  return `<div class="page-head"><span class="page-title">Stok Opname</span><div class="spacer"></div><button class="btn" data-inv="o-csv">⭳ Unduh CSV</button><button class="btn btn-primary" data-inv="o-baru">+ Opname Gudang</button></div>
  <div class="page-sub">Semua stok opname: opname ${HK_GUDANG} dari dashboard, hitungan kasir di POS, dan opname saat Tutup Event. Hasil hitung baru mengubah stok setelah disetujui Owner/Admin, dan orang yang menghitung tidak bisa menyetujui hitungannya sendiri (kecuali Owner).</div>
  ${tunggu.length?`<div class="hk-note">${tunggu.length} opname menunggu persetujuan: ${tunggu.map(o=>`${o.no} (${hkEsc(o.lokasi)}, ${hkEsc(o.oleh)})`).join(', ')}.</div>`:''}
  <div class="toolbar" style="flex-wrap:wrap;gap:8px;"><select class="hk-sel" style="width:auto;" data-hk-bind="hk.inv.oLok" data-hk-live="1"><option value="">Semua lokasi</option>${lokasi.map(l=>`<option ${I.oLok===l?'selected':''}>${hkEsc(l)}</option>`).join('')}</select>
    <select class="hk-sel" style="width:auto;" data-hk-bind="hk.inv.oStatus" data-hk-live="1"><option value="">Semua status</option>${Object.keys(SO_BADGE).map(s=>`<option ${I.oStatus===s?'selected':''}>${s}</option>`).join('')}</select>${ivRentang('hk.inv.oDari','hk.inv.oSampai')}</div>
  <div class="card" style="padding:0;overflow:auto;"><table><thead><tr><th>Waktu</th><th>Nomor</th><th>Lokasi</th><th>Jenis</th><th>Dihitung oleh</th><th>Disetujui oleh</th><th>Selisih (pcs)</th><th class="hk-num">Kerugian</th><th>Status</th><th></th></tr></thead>
  <tbody>${rows||'<tr><td colspan="10" class="hk-empty">Belum ada stok opname pada filter ini</td></tr>'}</tbody></table></div>`;
}
function viewOpnameGudang(){
  const I=IV(); I.og=I.og||{fisik:{}, catatan:'', cari:''}; const O=I.og, q=(O.cari||'').toLowerCase();
  const pending=state.posOpname.find(o=>o.jenis==='Gudang'&&['Menunggu persetujuan','Perlu opname ulang'].includes(o.status));
  const rows=ivCat().map(c=>({c, q:gdStok(c.sku)})).filter(x=>(x.q>0||(hkStokRow(state.stokItems,x.c.sku)||{}).perOutlet)&&(!q||x.c.nama.toLowerCase().includes(q)||x.c.sku.toLowerCase().includes(q)));
  return `${backButtonHTML()}<div class="page-head"><span class="page-title">Opname ${HK_GUDANG}</span></div>
  <div class="card" style="max-width:1000px;margin:0 auto;">
    ${pending&&pending.status==='Perlu opname ulang'?`<div class="hk-note" style="background:var(--danger-bg);color:var(--danger-text);">Opname ulang diminta ${hkEsc(pending.ulang.oleh)}: "${hkEsc(pending.ulang.catatan)}"</div>`:''}
    ${pending&&pending.status==='Menunggu persetujuan'?`<div class="hk-note">Opname ${pending.no} oleh ${hkEsc(pending.oleh)} masih menunggu persetujuan. Mengirim opname baru akan menggantikannya.</div>`:''}
    <div class="help-text" style="margin-bottom:8px;">Sama dengan stok opname di POS: hitung barang di gudang dan isi stok fisik. Kosong berarti sama dengan sistem. Hasilnya dikirim untuk disetujui Owner/Admin lain; stok belum berubah sampai disetujui. Barang kurang dicatat sebagai kerugian dengan penanggung jawab.</div>
    <div class="toolbar"><input class="search-input" placeholder="Cari produk atau SKU..." data-hk-bind="hk.inv.og.cari" data-hk-live="1" value="${hkEsc(O.cari||'')}"></div>
    <div class="card" style="padding:0;overflow:auto;"><table class="hk-varian"><thead><tr><th>Nama Produk</th><th>Varian</th><th class="hk-num">Stok sistem</th><th class="hk-num">Stok fisik</th><th class="hk-num">Selisih</th><th class="hk-num">HPP</th><th class="hk-num">Kerugian</th></tr></thead><tbody>
    ${rows.map(({c,q})=>`<tr><td><b>${hkEsc(c.produk)}</b><div class="hk-sub">${c.sku}</div></td><td>${hkEsc(c.varNama||'Tanpa varian')}</td><td class="hk-num">${q}</td>
      <td class="hk-num"><input type="number" min="0" class="hk-qty iv-og" style="width:80px;" data-sku="${c.sku}" data-sistem="${q}" data-hpp="${c.hpp}" data-hk-bind="hk.inv.og.fisik.${c.sku}" value="${hkEsc(O.fisik[c.sku]==null?'':O.fisik[c.sku])}" placeholder="${q}"></td>
      <td class="hk-num" id="ivOgSel-${c.sku}">sesuai</td><td class="hk-num">${hkRp(c.hpp)}</td><td class="hk-num" id="ivOgRugi-${c.sku}">–</td></tr>`).join('')}</tbody></table></div>
    <div class="hk-sub" id="ivOgSum" style="margin:8px 0;"></div>
    <div class="field"><label>Catatan</label><textarea rows="2" data-hk-bind="hk.inv.og.catatan" placeholder="Contoh: 2 kaos S tidak ditemukan di rak">${hkEsc(O.catatan||'')}</textarea></div>
    <div class="form-actions"><button class="btn" data-nav="stok-opname">Batal</button><div class="spacer"></div><button class="btn btn-primary" data-inv="o-kirim">Kirim untuk persetujuan</button></div>
  </div>`;
}
function hitungOg(){ let k=0,l=0,rugi=0; document.querySelectorAll('.iv-og').forEach(i=>{ const q=+i.dataset.sistem, f=i.value===''?q:Math.max(0,+i.value||0), d=f-q, el=document.getElementById('ivOgSel-'+i.dataset.sku), rg=document.getElementById('ivOgRugi-'+i.dataset.sku);
  if(d<0){ k+=-d; rugi+=-d*(+i.dataset.hpp||0); } else l+=d; if(el){ el.textContent=d===0?'sesuai':(d>0?'+':'')+d; el.style.color=d<0?'var(--danger-text)':d>0?'var(--success-text)':''; el.style.fontWeight=d?'700':''; }
  if(rg) rg.textContent=d<0?hkRp(-d*(+i.dataset.hpp||0)):'–'; i.style.borderColor=d<0?'var(--danger-text)':d>0?'var(--success-text)':''; });
  const s=document.getElementById('ivOgSum'); if(s) s.innerHTML=`Barang kurang <b style="${k?'color:var(--danger-text);':''}">${k} pcs</b> · lebih <b>${l} pcs</b> · kerugian <b style="${rugi?'color:var(--danger-text);':''}">${hkRp(rugi)}</b>`; }
function soDetailModal(){ const o=state.posOpname.find(x=>x.no===state.hk.modal.no), r=hkSORingkas(o), tj=o.tanggungJawab;
  return `<div class="confirm-box hk-modal hk-page"><div class="hk-mh"><span class="close" data-hk-act="modal-close">✕</span><h4>Stok opname ${o.no} · ${hkEsc(o.lokasi)}</h4></div><div class="hk-mb">
    <div class="hk-sub" style="margin-bottom:10px;">${SO_JENIS[o.jenis]||o.jenis} · dihitung ${hkEsc(o.dihitungOleh||o.oleh)} ${hkTgl(o.waktu)} ${hkJam(o.waktu)}${o.disetujui?` · disetujui ${hkEsc(o.disetujui.oleh)} ${hkTgl(o.disetujui.waktu)} ${hkJam(o.disetujui.waktu)}`:''}${o.ulang?` · diminta ulang ${hkEsc(o.ulang.oleh)}: "${hkEsc(o.ulang.catatan)}"`:''}${o.catatan?` · "${hkEsc(o.catatan)}"`:''}</div>
    <table class="hk-varian"><thead><tr><th>Barang</th><th class="hk-num">Sistem</th><th class="hk-num">Fisik</th><th class="hk-num">Selisih</th><th class="hk-num">Kerugian</th></tr></thead><tbody>${o.produk.map(p=>`<tr><td>${hkEsc(p.nama)}<div class="hk-sub">${p.sku}</div></td><td class="hk-num">${p.sistem}</td><td class="hk-num">${p.fisik}</td><td class="hk-num" style="${p.selisih<0?'color:var(--danger-text);font-weight:700;':''}">${p.selisih>0?'+':''}${p.selisih}</td><td class="hk-num">${p.selisih<0?hkRp(-p.selisih*(p.hpp||0)):'–'}</td></tr>`).join('')}</tbody></table>
    <div class="hk-sub" style="margin-top:8px;">Kurang ${r.kurang} pcs · lebih ${r.lebih} pcs · kerugian ${hkRp(o.kerugian||r.kerugian)}${tj?` · penanggung jawab ${hkEsc(tj.pj)}: "${hkEsc(tj.alasan)}" (${hkEsc(tj.status)})`:''}</div>
  </div><div class="hk-mf"><div class="spacer"></div><button class="btn" data-hk-act="modal-close">Tutup</button></div></div>`; }

/* ════════ STOK TERBUANG ════════ */
const TB_JENIS=['Hilang di perjalanan','Selisih opname','Barang cacat (retur)','Dicatat manual'];
const TB_ALASAN=['Rusak','Hilang','Cacat dari pemasok','Berjamur atau lembap','Lainnya'];
function ivTerbuang(){
  const out=[], O=state.posOpname, dipakai=new Set(O.filter(o=>o.jenis==='Tutup Event'&&o.dariSO).map(o=>o.dariSO));
  state.mutasi.filter(m=>m.status==='Diterima'&&m.items.some(i=>(i.diterima||0)<i.dikirim)).forEach(m=>out.push({waktu:m.tglTerima, jenis:'Hilang di perjalanan', no:m.no, lokasi:m.ke,
    items:m.items.filter(i=>(i.diterima||0)<i.dikirim).map(i=>({sku:i.sku, nama:i.nama, qty:i.dikirim-(i.diterima||0)})), penjelasan:m.catatan||'Barang kurang saat diterima kasir di booth', oleh:m.penerima||'-'}));
  O.filter(o=>(o.status==='Disetujui'&&!dipakai.has(o.no)||o.jenis==='Tutup Event'||o.status==='Berhasil')&&o.produk.some(p=>p.selisih<0)).forEach(o=>out.push({waktu:o.disetujui?o.disetujui.waktu:o.waktu, jenis:'Selisih opname', no:o.no, lokasi:o.lokasi,
    items:o.produk.filter(p=>p.selisih<0).map(p=>({sku:p.sku, nama:p.nama, qty:-p.selisih})), penjelasan:(o.tanggungJawab&&o.tanggungJawab.alasan)||o.catatan||'Selisih stok opname', oleh:o.disetujui?o.disetujui.oleh:o.oleh, pj:o.tanggungJawab&&o.tanggungJawab.pj}));
  hkReturList(data()).forEach(r=>out.push({waktu:r.waktu, jenis:'Barang cacat (retur)', no:r.no, lokasi:r.lokasi, items:r.items.map(i=>({sku:i.sku, nama:i.nama, qty:i.qty})), penjelasan:r.alasan, oleh:`${r.oleh} · disetujui ${r.disetujui}`, foto:r.foto,
    trxNo:r.trx.no, penyelesaian:r.cara==='Tukar barang'?'Tukar barang sama':`Uang kembali ${hkRp(r.nilai)} (${r.metode==='Tunai'?'tunai dari laci':'transfer'})`, uang:r.cara==='Uang kembali'?r.nilai:0}));
  state.terbuang.forEach(t=>out.push({waktu:t.waktu, jenis:'Dicatat manual', no:t.no, lokasi:t.lokasi, items:t.items, penjelasan:`${t.alasan}: ${t.penjelasan}`, oleh:t.oleh, foto:t.foto, pj:t.tanggungJawab&&t.tanggungJawab.pj,
    penyelesaian:t.tanggungJawab?(t.tanggungJawab.status||'Belum diselesaikan'):''}));
  out.forEach(x=>{ x.qty=x.items.reduce((a,i)=>a+i.qty,0); x.nilai=x.items.reduce((a,i)=>a+i.qty*ivHpp(i.sku),0); });
  return out.sort((a,b)=>b.waktu.localeCompare(a.waktu)); }
function viewStokTerbuang(){
  const I=IV(); if(I.tDari==null){ I.tDari=''; I.tSampai=''; }
  const all=ivTerbuang(), L=all.filter(x=>(!I.tJenis||x.jenis===I.tJenis)&&(!I.tLok||x.lokasi===I.tLok)&&ivDalam(x.waktu.slice(0,10),I.tDari,I.tSampai));
  const lokasi=[...new Set(all.map(x=>x.lokasi))];
  return `<div class="page-head"><span class="page-title">Stok Terbuang</span><div class="spacer"></div><button class="btn" data-inv="t-csv">⭳ Unduh CSV</button><button class="btn btn-primary" data-inv="t-baru">+ Catat Barang Terbuang</button></div>
  <div class="page-sub">Semua barang yang keluar dari stok tanpa terjual, lengkap dengan penjelasannya. Tercatat otomatis dari kiriman yang kurang, selisih opname, dan retur barang cacat dari POS (beserta penyelesaiannya: tukar barang atau uang kembali). Kerusakan lain (misalnya rusak di gudang) dicatat manual dan wajib diberi penjelasan.</div>
  <div class="hk-kpis">
    <div class="metric-card"><div class="metric-label">Total terbuang</div><div class="metric-value">${L.reduce((a,x)=>a+x.qty,0)} pcs</div><div class="hk-sub">${L.length} catatan</div></div>
    <div class="metric-card"><div class="metric-label">Nilai (HPP)</div><div class="metric-value" style="color:var(--danger-text);">${hkRp(L.reduce((a,x)=>a+x.nilai,0))}</div></div>
    <div class="metric-card"><div class="metric-label">Barang cacat (retur)</div><div class="metric-value">${L.filter(x=>x.jenis==='Barang cacat (retur)').reduce((a,x)=>a+x.qty,0)} pcs</div><div class="hk-sub">uang kembali ${hkRp(L.reduce((a,x)=>a+(x.uang||0),0))}</div></div>
    <div class="metric-card"><div class="metric-label">Paling sering terbuang</div>${(()=>{ const per={}; L.forEach(x=>x.items.forEach(i=>per[i.nama]=(per[i.nama]||0)+i.qty)); const t=Object.entries(per).sort((a,b)=>b[1]-a[1])[0]; return t?`<div class="metric-value" style="font-size:16px;">${hkEsc(t[0])}</div><div class="hk-sub">${t[1]} pcs</div>`:'<div class="metric-value">–</div>'; })()}</div>
  </div>
  <div class="toolbar" style="flex-wrap:wrap;gap:8px;"><select class="hk-sel" style="width:auto;" data-hk-bind="hk.inv.tJenis" data-hk-live="1"><option value="">Semua jenis</option>${TB_JENIS.map(j=>`<option ${I.tJenis===j?'selected':''}>${j}</option>`).join('')}</select>
    <select class="hk-sel" style="width:auto;" data-hk-bind="hk.inv.tLok" data-hk-live="1"><option value="">Semua lokasi</option>${lokasi.map(l=>`<option ${I.tLok===l?'selected':''}>${hkEsc(l)}</option>`).join('')}</select>${ivRentang('hk.inv.tDari','hk.inv.tSampai')}</div>
  <div class="card" style="padding:0;overflow:auto;"><table><thead><tr><th>Waktu</th><th>Jenis</th><th>Sumber</th><th>Lokasi</th><th>Barang</th><th class="hk-num">Nilai</th><th>Penjelasan</th><th>Penyelesaian</th><th>Dicatat oleh</th></tr></thead><tbody>
  ${L.map(x=>`<tr><td>${hkTgl(x.waktu)}<div class="hk-sub">${hkJam(x.waktu)}</div></td><td>${ivBadge(x.jenis,x.jenis==='Dicatat manual'?'badge-info':x.jenis==='Barang cacat (retur)'?'badge-warn':'badge-danger')}</td><td>${x.no}</td><td>${hkEsc(x.lokasi)}</td>
    <td>${x.items.map(i=>`${i.qty}× ${hkEsc(i.nama)}`).join('<br>')}</td><td class="hk-num">${hkRp(x.nilai)}</td><td style="max-width:280px;">${hkEsc(x.penjelasan)}${x.pj?`<div class="hk-sub">Penanggung jawab: ${hkEsc(x.pj)}</div>`:''}${x.foto?`<div><img src="${x.foto}" style="max-width:56px;border-radius:8px;margin-top:4px;"></div>`:''}</td><td>${x.penyelesaian?`${hkEsc(x.penyelesaian)}<div class="hk-sub">${x.trxNo?`dari ${x.trxNo}`:'di Selisih & Kerugian'}</div>`:'–'}</td><td>${hkEsc(x.oleh)}</td></tr>`).join('')||'<tr><td colspan="9" class="hk-empty">Tidak ada barang terbuang pada filter ini</td></tr>'}
  </tbody></table></div>`;
}
function viewTerbuangForm(){
  const I=IV(); const t=I.tb; const L=[HK_GUDANG, ...state.events.filter(e=>!e.ditutup).map(e=>e.nama)];
  if(t.pjLok!==t.lokasi){ const ev=state.events.find(e=>e.nama===t.lokasi); if(ev&&ev.pj) t.pj=ev.pj; t.pjLok=t.lokasi; }
  const rows=t.items.map((i,k)=>{ const c=ivCat().find(x=>x.sku===i.sku)||{}, st=hkStokDi(state.stokItems,i.sku,t.lokasi);
    return `<tr><td><b>${hkEsc(c.produk||i.nama)}</b><div class="hk-sub">${i.sku}</div></td><td>${hkEsc(c.varNama||'Tanpa varian')}</td><td class="hk-num">${st}</td><td class="hk-num">${hkRp(c.hpp||0)}</td>
      <td class="hk-num"><input type="number" min="1" max="${st}" data-batas="stok ${hkEsc(t.lokasi)}" class="hk-qty" style="width:80px;" data-hk-bind="hk.inv.tb.items.${k}.qty" value="${hkEsc(i.qty)}"></td><td class="hk-num"><span class="hk-row-link" style="color:var(--danger-text);" data-inv="t-hapus" data-inv-arg="${k}">✕</span></td></tr>`; }).join('');
  return `${backButtonHTML()}<div class="page-head"><span class="page-title">Catat Barang Terbuang</span></div>
  <div class="card" style="max-width:1000px;margin:0 auto;">
    <div class="field"><label>Lokasi<span class="req">*</span></label><select id="ivTLok" data-hk-bind="hk.inv.tb.lokasi" data-hk-live="1">${L.map(l=>`<option ${t.lokasi===l?'selected':''}>${hkEsc(l)}</option>`).join('')}</select></div>
    <div class="field"><label>Tanggal<span class="req">*</span></label><input type="date" data-hk-bind="hk.inv.tb.tanggal" value="${t.tanggal}" max="${ivToday()}"></div>
    <div class="field"><label>Alasan<span class="req">*</span></label><select id="ivTAlasan" data-hk-bind="hk.inv.tb.alasan"><option value="">Pilih alasan</option>${TB_ALASAN.map(a=>`<option ${t.alasan===a?'selected':''}>${a}</option>`).join('')}</select></div>
    <div class="field"><label>Penjelasan<span class="req">*</span></label><textarea rows="3" id="ivTPenj" data-hk-bind="hk.inv.tb.penjelasan" placeholder="Ceritakan apa yang terjadi, kapan diketahui, dan siapa yang menemukan">${hkEsc(t.penjelasan||'')}</textarea></div>
    <div class="field"><label>Penanggung Jawab<span class="req">*</span></label><div><select id="ivTPj" data-hk-bind="hk.inv.tb.pj"><option value="">Pilih penanggung jawab</option>${state.staff.filter(x=>x.aktif!==false).map(x=>`<option ${t.pj===x.nama?'selected':''} value="${hkEsc(x.nama)}">${hkEsc(x.nama)} · ${x.role.join(', ')}</option>`).join('')}</select><div class="help-text">Kerugian (jumlah × HPP) tercatat atas nama orang ini di Laporan › Selisih & Kerugian dan harus diselesaikan: diganti atau dibebankan ke perusahaan. Untuk lokasi event, terisi otomatis dengan penanggung jawab event.</div></div></div>
    <div class="form-section-title">Barang</div>
    <div class="card" style="padding:0;overflow:auto;" id="ivTBarang"><table class="hk-varian"><thead><tr><th>Nama Produk</th><th>Varian</th><th class="hk-num">Stok ${hkEsc(t.lokasi)}</th><th class="hk-num">HPP</th><th class="hk-num">Jumlah</th><th></th></tr></thead><tbody>${rows}
      <tr><td colspan="6" style="padding:8px;"><button type="button" class="btn" style="width:100%;border-style:dashed;" data-inv="pilih" data-inv-arg="terbuang">+ Produk</button></td></tr></tbody></table></div>
    <div class="field" style="margin-top:12px;"><label>Foto<div class="help-text">Opsional</div></label><div><input type="file" accept="image/*" id="ivTFoto">${t.foto?`<div><img src="${t.foto}" style="max-width:120px;border-radius:8px;margin-top:6px;"></div>`:''}</div></div>
    <div class="help-text">Stok di lokasi itu langsung berkurang saat disimpan. Catatan tidak bisa diubah setelah disimpan.</div>
    <div class="form-actions"><button class="btn" data-nav="stok-terbuang">Batal</button><div class="spacer"></div><button class="btn btn-primary" data-inv="t-simpan">Simpan</button></div>
  </div>`;
}

/* ════════ DAFTAR STOK ════════ */
function viewDaftarStok(){
  const I=IV(); if(I.sDari==null){ I.sDari=ivAwalBulan(); I.sSampai=ivToday(); }
  const evs=state.events.filter(e=>!e.ditutup), q=(I.sCari||'').toLowerCase();
  const prodOf=sku=>state.products.find(p=>p.sku===sku||(p.varian||[]).some(v=>v.sku===sku))||{};
  let L=ivCat().filter(c=>(!q||c.nama.toLowerCase().includes(q)||c.sku.toLowerCase().includes(q))&&(!I.sKat||c.kategori===I.sKat)).map(c=>{ const it=hkStokRow(state.stokItems,c.sku)||{}, g=gdStok(c.sku), per=evs.map(e=>hkStokDi(state.stokItems,c.sku,e.nama)), tr=it.transit||0;
    const total=g+per.reduce((a,b)=>a+b,0)+tr, min=+prodOf(c.sku).stokMin||0; return {c, g, per, tr, total, min, kurang:min&&total<min}; });
  if(I.sMin) L=L.filter(x=>x.kurang);
  const kats=[...new Set(ivCat().map(c=>c.kategori))], nKurang=ivCat().length?L.filter(x=>x.kurang).length:0;
  const tab=t=>`<div class="tab ${I.sTab===t[0]?'active':''}" data-inv="s-tab" data-inv-arg="${t[0]}">${t[1]}</div>`;
  const filter=`<div class="toolbar" style="flex-wrap:wrap;gap:8px;"><input class="search-input" style="max-width:260px;" placeholder="Cari SKU atau nama..." data-hk-bind="hk.inv.sCari" data-hk-live="1" value="${hkEsc(I.sCari||'')}">
    <select class="hk-sel" style="width:auto;" data-hk-bind="hk.inv.sKat" data-hk-live="1"><option value="">Semua kategori</option>${kats.map(k=>`<option ${I.sKat===k?'selected':''}>${hkEsc(k)}</option>`).join('')}</select>
    ${I.sTab==='lokasi'?`<label class="hk-check ${I.sMin?'on':''}" style="padding:6px 10px;" data-inv="s-min"><input type="checkbox" ${I.sMin?'checked':''} style="pointer-events:none;"><span>Hanya di bawah stok minimum</span></label>`:ivRentang('hk.inv.sDari','hk.inv.sSampai')}</div>`;
  let body;
  if(I.sTab==='lokasi'){
    const sum=k=>L.reduce((a,x)=>a+x[k],0);
    body=`<div class="card" style="padding:0;overflow:auto;"><table><thead><tr><th>SKU</th><th>Nama</th><th class="hk-num">${HK_GUDANG}</th>${evs.map(e=>`<th class="hk-num">${hkEsc(e.nama)}</th>`).join('')}<th class="hk-num">Dalam perjalanan</th><th class="hk-num">Total</th><th class="hk-num">Stok min</th><th>Status</th></tr></thead><tbody>
      ${L.map(x=>`<tr><td>${x.c.sku}</td><td>${hkEsc(x.c.nama)}</td><td class="hk-num">${x.g}</td>${x.per.map(n=>`<td class="hk-num">${n||'–'}</td>`).join('')}<td class="hk-num">${x.tr||'–'}</td><td class="hk-num"><b>${x.total}</b></td><td class="hk-num">${x.min||'–'}</td><td>${x.kurang?ivBadge('Di bawah minimum','badge-danger'):x.total===0?ivBadge('Habis','badge-mut'):ivBadge('Aman','badge-success')}</td></tr>`).join('')||`<tr><td colspan="${6+evs.length}" class="hk-empty">Tidak ada barang pada filter ini</td></tr>`}
      ${L.length?`<tr style="font-weight:700;background:var(--bg);"><td colspan="2">Total</td><td class="hk-num">${sum('g')}</td>${evs.map((e,k)=>`<td class="hk-num">${L.reduce((a,x)=>a+x.per[k],0)}</td>`).join('')}<td class="hk-num">${sum('tr')}</td><td class="hk-num">${sum('total')}</td><td colspan="2"></td></tr>`:''}</tbody></table></div>`;
  } else {
    const D=data(), dari=I.sDari, sampai=I.sSampai;
    const masuk={}, kirim={}, jual={}, buang={};
    state.faktur.filter(f=>!f.batal&&ivDalam(f.tanggal,dari,sampai)).forEach(f=>f.items.forEach(i=>masuk[i.sku]=(masuk[i.sku]||0)+i.qty));
    state.mutasi.filter(m=>m.status!=='Batal'&&ivDalam(m.tglKirim.slice(0,10),dari,sampai)).forEach(m=>m.items.forEach(i=>kirim[i.sku]=(kirim[i.sku]||0)+i.dikirim));
    hkSales(D,dari,sampai).forEach(s=>s.items.forEach(i=>{ if(i.sku) jual[i.sku]=(jual[i.sku]||0)+i.qty; }));
    ivTerbuang().filter(x=>ivDalam(x.waktu.slice(0,10),dari,sampai)).forEach(x=>x.items.forEach(i=>buang[i.sku]=(buang[i.sku]||0)+i.qty));
    body=`<div class="card" style="padding:0;overflow:auto;"><table><thead><tr><th>SKU</th><th>Nama</th><th class="hk-num">Masuk (pembelian)</th><th class="hk-num">Dikirim ke event</th><th class="hk-num">Terjual</th><th class="hk-num">Hilang & rusak</th><th class="hk-num">Stok sekarang</th></tr></thead><tbody>
      ${L.map(x=>`<tr><td>${x.c.sku}</td><td>${hkEsc(x.c.nama)}</td><td class="hk-num">${masuk[x.c.sku]||'–'}</td><td class="hk-num">${kirim[x.c.sku]||'–'}</td><td class="hk-num">${jual[x.c.sku]||'–'}</td><td class="hk-num" style="${buang[x.c.sku]?'color:var(--danger-text);':''}">${buang[x.c.sku]||'–'}</td><td class="hk-num"><b>${x.total}</b></td></tr>`).join('')}</tbody></table></div>
      <div class="hk-sub" style="margin-top:6px;">Terjual mencakup event, gudang, dan marketplace, dikurangi retur uang kembali. Hilang & rusak dari halaman Stok Terbuang.</div>`;
  }
  return `<div class="page-head"><span class="page-title">Daftar Stok</span><div class="spacer"></div><button class="btn" data-inv="s-csv">⭳ Unduh CSV</button></div>
  <div class="page-sub">Stok per lokasi: ${HK_GUDANG}, setiap event yang masih berjalan, dan barang yang sedang dikirim. ${nKurang?`<b style="color:var(--danger-text);">${nKurang} barang di bawah stok minimum.</b>`:''}</div>
  <div class="tabs">${tab(['lokasi','Per lokasi'])}${tab(['gerak','Pergerakan'])}</div>${filter}${body}`;
}

/* ════════ ROUTING, MODAL, PEMILIH PRODUK ════════ */
const _renderMainInv=renderMain;
renderMain=function(){ const m=document.getElementById('main'), v=state.view, V={'faktur-list':viewFakturList,'faktur-form':viewFakturForm,'pemasok':viewPemasok,'pemasok-form':viewPemasokForm,'stok-opname':viewStokOpname,'opname-gudang':viewOpnameGudang,'stok-terbuang':viewStokTerbuang,'terbuang-form':viewTerbuangForm,'daftar-stok':viewDaftarStok};
  if(V[v]){ if(v==='pemasok-form'&&!IV().pem) state.view='pemasok'; if(v==='terbuang-form'&&!IV().tb) state.view='stok-terbuang'; m.innerHTML=(V[state.view])(); if(state.view==='opname-gudang') hitungOg(); } else _renderMainInv(); };
const _renderHkModalInv=renderHkModal;
renderHkModal=function(){ const m=state.hk.modal; if(m&&(m.type==='faktur'||m.type==='sodetail')){ modalRoot.classList.add('open'); modalRoot.innerHTML=m.type==='faktur'?fakturDetailModal():soDetailModal(); return; } _renderHkModalInv(); };
const _pilihDefInv=pilihDef;
pilihDef=function(M){
  const varRow=(c,extra)=>({key:c.sku, cari:(c.nama+' '+c.sku).toLowerCase(), cells:[`<b>${hkEsc(c.produk)}</b><div class="hk-sub">${c.sku}</div>`, hkEsc(c.varNama||'Tanpa varian'), ...extra]});
  if(M.ctx==='faktur'){ const f=IV().faktur;
    return {judul:'Pilih barang yang dibeli', cols:['Nama Produk','Varian','HPP sekarang',`Stok ${HK_GUDANG}`], help:'Jumlah dan harga beli diisi di tabel faktur.',
      rows:ivCat().filter(c=>c.aktif).map(c=>varRow(c,[hkRp(c.hpp), gdStok(c.sku)])),
      simpan:keys=>{ const lama=f.items.filter(i=>keys.includes(i.sku)); keys.filter(k=>!lama.some(i=>i.sku===k)).forEach(k=>lama.push({sku:k, nama:(ivCat().find(c=>c.sku===k)||{}).nama, qty:'', harga:''})); f.items=lama; } }; }
  if(M.ctx==='terbuang'){ const t=IV().tb;
    return {judul:`Pilih barang yang terbuang di ${hkEsc(t.lokasi)}`, cols:['Nama Produk','Varian',`Stok ${hkEsc(t.lokasi)}`,'HPP'], help:'Hanya barang yang masih ada stoknya di lokasi ini.',
      rows:ivCat().filter(c=>hkStokDi(state.stokItems,c.sku,t.lokasi)>0).map(c=>varRow(c,[hkStokDi(state.stokItems,c.sku,t.lokasi), hkRp(c.hpp)])),
      simpan:keys=>{ const lama=t.items.filter(i=>keys.includes(i.sku)); keys.filter(k=>!lama.some(i=>i.sku===k)).forEach(k=>lama.push({sku:k, nama:(ivCat().find(c=>c.sku===k)||{}).nama, qty:1})); t.items=lama; } }; }
  return _pilihDefInv(M); };

/* total faktur & selisih opname dihitung langsung saat mengetik */
document.addEventListener('input',e=>{ const t=e.target; if(!t.classList) return;
  if(t.classList.contains('iv-og')) hitungOg();
  if(t.hasAttribute('data-iv-f')){ const f=IV().faktur; if(!f) return; let tot=0; f.items.forEach((i,k)=>{ const s=(+i.qty||0)*(+i.harga||0); tot+=s; const el=document.getElementById('ivFSub-'+k); if(el) el.textContent=hkRp(s); }); const el=document.getElementById('ivFTotal'); if(el) el.textContent=hkRp(tot); const dp=document.getElementById('ivFDp'); if(dp) dp.max=Math.max(0,tot-1); }
  if(t.classList.contains('hk-invalid')) t.classList.remove('hk-invalid'); });
document.addEventListener('change',e=>{ if(e.target.id!=='ivTFoto') return; const fl=e.target.files[0]; if(!fl) return; const img=new Image(); img.onload=()=>{ const k=Math.min(1,480/Math.max(img.width,img.height)), cv=document.createElement('canvas'); cv.width=img.width*k; cv.height=img.height*k; cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height); IV().tb.foto=cv.toDataURL('image/jpeg',.6); render(); }; img.src=URL.createObjectURL(fl); });

const ivTandai=(ids,msg)=>{ document.querySelectorAll('.hk-invalid').forEach(x=>x.classList.remove('hk-invalid')); ids.forEach(id=>{ const el=document.getElementById(id); if(el) el.classList.add('hk-invalid'); }); const f=document.querySelector('.hk-invalid'); if(f) f.scrollIntoView({block:'center',behavior:'smooth'}); toast(msg); };
const ivOwner=()=>{ const a=akun(); return !!a&&a.role.includes('Owner'); };

document.addEventListener('click',e=>{
  const el=e.target.closest('[data-inv]'); if(!el) return; const act=el.getAttribute('data-inv'), arg=el.getAttribute('data-inv-arg'), I=IV(), H=state.hk;
  switch(act){
    /* faktur */
    case 'f-tab': I.fTab=arg; render(); break;
    case 'f-baru': I.faktur=fakturBaru(); state.view='faktur-form'; render(); break;
    case 'f-batal': I.faktur=null; state.view='faktur-list'; render(); break;
    case 'f-hapus': I.faktur.items.splice(+arg,1); render(); break;
    case 'f-bayar': I.faktur.bayarStatus=arg; render(); break;
    case 'f-simpan': { const f=I.faktur, salah=[]; let msg='';
      const add=(c,id,m)=>{ if(c){ salah.push(id); msg=msg||m; } };
      add(!f.tanggal,'ivFTgl','Isi tanggal faktur'); add(!f.pemasokId,'ivFSup','Pilih pemasok');
      add(!f.items.length,'ivFBarang','Tambahkan barang lewat + Produk');
      add(f.items.some(i=>!(+i.qty>0)),'ivFBarang','Isi jumlah setiap barang'); add(f.items.some(i=>!(+i.harga>0)),'ivFBarang','Isi harga beli setiap barang');
      const total=f.items.reduce((a,i)=>a+(+i.qty||0)*(+i.harga||0),0), dp=+f.uangMuka||0;
      if(f.bayarStatus!=='Lunas'){ add(!f.jatuhTempo,'ivFTempo','Isi tanggal jatuh tempo'); add(f.jatuhTempo&&f.jatuhTempo<f.tanggal,'ivFTempo','Jatuh tempo tidak boleh sebelum tanggal faktur'); add(dp>=total&&total>0,'ivFDp','Uang muka harus lebih kecil dari total. Pilih Lunas kalau dibayar penuh'); }
      if(salah.length){ ivTandai(salah, salah.length>1?`${msg}. Masih ada isian lain yang ditandai merah`:msg); return; }
      const rec={no:f.no, tanggal:f.tanggal, pemasokId:f.pemasokId, items:f.items.map(i=>({sku:i.sku, nama:i.nama, qty:Math.round(+i.qty), harga:Math.round(+i.harga)})), total, jatuhTempo:f.bayarStatus==='Lunas'?null:f.jatuhTempo, catatan:(f.catatan||'').trim(), oleh:akunNama(), waktu:hkIso(new Date()),
        bayar:f.bayarStatus==='Lunas'?[{tanggal:f.tanggal, jumlah:total, cara:f.cara, catatan:'Lunas saat faktur dicatat', oleh:akunNama()}]:dp>0?[{tanggal:f.tanggal, jumlah:dp, cara:f.cara, catatan:'Uang muka', oleh:akunNama()}]:[]};
      hkTerimaFaktur(data(), rec); I.faktur=null; hkSaveAll(data()); state.view='faktur-list'; render();
      toast(`${rec.no} tersimpan. ${rec.items.reduce((a,i)=>a+i.qty,0)} pcs masuk ${HK_GUDANG}${rec.hpp.length?`, HPP ${rec.hpp.map(h=>h.produk).join(', ')} diperbarui`:''}`); break; }
    case 'f-buka': H.modal={type:'faktur', no:arg, jumlah:'', tanggal:ivToday(), cara:'Transfer', catatan:''}; render(); break;
    case 'f-batalkan': H.modal.batalMode=true; H.modal.alasanBatal=''; render(); break;
    case 'f-batal-tidak': H.modal.batalMode=false; render(); break;
    case 'f-batal-ok': { const M=H.modal, f=state.faktur.find(x=>x.no===M.no), al=(M.alasanBatal||'').trim();
      if(hkFakturKurang(data(),f).length){ toast('Sebagian barang sudah terpakai, faktur tidak bisa dibatalkan'); return; }
      if(al.length<5){ ivTandai(['ivFBatalAlasan'],'Tulis alasan pembatalan'); return; }
      hkBatalFaktur(data(), f, al, akunNama()); M.batalMode=false; hkSaveAll(data()); render();
      toast(`${f.no} dibatalkan. Stok ${HK_GUDANG} berkurang ${f.items.reduce((a,i)=>a+i.qty,0)} pcs${f.batal.hpp.length?', HPP dihitung ulang':''}`); break; }
    case 'f-lunasi': { const f=state.faktur.find(x=>x.no===H.modal.no); H.modal.jumlah=String(hkFakturSisa(f)); render(); break; }
    case 'f-bayar-simpan': { const M=H.modal, f=state.faktur.find(x=>x.no===M.no), j=Math.round(+M.jumlah||0), sisa=hkFakturSisa(f);
      if(!(j>0)){ toast('Isi jumlah pembayaran'); return; } if(j>sisa){ toast(`Maksimal ${hkRp(sisa)} (sisa tagihan)`); return; } if(!M.tanggal){ toast('Isi tanggal pembayaran'); return; }
      f.bayar.push({tanggal:M.tanggal, jumlah:j, cara:M.cara, catatan:(M.catatan||'').trim(), oleh:akunNama()}); hkSaveAll(data());
      M.jumlah=''; M.catatan=''; render(); toast(hkFakturSisa(f)?`Pembayaran ${hkRp(j)} tercatat. Sisa ${hkRp(hkFakturSisa(f))}`:`Faktur ${f.no} lunas`); break; }
    /* pemasok */
    case 'p-baru': I.pem={id:null, nama:'', telp:'', alamat:'', barang:'', rekening:'', catatan:''}; I.pemBalik=arg==='faktur'?'faktur-form':'pemasok'; FORM_VIEWS['pemasok-form']=I.pemBalik; state.view='pemasok-form'; render(); break;
    case 'p-ubah': I.pem={...state.pemasok.find(s=>s.id===arg)}; I.pemBalik='pemasok'; FORM_VIEWS['pemasok-form']='pemasok'; state.view='pemasok-form'; render(); break;
    case 'p-batal': state.view=I.pemBalik||'pemasok'; I.pem=null; render(); break;
    case 'p-simpan': { const p=I.pem, nama=(p.nama||'').trim(), salah=[];
      if(!nama) salah.push('ivPNama'); if(!(p.telp||'').trim()) salah.push('ivPTelp');
      if(salah.length){ ivTandai(salah, !nama?'Isi nama pemasok':'Isi nomor telepon pemasok'); return; }
      if(state.pemasok.some(s=>s.nama.toLowerCase()===nama.toLowerCase()&&s.id!==p.id)){ ivTandai(['ivPNama'],'Nama pemasok sudah ada'); return; }
      let id=p.id; if(id) Object.assign(state.pemasok.find(s=>s.id===id),{...p, nama}); else { id='sup'+Date.now(); state.pemasok.push({...p, id, nama}); }
      hkSaveAll(data()); if(I.pemBalik==='faktur-form'&&I.faktur) I.faktur.pemasokId=id; state.view=I.pemBalik||'pemasok'; I.pem=null; render(); toast(`Pemasok ${nama} tersimpan`); break; }
    /* opname */
    case 'o-baru': I.og={fisik:{}, catatan:'', cari:''}; state.view='opname-gudang'; render(); break;
    case 'o-kirim': { const O=I.og, cat=ivCat(), produk=cat.map(c=>{ const q=gdStok(c.sku), v=O.fisik[c.sku], f=v==null||v===''?q:Math.max(0,Math.round(+v||0)); return {sku:c.sku, nama:c.nama, sistem:q, fisik:f, selisih:f-q, hpp:c.hpp, kerugian:Math.max(0,q-f)*c.hpp}; }).filter(p=>p.sistem>0||p.fisik>0);
      if(!produk.length){ toast('Tidak ada barang di gudang'); return; }
      const ada=produk.some(p=>p.selisih); if(ada&&!(O.catatan||'').trim()){ toast('Ada selisih. Tulis catatannya dulu'); return; }
      state.posOpname.filter(o=>o.jenis==='Gudang'&&['Menunggu persetujuan','Perlu opname ulang'].includes(o.status)).forEach(o=>o.status='Diganti');
      const pre='SO/'+hkYmd(new Date()).slice(2).replace(/-/g,'')+'/', n=state.posOpname.filter(o=>o.no.startsWith(pre)).reduce((a,o)=>Math.max(a,+o.no.slice(pre.length)||0),0)+1;
      const so={no:pre+String(n).padStart(2,'0'), jenis:'Gudang', eventId:HK_GUDANG_ID, lokasi:HK_GUDANG, status:'Menunggu persetujuan', waktu:hkIso(new Date()), tanggal:hkTgl(new Date()), oleh:akunNama(), catatan:(O.catatan||'').trim(), produk, kerugian:produk.reduce((a,p)=>a+p.kerugian,0)};
      state.posOpname.unshift(so); I.og=null; hkSaveAll(data()); state.view='stok-opname'; render(); const r=hkSORingkas(so); toast(`Opname ${so.no} terkirim${r.kurang?` · kurang ${r.kurang} pcs`:''}. Menunggu persetujuan Owner/Admin lain`); break; }
    case 'o-periksa': { const so=state.posOpname.find(o=>o.no===arg), e=so.eventId===HK_GUDANG_ID?null:evById(so.eventId);
      if(so.oleh===akunNama()&&!ivOwner()){ toast('Opname ini dihitung oleh Anda. Minta Owner atau Admin lain yang menyetujui'); return; }
      H.modal={type:'sosetuju', no:so.no, soNo:so.no, pj:(e&&e.pj)||so.oleh, alasan:so.catatan||'', ulang:''}; render(); break; }
    case 'o-detail': H.modal={type:'sodetail', no:arg}; render(); break;
    case 'o-csv': ivCsv('stok-opname.csv',[['Waktu','Nomor','Lokasi','Jenis','Dihitung oleh','Disetujui oleh','Kurang','Lebih','Kerugian','Status'],...state.posOpname.map(o=>{ const r=hkSORingkas(o); return [o.waktu,o.no,o.lokasi,SO_JENIS[o.jenis]||o.jenis,o.dihitungOleh||o.oleh,o.disetujui?o.disetujui.oleh:'',r.kurang,r.lebih,o.kerugian||0,o.status]; })]); break;
    /* terbuang */
    case 't-baru': I.tb={lokasi:HK_GUDANG, tanggal:ivToday(), alasan:'', penjelasan:'', items:[], foto:null}; state.view='terbuang-form'; render(); break;
    case 't-hapus': I.tb.items.splice(+arg,1); render(); break;
    case 't-simpan': { const t=I.tb, salah=[]; let msg=''; const add=(c,id,m)=>{ if(c){ salah.push(id); msg=msg||m; } };
      add(!t.alasan,'ivTAlasan','Pilih alasan'); add(!t.pj,'ivTPj','Pilih penanggung jawab'); add((t.penjelasan||'').trim().length<10,'ivTPenj','Tulis penjelasan yang jelas (minimal 10 huruf)'); add(!t.items.length,'ivTBarang','Tambahkan barang lewat + Produk');
      add(t.items.some(i=>!(+i.qty>0)||+i.qty>hkStokDi(state.stokItems,i.sku,t.lokasi)),'ivTBarang','Jumlah harus 1 sampai stok yang ada');
      if(salah.length){ ivTandai(salah, salah.length>1?`${msg}. Masih ada isian lain yang ditandai merah`:msg); return; }
      const pre='ST/'+hkYmd(new Date()).slice(2).replace(/-/g,'')+'/', n=state.terbuang.reduce((a,x)=>Math.max(a,+x.no.split('/').pop()||0),0)+1;
      const rec={no:pre+String(n).padStart(4,'0'), tanggal:t.tanggal, waktu:t.tanggal===ivToday()?hkIso(new Date()):t.tanggal+'T12:00', lokasi:t.lokasi, alasan:t.alasan, penjelasan:t.penjelasan.trim(), items:t.items.map(i=>({sku:i.sku, nama:i.nama, qty:Math.round(+i.qty)})), oleh:akunNama(), foto:t.foto};
      rec.kerugian=rec.items.reduce((a,i)=>a+i.qty*ivHpp(i.sku),0); rec.tanggungJawab={pj:t.pj, alasan:`${rec.alasan}: ${rec.penjelasan}`, riwayat:[]};
      rec.items.forEach(i=>{ const it=hkStokRow(state.stokItems,i.sku), p=hkPO(it,rec.lokasi); p.akhir-=i.qty; it.akhir-=i.qty; p.terbuang=(p.terbuang||0)+i.qty; it.terbuang=(it.terbuang||0)+i.qty; });
      state.terbuang.unshift(rec); I.tb=null; hkSaveAll(data()); state.view='stok-terbuang'; render(); toast(`${rec.no} tercatat. Stok ${rec.lokasi} berkurang ${rec.items.reduce((a,i)=>a+i.qty,0)} pcs`); break; }
    case 't-csv': ivCsv('stok-terbuang.csv',[['Waktu','Jenis','Sumber','Lokasi','Barang','Pcs','Nilai HPP','Penjelasan','Penyelesaian','Dicatat oleh'],...ivTerbuang().map(x=>[x.waktu,x.jenis,x.no,x.lokasi,x.items.map(i=>`${i.qty}x ${i.nama}`).join('; '),x.qty,x.nilai,x.penjelasan,x.penyelesaian||'',x.oleh])]); break;
    /* daftar stok */
    case 's-tab': I.sTab=arg; render(); break;
    case 's-min': I.sMin=!I.sMin; render(); break;
    case 's-csv': { const evs=state.events.filter(e=>!e.ditutup); ivCsv('daftar-stok.csv',[['SKU','Nama',HK_GUDANG,...evs.map(e=>e.nama),'Dalam perjalanan','Total'],...ivCat().map(c=>{ const it=hkStokRow(state.stokItems,c.sku)||{}, per=evs.map(e=>hkStokDi(state.stokItems,c.sku,e.nama)); return [c.sku,c.nama,gdStok(c.sku),...per,it.transit||0,gdStok(c.sku)+per.reduce((a,b)=>a+b,0)+(it.transit||0)]; })]); break; }
    /* pemilih produk */
    case 'pilih': { const sel={}; (arg==='faktur'?I.faktur.items:I.tb.items).forEach(i=>sel[i.sku]=true); H.modal={type:'pilih', ctx:arg, cari:'', sel}; render(); break; }
  }
});

/* pilihan (select) dengan data-hk-live di halaman Inventori langsung menggambar ulang */
document.addEventListener('change',e=>{ const t=e.target; if(t.tagName==='SELECT'&&t.hasAttribute('data-hk-live')&&(t.getAttribute('data-hk-bind')||'').startsWith('hk.inv')) render(); });

/* ════════ PROMOSI: satu daftar untuk promo per produk dan promo total belanja ════════ */
(function(){ const i=NAV.findIndex(n=>n.id==='promosi'); if(i>-1) NAV[i]={id:'promo', label:'Promosi', icon:NAV[i].icon}; })();
const PJENIS=(p,kind)=>{ const j=(p.detail||{}).jenisBonus; if(kind==='total') return 'Total belanja'; return j==='bonus-produk'?'Bonus produk':j==='bundling'?'Bundling':'Potongan produk'; };
function viewPromoGabung(){
  const I=IV(), q=(I.pCari||'').toLowerCase();
  const all=[...state.promoProdukList.map((p,i)=>({p,i,kind:'produk'})), ...state.promoTotalList.map((p,i)=>({p,i,kind:'total'}))].map(x=>({...x, jenis:PJENIS(x.p,x.kind), st:hkPromoStatus(x.p)}));
  const L=all.filter(x=>(!q||x.p.nama.toLowerCase().includes(q))&&(!I.pJenis||x.jenis===I.pJenis)&&(!I.pStatus||x.st===I.pStatus));
  const jenisList=['Potongan produk','Bonus produk','Bundling','Total belanja'], stList=[...new Set(all.map(x=>x.st))];
  const K=x=>x.kind==='produk'?'promoProduk':'promoTotal';
  const rows=L.map(x=>`<tr><td><b>${hkEsc(x.p.nama)}</b><div class="hk-sub">${hkEsc(x.p.tipe||'')}</div></td><td>${ivBadge(x.jenis, x.kind==='total'?'badge-info':'badge-mut')}</td><td>${hkEsc(x.kind==='total'?'Semua produk':(x.p.produk||'-'))}</td><td>${hkEsc(x.p.kriteria||'-')}</td><td>${hkEsc(x.p.bonus||'-')}</td><td>${hkEsc(x.p.durasi||'-')}</td><td>${hkEsc(x.p.outlet||'Semua lokasi')}</td><td>${hkPromoPakai(x.p.nama)}</td><td>${promoStatusBadge(x.st)}</td>
    <td class="hk-num" style="white-space:nowrap;"><button class="btn" data-edit-${K(x)}="${x.i}">Ubah</button> <button class="btn" data-duplicate-${K(x)}="${x.i}" title="Duplikat promo">Duplikat</button></td></tr>`).join('');
  return `<div class="page-head"><span class="page-title">Promosi</span><div class="spacer"></div><button class="btn btn-primary" data-inv="pr-baru">+ Tambah Promosi</button></div>
  <div class="page-sub">Semua promo POS dalam satu daftar: potongan per produk, bonus produk, bundling, dan potongan total belanja. Satu pesanan hanya bisa memakai satu promo.</div>
  <div class="toolbar" style="flex-wrap:wrap;gap:8px;"><input class="search-input" style="max-width:260px;" placeholder="Cari nama promo..." data-hk-bind="hk.inv.pCari" data-hk-live="1" value="${hkEsc(I.pCari||'')}">
    <select class="hk-sel" style="width:auto;" data-hk-bind="hk.inv.pJenis" data-hk-live="1"><option value="">Semua jenis</option>${jenisList.map(j=>`<option ${I.pJenis===j?'selected':''}>${j}</option>`).join('')}</select>
    <select class="hk-sel" style="width:auto;" data-hk-bind="hk.inv.pStatus" data-hk-live="1"><option value="">Semua status</option>${stList.map(j=>`<option ${I.pStatus===j?'selected':''}>${j}</option>`).join('')}</select></div>
  <div class="card" style="padding:0;overflow:auto;"><table><thead><tr><th>Nama</th><th>Jenis</th><th>Produk</th><th>Kriteria</th><th>Bonus</th><th>Durasi</th><th>Berlaku di</th><th>Dipakai</th><th>Status</th><th></th></tr></thead>
  <tbody>${rows||'<tr><td colspan="10" class="hk-empty">Belum ada promo pada filter ini</td></tr>'}</tbody></table></div>`;
}
function promoJenisModal(){
  const opsi=[['promoProduk','Promo produk','Untuk produk tertentu: potongan %, potongan Rp, bonus produk (beli X gratis Y), atau bundling (harga paket).'],['promoTotal','Promo total belanja','Untuk seluruh isi keranjang: potongan % atau Rp kalau total belanja mencapai minimal tertentu.']];
  return `<div class="confirm-box hk-modal" style="width:560px;"><div class="hk-mh"><h4>Jenis promo</h4><div class="spacer"></div><span class="close" style="cursor:pointer;" data-hk-act="modal-close">✕</span></div><div class="hk-mb">
    <div style="display:flex;flex-direction:column;gap:10px;">${opsi.map(([k,l,d])=>`<div class="hk-check" style="cursor:pointer;" data-inv="pr-jenis" data-inv-arg="${k}"><div><b>${l}</b><div class="hk-sub">${d}</div></div></div>`).join('')}</div></div></div>`;
}
const _renderMainPromo=renderMain;
renderMain=function(){ const v=state.view; if(v==='promo'||v==='promo-produk'||v==='promo-total'){ state.view='promo'; document.getElementById('main').innerHTML=viewPromoGabung(); return; } _renderMainPromo(); };
const _renderHkModalPromo=renderHkModal;
renderHkModal=function(){ const m=state.hk.modal; if(m&&m.type==='promojenis'){ modalRoot.classList.add('open'); modalRoot.innerHTML=promoJenisModal(); return; } _renderHkModalPromo(); };
document.addEventListener('click',e=>{ const el=e.target.closest('[data-inv]'); if(!el) return; const act=el.getAttribute('data-inv'), arg=el.getAttribute('data-inv-arg');
  if(act==='pr-baru'){ state.hk.modal={type:'promojenis'}; render(); }
  if(act==='pr-jenis'){ state.hk.modal=null; render(); state[arg+'Form']=newPromoForm(); renderPromoFormModal(); }
  if(act==='o-ke'){ const I=IV(); I.oLok=arg; I.oStatus=''; state.hk.modal=null; state.view='stok-opname'; state.openGroups.inventori=true; render(); }
});

/* ════════ KARYAWAN › BERTUGAS HARI INI: siapa ditugaskan, siapa membuka kasir, siapa belum datang, per lokasi ════════ */
function viewBertugas(){
  const hari=ivToday(), M=(state.masukPos||[]).filter(m=>m.waktu.slice(0,10)===hari&&!m.aksi.startsWith('PIN salah'));
  const shiftBuka=state.posShift.filter(s=>!s.tutup);
  const lokasi=[{id:HK_GUDANG_ID, nama:HK_GUDANG, gudang:true, kasir:[], pj:''}, ...state.events.filter(e=>!e.ditutup&&e.mulai<=hari&&e.selesai>=hari||!e.ditutup&&e.selesai<hari)];
  const st=n=>state.staff.find(x=>x.nama===n)||{role:[]};
  const hadir=(nama,tempat)=>M.filter(m=>m.nama===nama&&m.tempat===tempat).sort((a,b)=>a.waktu.localeCompare(b.waktu));
  let nBuka=0, nBelum=0;
  const kartu=lokasi.map(e=>{
    const laci=shiftBuka.filter(s=>s.eventId===e.id); nBuka+=laci.length;
    const statusOrang=nama=>{ const sh=laci.find(s=>s.kasir===nama), h=hadir(nama,e.nama), terakhir=h[h.length-1];
      if(sh) return {k:'buka', t:`Membuka kasir sejak ${hkJam(sh.buka)}`, b:'badge-success'};
      if(h.some(x=>x.aksi==='Gabung kasir')) return {k:'gabung', t:`Bergabung ke laci, masuk ${hkJam(h[0].waktu)}`, b:'badge-success'};
      if(terakhir&&terakhir.aksi==='Keluar') return {k:'keluar', t:`Sudah keluar ${hkJam(terakhir.waktu)}`, b:'badge-mut'};
      if(h.length) return {k:'hadir', t:`Masuk POS ${hkJam(h[0].waktu)}`, b:'badge-success'};
      return {k:'belum', t:'Belum masuk POS hari ini', b:'badge-danger'}; };
    const ditugaskan=e.gudang?[]:e.kasir.map(n=>({n, s:statusOrang(n)}));
    nBelum+=ditugaskan.filter(x=>x.s.k==='belum').length;
    const lain=[...new Set([...M.filter(m=>m.tempat===e.nama).map(m=>m.nama), ...laci.map(s=>s.kasir)])].filter(n=>!e.kasir.includes(n)).map(n=>({n, s:statusOrang(n)}));
    const baris=(x,tamu)=>`<tr><td><b>${hkEsc(x.n)}</b><div class="hk-sub">${hkEsc(st(x.n).role.join(', '))}${tamu?' · tidak ditugaskan, ikut berjualan':''}${!e.gudang&&e.pj===x.n?' · penanggung jawab':''}</div></td><td>${ivBadge(x.s.t,x.s.b)}</td></tr>`;
    const sts=e.gudang?'':hkStatusEvent(e);
    return `<div class="card" style="margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;"><b style="font-size:15px;">${hkEsc(e.nama)}</b>${e.gudang?ivBadge('Gudang','badge-mut'):ivBadge(sts,sts==='Berlangsung'?'badge-success':'badge-warn')}
        <span class="hk-sub">${e.gudang?'Jual langsung (Owner) dan serah terima pre-sale (Admin)':`${hkEsc(e.venue||'')} · ${tglRange(e.mulai,e.selesai)}`}</span><div class="spacer" style="flex:1;"></div>
        ${e.gudang?'':`<span class="hk-sub">Penanggung jawab: <b>${hkEsc(e.pj||'-')}</b></span><span class="hk-row-link" style="color:var(--accent-text);font-weight:600;" data-inv="bt-event" data-inv-arg="${e.id}">Detail event ›</span>`}</div>
      <div class="hk-sub" style="margin:8px 0;">${laci.length?`Laci terbuka: ${laci.map(s=>{ const K=hkShiftKas(data(),s); return `<b>${hkEsc(s.kasir)}</b> sejak ${hkJam(s.buka)} (${hkTgl(s.buka)}) · ${K.n} transaksi · ${hkRp(K.penjualan)}`; }).join('; ')}`:'Belum ada laci terbuka.'}</div>
      ${e.gudang?(lain.length?`<table class="hk-varian"><thead><tr><th>Ada di Gudang Pusat hari ini</th><th>Status</th></tr></thead><tbody>${lain.map(x=>baris(x,false)).join('')}</tbody></table>`:'<div class="hk-sub">Belum ada yang memakai POS di Gudang Pusat hari ini. Gudang tidak punya petugas tetap: Owner bisa jual langsung, Admin bisa serah terima pre-sale.</div>')
        :`<table class="hk-varian"><thead><tr><th>Ditugaskan</th><th>Status hari ini</th></tr></thead><tbody>${ditugaskan.map(x=>baris(x,false)).join('')||'<tr><td colspan="2" class="hk-empty">Belum ada kasir ditugaskan. Atur di Ubah Event.</td></tr>'}${lain.map(x=>baris(x,true)).join('')}</tbody></table>`}
    </div>`; }).join('');
  /* satu orang ditugaskan di lebih dari satu event yang berlangsung hari ini */
  const ganda=state.staff.map(s=>({n:s.nama, ev:lokasi.filter(e=>!e.gudang&&e.kasir.includes(s.nama)&&hkStatusEvent(e)==='Berlangsung')})).filter(x=>x.ev.length>1);
  return `<div class="hk-sub" style="margin-bottom:12px;">Per ${hkTgl(hari)}. Status diambil dari riwayat masuk POS hari ini dan laci kasir yang sedang terbuka.</div>
  <div class="hk-kpis"><div class="metric-card"><div class="metric-label">Lokasi aktif</div><div class="metric-value">${lokasi.length}</div><div class="hk-sub">Gudang Pusat + event</div></div>
    <div class="metric-card"><div class="metric-label">Laci terbuka</div><div class="metric-value">${nBuka}</div></div>
    <div class="metric-card"><div class="metric-label">Ditugaskan, belum masuk POS</div><div class="metric-value" style="${nBelum?'color:var(--danger-text);':''}">${nBelum}</div></div>
    <div class="metric-card"><div class="metric-label">Ditugaskan di 2 event sekaligus</div><div class="metric-value" style="${ganda.length?'color:var(--danger-text);':''}">${ganda.length}</div>${ganda.length?`<div class="hk-sub">${ganda.map(x=>hkEsc(x.n)).join(', ')}</div>`:''}</div></div>
  ${kartu}`;
}
const _viewKaryawanBt=viewKaryawan;
viewKaryawan=function(){ const I=IV(), tab=I.kTab||'daftar';
  const tabs=`<div class="tabs" style="margin-bottom:14px;">${[['daftar','Daftar Karyawan'],['tugas','Bertugas Hari Ini']].map(([k,l])=>`<div class="tab ${tab===k?'active':''}" data-inv="k-tab" data-inv-arg="${k}">${l}</div>`).join('')}</div>`;
  if(tab==='tugas') return `<div class="page-head"><span class="page-title">Karyawan</span></div>${tabs}${viewBertugas()}`;
  const h=_viewKaryawanBt(), i=h.indexOf('</div>')+6; return h.slice(0,i)+tabs+h.slice(i); };
document.addEventListener('click',e=>{ const el=e.target.closest('[data-inv]'); if(!el) return; const act=el.getAttribute('data-inv'), arg=el.getAttribute('data-inv-arg');
  if(act==='k-tab'){ IV().kTab=arg; render(); }
  if(act==='bt-event'){ state.hk.evId=arg; state.view='event-detail'; render(); } });
