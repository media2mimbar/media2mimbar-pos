/* ════════════════════════════════════════════════════════════
   DATA BERSAMA DASHBOARD + POS
   Dua halaman membaca dan menulis kunci localStorage yang sama
   (awalan "hk2:"). Kalau localStorage tidak tersedia, data hanya
   hidup di memori tab itu.
   ════════════════════════════════════════════════════════════ */
const HK_VER = '19';
const HK_KEYS = ['produk','kategori','stok','staff','channel','orders','batches','events','pos','trx','shift','promoProduk','promoTotal','pelanggan','mutasi','opname','masuk','faktur','pemasok','terbuang','biaya'];
const HK_GUDANG = 'Gudang Pusat';

const hkLS = (()=>{ try{ const k='hk2:test'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return localStorage; }catch(e){ return null; } })();

function hkPad(n){ return String(n).padStart(2,'0'); }
function hkYmd(d){ return `${d.getFullYear()}-${hkPad(d.getMonth()+1)}-${hkPad(d.getDate())}`; }
function hkIso(d){ return `${hkYmd(d)}T${hkPad(d.getHours())}:${hkPad(d.getMinutes())}`; }
function hkAddDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function hkToday(){ const d=new Date(); d.setHours(0,0,0,0); return d; }
function hkRp(n){ n=Math.round(Number(n)||0); return (n<0?'-':'')+'Rp '+Math.abs(n).toLocaleString('id-ID'); }
function hkEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
const HK_BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
function hkTgl(iso){ const d=new Date(iso); return `${d.getDate()} ${HK_BULAN[d.getMonth()]} ${d.getFullYear()}`; }
function hkJam(iso){ const d=new Date(iso); return `${hkPad(d.getHours())}:${hkPad(d.getMinutes())}`; }

/* ── katalog: satu baris per barang yang bisa dijual (varian atau produk tanpa varian) ── */
function hkCatalog(produk){
  const out=[];
  produk.forEach(p=>{
    const base={parent:p.sku, produk:p.nama, kategori:p.kategori, hpp:Number(p.modal)||0, aktif:p.status==='Aktif', tampilPos:p.tampilPos!==false};
    if(p.varian&&p.varian.length) p.varian.forEach(v=>out.push({...base, sku:v.sku, varNama:v.nama, nama:`${p.nama} ${v.nama}`, harga:Number(v.jual)||0, hpp:Number(v.hpp)||base.hpp}));
    else out.push({...base, sku:p.sku, varNama:'', nama:p.nama, harga:Number(p.jual)||0});
  });
  return out;
}

/* ── stok per lokasi ── */
function hkStokRow(stok, sku){ return stok.find(s=>s.sku===sku); }
function hkPO(item, lokasi){
  let p=item.perOutlet.find(x=>x.outlet===lokasi);
  if(!p){ p={outlet:lokasi, awal:0, masuk:0, keluar:0, terjual:0, akhir:0, satuan:item.satuan}; item.perOutlet.push(p); }
  if(p.keluar==null) p.keluar=0;
  return p;
}
function hkStokDi(stok, sku, lokasi){ const it=hkStokRow(stok,sku); if(!it) return 0; const p=it.perOutlet.find(x=>x.outlet===lokasi); return p?p.akhir:0; }
function hkPindah(stok, sku, dari, ke, qty){
  const it=hkStokRow(stok,sku); if(!it||!qty) return;
  const a=hkPO(it,dari), b=hkPO(it,ke);
  a.keluar+=qty; a.akhir-=qty; b.masuk+=qty; b.akhir+=qty;
}
/* kirim stok dari Gudang Pusat ke event: hanya dari dashboard. Barang jadi "transit" sampai diterima kasir di POS */
function hkKirimStok(data, ev, list, oleh, catatan){
  if(!list.length) return null;
  const items=list.map(([sku,q])=>{ const it=hkStokRow(data.stok,sku), g=hkPO(it,HK_GUDANG); g.keluar+=q; g.akhir-=q; it.transit=(it.transit||0)+q; return {sku, nama:it.nama, dikirim:q, diterima:null}; });
  const d=new Date(), pre=`MT/${hkYmd(d).slice(2).replace(/-/g,'')}/`;
  const m={no:pre+hkPad(data.mutasi.filter(x=>x.no.startsWith(pre)).reduce((a,x)=>Math.max(a,+x.no.slice(pre.length)||0),0)+1), dari:HK_GUDANG, ke:ev.nama, eventId:ev.id, tglKirim:hkIso(d), tglTerima:null, oleh, penerima:null, status:'Dikirim', catatan:catatan||'', items};
  data.mutasi.unshift(m); return m;
}
function hkJual(stok, sku, lokasi, qty){
  const it=hkStokRow(stok,sku); if(!it) return;
  const p=hkPO(it,lokasi);
  it.terjual+=qty; it.akhir-=qty; p.terjual+=qty; p.akhir-=qty;
}
/* Gudang Pusat bisa jadi tempat jualan langsung (khusus Owner), diperlakukan seperti event tanpa tanggal */
const HK_GUDANG_ID='gudang';
function hkTempat(data, id){
  if(id===HK_GUDANG_ID){ const t=hkYmd(new Date()); return {id:HK_GUDANG_ID, nama:HK_GUDANG, venue:'Jual langsung dari gudang / kantor', mulai:t, selesai:t, kasir:[], ditutup:false, gudang:true, harga:(data.pos&&data.pos.hargaGudang)||{}}; }
  return data.events.find(e=>e.id===id)||null;
}
function hkStatusEvent(ev){
  if(ev&&ev.gudang) return 'Berlangsung';
  if(ev.ditutup) return 'Selesai';
  const t=hkYmd(new Date());
  if(t<ev.mulai) return 'Akan Datang';
  if(t>ev.selesai) return 'Perlu Ditutup';
  return 'Berlangsung';
}

