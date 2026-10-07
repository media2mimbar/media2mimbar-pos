/* ════════════════════════════════════════════════════════════
   KEUANGAN: Biaya, Laporan Keuangan per Event, Laporan Keuangan Keseluruhan.
   Laba rugi: penjualan − diskon − pembulatan − retur uang kembali − potongan marketplace = penjualan bersih
              penjualan bersih − HPP = laba kotor
              laba kotor − biaya (dicatat + kas keluar laci) − kerugian + penggantian PJ + kas lebih = laba bersih
   PPN yang dipungut bukan pendapatan, ditampilkan terpisah.
   ════════════════════════════════════════════════════════════ */
const KU=()=>{ state.hk.keu=state.hk.keu||{evId:null, per:'bulan', dari:'', sampai:'', bTuju:'', bKat:'', bDari:'', bSampai:''}; return state.hk.keu; };
const BIAYA_KAT_EVENT=['Sewa booth','Transportasi & logistik','Honor kru','Konsumsi','Perlengkapan & display','Promosi event','Perizinan & retribusi','Potongan bank & MDR QRIS','Lainnya'];
const BIAYA_KAT_UMUM=['Gaji karyawan tetap','Sewa gudang & kantor','Listrik, air & internet','Iklan online','Kemasan & label','Foto & konten produk','Potongan bank & MDR QRIS','Lainnya'];
const kuOwner=()=>{ const a=akun(); return !!a&&a.role.includes('Owner'); };
const kuAlokAktif=()=>!!state.posSettings.keuAlokasi;
const kuPct=(v,b)=>b?(Math.round(v/b*1000)/10).toLocaleString('id-ID')+'%':'–';
const kuRp=(v,kurang)=>v<0?`<span style="color:var(--danger-text);">−${hkRp(-v)}</span>`:kurang&&v?`(${hkRp(v)})`:hkRp(v);
const kuEvList=()=>state.events.slice().sort((a,b)=>b.mulai.localeCompare(a.mulai));
const kuUkuran=c=>{ if(!c||!c.varNama) return null; return c.varNama.split(' · ')[0].trim(); };
ICONS.keuangan=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="8" width="20" height="15" rx="2"/><path d="M5 12.5h20"/><path d="M19 17.5h2.5"/><path d="M9 8l9-3 1.2 3"/></g></svg>`;
NAV.splice(NAV.findIndex(n=>n.id==='laporan')+1, 0, {id:'keuangan', label:'Keuangan', icon:'keuangan', children:[{id:'keu-ringkasan', label:'Laporan Keseluruhan'},{id:'keu-event', label:'Laporan per Event'},{id:'keu-biaya', label:'Biaya'}]});
FORM_VIEWS['keu-biaya-form']='keu-biaya';

function kuRange(){ const K=KU(), t=hkToday();
  if(K.per==='bulan') return [hkYmd(new Date(t.getFullYear(),t.getMonth(),1)),hkYmd(t)];
  if(K.per==='lalu') return [hkYmd(new Date(t.getFullYear(),t.getMonth()-1,1)),hkYmd(new Date(t.getFullYear(),t.getMonth(),0))];
  if(K.per==='90') return [hkYmd(hkAddDays(t,-89)),hkYmd(t)];
  if(K.per==='tahun') return [hkYmd(new Date(t.getFullYear(),0,1)),hkYmd(t)];
  if(K.per==='rentang') return [K.dari||null, K.sampai||null];
  return [null,null]; }

/* kas keluar dari laci POS (beli air, lakban, dll.) ikut dihitung sebagai biaya event */
function kuLaci(evId, dari, sampai){ const out=[];
  state.posShift.filter(s=>evId==null||s.eventId===evId).forEach(s=>(s.kas||[]).filter(k=>k.jenis==='keluar'&&ivDalam(k.waktu.slice(0,10),dari,sampai)).forEach(k=>out.push({tanggal:k.waktu.slice(0,10), waktu:k.waktu, eventId:s.eventId, kategori:'Kas keluar laci', keterangan:k.nama+(k.catatan?` (${k.catatan})`:''), jumlah:k.jumlah, cara:'Tunai (laci)', oleh:s.kasir, laci:true})));
  return out; }
function kuBiaya(evId, dari, sampai){ return state.biaya.filter(b=>(evId===undefined||b.eventId===evId)&&ivDalam(b.tanggal,dari,sampai)); }

/* evId: id event, atau null untuk semua lokasi dan saluran */
function kuHitung(evId, dari, sampai){
  const D=data(), cat=hkCatalog(D.produk), bySku={}; cat.forEach(c=>bySku[c.sku]=c);
  const hppOf=sku=>(bySku[sku]||{}).hpp||0, inR=w=>ivDalam(String(w||'').slice(0,10),dari,sampai), evOk=id=>evId==null||id===evId;
  const ev=evId?hkTempat(D,evId):null, lokOk=n=>evId==null||(ev&&n===ev.nama);
  const R={kotorOff:0, diskon:0, bulat:0, pajak:0, hppOff:0, nTrx:0, qty:0, returUang:0, hppTukar:0, qtyRetur:0, kotorOn:0, potongan:0, hppOn:0, piutangOn:0, nOn:0, qtyOn:0,
    saluran:new Map(), metode:new Map(), kat:new Map(), ukuran:new Map(), produk:new Map(), bulan:new Map()};
  const tambah=(map,k,f)=>{ if(!map.has(k)) map.set(k,{qty:0, jual:0, hpp:0}); f(map.get(k)); };
  const bln=w=>String(w).slice(0,7), B=k=>{ if(!R.bulan.has(k)) R.bulan.set(k,{bersih:0, hpp:0, biaya:0, rugi:0}); return R.bulan.get(k); };
  const item=(i,w)=>{ const c=bySku[i.sku], h=i.hpp!=null?i.hpp:hppOf(i.sku), jual=i.qty*i.harga;
    tambah(R.kat, c?c.kategori:'Lainnya', x=>{ x.qty+=i.qty; x.jual+=jual; x.hpp+=i.qty*h; });
    const u=kuUkuran(c); if(u) tambah(R.ukuran, u, x=>{ x.qty+=i.qty; x.jual+=jual; x.hpp+=i.qty*h; });
    tambah(R.produk, i.sku||i.nama, x=>{ x.nama=i.nama; x.qty+=i.qty; x.jual+=jual; x.hpp+=i.qty*h; });
    return {jual, hpp:i.qty*h}; };
  /* pre-sale yang barangnya belum diambil: uangnya sudah diterima tapi belum jadi penjualan (diakui saat barang diserahkan) */
  R.presale=0; R.nPresale=0;
  const belumAmbil=t=>t.pengambilan&&t.pengambilan.status!=='Diambil';
  D.trx.filter(t=>t.status==='Lunas'&&evOk(t.eventId)&&belumAmbil(t)&&inR(t.waktu)).forEach(t=>{ R.presale+=t.total; R.nPresale++; hkBayar(t).forEach(b=>R.metode.set(b.metode,(R.metode.get(b.metode)||0)+b.jumlah)); });
  D.trx.filter(t=>t.status==='Lunas'&&evOk(t.eventId)&&!belumAmbil(t)&&inR(t.pengambilan&&t.pengambilan.waktu||t.waktu)).forEach(t=>{ R.nTrx++;
    let jual=0, hpp=0; t.items.forEach(i=>{ const r=item(i,t.waktu); jual+=r.jual; hpp+=r.hpp; R.qty+=i.qty; });
    R.kotorOff+=jual; R.hppOff+=hpp; R.diskon+=t.diskon||0; R.bulat+=t.pembulatan||0; R.pajak+=t.pajak||0;
    const tp=hkTempat(D,t.eventId), sal=t.eventId===HK_GUDANG_ID?`Jual langsung · ${HK_GUDANG}`:`Event · ${tp?tp.nama:t.lokasi}`;
    tambah(R.saluran, sal, x=>{ x.jual+=jual; x.qty+=t.items.reduce((a,i)=>a+i.qty,0); });
    hkBayar(t).forEach(b=>R.metode.set(b.metode,(R.metode.get(b.metode)||0)+b.jumlah));
    const m=B(bln(t.waktu)); m.bersih+=jual-(t.diskon||0)-(t.pembulatan||0); m.hpp+=hpp; });
  hkReturList(D).filter(r=>evOk(r.trx.eventId)&&inR(r.waktu)).forEach(r=>{ const q=r.items.reduce((a,i)=>a+i.qty,0); R.qtyRetur+=q;
    if(r.cara==='Uang kembali'){ R.returUang+=r.nilai; R.metode.set(r.metode,(R.metode.get(r.metode)||0)-r.nilai); B(bln(r.waktu)).bersih-=r.nilai; }
    else { const h=r.items.reduce((a,i)=>a+i.qty*hppOf(i.sku),0); R.hppTukar+=h; B(bln(r.waktu)).hpp+=h; } });
  if(evId==null) D.orders.filter(o=>o.status!=='Dibatalkan'&&inR(o.tanggal)).forEach(o=>{ R.nOn++;
    let jual=0, hpp=0; o.items.forEach(i=>{ const r=item({...i, hpp:hppOf(i.sku)},o.tanggal); jual+=r.jual; hpp+=r.hpp; R.qtyOn+=i.qty; });
    const pot=Number(o.potongan)||0; R.kotorOn+=jual; R.potongan+=pot; R.hppOn+=hpp; if(o.status!=='Selesai') R.piutangOn+=jual-pot;
    tambah(R.saluran, `Online · ${o.saluran}`, x=>{ x.jual+=jual; x.pot=(x.pot||0)+pot; x.qty+=o.items.reduce((a,i)=>a+i.qty,0); });
    const m=B(bln(o.tanggal)); m.bersih+=jual-pot; m.hpp+=hpp; });
  /* biaya */
  R.biaya=[...kuBiaya(evId==null?undefined:evId, dari, sampai), ...kuLaci(evId, dari, sampai)];
  R.biaya.forEach(b=>B(bln(b.tanggal)).biaya+=b.jumlah);
  R.biayaEvent=R.biaya.filter(b=>b.eventId); R.biayaUmum=R.biaya.filter(b=>!b.eventId);
  /* kerugian: selisih opname, barang terbuang manual, kas laci kurang, barang kurang saat kiriman diterima */
  R.rugi=hkKerugianSemua(D).filter(o=>lokOk(o.lokasi)&&inR(o.waktu)).map(o=>({jenis:o.jenis==='Kas'?'Kas laci kurang':o.jenis==='Terbuang'?'Barang terbuang':'Selisih stok opname', no:o.no, waktu:o.waktu, lokasi:o.lokasi, jumlah:o.kerugian, ganti:hkKerugianJumlah(o,'Diganti'), pj:(o.tanggungJawab||{}).pj}));
  D.mutasi.filter(m=>m.status==='Diterima'&&evOk(m.eventId)&&inR(m.tglTerima)).forEach(m=>{ const nilai=m.items.reduce((a,i)=>a+Math.max(0,i.dikirim-(i.diterima||0))*hppOf(i.sku),0); if(nilai) R.rugi.push({jenis:'Kurang saat kiriman diterima', no:m.no, waktu:m.tglTerima, lokasi:m.ke, jumlah:nilai, ganti:0}); });
  /* kas laci kurang dari shift lama yang belum punya penanggung jawab tetap dihitung sebagai kerugian */
  D.shift.filter(s=>evOk(s.eventId)&&s.tutup&&!s.kasKurang&&inR(s.tutup)).forEach(s=>{ const sel=hkShiftKas(D,s).selisih; if(sel<0) R.rugi.push({jenis:'Kas laci kurang', no:'Laci '+s.kasir, waktu:s.tutup, lokasi:(hkTempat(D,s.eventId)||{}).nama, jumlah:-sel, ganti:0}); });
  R.rugi.forEach(r=>B(bln(r.waktu)).rugi+=r.jumlah-r.ganti);
  R.kasLebih=D.shift.filter(s=>evOk(s.eventId)&&s.tutup&&inR(s.tutup)).reduce((a,s)=>a+Math.max(0,hkShiftKas(D,s).selisih||0),0);
  R.setoran=D.shift.filter(s=>evOk(s.eventId)&&s.tutup&&inR(s.tutup)).reduce((a,s)=>a+((s.kasHitung||0)-s.modal),0);
  /* total */
  R.kotor=R.kotorOff+R.kotorOn;
  R.bersih=R.kotorOff-R.diskon-R.bulat-R.returUang+R.kotorOn-R.potongan;
  R.hpp=R.hppOff+R.hppOn+R.hppTukar;
  R.labaKotor=R.bersih-R.hpp;
  R.totBiaya=R.biaya.reduce((a,b)=>a+b.jumlah,0);
  R.totRugi=R.rugi.reduce((a,r)=>a+r.jumlah,0); R.totGanti=R.rugi.reduce((a,r)=>a+r.ganti,0);
  /* bagian biaya umum untuk event (kalau diaktifkan Owner): biaya umum bulan itu × porsi penjualan bersih event di bulan itu */
  R.alokasi=0; R.alokRinci=[];
  if(evId!=null&&ev&&!ev.gudang&&kuAlokAktif()) [...R.bulan.entries()].forEach(([k,m])=>{ if(m.bersih<=0) return;
    const y=+k.slice(0,4), mo=+k.slice(5,7), a=hkYmd(new Date(y,mo-1,1)), z=hkYmd(new Date(y,mo,0));
    const umum=state.biaya.filter(b=>!b.eventId&&ivDalam(b.tanggal,a,z)).reduce((x,b)=>x+b.jumlah,0); if(!umum) return;
    const tot=kuHitung(null,a,z).bersih, porsi=tot>0?Math.min(1,m.bersih/tot):0, j=Math.round(umum*porsi);
    if(j){ R.alokasi+=j; R.alokRinci.push({bulan:k, umum, porsi, jumlah:j}); m.biaya+=j; } });
  R.totBiaya+=R.alokasi;
  R.labaBersih=R.labaKotor-R.totBiaya-R.totRugi+R.totGanti+R.kasLebih;
  R.n=R.nTrx+R.nOn; R.qtyAll=R.qty+R.qtyOn;
  /* sell-through event: terjual ÷ barang yang diterima di event */
  if(ev&&!ev.gudang){ let masuk=0, terjual=0; R.st=new Map();
    state.stokItems.forEach(it=>{ const p=(it.perOutlet||[]).find(x=>x.outlet===ev.nama); if(!p||!p.masuk) return; masuk+=p.masuk; terjual+=p.terjual; R.st.set(it.sku,{masuk:p.masuk, terjual:p.terjual, sisa:p.akhir, kembali:(ev.tutup&&ev.tutup.kembali||{})[it.sku]||0}); });
    R.masuk=masuk; R.terjual=terjual; R.sellThrough=masuk?terjual/masuk:null; }
  return R; }

/* ── tampilan laporan laba rugi ── */
const kuInd=rows=>`<table class="ku-lr"><tbody>${rows.map(([l,v,sub])=>`<tr><td>${l}${sub?`<div class="hk-sub">${sub}</div>`:''}</td><td class="hk-num" style="font-weight:600;">${v}</td></tr>`).join('')}</tbody></table>`;
function kuTabel(rows, base){
  return `<table class="ku-lr"><tbody>${rows.map(r=>r.head?`<tr class="ku-h"><td colspan="3">${r.head}</td></tr>`
    :`<tr class="${r.tot?'ku-tot':''}${r.grand?' ku-grand':''}"><td style="padding-left:${12+(r.lv||0)*18}px;">${r.l}${r.sub?`<div class="hk-sub">${r.sub}</div>`:''}</td><td class="hk-num">${kuRp(r.v,r.kurang)}</td><td class="hk-num ku-pct">${base&&r.pct!==false?kuPct(r.v,base):''}</td></tr>`).join('')}</tbody></table>`; }
function kuLabaRugi(R, gabung){
  const rows=[{head:'Pendapatan'}];
  if(gabung){ [...R.saluran.entries()].sort((a,b)=>b[1].jual-a[1].jual).forEach(([k,x])=>rows.push({l:hkEsc(k), v:x.jual, lv:1})); }
  else rows.push({l:'Penjualan (harga jual × qty)', v:R.kotorOff, lv:1, sub:`${R.nTrx} transaksi · ${R.qty} pcs`});
  rows.push({l:'Penjualan kotor', v:R.kotor, tot:true});
  if(R.diskon) rows.push({l:'Diskon & promo', v:R.diskon, lv:1, kurang:true});
  if(R.bulat) rows.push({l:'Pembulatan ke bawah', v:R.bulat, lv:1, kurang:true});
  if(R.returUang) rows.push({l:'Retur barang cacat (uang kembali)', v:R.returUang, lv:1, kurang:true});
  if(R.potongan) rows.push({l:'Potongan marketplace (admin, layanan, ongkir)', v:R.potongan, lv:1, kurang:true});
  rows.push({l:'Penjualan bersih', v:R.bersih, tot:true});
  rows.push({head:'Harga pokok'});
  rows.push({l:'HPP barang terjual', v:R.hppOff+R.hppOn, lv:1, kurang:true});
  if(R.hppTukar) rows.push({l:'HPP barang pengganti retur (tukar barang)', v:R.hppTukar, lv:1, kurang:true});
  rows.push({l:'Laba kotor', v:R.labaKotor, tot:true, sub:`Margin kotor ${kuPct(R.labaKotor,R.bersih)}`, pct:false});
  rows.push({head:'Biaya'});
  const grup=(list,lv)=>{ const g=new Map(); list.forEach(b=>g.set(b.kategori,(g.get(b.kategori)||0)+b.jumlah)); return [...g.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>({l:hkEsc(k), v, lv, kurang:true})); };
  if(gabung){ if(R.biayaEvent.length){ rows.push({l:'Biaya event', v:R.biayaEvent.reduce((a,b)=>a+b.jumlah,0), lv:1, kurang:true}); rows.push(...grup(R.biayaEvent,2)); }
    if(R.biayaUmum.length){ rows.push({l:'Biaya umum', v:R.biayaUmum.reduce((a,b)=>a+b.jumlah,0), lv:1, kurang:true}); rows.push(...grup(R.biayaUmum,2)); } }
  else { rows.push(...grup(R.biaya,1)); if(R.alokasi){ const NB=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']; rows.push({l:'Bagian biaya umum', v:R.alokasi, lv:1, kurang:true, sub:R.alokRinci.map(x=>`${NB[+x.bulan.slice(5,7)-1]}: ${kuPct(x.porsi,1)} dari ${hkRp(x.umum)}`).join(' · ')}); } }
  if(!R.biaya.length&&!R.alokasi) rows.push({l:'<span class="hk-sub">Belum ada biaya dicatat</span>', v:0, lv:1, pct:false});
  rows.push({l:'Total biaya', v:R.totBiaya, tot:true, kurang:true});
  if(R.rugi.length||R.kasLebih){ rows.push({head:'Kerugian dan selisih'});
    const g=new Map(); R.rugi.forEach(r=>g.set(r.jenis,(g.get(r.jenis)||0)+r.jumlah)); g.forEach((v,k)=>rows.push({l:k, v, lv:1, kurang:true}));
    if(R.totGanti) rows.push({l:'Diganti penanggung jawab', v:R.totGanti, lv:1});
    if(R.kasLebih) rows.push({l:'Selisih kas lebih', v:R.kasLebih, lv:1}); }
  rows.push({l:'Laba bersih', v:R.labaBersih, tot:true, grand:true, sub:`Margin bersih ${kuPct(R.labaBersih,R.bersih)}`, pct:false});
  return kuTabel(rows, R.bersih)+(R.pajak?`<div class="hk-sub" style="padding:8px 12px 0;">PPN dipungut ${hkRp(R.pajak)} tidak masuk pendapatan karena disetor ke negara.</div>`:''); }
function kuTabelSederhana(head, rows, foot){
  return `<table class="hk-varian"><thead><tr>${head.map((h,i)=>`<th class="${i?'hk-num':''}">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${i?'hk-num':''}">${c}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${head.length}" class="hk-empty">Belum ada data</td></tr>`}</tbody>${foot&&rows.length?`<tfoot><tr>${foot.map((c,i)=>`<td class="${i?'hk-num':''}" style="font-weight:700;">${c}</td>`).join('')}</tr></tfoot>`:''}</table>`; }
function kuKatUkuran(R){
  const kat=[...R.kat.entries()].sort((a,b)=>b[1].jual-a[1].jual), uk=[...R.ukuran.entries()], ORD=['XS','S','M','L','XL','XXL','3XL'];
  uk.sort((a,b)=>(ORD.indexOf(a[0])+1||99)-(ORD.indexOf(b[0])+1||99)); const tq=uk.reduce((a,x)=>a+x[1].qty,0);
  return `<div class="hk-grid2">
    <div class="card"><div class="widget-title">Per kategori</div>${kuTabelSederhana(['Kategori','Qty','Penjualan','Laba kotor','Margin'], kat.map(([k,x])=>[hkEsc(k),x.qty,hkRp(x.jual),hkRp(x.jual-x.hpp),kuPct(x.jual-x.hpp,x.jual)]))}<div class="hk-sub" style="margin-top:6px;">Dihitung dari harga jual sebelum diskon transaksi.</div></div>
    <div class="card"><div class="widget-title">Per ukuran</div>${kuTabelSederhana(['Ukuran','Qty','Porsi qty','Penjualan'], uk.map(([k,x])=>[hkEsc(k),x.qty,kuPct(x.qty,tq),hkRp(x.jual)]))}<div class="hk-sub" style="margin-top:6px;">Hanya produk yang punya varian ukuran. Dipakai untuk menentukan komposisi ukuran saat produksi dan kirim stok berikutnya.</div></div>
  </div>`; }
function kuPeriodeBar(){ const K=KU(), [dari,sampai]=kuRange(), P=[['bulan','Bulan ini'],['lalu','Bulan lalu'],['90','90 hari'],['tahun','Tahun ini'],['semua','Semua']];
  return `<div class="hk-tabsrow ku-noprint"><div class="tabs">${P.map(([k,l])=>`<div class="tab ${K.per===k?'active':''}" data-ku="per" data-ku-arg="${k}">${l}</div>`).join('')}</div>
    <div class="hk-rentang ${K.per==='rentang'?'on':''}"><span>Dari</span><input type="date" data-hk-bind="hk.keu.dari" data-ku-tgl="1" value="${dari||''}" max="${sampai||hkYmd(hkToday())}"><span>s/d</span><input type="date" data-hk-bind="hk.keu.sampai" data-ku-tgl="1" value="${sampai||''}" min="${dari||''}" max="${hkYmd(hkToday())}">${K.per==='rentang'?'<span class="hk-rentang-x" data-ku="per" data-ku-arg="semua" title="Hapus rentang">✕</span>':''}</div></div>`; }

/* ════════ LAPORAN KEUANGAN PER EVENT ════════ */
function viewKeuEvent(){
  const K=KU(), evs=kuEvList(); if(!K.evId||!evs.some(e=>e.id===K.evId)) K.evId=(evs.find(e=>hkStatusEvent(e)!=='Akan Datang')||evs[0]||{}).id;
  const e=evs.find(x=>x.id===K.evId); if(!e) return '<div class="hk-empty">Belum ada event</div>';
  const R=kuHitung(e.id,null,null), st=hkStatusEvent(e), cat=hkCatalog(state.products);
  const atv=R.nTrx?R.bersih/R.nTrx:0, upt=R.nTrx?R.qty/R.nTrx:0, mk=R.bersih?R.labaKotor/R.bersih:0, impas=mk>0?(R.totBiaya+R.totRugi-R.totGanti)/mk:null;
  const metode=[...R.metode.entries()].filter(([,v])=>v), totM=metode.reduce((a,[,v])=>a+v,0);
  const prod=[...R.st.entries()].map(([sku,s])=>{ const p=R.produk.get(sku)||{qty:0,jual:0,hpp:0}, c=cat.find(x=>x.sku===sku)||{nama:sku}; return {sku, nama:c.nama, ...s, jual:p.jual, laba:p.jual-p.hpp, str:s.masuk?s.terjual/s.masuk:0}; }).sort((a,b)=>b.jual-a.jual);
  const lambat=prod.filter(p=>p.str<.3);
  return `<div class="page-head"><span class="page-title">Laporan Keuangan Event</span><div class="spacer"></div>
    <select class="hk-sel ku-noprint" style="width:auto;min-width:260px;" data-hk-bind="hk.keu.evId" data-ku-live="1">${evs.map(x=>`<option value="${x.id}" ${x.id===e.id?'selected':''}>${hkEsc(x.nama)} · ${tglRange(x.mulai,x.selesai)}</option>`).join('')}</select>
    <button class="btn ku-noprint" data-ku="biaya-baru" data-ku-arg="${e.id}">+ Catat Biaya</button><button class="btn ku-noprint" data-ku="csv-event">⭳ Unduh CSV</button><button class="btn ku-noprint" data-ku="cetak">Cetak / PDF</button></div>
  <div class="page-sub"><b>${hkEsc(e.nama)}</b> · ${hkEsc(e.venue||'')} · ${tglRange(e.mulai,e.selesai)} · Penanggung jawab ${hkEsc(e.pj||'-')} · ${statusBadge(st)} <span class="hk-row-link ku-noprint" style="color:var(--accent-text);font-weight:600;" data-hk-act="ev-open" data-hk-arg="${e.id}">Detail event ›</span></div>
  ${kuAlokSwitch()}
  ${e.ditutup?'':`<div class="hk-note" style="cursor:default;">${st==='Akan Datang'?'Event belum dimulai. Laporan baru berisi biaya yang sudah dicatat.':'Event belum ditutup. Angka masih bisa berubah: penjualan berjalan, selisih stok opname, dan sisa barang yang kembali ke gudang baru final setelah Tutup Event.'}</div>`}
  <div class="hk-kpis">
    <div class="metric-card"><div class="metric-label">Penjualan bersih</div><div class="metric-value">${hkRp(R.bersih)}</div><div class="hk-sub">${R.nTrx} transaksi · ${R.qty} pcs</div></div>
    <div class="metric-card"><div class="metric-label">Laba kotor</div><div class="metric-value">${hkRp(R.labaKotor)}</div><div class="hk-sub">margin ${kuPct(R.labaKotor,R.bersih)}</div></div>
    <div class="metric-card"><div class="metric-label">Biaya + kerugian</div><div class="metric-value">${hkRp(R.totBiaya+R.totRugi-R.totGanti)}</div><div class="hk-sub">${kuPct(R.totBiaya+R.totRugi-R.totGanti,R.bersih)} dari penjualan</div></div>
    <div class="metric-card"><div class="metric-label">Laba bersih</div><div class="metric-value" style="color:${R.labaBersih<0?'var(--danger-text)':'var(--success-text)'};">${R.labaBersih<0?'−':''}${hkRp(Math.abs(R.labaBersih))}</div><div class="hk-sub">margin ${kuPct(R.labaBersih,R.bersih)}</div></div>
    <div class="metric-card"><div class="metric-label">Sell-through</div><div class="metric-value">${R.sellThrough==null?'–':kuPct(R.terjual,R.masuk)}</div><div class="hk-sub">${R.terjual||0} dari ${R.masuk||0} pcs dikirim</div></div>
  </div>
  <div class="hk-grid2" style="align-items:start;">
    <div class="card"><div class="widget-title">Laba rugi event</div>${kuLabaRugi(R,false)}</div>
    <div>
      <div class="card" style="margin-bottom:14px;"><div class="widget-title">Indikator penjualan</div>${kuInd([
        ['Rata-rata nilai transaksi', hkRp(Math.round(atv))],
        ['Rata-rata pcs per transaksi', upt.toLocaleString('id-ID',{maximumFractionDigits:1})+' pcs'],
        ['Diskon dari penjualan kotor', kuPct(R.diskon,R.kotorOff)],
        ['Barang diretur', `${R.qtyRetur} pcs (${kuPct(R.qtyRetur,R.qty)})`],
        ['Titik impas', impas==null?'–':hkRp(Math.round(impas)), 'Penjualan bersih minimum supaya biaya dan kerugian tertutup, dengan margin kotor event ini'],
        ['Status titik impas', impas==null?'–':R.bersih>=impas?'<span style="color:var(--success-text);font-weight:700;">Sudah lewat</span>':`<span style="color:var(--danger-text);font-weight:700;">Kurang ${hkRp(Math.round(impas-R.bersih))}</span>`]])}</div>
      <div class="card"><div class="widget-title">Uang diterima</div>${kuTabel([...metode.map(([k,v])=>({l:hkEsc(k), v, lv:0})), {l:'Total diterima', v:totM, tot:true, pct:false},
        ...(R.pajak?[{l:'Termasuk PPN dipungut', v:R.pajak, lv:1, pct:false}]:[]),
        ...(R.presale?[{l:`Termasuk uang pre-sale, barang belum diambil (${R.nPresale} pesanan)`, v:R.presale, lv:1, pct:false, sub:'Belum dihitung sebagai penjualan. Masuk penjualan saat barang diserahkan, atau dikembalikan kalau perlu refund.'}]:[]),
        {l:'Setoran tunai dari laci (uang dihitung − modal awal)', v:R.setoran, pct:false, sub:'Dari shift yang sudah ditutup. Kas keluar laci sudah terpakai di event.'}], totM)}</div>
    </div>
  </div>
  ${kuKatUkuran(R)}
  <div class="card" style="padding:0;overflow:auto;margin-bottom:14px;"><div class="widget-title" style="padding:14px 16px 0;">Per produk${lambat.length?` <span class="hk-sub" style="font-weight:400;">· ${lambat.length} varian terjual di bawah 30% (lambat)</span>`:''}</div>
    <table><thead><tr><th>Produk</th><th class="hk-num">Diterima di event</th><th class="hk-num">Terjual</th><th class="hk-num">Sell-through</th><th class="hk-num">${e.ditutup?'Kembali ke gudang':'Sisa di event'}</th><th class="hk-num">Penjualan</th><th class="hk-num">Laba kotor</th></tr></thead>
    <tbody>${prod.map(p=>`<tr><td>${hkEsc(p.nama)}<div class="hk-sub">${p.sku}</div></td><td class="hk-num">${p.masuk}</td><td class="hk-num">${p.terjual}</td><td class="hk-num" style="${p.str<.3?'color:var(--danger-text);font-weight:700;':''}">${kuPct(p.terjual,p.masuk)}</td><td class="hk-num">${e.ditutup?p.kembali:p.sisa}</td><td class="hk-num">${hkRp(p.jual)}</td><td class="hk-num">${hkRp(p.laba)}</td></tr>`).join('')||'<tr><td colspan="7" class="hk-empty">Belum ada barang dikirim ke event ini</td></tr>'}</tbody></table></div>
  <div class="card" style="padding:0;overflow:auto;"><div class="widget-title" style="padding:14px 16px 0;">Rincian biaya dan kerugian</div>${kuRincian(R)}</div>`; }
function kuRincian(R, gabung){
  const rows=[...R.biaya.map(b=>({tgl:b.tanggal, jenis:b.laci?ivBadge('Laci POS','badge-mut'):ivBadge('Biaya','badge-info'), kat:b.kategori, ket:b.keterangan, tuju:gabung?(b.eventId?(hkTempat(data(),b.eventId)||{nama:'-'}).nama:'Umum'):'', oleh:b.oleh, v:b.jumlah, b})),
    ...R.rugi.map(r=>({tgl:r.waktu.slice(0,10), jenis:ivBadge('Kerugian','badge-danger'), kat:r.jenis, ket:`${r.no}${r.pj?` · PJ ${r.pj}`:''}${r.ganti?` · diganti ${hkRp(r.ganti)}`:''}`, tuju:gabung?r.lokasi:'', oleh:'', v:r.jumlah}))].sort((a,b)=>b.tgl.localeCompare(a.tgl));
  return `<table><thead><tr><th>Tanggal</th><th>Jenis</th>${gabung?'<th>Dibebankan ke</th>':''}<th>Kategori</th><th>Keterangan</th><th>Dicatat oleh</th><th class="hk-num">Jumlah</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td>${hkTgl(r.tgl)}</td><td>${r.jenis}</td>${gabung?`<td>${hkEsc(r.tuju)}</td>`:''}<td>${hkEsc(r.kat)}</td><td>${hkEsc(r.ket)}${r.b&&r.b.foto?` <a href="${r.b.foto}" target="_blank" class="hk-sub">bukti</a>`:''}</td><td>${hkEsc(r.oleh||'')}</td><td class="hk-num">${hkRp(r.v)}</td></tr>`).join('')||`<tr><td colspan="${gabung?7:6}" class="hk-empty">Belum ada biaya atau kerugian</td></tr>`}</tbody></table>`; }