/* ── seed ── */
function hkSeed(){
  const T=hkToday();
  const ymd=n=>hkYmd(hkAddDays(T,n));
  const at=(n,h,m)=>{ const d=hkAddDays(T,n); d.setHours(h,m,0,0); return hkIso(d); };

  const kategori=[
    {nama:'Pakaian', urutan:1, departemen:null, tampilMenu:true, outlets:[HK_GUDANG]},
    {nama:'Aksesoris', urutan:2, departemen:null, tampilMenu:true, outlets:[HK_GUDANG]},
    {nama:'Tas', urutan:3, departemen:null, tampilMenu:true, outlets:[HK_GUDANG]},
    {nama:'Konsumsi', urutan:4, departemen:null, tampilMenu:true, outlets:[HK_GUDANG]},
    {nama:'Tanpa Kategori', urutan:5, departemen:null, tampilMenu:false, outlets:[HK_GUDANG]},
  ];
  const v=(sku,nama,jual)=>({sku,nama,jual});
  const produk=[
    {nama:'Kaos Burtuqol Palestina', sku:'KBP-005', kategori:'Pakaian', satuan:'Pcs', modal:55000, jual:null, status:'Aktif', tampilPos:true, stokMin:5, deskripsi:'Kaos katun combed 24s, sablon plastisol.',
      varian:[v('KBP-005-S','S',125000),v('KBP-005-M','M',125000),v('KBP-005-L','L',125000),v('KBP-005-XL','XL',135000)]},
    {nama:'Jersey Dewasa', sku:'JRS-006', kategori:'Pakaian', satuan:'Pcs', modal:85000, jual:null, status:'Aktif', tampilPos:true, stokMin:5, deskripsi:'',
      varian:[v('JRS-006-M','M',175000),v('JRS-006-L','L',175000),v('JRS-006-XL','XL',185000)]},
    {nama:'Kemeja Flanel', sku:'KF-001', kategori:'Pakaian', satuan:'Pcs', modal:45000, jual:null, status:'Aktif', tampilPos:true, stokMin:3, deskripsi:'',
      varian:[v('KF-001-S-HTM','S · Hitam',89000),v('KF-001-M-HTM','M · Hitam',89000),v('KF-001-L-HTM','L · Hitam',89000)]},
    {nama:'Kaos Polos', sku:'KP-004', kategori:'Pakaian', satuan:'Pcs', modal:20000, jual:40000, status:'Aktif', tampilPos:true, stokMin:10, deskripsi:''},
    {nama:'Tumbler Hikayat', sku:'TMB-007', kategori:'Aksesoris', satuan:'Pcs', modal:38000, jual:85000, status:'Aktif', tampilPos:true, stokMin:5, deskripsi:'Stainless 500 ml.'},
    {nama:'Topi Bordir', sku:'TB-002', kategori:'Aksesoris', satuan:'Pcs', modal:12000, jual:35000, status:'Aktif', tampilPos:true, stokMin:5, deskripsi:''},
    {nama:'Totebag Hikayat', sku:'TOT-009', kategori:'Tas', satuan:'Pcs', modal:15000, jual:45000, status:'Aktif', tampilPos:true, stokMin:5, deskripsi:''},
    {nama:'Tas Kanvas', sku:'TK-003', kategori:'Tas', satuan:'Pcs', modal:28000, jual:65000, status:'Nonaktif', tampilPos:false, stokMin:3, deskripsi:'Dihentikan sementara, menunggu restock bahan.'},
    {nama:'Kopi Ashabul Kafein 200g', sku:'KOP-008', kategori:'Konsumsi', satuan:'Pcs', modal:30000, jual:65000, status:'Aktif', tampilPos:true, stokMin:8, deskripsi:''},
  ];
  produk.forEach(p=>{ p.beli=p.modal; });
  const cat=hkCatalog(produk);

  /* stok awal: semua di gudang */
  const awalGudang={ 'KBP-005-S':30,'KBP-005-M':60,'KBP-005-L':60,'KBP-005-XL':30, 'JRS-006-M':25,'JRS-006-L':30,'JRS-006-XL':15,
    'KF-001-S-HTM':20,'KF-001-M-HTM':30,'KF-001-L-HTM':20, 'KP-004':150, 'TMB-007':60, 'TB-002':85, 'TOT-009':80, 'TK-003':2, 'KOP-008':70 };
  const stok=cat.map(c=>({sku:c.sku, nama:c.nama, parent:c.parent, jenis:'Produk', kategori:c.kategori, awal:awalGudang[c.sku]||0, masuk:0, terjual:0, akhir:awalGudang[c.sku]||0, keluar:0, terbuang:0, terproduksi:0, transit:0, satuan:'Pcs',
    perOutlet:[{outlet:HK_GUDANG, awal:awalGudang[c.sku]||0, masuk:0, keluar:0, terjual:0, akhir:awalGudang[c.sku]||0, satuan:'Pcs'}]}));

  const staff=[
    {nama:'Rina Wijaya', telp:'0812xxxxxxx', role:['Owner'], email:'rina@hikayat.id', pw:hkHashPw('hikayat123'), pwBaru:false, pin:'111111', pinBaru:false, aktif:true},
    {nama:'Dimas Pratama', telp:'0813xxxxxxx', role:['Admin'], email:'dimas@hikayat.id', pw:hkHashPw('hikayat123'), pwBaru:false, pin:'222222', pinBaru:false, aktif:true},
    {nama:'Sari Handayani', telp:'0821xxxxxxx', role:['Kasir'], email:'', pw:'', pwBaru:false, pin:'333333', pinBaru:false, aktif:true},
    {nama:'Budi Santoso', telp:'0857xxxxxxx', role:['Admin','Kasir'], email:'budi@hikayat.id', pw:hkHashPw('hikayat123'), pwBaru:false, pin:'444444', pinBaru:false, aktif:true},
    /* karyawan baru yang belum pernah masuk: password dan PIN masih sementara dari Owner */
    {nama:'Laila Nur', telp:'0811xxxxxxx', role:['Admin','Kasir'], email:'laila@hikayat.id', pw:hkHashPw('sementara1'), pwBaru:true, pin:'582914', pinBaru:true, aktif:true},
  ];

  const events=[
    {id:'ev-sby', nama:'Pameran Buku Surabaya', venue:'Grand City Convex, Surabaya', mulai:ymd(-22), selesai:ymd(-20), kasir:['Sari Handayani'], catatan:'Booth B-12', presaleAktif:false, presale:'stok', harga:{}, ditutup:false, tutup:null},
    {id:'ev-bdg', nama:'Hikayat Fest Bandung', venue:'Sabuga ITB, Bandung', mulai:ymd(-2), selesai:ymd(1), kasir:['Sari Handayani','Budi Santoso'], catatan:'Booth utama dekat panggung', presaleAktif:false, presale:'stok', harga:{'TOT-009':40000,'KP-004':35000}, ditutup:false, tutup:null},
    {id:'ev-jkt', nama:'Kajian Akbar Istiqlal', venue:'Masjid Istiqlal, Jakarta', mulai:ymd(13), selesai:ymd(13), kasir:['Budi Santoso'], catatan:'', presaleAktif:true, presale:'ambil', harga:{'KBP-005-S':115000,'KBP-005-M':115000,'KBP-005-L':115000,'KBP-005-XL':125000}, ditutup:false, tutup:null},
  ];
  const pjEv={'ev-sby':'Sari Handayani','ev-bdg':'Budi Santoso','ev-jkt':'Budi Santoso'}; events.forEach(e=>e.pj=pjEv[e.id]||e.kasir[0]||'');

  const pos={
    metode:{tunai:true, qris:true, transfer:true},
    qrisNama:'HIKAYAT MERCHANDISE', qrisNmid:'ID1026xxxxxxxx',
    rekening:[{bank:'BCA', no:'123 456 7890', nama:'PT Hikayat Media'},{bank:'BSI', no:'7123 456 789', nama:'PT Hikayat Media'}],
    nominalCepat:[50000,100000,200000],
    struk:{nama:'Hikayat Merchandise', info:'IG @hikayat.merch · WA 0812-0000-0000', footer:'Terima kasih sudah mendukung Hikayat!', tampilKasir:true, tampilEvent:true},
    pembulatan:0, pajakAktif:false, pajakPersen:11,
    diskonKasir:true, diskonMaks:10,
    wajibPin:true, voidPin:true, kunciMenit:20,
    hargaGudang:{},
    gridKolom:2, tampilStok:true,
  };

  /* transaksi contoh, angka acak tapi tetap sama tiap kali seed dibuat */
  let seed=7; const rnd=()=>{ seed=(seed*16807)%2147483647; return (seed-1)/2147483646; };
  const pick=a=>a[Math.floor(rnd()*a.length)];
  const jualan=cat.filter(c=>c.aktif&&c.tampilPos);
  const trx=[], shift=[];
  let no=1;
  function buatShift(ev, kasir, hari, jamBuka, jamTutup, nTrx, opts={}){
    const sh={id:'sh'+(shift.length+1), eventId:ev.id, kasir, buka:at(hari,jamBuka,0), modal:300000, tutup:null, kasHitung:null, catatan:'', kas:[]};
    if(opts.kas){ sh.kas.push({id:'kk'+shift.length, nama:opts.kas.nama, jenis:opts.kas.jenis, jumlah:opts.kas.jumlah, waktu:at(hari,jamBuka+2,15), catatan:''}); }
    shift.push(sh);
    let tunai=0;
    for(let i=0;i<nTrx;i++){
      const nItem=1+Math.floor(rnd()*3), items=[];
      for(let k=0;k<nItem;k++){
        const c=pick(jualan);
        const ada=items.find(x=>x.sku===c.sku);
        if(hkStokDi(stok,c.sku,ev.nama)-(ada?ada.qty:0)<=1) continue;
        if(ada) ada.qty++; else items.push({sku:c.sku, nama:c.nama, qty:1, harga:hkHarga(ev,c.sku,c.harga), hpp:c.hpp});
      }
      if(!items.length) continue;
      const sub=items.reduce((s,x)=>s+x.qty*x.harga,0);
      const metode=rnd()<.45?'Tunai':rnd()<.8?'QRIS':'Transfer';
      const diskon=rnd()<.12?Math.round(sub*.05/1000)*1000:0;
      const total=sub-diskon;
      const dibayar=metode==='Tunai'?Math.ceil(total/50000)*50000:total;
      const menit=Math.floor((jamTutup-jamBuka)*60*(i+0.5)/nTrx);
      const w=hkAddDays(T,hari); w.setHours(jamBuka,0,0,0); w.setMinutes(menit);
      const t={id:'t'+no, no:`HK-${hkYmd(w).slice(2).replace(/-/g,'')}-${hkPad(no)}`, eventId:ev.id, lokasi:ev.nama, shiftId:sh.id, kasir, waktu:hkIso(w), items, subtotal:sub, diskon, pajak:0, pembulatan:0, total, metode, dibayar, kembalian:dibayar-total, status:'Lunas', void:null, pembayaran:[{metode, jumlah:total}], pelanggan:null};
      no++;
      items.forEach(x=>hkJual(stok,x.sku,ev.nama,x.qty));
      trx.push(t); if(metode==='Tunai') tunai+=total;
    }
    if(opts.void){ const t=trx[trx.length-2]; if(t){ t.status='Void'; t.void={oleh:'Budi Santoso', alasan:'Salah input ukuran', waktu:t.waktu}; t.items.forEach(x=>{ hkJual(stok,x.sku,ev.nama,-x.qty); }); if(t.metode==='Tunai') tunai-=t.total; } }
    const kasNet=sh.kas.reduce((a,k)=>a+(k.jenis==='masuk'?k.jumlah:-k.jumlah),0);
    if(!opts.terbuka){ sh.tutup=at(hari,jamTutup,5); sh.kasHitung=sh.modal+tunai+kasNet+(opts.selisih||0); sh.catatan=opts.catatan||''; }
    return sh;
  }
  const mutasi=[]; let noMt=1;
  const alokasi=(ev, porsi, hari)=>{ const items=[];
    cat.forEach(c=>{ const q=Math.floor(hkStokDi(stok,c.sku,HK_GUDANG)*porsi); if(q>0){ hkPindah(stok,c.sku,HK_GUDANG,ev.nama,q); items.push({sku:c.sku, nama:c.nama, dikirim:q, diterima:q}); } });
    mutasi.push({no:`MT/${hkYmd(hkAddDays(T,hari-1)).slice(2).replace(/-/g,'')}/${hkPad(noMt++)}`, dari:HK_GUDANG, ke:ev.nama, eventId:ev.id, tglKirim:at(hari-1,16,0), tglTerima:at(hari,8,30), oleh:'Dimas Pratama', penerima:ev.kasir[0], status:'Diterima', catatan:'', items}); };

  /* event Surabaya: sudah lewat, sudah ditutup, sisa stok kembali ke gudang */
  const sby=events[0];
  alokasi(sby,.3,-22);
  buatShift(sby,'Sari Handayani',-22,10,21,9);
  buatShift(sby,'Sari Handayani',-21,10,21,11,{selisih:-5000, catatan:'Kurang Rp 5.000, kemungkinan salah kembalian'});
  buatShift(sby,'Sari Handayani',-20,10,18,8);
  const kembali={};
  cat.forEach(c=>{ const q=hkStokDi(stok,c.sku,sby.nama); if(q>0){ kembali[c.sku]=q; hkPindah(stok,c.sku,sby.nama,HK_GUDANG,q); } });
  sby.ditutup=true; sby.tutup={waktu:at(-20,19,0), oleh:'Dimas Pratama', kembali};

  /* event Bandung: sedang berlangsung, shift Budi hari ini masih terbuka */
  const bdg=events[1];
  alokasi(bdg,.45,-2);
  buatShift(bdg,'Sari Handayani',-2,9,21,10);
  buatShift(bdg,'Budi Santoso',-1,9,21,12,{void:true, kas:{nama:'Beli air mineral & lakban', jenis:'keluar', jumlah:35000}});
  buatShift(bdg,'Budi Santoso',0,9,13,5,{terbuka:true});
  /* restock yang sedang dikirim, belum diterima kasir di booth */
  const restock=[['KBP-005-M',10],['KBP-005-L',10],['JRS-006-L',6],['TMB-007',8]].filter(([sku])=>hkStokDi(stok,sku,HK_GUDANG)>0).map(([sku,q])=>{ q=Math.min(q,hkStokDi(stok,sku,HK_GUDANG)); const it=hkStokRow(stok,sku); const g=hkPO(it,HK_GUDANG); g.keluar+=q; g.akhir-=q; it.transit+=q; return {sku, nama:it.nama, dikirim:q, diterima:null}; });
  mutasi.push({no:`MT/${hkYmd(T).slice(2).replace(/-/g,'')}/${hkPad(noMt++)}`, dari:HK_GUDANG, ke:bdg.nama, eventId:bdg.id, tglKirim:at(-1,20,0), tglTerima:null, oleh:'Dimas Pratama', penerima:null, status:'Dikirim', catatan:'Restock hari terakhir', items:restock});

  /* pesanan online contoh, stok diambil dari gudang */
  const orders=[
    {id:'po1', saluran:'Shopee', noPesanan:'2609280X9Y8Z', tanggal:at(-3,13,5), pembeli:'hanif.r', status:'Selesai', potongan:8000, sumber:'Manual', oleh:'Dimas Pratama', batchId:null, moves:[], items:[{sku:'KP-004', nama:'Kaos Polos', qty:2, harga:45000}]},
    {id:'po2', saluran:'Tokopedia', noPesanan:'INV/20260929/MPL/3450001122', tanggal:at(-2,20,14), pembeli:'Dewi', status:'Selesai', potongan:5520, sumber:'Manual', oleh:'Dimas Pratama', batchId:null, moves:[], items:[{sku:'KF-001-M-HTM', nama:'Kemeja Flanel M · Hitam', qty:1, harga:69000}]},
    {id:'po3', saluran:'Shopee', noPesanan:'2610040QW12E', tanggal:at(-1,8,40), pembeli:'umar.f', status:'Diproses', potongan:21300, sumber:'Manual', oleh:'Budi Santoso', batchId:null, moves:[], items:[{sku:'KBP-005-L', nama:'Kaos Burtuqol Palestina L', qty:1, harga:129000},{sku:'TOT-009', nama:'Totebag Hikayat', qty:1, harga:49000}]},
  ];
  orders.forEach(o=>o.items.forEach(i=>{ hkJual(stok,i.sku,HK_GUDANG,i.qty); o.moves.push({sku:i.sku, outlet:HK_GUDANG, qty:i.qty}); }));

  const channel=[
    {nama:'Shopee', deskripsi:'Hikayat Official Shop di Shopee', status:true, outlets:[HK_GUDANG], komisiAktif:true, biayaAdmin:'8', biayaLayanan:'2', biayaPesanan:'1250',
      produk:[{sku:'KP-004', nama:'Kaos Polos', satuan:'Pcs', hargaAwal:40000, hargaJual:45000},...['S','M','L'].map(u=>({sku:'KBP-005-'+u, nama:'Kaos Burtuqol Palestina '+u, satuan:'Pcs', hargaAwal:125000, hargaJual:129000})),{sku:'KBP-005-XL', nama:'Kaos Burtuqol Palestina XL', satuan:'Pcs', hargaAwal:135000, hargaJual:139000},{sku:'TOT-009', nama:'Totebag Hikayat', satuan:'Pcs', hargaAwal:45000, hargaJual:49000}]},
    {nama:'Tokopedia', deskripsi:'Toko resmi Hikayat Merchandise di Tokopedia', status:true, outlets:[HK_GUDANG], komisiAktif:true, biayaAdmin:'6', biayaLayanan:'2', biayaPesanan:'0',
      produk:[...['S','M','L'].map(u=>({sku:'KF-001-'+u+'-HTM', nama:'Kemeja Flanel '+u+' · Hitam', satuan:'Pcs', hargaAwal:89000, hargaJual:95000})),{sku:'TB-002', nama:'Topi Bordir', satuan:'Pcs', hargaAwal:35000, hargaJual:40000}]},
    {nama:'TikTok Shop', deskripsi:'Belum dibuka', status:false, outlets:[HK_GUDANG], komisiAktif:false, biayaAdmin:'', biayaLayanan:'', biayaPesanan:'', produk:[]},
  ];

  const pelanggan=[
    {kode:'SN2610010001', nama:'Fajar Ramadhan', telepon:'+62 812 3456 7788', email:'fajar.r@mail.com', jenisKelamin:'Laki-Laki', tanggalLahir:'', grup:'Member', kota:'Kota Bandung', alamat:'', catatan:'', poin:40, deposit:0, transaksi:[]},
    {kode:'SN2609120002', nama:'Nadia Putri', telepon:'+62 857 1122 3344', email:'', jenisKelamin:'Perempuan', tanggalLahir:'', grup:'Member', kota:'Kota Surabaya', alamat:'', catatan:'', poin:15, deposit:0, transaksi:[]},
    {kode:'SN2608300003', nama:'Toko Buku Al-Kautsar', telepon:'+62 22 700 1234', email:'', jenisKelamin:'', tanggalLahir:'', grup:'Reseller', kota:'Kota Bandung', alamat:'', catatan:'Ambil grosir untuk dijual lagi', poin:0, deposit:0, transaksi:[]},
    {kode:'SN2610030004', nama:'Umar Faruq', telepon:'+62 813 9988 7766', email:'', jenisKelamin:'Laki-Laki', tanggalLahir:'', grup:'', kota:'', alamat:'', catatan:'', poin:0, deposit:0, transaksi:[]},
  ];
  const tgl=n=>{ const d=hkAddDays(T,n); return `${hkPad(d.getDate())} ${HK_BULAN[d.getMonth()]} ${d.getFullYear()}`; };
  const HARI=['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
  const promoDetail=o=>({outlet:o.outlet, statusPromo:o.aktif, nama:o.nama, deskripsi:o.deskripsi, aktivasi:o.auto?'otomatis':'manual', platform:['POS'], tglMulai:o.mulai, tglSelesai:o.selesai, jamMulai:'00:00', jamSelesai:'23:59', hari:[...HARI],
    jenisBonus:o.jenis, besaranPotongan:String(o.besar), izinkanKasirUbah:!!o.ubah, batasKasirPersen:o.ubah?String(o.ubah):'', maksimalPotongan:!!o.maks, maksimalPotonganNominal:o.maks?Number(o.maks).toLocaleString('id-ID'):'',
    promoBerdasarkan:o.minQty?'kuantitas':'pembelian', minPembelian:o.min?Number(o.min).toLocaleString('id-ID'):'', minKuantitas:o.minQty?String(o.minQty):'', produkPromo:o.produk||[], bonusProduk:o.bonus||[], jumlahBonus:o.bonusQty?String(o.bonusQty):'', hargaPaket:o.paket?Number(o.paket).toLocaleString('id-ID'):'', berlakuKelipatan:!!o.kelipatan, jenisPromo:'satuan', jumlahMaksimalTransaksi:'', terapkanGrupHargaSpesial:false, hargaCoretItems:[]});
  const promoRow=(o,produkMode)=>({nama:o.nama, tipe:o.auto?'Otomatis':'Manual', produk:produkMode?(o.produk||[]).join(', '):undefined, kriteria:o.jenis==='bundling'?`Paket : ${o.produk.join(' + ')}`:o.minQty?`Min Kuantitas : ${o.minQty}`:(o.min?`Min Pembelian : Rp ${Number(o.min).toLocaleString('id-ID')}`:'-'),
    bonus:o.jenis==='persen'?`${o.besar} %`:o.jenis==='bonus-produk'?`Gratis ${o.bonusQty} ${o.bonus.join(', ')}`:o.jenis==='bundling'?`Paket Rp ${Number(o.paket).toLocaleString('id-ID')}`:`Rp ${Number(o.besar).toLocaleString('id-ID')}`, durasi:o.mulai===o.selesai?o.mulai:`${o.mulai} - ${o.selesai}`, outlet:o.outlet||'Semua lokasi', status:o.aktif?'Aktif':'Tidak Aktif', detail:promoDetail(o)});
  const promoProduk=[
    promoRow({nama:'Jersey Fest', deskripsi:'Diskon Jersey Dewasa selama Hikayat Fest', outlet:bdg.nama, aktif:true, mulai:tgl(-2), selesai:tgl(1), jenis:'persen', besar:15, maks:30000, minQty:1, produk:['Jersey Dewasa']},true),
    promoRow({nama:'Hemat Kaos Burtuqol', deskripsi:'Minimal 2 pcs Kaos Burtuqol Palestina ukuran apa saja', outlet:'', aktif:true, mulai:tgl(-10), selesai:tgl(20), jenis:'persen', besar:10, maks:0, minQty:2, produk:['Kaos Burtuqol Palestina'], ubah:15},true),
    promoRow({nama:'Beli 2 Jersey gratis Topi', deskripsi:'Setiap beli 2 Jersey Dewasa dapat 1 Topi Bordir gratis', outlet:bdg.nama, aktif:true, mulai:tgl(-2), selesai:tgl(1), jenis:'bonus-produk', besar:0, minQty:2, produk:['Jersey Dewasa'], bonus:['Topi Bordir'], bonusQty:1, kelipatan:true},true),
    promoRow({nama:'Paket Tumbler + Totebag', deskripsi:'Tumbler Hikayat dan Totebag Hikayat jadi satu paket', outlet:'', aktif:true, mulai:tgl(-10), selesai:tgl(20), jenis:'bundling', besar:0, paket:110000, produk:['Tumbler Hikayat','Totebag Hikayat'], kelipatan:true},true),
    promoRow({nama:'Promo Pameran Buku', deskripsi:'Potongan Rp10.000 Totebag', outlet:'Pameran Buku Surabaya', aktif:true, mulai:tgl(-22), selesai:tgl(-20), jenis:'nominal', besar:10000, maks:0, minQty:1, produk:['Totebag Hikayat']},true),
  ];
  const promoTotal=[
    promoRow({nama:'Belanja Rp300 ribu', deskripsi:'Berlaku semua produk di booth event', outlet:'', auto:true, aktif:true, mulai:tgl(-5), selesai:tgl(25), jenis:'persen', besar:10, maks:50000, min:300000},false),
    promoRow({nama:'Promo Kajian Istiqlal', deskripsi:'Potongan Rp20.000 min belanja Rp150.000', outlet:'Kajian Akbar Istiqlal', aktif:true, mulai:tgl(13), selesai:tgl(13), jenis:'nominal', besar:20000, maks:0, min:150000},false),
  ];
  promoTotal.forEach(p=>delete p.produk);

  /* pesanan pre-sale contoh: Kajian Istiqlal (belum diambil) dan satu dari Surabaya yang perlu di-refund */
  const kasirPS=(ev,hari,jam,ket)=>{ const sh={id:'sh'+(shift.length+1), eventId:ev.id, kasir:'Rina Wijaya', buka:at(hari,jam,0), modal:0, tutup:at(hari,jam+2,0), kasHitung:0, catatan:ket, kas:[]}; shift.push(sh); return sh; };
  const preSale=(ev,sh,hari,jam,pl,items,metode,status)=>{ const sub=items.reduce((a,i)=>a+i.qty*i.harga,0); const w=at(hari,jam,15);
    trx.push({id:'t'+no, no:`HK-${w.slice(2,10).replace(/-/g,'')}-${hkPad(no)}`, eventId:ev.id, lokasi:ev.nama, shiftId:sh.id, kasir:'Rina Wijaya', waktu:w, items, subtotal:sub, diskon:0, pajak:0, pembulatan:0, total:sub,
      metode, pembayaran:[{metode, jumlah:sub}], dibayar:sub, kembalian:0, pelanggan:{kode:pl.kode, nama:pl.nama, telepon:pl.telepon}, status:'Lunas', void:null, struk:{wa:pl.telepon.replace(/\D/g,''), waktu:w, status:'Terkirim'},
      pengambilan:{status, waktu:null, oleh:null, catatan:status==='Perlu Refund'?`Tidak diambil ${HK_BATAS_AMBIL_HARI} hari setelah event ditutup`:'', batas:status==='Perlu Refund'?hkIso(hkAddDays(new Date(),-13)):null}}); no++; };
  const jkt=events[2], shJ=kasirPS(jkt,-1,13,'Pre-sale dari kantor');
  const it=(sku,q,h)=>{ const c=cat.find(x=>x.sku===sku); return {sku, nama:c.nama, qty:q, harga:h||hkHarga(jkt,sku,c.harga), hpp:c.hpp}; };
  preSale(jkt,shJ,-1,13,pelanggan[0],[it('KBP-005-L',2),it('TMB-007',1)],'Transfer','Menunggu');
  preSale(jkt,shJ,-1,14,pelanggan[3],[it('KBP-005-XL',1)],'QRIS','Menunggu');
  const shS=kasirPS(sby,-25,10,'Pre-sale Pameran Buku');
  preSale(sby,shS,-25,10,pelanggan[1],[{sku:'JRS-006-M', nama:'Jersey Dewasa M', qty:1, harga:175000, hpp:85000}],'Transfer','Perlu Refund');

  /* riwayat masuk POS contoh, dari shift yang ada */
  const masuk=[]; let mi=1;
  const log=(nama,aksi,tempat,waktu,perangkat)=>masuk.push({id:'m'+(mi++), nama, role:(staff.find(x=>x.nama===nama)||{role:[]}).role.join(', '), aksi, tempat, waktu, perangkat});
  shift.forEach(sh=>{ const t=sh.eventId===HK_GUDANG_ID?HK_GUDANG:(events.find(e=>e.id===sh.eventId)||{nama:''}).nama, hp=sh.kasir==='Rina Wijaya'?'HP-RINA':sh.kasir==='Budi Santoso'?'HP-BOOTH-2':'HP-BOOTH-1';
    log(sh.kasir,'Masuk',t,sh.buka,hp); log(sh.kasir,'Buka kasir',t,sh.buka,hp); if(sh.tutup){ log(sh.kasir,'Tutup kasir',t,sh.tutup,hp); log(sh.kasir,'Keluar',t,sh.tutup,hp); } });
  const shB=shift.find(x=>x.eventId==='ev-bdg'&&!x.tutup); if(shB){ log('Sari Handayani','PIN salah','Hikayat Fest Bandung',shB.buka,'HP-BOOTH-2'); }
  masuk.sort((a,b)=>b.waktu.localeCompare(a.waktu));
  /* pemasok, faktur pembelian (barang masuk Gudang Pusat), dan barang terbuang yang dicatat manual */
  const pemasok=[
    {id:'sup1', nama:'CV Konveksi Mitra', telp:'0812-2200-1100', alamat:'Jl. Soekarno-Hatta 120, Bandung', barang:'Kaos, jersey, kemeja', rekening:'BCA 123-456-7890 a.n. CV Konveksi Mitra', catatan:'Minimal order 50 pcs per desain'},
    {id:'sup2', nama:'Sablon & Bordir Jaya', telp:'0857-1100-2233', alamat:'Jl. Pemuda 8, Jakarta Timur', barang:'Topi bordir, totebag', rekening:'Mandiri 130-00-1122334-5', catatan:''},
    {id:'sup3', nama:'Tumbler Grosir Indonesia', telp:'0821-7788-9900', alamat:'Surabaya', barang:'Tumbler, botol', rekening:'BRI 0011-01-002233-50-1', catatan:'Bayar tempo 30 hari'},
  ];
  const fakturMasuk=(it)=>{ const r=hkStokRow(stok,it.sku), g=hkPO(r,HK_GUDANG); g.masuk+=it.qty; g.akhir+=it.qty; r.masuk+=it.qty; r.akhir+=it.qty; };
  const fit=(sku,qty,harga)=>({sku, nama:cat.find(c=>c.sku===sku).nama, qty, harga});
  const faktur=[
    {no:'FA/'+hkYmd(hkAddDays(T,-18)).slice(2).replace(/-/g,'')+'/0001', tanggal:hkYmd(hkAddDays(T,-18)), pemasokId:'sup1', items:[fit('KP-004',50,19000)], jatuhTempo:null, catatan:'Restock kaos polos', oleh:'Dimas Pratama', waktu:at(-18,10,0),
      bayar:[{tanggal:hkYmd(hkAddDays(T,-18)), jumlah:950000, cara:'Transfer', catatan:'', oleh:'Dimas Pratama'}], hpp:[]},
    {no:'FA/'+hkYmd(hkAddDays(T,-6)).slice(2).replace(/-/g,'')+'/0002', tanggal:hkYmd(hkAddDays(T,-6)), pemasokId:'sup3', items:[fit('TMB-007',20,38000)], jatuhTempo:hkYmd(hkAddDays(T,24)), catatan:'Tempo 30 hari', oleh:'Rina Wijaya', waktu:at(-6,14,0),
      bayar:[{tanggal:hkYmd(hkAddDays(T,-6)), jumlah:200000, cara:'Transfer', catatan:'Uang muka', oleh:'Rina Wijaya'}], hpp:[]},
    {no:'FA/'+hkYmd(hkAddDays(T,-35)).slice(2).replace(/-/g,'')+'/0003', tanggal:hkYmd(hkAddDays(T,-35)), pemasokId:'sup2', items:[fit('TB-002',30,12000),fit('TOT-009',30,15000)], jatuhTempo:hkYmd(hkAddDays(T,-5)), catatan:'', oleh:'Dimas Pratama', waktu:at(-35,9,0), bayar:[], hpp:[]},
  ];
  faktur.forEach(f=>{ f.total=f.items.reduce((a,i)=>a+i.qty*i.harga,0); f.items.forEach(fakturMasuk); });
  const terbuang=[{no:'ST/'+hkYmd(hkAddDays(T,-12)).slice(2).replace(/-/g,'')+'/0001', tanggal:hkYmd(hkAddDays(T,-12)), waktu:at(-12,15,20), lokasi:HK_GUDANG, alasan:'Rusak', penjelasan:'Kemasan sobek dan kopi tumpah saat bongkar muat dari ekspedisi', items:[{sku:'KOP-008', nama:'Kopi Ashabul Kafein 200g', qty:2}], oleh:'Dimas Pratama', foto:null, kerugian:60000,
    tanggungJawab:{pj:'Dimas Pratama', alasan:'Rusak: Kemasan sobek dan kopi tumpah saat bongkar muat dari ekspedisi', riwayat:[]}}];
  terbuang.forEach(t=>t.items.forEach(i=>{ const r=hkStokRow(stok,i.sku), g=hkPO(r,HK_GUDANG); g.akhir-=i.qty; r.akhir-=i.qty; g.terbuang=(g.terbuang||0)+i.qty; r.terbuang=(r.terbuang||0)+i.qty; }));
  /* biaya: biaya event (sewa booth, transport, honor kru, ...) dan biaya umum (gaji tetap, sewa gudang, ...) */
  let noBy=0; const by=(hari, eventId, kategori, keterangan, jumlah, cara, oleh)=>{ const tg=hkYmd(hkAddDays(T,hari)); noBy++; return {id:'by'+noBy, no:'BY/'+tg.slice(2).replace(/-/g,'')+'/'+String(noBy).padStart(4,'0'), tanggal:tg, eventId, kategori, keterangan, jumlah, cara, oleh:oleh||'Dimas Pratama', waktu:at(hari,17,0), foto:null}; };
  const awalBln=new Date(T.getFullYear(),T.getMonth(),1), hb=d=>Math.round((d-new Date(T.getFullYear(),T.getMonth(),T.getDate()))/864e5);
  const blnLalu=hb(new Date(T.getFullYear(),T.getMonth()-1,25)), blnIni=hb(new Date(awalBln.getFullYear(),awalBln.getMonth(),1));
  const biaya=[
    by(-30,'ev-sby','Sewa booth','Sewa booth B-12 (3 hari)',1200000,'Transfer','Rina Wijaya'),
    by(-23,'ev-sby','Transportasi & logistik','Kirim 3 koli barang via kargo ke Surabaya',380000,'Transfer'),
    by(-20,'ev-sby','Honor kru','Honor jaga booth 3 hari (Sari)',450000,'Transfer','Rina Wijaya'),
    by(-21,'ev-sby','Perlengkapan & display','Hanger kayu 30 pcs dan cermin berdiri',260000,'Tunai'),
    by(-19,'ev-sby','Potongan bank & MDR QRIS','MDR QRIS 0,3% sesuai laporan aplikasi merchant',5300,'Transfer','Rina Wijaya'),
    by(-18,'ev-sby','Transportasi & logistik','Retur sisa barang ke gudang',220000,'Transfer'),
    by(-9,'ev-bdg','Sewa booth','Sewa booth utama dekat panggung (4 hari)',1800000,'Transfer','Rina Wijaya'),
    by(-3,'ev-bdg','Transportasi & logistik','Sewa mobil bak kirim barang ke Sabuga',350000,'Tunai'),
    by(-3,'ev-bdg','Promosi event','Cetak X-banner dan price tag',175000,'Transfer'),
    by(-1,'ev-bdg','Konsumsi','Makan siang kru 2 hari',160000,'Tunai','Budi Santoso'),
    by(-4,'ev-jkt','Sewa booth','DP sewa booth Istiqlal',750000,'Transfer','Rina Wijaya'),
    by(blnLalu,null,'Gaji karyawan tetap','Gaji admin gudang',2500000,'Transfer','Rina Wijaya'),
    by(blnIni,null,'Sewa gudang & kantor','Sewa gudang bulan ini',750000,'Transfer','Rina Wijaya'),
    by(blnIni,null,'Listrik, air & internet','Internet dan listrik gudang',300000,'Transfer'),
    by(-5,null,'Kemasan & label','Hangtag, polymailer, dan plastik baju',280000,'Transfer'),
    by(-6,null,'Iklan online','Iklan Shopee',200000,'Transfer'),
  ];
  return {produk, kategori, stok, staff, channel, orders, batches:[], events, pos, trx, shift, promoProduk, promoTotal, pelanggan, mutasi, opname:[], masuk, faktur, pemasok, terbuang, biaya};
}

/* ── baca / tulis ── */
let hkLastWritten = {};
function hkLoad(){
  if(!hkLS) return hkSeed();
  if(hkLS.getItem('hk2:ver')!==HK_VER || HK_KEYS.some(k=>hkLS.getItem('hk2:'+k)==null)){
    const s=hkSeed(); hkSaveAll(s); hkLS.setItem('hk2:ver',HK_VER); return s;
  }
  const out={};
  HK_KEYS.forEach(k=>{ const raw=hkLS.getItem('hk2:'+k); hkLastWritten[k]=raw; try{ out[k]=JSON.parse(raw); }catch(e){ out[k]=hkSeed()[k]; } });
  if(hkCekBatasPreSale(out)) hkSave('trx', out.trx);
  return out;
}
function hkSave(key, value){
  if(!hkLS) return;
  const raw=JSON.stringify(value);
  if(hkLastWritten[key]===raw) return;
  hkLastWritten[key]=raw;
  try{ hkLS.setItem('hk2:'+key, raw); }catch(e){ console.warn('Gagal menyimpan', key, e); }
}
function hkSaveAll(obj){ HK_KEYS.forEach(k=>{ if(obj[k]!==undefined) hkSave(k,obj[k]); }); }
function hkReset(){ if(hkLS){ HK_KEYS.forEach(k=>hkLS.removeItem('hk2:'+k)); hkLS.removeItem('hk2:ver'); } hkLastWritten={}; }

/* ── angka penjualan gabungan (offline + online) untuk dashboard dan laporan ── */
function hkSales(data, dari, sampai){
  const cat=hkCatalog(data.produk), bySku={}; cat.forEach(c=>bySku[c.sku]=c);
  const hppOf=sku=>{ const c=bySku[sku]; return c?c.hpp:0; };
  const katOf=sku=>{ const c=bySku[sku]; return c?c.kategori:'Lainnya'; };
  const out=[];
  data.trx.filter(t=>t.status==='Lunas').forEach(t=>{
    const ev=hkTempat(data, t.eventId);
    out.push({waktu:t.waktu, jenis:'Offline', saluran:ev?ev.nama:t.lokasi, eventId:t.eventId, kasir:t.kasir, metode:t.metode, bayar:hkBayar(t), terbayar:true,
      items:t.items.map(i=>({...i, hpp:i.hpp!=null?i.hpp:hppOf(i.sku), kategori:katOf(i.sku)})), kotor:t.subtotal-t.diskon, potongan:0});
  });
  hkReturList(data).forEach(r=>{ const ev=hkTempat(data, r.eventId), uang=r.cara==='Uang kembali';
    out.push({waktu:r.waktu, jenis:'Offline', saluran:ev?ev.nama:r.lokasi, eventId:r.eventId, kasir:r.oleh, metode:'Retur', bayar:uang?[{metode:r.metode, jumlah:-r.nilai}]:[], terbayar:true, retur:true,
      items:uang?r.items.map(i=>({sku:i.sku, nama:i.nama, qty:-i.qty, harga:i.harga, hpp:0, kategori:katOf(i.sku)})):[], hppExtra:uang?0:r.items.reduce((a,i)=>a+i.qty*hppOf(i.sku),0), kotor:uang?-r.nilai:0, potongan:0}); });
  data.orders.filter(o=>o.status!=='Dibatalkan').forEach(o=>{
    const kotor=o.items.reduce((s,i)=>s+i.qty*i.harga,0);
    out.push({waktu:o.tanggal, jenis:'Online', saluran:o.saluran, eventId:null, kasir:o.oleh||'Tanpa nama', metode:o.saluran, bayar:[{metode:o.saluran, jumlah:kotor}], terbayar:o.status==='Selesai',
      items:o.items.map(i=>({...i, hpp:hppOf(i.sku), kategori:katOf(i.sku)})), kotor, potongan:Number(o.potongan)||0});
  });
  return out.filter(s=>{ const d=s.waktu.slice(0,10); return (!dari||d>=dari)&&(!sampai||d<=sampai); })
    .map(s=>{ const hpp=s.items.reduce((a,i)=>a+i.qty*(i.hpp||0),0)+(s.hppExtra||0); return {...s, qty:s.items.reduce((a,i)=>a+i.qty,0), hpp, bersih:s.kotor-s.potongan, laba:s.kotor-s.potongan-hpp}; });
}
/* retur barang cacat: hanya untuk barang rusak. Barang cacat tidak kembali ke stok jual (dicatat rusak). */
function hkReturList(data){ const out=[]; data.trx.forEach(t=>(t.retur||[]).forEach(r=>out.push({...r, trx:t}))); return out.sort((a,b)=>b.waktu.localeCompare(a.waktu)); }
function hkSudahRetur(t, sku){ return (t.retur||[]).reduce((a,r)=>a+r.items.filter(i=>i.sku===sku).reduce((b,i)=>b+i.qty,0),0); }
function hkNilaiRetur(t, i, qty){ return Math.round(i.harga*qty*(t.subtotal?t.total/t.subtotal:1)); }
function hkRetur(data, t, r){
  r.items.forEach(i=>{ const it=hkStokRow(data.stok,i.sku); if(!it) return; const po=hkPO(it,r.lokasi);
    po.rusak=(po.rusak||0)+i.qty; it.rusak=(it.rusak||0)+i.qty;
    if(r.cara==='Tukar barang'){ po.akhir-=i.qty; it.akhir-=i.qty; } });
  t.retur=t.retur||[]; t.retur.push(r); }
/* ── faktur pembelian: barang selalu masuk Gudang Pusat ── */
function hkFakturDibayar(f){ return (f.bayar||[]).reduce((a,b)=>a+b.jumlah,0); }
function hkFakturSisa(f){ return f.batal?0:Math.max(0, f.total-hkFakturDibayar(f)); }
function hkFakturStatus(f){ if(f.batal) return 'Dibatalkan'; if(hkFakturSisa(f)<=0) return 'Lunas'; if(f.jatuhTempo&&f.jatuhTempo<hkYmd(new Date())) return 'Lewat jatuh tempo'; return 'Belum lunas'; }
/* HPP rata-rata tertimbang: (stok lama x HPP lama + barang masuk x harga beli) / total stok */
function hkStokTotal(stok, sku){ const it=hkStokRow(stok,sku); return it?Math.max(0,(it.akhir||0)+(it.transit||0)):0; }
function hkTerimaFaktur(data, f){
  const ubah=[];
  const perProduk={}; f.items.forEach(i=>{ const p=data.produk.find(p=>p.sku===i.sku||(p.varian||[]).some(v=>v.sku===i.sku)); if(!p) return; (perProduk[p.sku]=perProduk[p.sku]||{p, items:[]}).items.push(i); });
  Object.values(perProduk).forEach(({p,items})=>{ const skus=p.varian&&p.varian.length?p.varian.map(v=>v.sku):[p.sku];
    const stokLama=skus.reduce((a,sku)=>a+hkStokTotal(data.stok,sku),0), lama=Number(p.modal)||0, q=items.reduce((a,i)=>a+i.qty,0), nilai=items.reduce((a,i)=>a+i.qty*i.harga,0);
    const baru=stokLama+q>0?Math.round((stokLama*lama+nilai)/(stokLama+q)):lama;
    if(baru!==lama){ p.modal=baru; p.beli=baru; ubah.push({produk:p.nama, lama, baru}); } });
  f.items.forEach(i=>{ const it=hkStokRow(data.stok,i.sku); if(!it) return; const g=hkPO(it,HK_GUDANG); g.masuk+=i.qty; g.akhir+=i.qty; it.masuk+=i.qty; it.akhir+=i.qty; });
  f.hpp=ubah; data.faktur.unshift(f); return f; }
/* batal faktur: hanya kalau semua barangnya masih ada di Gudang Pusat (belum dikirim, dijual, atau terbuang).
   Stok gudang dikurangi lagi dan HPP dihitung mundur dari rata-rata tertimbang. */
function hkFakturKurang(data, f){ const per={}; f.items.forEach(i=>per[i.sku]=(per[i.sku]||0)+i.qty);
  return Object.entries(per).map(([sku,q])=>{ const it=hkStokRow(data.stok,sku), ada=it?hkPO(it,HK_GUDANG).akhir:0; return {sku, nama:(f.items.find(i=>i.sku===sku)||{}).nama, ada, butuh:q}; }).filter(x=>x.ada<x.butuh); }
function hkBatalFaktur(data, f, alasan, oleh){
  const ubah=[], perProduk={}; f.items.forEach(i=>{ const p=data.produk.find(p=>p.sku===i.sku||(p.varian||[]).some(v=>v.sku===i.sku)); if(!p) return; (perProduk[p.sku]=perProduk[p.sku]||{p, items:[]}).items.push(i); });
  Object.values(perProduk).forEach(({p,items})=>{ const skus=p.varian&&p.varian.length?p.varian.map(v=>v.sku):[p.sku];
    const stok=skus.reduce((a,sku)=>a+hkStokTotal(data.stok,sku),0), now=Number(p.modal)||0, q=items.reduce((a,i)=>a+i.qty,0), nilai=items.reduce((a,i)=>a+i.qty*i.harga,0);
    const awal=((f.hpp||[]).find(h=>h.produk===p.nama)||{lama:now}).lama, hitung=stok-q>0?Math.round((stok*now-nilai)/(stok-q)):awal, baru=hitung>0?hitung:awal;
    if(baru!==now){ p.modal=baru; p.beli=baru; ubah.push({produk:p.nama, lama:now, baru}); } });
  f.items.forEach(i=>{ const it=hkStokRow(data.stok,i.sku); if(!it) return; const g=hkPO(it,HK_GUDANG); g.masuk-=i.qty; g.akhir-=i.qty; it.masuk-=i.qty; it.akhir-=i.qty; });
  f.batal={alasan, oleh, waktu:hkIso(new Date()), hpp:ubah, kembali:hkFakturDibayar(f)}; return f; }
/* ── akun karyawan: semua didaftarkan Owner di dashboard ──
   Dashboard: email + password. POS: PIN 6 angka. Keduanya sementara sampai diganti karyawan saat pertama masuk.
   Prototipe: password disimpan sebagai hash sederhana di localStorage; versi produksi memakai server dengan hash yang kuat. */
function hkHashPw(pw){ const s='hikayat:'+pw; let h1=0xdeadbeef, h2=0x41c6ce57;
  for(let i=0;i<s.length;i++){ const c=s.charCodeAt(i); h1=Math.imul(h1^c,2654435761); h2=Math.imul(h2^c,1597334677); }
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909); h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return 'h$'+(4294967296*(2097151&h2)+(h1>>>0)).toString(16); }
function hkCekPw(staff, pw){ return !!staff&&!!staff.pw&&staff.pw===hkHashPw(pw); }
function hkAksesDashboard(staff){ return !!staff&&staff.role.some(r=>r==='Admin'||r==='Owner'); }
/* aturan password baru: minimal 8 karakter, ada huruf dan angka */
function hkPwLemah(pw){ if((pw||'').length<8) return 'Password minimal 8 karakter'; if(!/[a-zA-Z]/.test(pw)||!/\d/.test(pw)) return 'Password harus berisi huruf dan angka'; return null; }
/* aturan PIN: 6 angka, tidak boleh angka sama semua atau berurutan, dan tidak dipakai karyawan lain */
function hkPinLemah(pin, staffList, namaSendiri){ if(!/^\d{6}$/.test(pin||'')) return 'PIN harus 6 angka';
  if(/^(\d)\1{5}$/.test(pin)) return 'PIN tidak boleh 6 angka yang sama';
  if('0123456789'.includes(pin)||'9876543210'.includes(pin)) return 'PIN tidak boleh angka berurutan';
  if((staffList||[]).some(x=>x.pin===pin&&x.nama!==namaSendiri)) return 'PIN sudah dipakai karyawan lain';
  return null; }
function hkSum(list, f){ return list.reduce((s,x)=>s+(typeof f==='function'?f(x):x[f]),0); }
function hkGroup(list, keyFn){ const m=new Map(); list.forEach(x=>{ const k=keyFn(x); if(!m.has(k)) m.set(k,[]); m.get(k).push(x); }); return m; }

/* ── pembayaran & kas kasir ── */
function hkBayar(t){ return t.pembayaran&&t.pembayaran.length?t.pembayaran:[{metode:t.metode, jumlah:t.total}]; }
/* QRIS statis: kasir mencatat 4 digit terakhir no. referensi dari notifikasi dana masuk */
function hkRefQris(t){ return hkBayar(t).filter(b=>b.ref).map(b=>'ref …'+b.ref).join(', '); }
function hkShiftKas(data, sh){
  const trx=data.trx.filter(t=>t.shiftId===sh.id&&t.status!=='Void');
  const by={Tunai:0, QRIS:0, Transfer:0};
  trx.forEach(t=>hkBayar(t).forEach(b=>{ by[b.metode]=(by[b.metode]||0)+b.jumlah; }));
  const kas=sh.kas||[];
  const masuk=kas.filter(k=>k.jenis==='masuk').reduce((a,k)=>a+k.jumlah,0), keluar=kas.filter(k=>k.jenis==='keluar').reduce((a,k)=>a+k.jumlah,0);
  const refund=data.trx.filter(t=>t.shiftId===sh.id&&t.status==='Void').reduce((a,t)=>a+t.total,0);
  const retur=hkReturList(data).filter(r=>r.shiftId===sh.id&&r.cara==='Uang kembali'&&r.metode==='Tunai').reduce((a,r)=>a+r.nilai,0);
  const harus=sh.modal+(by.Tunai||0)+masuk-keluar-retur;
  return {n:trx.length, penjualan:trx.reduce((a,t)=>a+t.total,0), tunai:by.Tunai||0, qris:by.QRIS||0, transfer:by.Transfer||0, masuk, keluar, refund, retur,
    harus, selisih:sh.tutup?sh.kasHitung-harus:null};
}