function kuAlokSwitch(){ const on=kuAlokAktif();
  return `<div class="card ku-noprint" style="display:flex;align-items:center;gap:12px;padding:12px 16px;margin-bottom:14px;"><div class="toggle ${on?'on':''}" data-ku="alok"></div><div style="flex:1;"><b>Bagi biaya umum ke event</b><div class="hk-sub">${on?'Aktif. Laba bersih event ikut menanggung gaji, sewa gudang, dan biaya umum lain, sesuai porsi penjualan event di bulan itu.':'Nonaktif. Laba bersih event hanya dikurangi biaya event itu sendiri.'} Laba bersih keseluruhan tidak berubah.</div></div></div>`; }
/* ════════ LAPORAN KEUANGAN KESELURUHAN ════════ */
function viewKeuRingkasan(){
  const [dari,sampai]=kuRange(), R=kuHitung(null,dari,sampai), D=data();
  /* arus kas periode: uang yang benar-benar masuk dan keluar */
  const masukOff=[...R.metode.entries()].filter(([k])=>!state.marketplaceChannels.some(c=>c.nama===k));
  const cair=D.orders.filter(o=>o.status==='Selesai'&&ivDalam(o.tanggal.slice(0,10),dari,sampai)).reduce((a,o)=>a+o.items.reduce((s,i)=>s+i.qty*i.harga,0)-(Number(o.potongan)||0),0);
  const bayarSup=state.faktur.reduce((a,f)=>a+(f.bayar||[]).filter(b=>ivDalam(b.tanggal,dari,sampai)).reduce((x,b)=>x+b.jumlah,0),0);
  const biayaKas=R.biaya.filter(b=>!b.laci).reduce((a,b)=>a+b.jumlah,0), laci=R.biaya.filter(b=>b.laci).reduce((a,b)=>a+b.jumlah,0);
  const kasMasuk=masukOff.reduce((a,[,v])=>a+v,0)+cair, kasKeluar=bayarSup+biayaKas+laci, kasBersih=kasMasuk-kasKeluar;
  /* posisi hari ini */
  const cat=hkCatalog(state.products), hppOf=sku=>(cat.find(c=>c.sku===sku)||{}).hpp||0, perLok=new Map(); let transit=0;
  state.stokItems.forEach(it=>{ (it.perOutlet||[]).forEach(p=>{ if(p.akhir>0) perLok.set(p.outlet,(perLok.get(p.outlet)||0)+p.akhir*hppOf(it.sku)); }); transit+=(it.transit||0)*hppOf(it.sku); });
  const persediaan=[...perLok.values()].reduce((a,b)=>a+b,0)+transit, utang=state.faktur.reduce((a,f)=>a+hkFakturSisa(f),0);
  const piutang=D.orders.filter(o=>o.status!=='Selesai'&&o.status!=='Dibatalkan').reduce((a,o)=>a+o.items.reduce((s,i)=>s+i.qty*i.harga,0)-(Number(o.potongan)||0),0);
  const rugiBuka=hkKerugianSemua(D).reduce((a,o)=>a+hkKerugianSisa(o),0);
  const psBelum=D.trx.filter(t=>t.status==='Lunas'&&t.pengambilan&&t.pengambilan.status!=='Diambil').reduce((a,t)=>a+t.total,0);
  /* per event */
  const evRows=kuEvList().map(e=>({e, R:kuHitung(e.id,dari,sampai)})).filter(x=>x.R.nTrx||x.R.totBiaya||x.R.totRugi);
  const bulan=[...R.bulan.entries()].sort((a,b)=>b[0].localeCompare(a[0]));
  const NB=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'], nb=k=>`${NB[+k.slice(5,7)-1]} ${k.slice(0,4)}`;
  return `<div class="page-head"><span class="page-title">Laporan Keuangan Keseluruhan</span><div class="spacer"></div><button class="btn ku-noprint" data-ku="biaya-baru">+ Catat Biaya</button><button class="btn ku-noprint" data-ku="csv-all">⭳ Unduh CSV</button><button class="btn ku-noprint" data-ku="cetak">Cetak / PDF</button></div>
  <div class="page-sub">${dari?`${hkTgl(dari)} s/d ${hkTgl(sampai)}`:'Semua tanggal'} · Semua event, jual langsung di ${HK_GUDANG}, dan penjualan online. Biaya umum (gaji tetap, sewa gudang, dan lainnya) ikut dihitung.</div>
  ${kuPeriodeBar()}
  <div class="hk-kpis">
    <div class="metric-card"><div class="metric-label">Penjualan bersih</div><div class="metric-value">${hkRp(R.bersih)}</div><div class="hk-sub">${R.n} transaksi · ${R.qtyAll} pcs</div></div>
    <div class="metric-card"><div class="metric-label">Laba kotor</div><div class="metric-value">${hkRp(R.labaKotor)}</div><div class="hk-sub">margin ${kuPct(R.labaKotor,R.bersih)}</div></div>
    <div class="metric-card"><div class="metric-label">Biaya + kerugian</div><div class="metric-value">${hkRp(R.totBiaya+R.totRugi-R.totGanti)}</div><div class="hk-sub">event ${hkRp(R.biayaEvent.reduce((a,b)=>a+b.jumlah,0))} · umum ${hkRp(R.biayaUmum.reduce((a,b)=>a+b.jumlah,0))}</div></div>
    <div class="metric-card"><div class="metric-label">Laba bersih</div><div class="metric-value" style="color:${R.labaBersih<0?'var(--danger-text)':'var(--success-text)'};">${R.labaBersih<0?'−':''}${hkRp(Math.abs(R.labaBersih))}</div><div class="hk-sub">margin ${kuPct(R.labaBersih,R.bersih)}</div></div>
    <div class="metric-card"><div class="metric-label">Arus kas bersih</div><div class="metric-value" style="${kasBersih<0?'color:var(--danger-text);':''}">${kasBersih<0?'−':''}${hkRp(Math.abs(kasBersih))}</div><div class="hk-sub">masuk ${hkRp(kasMasuk)} · keluar ${hkRp(kasKeluar)}</div></div>
  </div>
  <div class="hk-grid2" style="align-items:start;">
    <div class="card"><div class="widget-title">Laba rugi</div>${kuLabaRugi(R,true)}</div>
    <div>
      <div class="card" style="margin-bottom:14px;"><div class="widget-title">Arus kas</div>${kuTabel([{head:'Uang masuk'},...masukOff.map(([k,v])=>({l:`Penjualan offline · ${hkEsc(k)}`, v, lv:1})),{l:'Pencairan marketplace (pesanan selesai)', v:cair, lv:1},{l:'Total masuk', v:kasMasuk, tot:true},
        {head:'Uang keluar'},{l:'Bayar pemasok (faktur pembelian)', v:bayarSup, lv:1, kurang:true},{l:'Biaya dicatat', v:biayaKas, lv:1, kurang:true},{l:'Kas keluar laci POS', v:laci, lv:1, kurang:true},{l:'Total keluar', v:kasKeluar, tot:true, kurang:true},
        {l:'Arus kas bersih', v:kasBersih, tot:true, grand:true}])}<div class="hk-sub" style="padding:8px 12px 0;">Arus kas berbeda dari laba: pembelian stok mengurangi kas saat dibayar, tapi baru jadi HPP saat barangnya terjual.</div></div>
      <div class="card"><div class="widget-title">Posisi per hari ini</div>${kuTabel([{head:'Persediaan (stok × HPP)'},...[...perLok.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>({l:hkEsc(k), v, lv:1})),...(transit?[{l:'Dalam perjalanan', v:transit, lv:1}]:[]),{l:'Total persediaan', v:persediaan, tot:true},
        {head:'Tagihan'},{l:'Piutang marketplace (pesanan belum selesai)', v:piutang, lv:1},{l:'Kerugian belum diselesaikan penanggung jawab', v:rugiBuka, lv:1},{l:'Utang ke pemasok (faktur belum lunas)', v:utang, lv:1, kurang:true},...(psBelum?[{l:'Uang pre-sale, barang belum diambil atau perlu refund', v:psBelum, lv:1, kurang:true}]:[])])}</div>
    </div>
  </div>
  ${kuAlokSwitch()}
  <div class="card" style="padding:0;overflow:auto;margin-bottom:14px;"><div class="widget-title" style="padding:14px 16px 0;">Per event</div>
    <table><thead><tr><th>Event</th><th>Status</th><th class="hk-num">Penjualan bersih</th><th class="hk-num">Laba kotor</th><th class="hk-num">Biaya event</th>${kuAlokAktif()?'<th class="hk-num">Bagian biaya umum</th>':''}<th class="hk-num">Kerugian</th><th class="hk-num">Laba bersih</th><th class="hk-num">Margin bersih</th><th class="hk-num">Sell-through</th></tr></thead><tbody>
    ${evRows.map(({e,R:r})=>`<tr class="hk-row-link" style="cursor:pointer;" data-ku="ev-lap" data-ku-arg="${e.id}"><td><b style="color:var(--accent-text);">${hkEsc(e.nama)}</b><div class="hk-sub">${tglRange(e.mulai,e.selesai)}</div></td><td>${statusBadge(hkStatusEvent(e))}</td><td class="hk-num">${hkRp(r.bersih)}</td><td class="hk-num">${hkRp(r.labaKotor)}</td><td class="hk-num">${hkRp(r.totBiaya-r.alokasi)}</td>${kuAlokAktif()?`<td class="hk-num">${hkRp(r.alokasi)}</td>`:''}<td class="hk-num">${hkRp(r.totRugi-r.totGanti)}</td><td class="hk-num" style="font-weight:700;">${kuRp(r.labaBersih)}</td><td class="hk-num">${kuPct(r.labaBersih,r.bersih)}</td><td class="hk-num">${r.sellThrough==null?'–':kuPct(r.terjual,r.masuk)}</td></tr>`).join('')||`<tr><td colspan="${kuAlokAktif()?10:9}" class="hk-empty">Tidak ada event di periode ini</td></tr>`}</tbody></table>
    <div class="hk-sub" style="padding:8px 16px 12px;">Klik event untuk membuka laporannya. Angka event di sini hanya untuk tanggal di periode yang dipilih.</div></div>
  <div class="card" style="padding:0;overflow:auto;margin-bottom:14px;"><div class="widget-title" style="padding:14px 16px 0;">Per bulan</div>
    <table><thead><tr><th>Bulan</th><th class="hk-num">Penjualan bersih</th><th class="hk-num">HPP</th><th class="hk-num">Laba kotor</th><th class="hk-num">Biaya</th><th class="hk-num">Kerugian</th><th class="hk-num">Laba bersih</th></tr></thead><tbody>
    ${bulan.map(([k,m])=>{ const lb=m.bersih-m.hpp-m.biaya-m.rugi; return `<tr><td>${nb(k)}</td><td class="hk-num">${hkRp(m.bersih)}</td><td class="hk-num">${hkRp(m.hpp)}</td><td class="hk-num">${hkRp(m.bersih-m.hpp)}</td><td class="hk-num">${hkRp(m.biaya)}</td><td class="hk-num">${hkRp(m.rugi)}</td><td class="hk-num" style="font-weight:700;">${kuRp(lb)}</td></tr>`; }).join('')||'<tr><td colspan="7" class="hk-empty">Belum ada data</td></tr>'}</tbody></table>
    <div class="hk-sub" style="padding:8px 16px 12px;">Laba bersih per bulan belum termasuk selisih kas lebih.</div></div>
  ${kuKatUkuran(R)}
  <div class="card" style="padding:0;overflow:auto;"><div class="widget-title" style="padding:14px 16px 0;">Rincian biaya dan kerugian</div>${kuRincian(R,true)}</div>`; }