/* ── promo dari dashboard (tanggal "26 Mar 2026" atau "26 Mar 26") ── */
function hkParseTgl(s){
  const m=String(s||'').trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{2,4})$/); if(!m) return null;
  const bln=HK_BULAN.findIndex(b=>b.toLowerCase()===m[2].toLowerCase()); if(bln<0) return null;
  const th=m[3].length===2?2000+Number(m[3]):Number(m[3]);
  return `${th}-${hkPad(bln+1)}-${hkPad(Number(m[1]))}`;
}
function hkNum(s){ return Number(String(s==null?'':s).replace(/[^\d]/g,''))||0; }
const HK_HARI=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
/* promo yang berlaku di POS untuk lokasi dan waktu tertentu (tanggal, hari, jam) */
function hkPromoAktif(data, lokasi, ymd, jam){
  const now=new Date(); ymd=ymd||hkYmd(now); jam=jam||`${hkPad(now.getHours())}:${hkPad(now.getMinutes())}`;
  const hari=HK_HARI[new Date(ymd+'T12:00').getDay()];
  const ok=p=>{ const d=p.detail||{}; if(p.status!=='Aktif'||d.statusPromo===false) return false;
    if(d.platform&&d.platform.length&&!d.platform.includes('POS')) return false;
    if(Array.isArray(d.lokasi)){ if(!d.lokasiSemua&&d.lokasi.length&&!d.lokasi.includes(lokasi)) return false; }
    else if(d.outlet&&d.outlet!==lokasi&&d.outlet!=='Semua Lokasi'&&d.outlet!=='Semua lokasi') return false;
    const a=hkParseTgl(d.tglMulai), b=hkParseTgl(d.tglSelesai)||a; if(a&&ymd<a) return false; if(b&&ymd>b) return false;
    if(d.hari&&d.hari.length&&!d.hari.includes(hari)) return false;
    if(d.jamMulai&&jam<d.jamMulai) return false; if(d.jamSelesai&&jam>d.jamSelesai) return false;
    return ['persen','nominal','rp','bonus-produk','bundling'].includes(d.jenisBonus); };
  const map=(p,scope)=>{ const d=p.detail, persen=d.jenisBonus==='persen', qty=d.promoBerdasarkan==='kuantitas';
    return {id:(scope==='order'?'pt-':'pp-')+p.nama, name:p.nama, scope, parents:scope==='product'?(d.produkPromo||[]):undefined, type:persen?'percent':'nominal', percent:hkNum(d.besaranPotongan), nominal:hkNum(d.besaranPotongan),
      maxPotongan:persen&&d.maksimalPotongan?hkNum(d.maksimalPotonganNominal):0, minPembelian:qty&&scope==='product'?0:hkNum(d.minPembelian), minQty:qty?hkNum(d.minKuantitas):0,
      kelipatan:!persen&&!!d.berlakuKelipatan, auto:d.aktivasi==='otomatis', editable:!!d.izinkanKasirUbah&&persen, maxPercent:hkNum(d.batasKasirPersen)||100,
      ...(d.jenisBonus==='bonus-produk'?{type:'bonus', minPembelian:0, minQty:hkNum(d.minKuantitas)||1, bonusParents:d.bonusProduk||[], bonusQty:hkNum(d.jumlahBonus)||1, kelipatan:!!d.berlakuKelipatan, editable:false}:{}),
      ...(d.jenisBonus==='bundling'?{type:'bundle', minPembelian:0, minQty:0, hargaPaket:hkNum(d.hargaPaket), kelipatan:!!d.berlakuKelipatan, editable:false}:{}),
      desc:d.deskripsi||'', periode:p.durasi+(d.jamMulai&&(d.jamMulai!=='00:00'||d.jamSelesai!=='23:59')?` · ${d.jamMulai}–${d.jamSelesai}`:'')+(d.hari&&d.hari.length&&d.hari.length<7?` · ${d.hari.join(', ')}`:'')}; };
  return [...(data.promoTotal||[]).filter(ok).map(p=>map(p,'order')), ...(data.promoProduk||[]).filter(ok).map(p=>map(p,'product'))];
}