/* ════════ BIAYA ════════ */
function viewKeuBiaya(){
  const K=KU(), dari=K.bDari||null, sampai=K.bSampai||null;
  let L=[...kuBiaya(undefined,dari,sampai), ...kuLaci(null,dari,sampai)];
  if(K.bTuju==='umum') L=L.filter(b=>!b.eventId); else if(K.bTuju) L=L.filter(b=>b.eventId===K.bTuju);
  if(K.bKat) L=L.filter(b=>b.kategori===K.bKat);
  L.sort((a,b)=>b.tanggal.localeCompare(a.tanggal)||String(b.no||'').localeCompare(String(a.no||'')));
  const tot=L.reduce((a,b)=>a+b.jumlah,0), kats=[...new Set([...BIAYA_KAT_EVENT,...BIAYA_KAT_UMUM,'Kas keluar laci'])];
  const nm=id=>id?(hkTempat(data(),id)||{nama:'-'}).nama:'Umum';
  return `<div class="page-head"><span class="page-title">Biaya</span><div class="spacer"></div><button class="btn" data-ku="csv-biaya">⭳ Unduh CSV</button><button class="btn btn-primary" data-ku="biaya-baru">+ Catat Biaya</button></div>
  <div class="page-sub">Biaya event (sewa booth, transport, honor kru, dan lainnya) dan biaya umum (gaji tetap, sewa gudang, iklan online, dan lainnya). Kas keluar dari laci POS ikut tampil otomatis. Pembelian barang dari pemasok tidak dicatat di sini, tapi di Faktur Pembelian.</div>
  <div class="hk-kpis">
    <div class="metric-card"><div class="metric-label">Total</div><div class="metric-value">${hkRp(tot)}</div><div class="hk-sub">${L.length} catatan</div></div>
    <div class="metric-card"><div class="metric-label">Biaya event</div><div class="metric-value">${hkRp(L.filter(b=>b.eventId&&!b.laci).reduce((a,b)=>a+b.jumlah,0))}</div></div>
    <div class="metric-card"><div class="metric-label">Biaya umum</div><div class="metric-value">${hkRp(L.filter(b=>!b.eventId).reduce((a,b)=>a+b.jumlah,0))}</div></div>
    <div class="metric-card"><div class="metric-label">Kas keluar laci POS</div><div class="metric-value">${hkRp(L.filter(b=>b.laci).reduce((a,b)=>a+b.jumlah,0))}</div></div>
  </div>
  <div class="hk-filterbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
    <select class="hk-sel" style="width:auto;" data-hk-bind="hk.keu.bTuju" data-ku-live="1"><option value="">Semua</option><option value="umum" ${K.bTuju==='umum'?'selected':''}>Umum</option>${kuEvList().map(e=>`<option value="${e.id}" ${K.bTuju===e.id?'selected':''}>${hkEsc(e.nama)}</option>`).join('')}</select>
    <select class="hk-sel" style="width:auto;" data-hk-bind="hk.keu.bKat" data-ku-live="1"><option value="">Semua kategori</option>${kats.map(k=>`<option ${K.bKat===k?'selected':''}>${hkEsc(k)}</option>`).join('')}</select>
    <span class="hk-sub">Dari</span><input type="date" class="hk-sel" style="width:auto;" data-hk-bind="hk.keu.bDari" data-ku-live="1" value="${hkEsc(K.bDari||'')}"><span class="hk-sub">s/d</span><input type="date" class="hk-sel" style="width:auto;" data-hk-bind="hk.keu.bSampai" data-ku-live="1" value="${hkEsc(K.bSampai||'')}"></div>
  <div class="card" style="padding:0;overflow:auto;"><table><thead><tr><th>Tanggal</th><th>No.</th><th>Dibebankan ke</th><th>Kategori</th><th>Keterangan</th><th>Cara bayar</th><th>Dicatat oleh</th><th class="hk-num">Jumlah</th><th></th></tr></thead><tbody>
    ${L.map(b=>`<tr><td>${hkTgl(b.tanggal)}</td><td>${b.laci?ivBadge('Laci POS','badge-mut'):hkEsc(b.no)}</td><td>${hkEsc(nm(b.eventId))}</td><td>${hkEsc(b.kategori)}</td><td>${hkEsc(b.keterangan)}${b.foto?` <a href="${b.foto}" target="_blank" class="hk-sub">bukti</a>`:''}</td><td>${hkEsc(b.cara)}</td><td>${hkEsc(b.oleh)}</td><td class="hk-num">${hkRp(b.jumlah)}</td>
      <td style="white-space:nowrap;">${b.laci?'<span class="hk-sub">dari POS</span>':!kuOwner()?'':`<span class="hk-row-link" style="color:var(--accent-text);" data-ku="biaya-ubah" data-ku-arg="${b.id}">Ubah</span> · <span class="hk-row-link" style="color:var(--danger-text);" data-ku="biaya-hapus" data-ku-arg="${b.id}">Hapus</span>`}</td></tr>`).join('')||'<tr><td colspan="9" class="hk-empty">Belum ada biaya di filter ini</td></tr>'}</tbody>
    ${L.length?`<tfoot><tr><td colspan="7" style="font-weight:700;">Total</td><td class="hk-num" style="font-weight:700;">${hkRp(tot)}</td><td></td></tr></tfoot>`:''}</table></div>`; }
function viewKeuBiayaForm(){
  const f=KU().form, kats=f.eventId?BIAYA_KAT_EVENT:BIAYA_KAT_UMUM;
  return `${backButtonHTML()}<div class="page-head"><span class="page-title">${f.id?'Ubah Biaya':'Catat Biaya'}</span></div>
  <div class="card" style="max-width:1000px;margin:0 auto;">
    <div class="field"><label>Dibebankan ke<span class="req">*</span></label><div><select id="kuTuju" data-hk-bind="hk.keu.form.eventId" data-ku-live="1">${kuOwner()?'<option value="">Umum (tidak terkait event)</option>':''}${kuEvList().map(e=>`<option value="${e.id}" ${f.eventId===e.id?'selected':''}>${hkEsc(e.nama)} · ${tglRange(e.mulai,e.selesai)}${e.ditutup?' (ditutup)':''}</option>`).join('')}</select>
      <div class="help-text">Biaya event masuk laporan keuangan event itu. Biaya umum hanya masuk laporan keseluruhan.${kuOwner()?'':' Setelah disimpan, hanya Owner yang bisa mengubah atau menghapus.'}</div></div></div>
    <div class="field"><label>Tanggal<span class="req">*</span></label><input type="date" id="kuTgl" data-hk-bind="hk.keu.form.tanggal" value="${f.tanggal}" max="${ivToday()}"></div>
    <div class="field"><label>Kategori<span class="req">*</span></label><select id="kuKat" data-hk-bind="hk.keu.form.kategori"><option value="">Pilih kategori</option>${kats.map(k=>`<option ${f.kategori===k?'selected':''}>${k}</option>`).join('')}</select></div>
    <div class="field"><label>Keterangan<span class="req">*</span></label><input id="kuKet" data-hk-bind="hk.keu.form.keterangan" value="${hkEsc(f.keterangan)}" placeholder="${f.eventId?'Contoh: sewa booth 3 hari, kirim 3 koli via kargo':'Contoh: gaji admin gudang bulan ini'}">${f.kategori==='Potongan bank & MDR QRIS'?'<div class="help-text">Isi sesuai potongan yang tertulis di mutasi rekening atau laporan aplikasi merchant.</div>':''}</div>
    <div class="field"><label>Jumlah (Rp)<span class="req">*</span></label><input type="number" min="1" id="kuJml" data-hk-bind="hk.keu.form.jumlah" value="${hkEsc(f.jumlah)}"></div>
    <div class="field"><label>Cara bayar<span class="req">*</span></label><div class="row-2">${['Transfer','Tunai'].map(k=>`<div class="hk-check ${f.cara===k?'on':''}" data-ku="b-cara" data-ku-arg="${k}"><input type="radio" ${f.cara===k?'checked':''} style="pointer-events:none;"><div><b>${k}</b><div class="hk-sub">${k==='Tunai'?'Dibayar dari kas kantor, bukan laci POS':'Dari rekening usaha'}</div></div></div>`).join('')}</div></div>
    <div class="field"><label>Bukti</label><div><input type="file" accept="image/*" id="kuFoto">${f.foto?`<div style="margin-top:8px;"><img src="${f.foto}" style="max-width:120px;border-radius:8px;border:1px solid var(--border);"> <span class="hk-row-link" style="color:var(--danger-text);" data-ku="b-foto-x">Hapus</span></div>`:''}<div class="help-text">Opsional. Foto nota atau bukti transfer.</div></div></div>
    <div class="form-actions"><button class="btn" data-nav="${f.balik||'keu-biaya'}">Batal</button><div class="spacer"></div><button class="btn btn-primary" data-ku="b-simpan">Simpan</button></div>
  </div>`; }