/* ── harga khusus per event (kosong = harga normal) ── */
function hkHarga(ev, sku, normal){ const h=ev&&ev.harga&&ev.harga[sku]; return h?Number(h):normal; }
/* pre-sale: event yang belum mulai dengan mode "ambil nanti" tidak mengurangi stok saat transaksi */
function hkAmbilNanti(ev){ return !!ev&&!ev.gudang&&ev.presaleAktif!==false&&ev.presale==='ambil'&&hkStatusEvent(ev)==='Akan Datang'; }
/* event belum mulai dan pre-sale dimatikan: belum boleh berjualan */
function hkPreSaleTutup(ev){ return !!ev&&!ev.gudang&&ev.presaleAktif===false&&hkStatusEvent(ev)==='Akan Datang'; }
function hkPreSaleMenunggu(data, evId){ return data.trx.filter(t=>t.eventId===evId&&t.status!=='Void'&&t.pengambilan&&t.pengambilan.status==='Menunggu'); }

/* ── tutup event: dipakai dashboard (Admin/Owner) dan POS (Owner) ── */
/* pesanan pre-sale yang lewat batas ambil otomatis jadi Perlu Refund. Dipanggil saat dashboard/POS memuat data. */
function hkCekBatasPreSale(data){ const now=hkIso(new Date()); let n=0;
  data.trx.forEach(t=>{ const g=t.pengambilan; if(t.status==='Lunas'&&g&&g.status==='Menunggu'&&g.batas&&g.batas<now){ g.status='Perlu Refund'; g.catatan=`Tidak diambil ${HK_BATAS_AMBIL_HARI} hari setelah event ditutup`; n++; } });
  return n; }