function kuHapusModal(){ const b=state.biaya.find(x=>x.id===state.hk.modal.id);
  return `<div class="confirm-box"><h4>Hapus biaya ${hkEsc(b.no)}?</h4><p>${hkEsc(b.kategori)} · ${hkEsc(b.keterangan)} · ${hkRp(b.jumlah)}. Laporan keuangan langsung berubah.</p><div class="confirm-actions"><button class="btn" data-hk-act="modal-close">Batal</button><button class="btn btn-danger" data-ku="b-hapus-ok">Hapus</button></div></div>`; }

/* ── CSV ── */
function kuCsvLR(R){ const r=[['Pos','Jumlah']]; const p=(l,v)=>r.push([l,v]);
  [...R.saluran.entries()].forEach(([k,x])=>p('Penjualan '+k,x.jual)); p('Penjualan kotor',R.kotor); p('Diskon & promo',-R.diskon); p('Pembulatan',-R.bulat); p('Retur uang kembali',-R.returUang); p('Potongan marketplace',-R.potongan);
  p('Penjualan bersih',R.bersih); p('HPP',-R.hpp); p('Laba kotor',R.labaKotor); const g=new Map(); R.biaya.forEach(b=>g.set(b.kategori,(g.get(b.kategori)||0)+b.jumlah)); g.forEach((v,k)=>p('Biaya '+k,-v));
  p('Total biaya',-R.totBiaya); p('Kerugian',-R.totRugi); p('Diganti penanggung jawab',R.totGanti); p('Selisih kas lebih',R.kasLebih); p('Laba bersih',R.labaBersih); p('PPN dipungut (bukan pendapatan)',R.pajak); return r; }