/* kerugian dari selisih stok tutup event, beserta pertanggungjawabannya */
function hkKerugianList(data){ return data.opname.filter(o=>o.jenis==='Tutup Event'&&o.kerugian>0); }
/* semua kerugian yang perlu pertanggungjawaban: selisih stok (opname) dan kas kurang (tutup kasir) */
function hkKerugianSemua(data){
  const stok=data.opname.filter(o=>o.kerugian>0&&o.tanggungJawab).map(o=>({key:o.no, jenis:'Stok', waktu:o.disetujui?o.disetujui.waktu:o.waktu, lokasi:o.lokasi, oleh:o.disetujui?o.disetujui.oleh:o.oleh, no:o.no, kerugian:o.kerugian, tanggungJawab:o.tanggungJawab,
    rincian:o.produk.filter(x=>x.selisih<0).map(x=>`${x.nama} ${x.selisih}`)}));
  const kas=data.shift.filter(s=>s.tutup&&s.kasKurang).map(s=>{ const ev=hkTempat(data,s.eventId)||{nama:'-'}, K=hkShiftKas(data,s);
    return {key:'KAS:'+s.id, jenis:'Kas', waktu:s.tutup, lokasi:ev.nama, oleh:s.ditutupOleh||s.kasir, no:'Laci '+s.kasir, kerugian:Math.max(0,-K.selisih), tanggungJawab:s.kasKurang, rincian:[`Kas kurang ${Math.max(0,-K.selisih).toLocaleString('id-ID')}`]}; });
  const buang=(data.terbuang||[]).filter(t=>t.kerugian>0&&t.tanggungJawab).map(t=>({key:'TB:'+t.no, jenis:'Terbuang', waktu:t.waktu, lokasi:t.lokasi, oleh:t.oleh, no:t.no, kerugian:t.kerugian, tanggungJawab:t.tanggungJawab,
    rincian:t.items.map(i=>`${i.nama} -${i.qty}`)}));
  return [...stok, ...kas, ...buang].sort((a,b)=>b.waktu.localeCompare(a.waktu));
}
function hkKerugianRiwayat(o){ return (o.tanggungJawab&&o.tanggungJawab.riwayat)||[]; }
function hkKerugianJumlah(o, jenis){ return hkKerugianRiwayat(o).filter(r=>!jenis||r.jenis===jenis).reduce((a,r)=>a+(+r.jumlah||0),0); }
function hkKerugianSisa(o){ return Math.max(0, o.kerugian-hkKerugianJumlah(o)); }
/* catat satu langkah penyelesaian; riwayat tidak pernah ditimpa */
function hkSelesaikanKerugian(o, r){ const tj=o.tanggungJawab, sisa=hkKerugianSisa(o); tj.riwayat=tj.riwayat||[];
  tj.riwayat.push({...r, jumlah:Math.min(sisa, r.jenis==='Dibebankan perusahaan'?sisa:(+r.jumlah||0))});
  const s2=hkKerugianSisa(o); tj.status=s2>0?'Diganti sebagian':hkKerugianJumlah(o,'Dibebankan perusahaan')?'Dibebankan perusahaan':'Diganti'; }
/* stok opname akhir event dari POS: dikirim kasir, disetujui atau diminta ulang saat Tutup Event */
function hkSOAkhir(data, evId){ return data.opname.find(o=>o.eventId===evId&&o.jenis==='Akhir Event'&&o.status!=='Diganti')||null; }
/* fisik untuk ditutup: stok sistem sekarang + selisih hasil opname (kalau ada penjualan setelah opname, selisihnya tetap) */
function hkSOFisik(data, so){ const ev=hkTempat(data,so.eventId), out={}; so.produk.forEach(p=>{ out[p.sku]=Math.max(0,hkStokDi(data.stok,p.sku,ev.nama)+(p.fisik-p.sistem)); }); return out; }
/* setujui opname di tengah event: stok event disesuaikan, kerugian (kalau ada) masuk Selisih & Kerugian; event tetap berjalan */
function hkSetujuiSO(data, soNo, oleh, pj){
  const so=data.opname.find(o=>o.no===soNo); if(!so||so.status!=='Menunggu persetujuan') return false;
  const ev=hkTempat(data,so.eventId), fisik=hkSOFisik(data,so); let kerugian=0;
  so.produk.forEach(p=>{ const it=hkStokRow(data.stok,p.sku); if(!it) return; const po=hkPO(it,ev.nama), d=po.akhir-fisik[p.sku];
    if(d){ po.akhir-=d; it.akhir-=d; po.terbuang=(po.terbuang||0)+d; it.terbuang=(it.terbuang||0)+d; } if(d>0) kerugian+=d*(p.hpp||0); });
  so.status='Disetujui'; so.disetujui={oleh, waktu:hkIso(new Date())}; so.kerugian=kerugian;
  so.tanggungJawab=kerugian?{pj:pj&&pj.nama||so.oleh, alasan:pj&&pj.alasan||so.catatan||'', status:'Belum diselesaikan', riwayat:[]}:null;
  return true; }