/* ════════ ROUTING ════════ */
const _renderMainKu=renderMain;
renderMain=function(){ const m=document.getElementById('main'), V={'keu-ringkasan':viewKeuRingkasan,'keu-event':viewKeuEvent,'keu-biaya':viewKeuBiaya,'keu-biaya-form':viewKeuBiayaForm};
  if(state.view==='keuangan') state.view='keu-ringkasan';
  if(state.view==='keu-biaya-form'&&!KU().form) state.view='keu-biaya';
  /* menu Keuangan hanya Owner. Admin hanya bisa mencatat biaya baru untuk event dari halaman detail event */
  if(V[state.view]&&!kuOwner()&&!(state.view==='keu-biaya-form'&&KU().form&&KU().form.eventId&&!KU().form.id)){ state.view='dashboard'; toast('Menu Keuangan hanya untuk Owner'); }
  if(V[state.view]) m.innerHTML=V[state.view](); else _renderMainKu(); };
const _renderSidebarKu=renderSidebar;
renderSidebar=function(){ if(kuOwner()) return _renderSidebarKu(); const i=NAV.findIndex(n=>n.id==='keuangan'), it=i>=0?NAV.splice(i,1)[0]:null; try{ _renderSidebarKu(); } finally{ if(it) NAV.splice(i,0,it); } };
const _renderHkModalKu=renderHkModal;
renderHkModal=function(){ const m=state.hk.modal; if(m&&m.type==='kuhapus'){ modalRoot.classList.add('open'); modalRoot.innerHTML=kuHapusModal(); return; } _renderHkModalKu(); };
document.addEventListener('change',e=>{ const t=e.target;
  if(t.hasAttribute&&t.hasAttribute('data-ku-live')){ if(t.getAttribute('data-hk-bind')==='hk.keu.form.eventId'){ const f=KU().form; if(f&&!(f.eventId?BIAYA_KAT_EVENT:BIAYA_KAT_UMUM).includes(f.kategori)) f.kategori=''; } setTimeout(render,0); }
  if(t.hasAttribute&&t.hasAttribute('data-ku-tgl')){ const K=KU(); if(t.value){ const [d0,s0]=kuRange(); if(K.per!=='rentang'){ K.dari=K.dari||d0; K.sampai=K.sampai||s0; } K.per='rentang'; setTimeout(render,0); } }
  if(t.id==='kuFoto'){ const fl=t.files[0]; if(!fl) return; const img=new Image(); img.onload=()=>{ const k=Math.min(1,640/Math.max(img.width,img.height)), cv=document.createElement('canvas'); cv.width=img.width*k; cv.height=img.height*k; cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height); KU().form.foto=cv.toDataURL('image/jpeg',.7); render(); }; img.src=URL.createObjectURL(fl); } });
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-ku]'); if(!el) return; const act=el.getAttribute('data-ku'), arg=el.getAttribute('data-ku-arg'), K=KU(), H=state.hk;
  switch(act){
    case 'per': K.per=arg; if(arg!=='rentang'){ K.dari=''; K.sampai=''; } render(); break;
    case 'ev-lap': K.evId=arg; state.view='keu-event'; state.openGroups.keuangan=true; render(); break;
    case 'cetak': window.print(); break;
    case 'biaya-baru': { const balik=state.view==='keu-biaya-form'?'keu-biaya':state.view; if(!kuOwner()&&!arg){ toast('Pilih event dulu'); return; } K.form={id:null, eventId:arg||(state.view==='keu-event'?K.evId:''), tanggal:ivToday(), kategori:'', keterangan:'', jumlah:'', cara:'Transfer', foto:null, balik}; FORM_VIEWS['keu-biaya-form']=balik; state.view='keu-biaya-form'; render(); break; }
    case 'alok': if(!kuOwner()) return; state.posSettings.keuAlokasi=!kuAlokAktif(); hkSaveAll(data()); render(); toast(kuAlokAktif()?'Biaya umum dibagi ke event':'Biaya umum tidak dibagi ke event'); break;
    case 'biaya-ubah': if(!kuOwner()){ toast('Hanya Owner yang bisa mengubah biaya'); return; } { const b=state.biaya.find(x=>x.id===arg); const balik=el.getAttribute('data-ku-balik')||'keu-biaya'; K.form={...b, eventId:b.eventId||'', jumlah:String(b.jumlah), balik}; FORM_VIEWS['keu-biaya-form']=balik; state.view='keu-biaya-form'; render(); break; }
    case 'biaya-hapus': if(!kuOwner()){ toast('Hanya Owner yang bisa menghapus biaya'); return; } H.modal={type:'kuhapus', id:arg}; render(); break;
    case 'b-hapus-ok': { if(!kuOwner()) return; const i=state.biaya.findIndex(x=>x.id===H.modal.id), b=state.biaya[i]; state.biaya.splice(i,1); H.modal=null; hkSaveAll(data()); render(); toast(`${b.no} dihapus`); break; }
    case 'b-cara': K.form.cara=arg; render(); break;
    case 'b-foto-x': K.form.foto=null; render(); break;
    case 'b-simpan': { const f=K.form, salah=[]; let msg=''; const add=(c,id,m)=>{ if(c){ salah.push(id); msg=msg||m; } };
      add(!f.tanggal,'kuTgl','Isi tanggal'); add(!f.kategori,'kuKat','Pilih kategori'); add((f.keterangan||'').trim().length<3,'kuKet','Isi keterangan'); add(!(Math.round(+f.jumlah)>0),'kuJml','Isi jumlah biaya');
      if(salah.length){ ivTandai(salah, salah.length>1?`${msg}. Masih ada isian lain yang ditandai merah`:msg); return; }
      const rec={eventId:f.eventId||null, tanggal:f.tanggal, kategori:f.kategori, keterangan:f.keterangan.trim(), jumlah:Math.round(+f.jumlah), cara:f.cara, foto:f.foto||null};
      if(f.id&&!kuOwner()){ toast('Hanya Owner yang bisa mengubah biaya'); return; }
      if(!kuOwner()&&!f.eventId){ ivTandai(['kuTuju'],'Admin hanya bisa mencatat biaya event'); return; }
      if(f.id){ Object.assign(state.biaya.find(x=>x.id===f.id), rec, {diubah:{oleh:akunNama(), waktu:hkIso(new Date())}}); }
      else { const pre='BY/'+hkYmd(new Date()).slice(2).replace(/-/g,'')+'/', n=state.biaya.reduce((a,x)=>Math.max(a,+String(x.no).split('/').pop()||0),0)+1;
        state.biaya.push({id:'by'+Date.now(), no:pre+String(n).padStart(4,'0'), ...rec, oleh:akunNama(), waktu:hkIso(new Date())}); }
      hkSaveAll(data()); const balik=f.balik||'keu-biaya'; if(balik==='keu-event'&&rec.eventId) K.evId=rec.eventId; if(balik==='event-detail'&&rec.eventId) state.hk.evId=rec.eventId; K.form=null; state.view=balik; render();
      toast(`Biaya ${hkRp(rec.jumlah)} tersimpan${rec.eventId?` untuk ${(hkTempat(data(),rec.eventId)||{}).nama}`:' sebagai biaya umum'}`); break; }
    case 'csv-event': { const R=kuHitung(K.evId,null,null), e=hkTempat(data(),K.evId); ivCsv(`keuangan-${e.nama.replace(/\W+/g,'-').toLowerCase()}.csv`, [['Laporan Keuangan Event',e.nama],[],...kuCsvLR(R),[],['Produk','SKU','Diterima','Terjual','Sell-through %','Penjualan'],...[...R.st.entries()].map(([sku,s])=>{ const p=R.produk.get(sku)||{jual:0}; return [(hkCatalog(state.products).find(c=>c.sku===sku)||{}).nama,sku,s.masuk,s.terjual,s.masuk?Math.round(s.terjual/s.masuk*100):0,p.jual]; })]); break; }
    case 'csv-all': { const [d,s]=kuRange(), R=kuHitung(null,d,s); ivCsv('keuangan-keseluruhan.csv', [['Laporan Keuangan Keseluruhan',d?`${d} s/d ${s}`:'Semua tanggal'],[],...kuCsvLR(R),[],['Event','Penjualan bersih','Laba kotor','Biaya','Kerugian','Laba bersih'],...kuEvList().map(e=>{ const r=kuHitung(e.id,d,s); return [e.nama,r.bersih,r.labaKotor,r.totBiaya,r.totRugi-r.totGanti,r.labaBersih]; })]); break; }
    case 'csv-biaya': ivCsv('biaya.csv', [['Tanggal','No','Dibebankan ke','Kategori','Keterangan','Cara bayar','Dicatat oleh','Jumlah'],...[...state.biaya,...kuLaci(null,null,null)].map(b=>[b.tanggal,b.no||'Laci POS',b.eventId?(hkTempat(data(),b.eventId)||{}).nama:'Umum',b.kategori,b.keterangan,b.cara,b.oleh,b.jumlah])]); break;
  } });