function hkSORingkas(so){ const kurang=so.produk.filter(p=>p.fisik<p.sistem).reduce((a,p)=>a+p.sistem-p.fisik,0), lebih=so.produk.filter(p=>p.fisik>p.sistem).reduce((a,p)=>a+p.fisik-p.sistem,0);
  return {kurang, lebih, kerugian:so.produk.reduce((a,p)=>a+Math.max(0,p.sistem-p.fisik)*(p.hpp||0),0)}; }
function hkCekTutupEvent(data, evId){
  const ev=data.events.find(e=>e.id===evId);
  return {ev, shiftBuka:data.shift.filter(s=>s.eventId===evId&&!s.tutup), mutasiTunda:data.mutasi.filter(m=>m.eventId===evId&&m.status==='Dikirim'),
    sisa:data.stok.map(it=>({it, q:hkStokDi(data.stok,it.sku,ev.nama)})).filter(x=>x.q>0), preSale:hkPreSaleMenunggu(data, evId)};
}
/* batas ambil pre-sale di Gudang Pusat setelah event ditutup */
const HK_BATAS_AMBIL_HARI = 7;
/* fisik: {sku: jumlah hasil hitung}. Kosong berarti sama dengan stok sistem.
   Selisih dicatat sebagai stok opname tutup event (kerugian = selisih x HPP), lalu stok fisik kembali ke gudang. */
function hkTutupEvent(data, evId, oleh, fisik, pj, soNo){
  const c=hkCekTutupEvent(data, evId), ev=c.ev; if(c.shiftBuka.length) return false;
  const kembali={}, selisih={}, items=[]; let kerugian=0;
  const hppOf=sku=>{ const k=hkCatalog(data.produk).find(x=>x.sku===sku); return k?k.hpp:0; };
  c.sisa.forEach(x=>{ const sku=x.it.sku, f=fisik&&fisik[sku]!=null&&fisik[sku]!==''?Math.max(0,Math.round(+fisik[sku])||0):x.q, d=x.q-f, hpp=hppOf(sku);
    items.push({sku, nama:x.it.nama, sistem:x.q, fisik:f, selisih:f-x.q, hpp, kerugian:Math.max(0,d)*hpp});
    if(d){ const p=hkPO(x.it,ev.nama); p.akhir-=d; x.it.akhir-=d; p.terbuang=(p.terbuang||0)+d; x.it.terbuang=(x.it.terbuang||0)+d; selisih[sku]=-d; kerugian+=Math.max(0,d)*hpp; }
    if(f>0){ kembali[sku]=f; hkPindah(data.stok, sku, ev.nama, HK_GUDANG, f); } });
  if(items.length) data.opname.unshift({no:'SO/'+hkYmd(new Date()).replace(/-/g,'').slice(2)+'/'+String(data.opname.length+1).padStart(2,'0'), jenis:'Tutup Event', eventId:ev.id, lokasi:ev.nama, status:'Berhasil', waktu:hkIso(new Date()), tanggal:hkTgl(new Date()), oleh, produk:items, kerugian,
    tanggungJawab:kerugian?{pj:pj&&pj.nama||'', alasan:pj&&pj.alasan||'', status:'Belum diselesaikan', riwayat:[]}:null, dariSO:soNo||null});
  const so=soNo&&data.opname.find(o=>o.no===soNo); if(so){ so.status='Disetujui'; so.disetujui={oleh, waktu:hkIso(new Date())}; if(items.length) data.opname[0].dihitungOleh=so.oleh; }
  c.mutasiTunda.forEach(m=>{ m.items.forEach(i=>{ const it=hkStokRow(data.stok,i.sku), g=hkPO(it,HK_GUDANG); it.transit-=i.dikirim; g.keluar-=i.dikirim; g.akhir+=i.dikirim; }); m.status='Batal'; m.catatan='Event ditutup sebelum diterima'; });
  const batas=hkIso(hkAddDays(new Date(),HK_BATAS_AMBIL_HARI));
  c.preSale.forEach(t=>{ t.pengambilan.batas=batas; t.pengambilan.catatan=`Event ditutup. Bisa diambil di ${HK_GUDANG} sampai ${hkTgl(batas)}`; });
  ev.ditutup=true; ev.tutup={waktu:hkIso(new Date()), oleh, kembali, selisih, kerugian, pj:kerugian&&pj?pj.nama:null, opnameNo:items.length?data.opname[0].no:null};
  return true;
}