document.head.insertAdjacentHTML('beforeend',`<style>
  .ku-lr{width:100%;border-collapse:collapse;font-size:13px;}
  .ku-lr td{padding:7px 12px;border-bottom:1px solid #F0F0EC;vertical-align:top;}
  .ku-lr .ku-h td{padding-top:14px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-mut);border-bottom:none;}
  .ku-lr .ku-tot td{font-weight:700;background:#FAFAF8;}
  .ku-lr .ku-grand td{font-size:15px;background:#F1F2EF;border-top:2px solid var(--border-strong);}
  .ku-lr .ku-pct{width:70px;color:var(--text-mut);font-size:12px;}
  @media print{
    .topbar,.sidebar,.ku-noprint,.toast{display:none!important;}
    html,body,.body,.main,#main{height:auto!important;overflow:visible!important;background:#fff!important;}
    .main,#main{padding:0!important;}
    .card,.metric-card{box-shadow:none!important;break-inside:avoid;}
    .hk-grid2{display:block!important;} .hk-grid2>*{margin-bottom:14px;}
    .hk-kpis{grid-template-columns:repeat(5,1fr)!important;}
  }
</style>`);

/* kartu biaya di detail event: Admin dan Owner bisa mencatat biaya baru, hanya Owner yang bisa mengubah atau menghapus */
window.kuKartuEvent=function(e){ const L=[...kuBiaya(e.id,null,null), ...kuLaci(e.id,null,null)].sort((a,b)=>b.tanggal.localeCompare(a.tanggal)), tot=L.reduce((a,b)=>a+b.jumlah,0), own=kuOwner();
  return `<div class="card" style="padding:0;overflow:auto;margin-bottom:14px;"><div style="display:flex;align-items:center;gap:10px;padding:14px 16px 0;"><div class="widget-title" style="margin:0;">Biaya event · ${hkRp(tot)}</div><div style="flex:1;"></div><button class="btn" data-ku="biaya-baru" data-ku-arg="${e.id}">+ Catat Biaya</button></div>
    <table><thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th>Cara bayar</th><th>Dicatat oleh</th><th class="hk-num">Jumlah</th>${own?'<th></th>':''}</tr></thead><tbody>
    ${L.map(b=>`<tr><td>${hkTgl(b.tanggal)}</td><td>${hkEsc(b.kategori)}${b.laci?' '+ivBadge('Laci POS','badge-mut'):''}</td><td>${hkEsc(b.keterangan)}</td><td>${hkEsc(b.cara)}</td><td>${hkEsc(b.oleh)}</td><td class="hk-num">${hkRp(b.jumlah)}</td>${own?`<td style="white-space:nowrap;">${b.laci?'':`<span class="hk-row-link" style="color:var(--accent-text);" data-ku="biaya-ubah" data-ku-arg="${b.id}" data-ku-balik="event-detail">Ubah</span> · <span class="hk-row-link" style="color:var(--danger-text);" data-ku="biaya-hapus" data-ku-arg="${b.id}">Hapus</span>`}</td>`:''}</tr>`).join('')||`<tr><td colspan="${own?7:6}" class="hk-empty">Belum ada biaya untuk event ini</td></tr>`}</tbody></table>
    <div class="hk-sub" style="padding:8px 16px 12px;">${own?'Laporan laba rugi event ada di tombol Laporan Keuangan.':'Biaya yang sudah disimpan hanya bisa diubah atau dihapus Owner.'}</div></div>`; };
