const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:1.5,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push('POS: '+e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/ERR_|Failed to load/.test(m.text())) errs.push('POSc: '+m.text()); });
  const base='file://'+process.cwd()+'/out/';
  await p.goto(base+'pos.html'); await p.waitForTimeout(700);
  let n=0; const shot=async name=>{ await p.waitForTimeout(450); await p.screenshot({path:`shots/n/${String(++n).padStart(2,'0')}-${name}.png`}); };
  const ev=async(code,name)=>{ try{ await p.evaluate(code); if(name) await shot(name); }catch(e){ errs.push(name+': '+e.message.split('\n')[0]); } };
  const tap=async sel=>{ await p.locator(sel).first().click(); await p.waitForTimeout(150); };
  await shot('login');
  await tap('text=Sari Handayani'); for(const c of '33333') await tap(`#hkLoginBody .pin-key:text-is("${c}")`); await shot('pin');
  await tap(`#hkLoginBody .pin-key:text-is("3")`); await shot('home');
  await tap('.pcard:has-text("Kaos Burtuqol")'); await tap('.hk-vbtn:has-text("L")'); await tap('.hk-vbtn:has-text("L")'); await shot('varian');
  await ev(`closeSheet('sheetHkVarian')`);
  await tap('.pcard:has-text("Jersey")'); await tap('.hk-vbtn:has-text("L")'); await ev(`closeSheet('sheetHkVarian')`);
  await tap('.pcard:has-text("Tumbler")');
  await shot('home-cart');
  await tap('.cartbar-left'); await shot('cart-sheet');
  await ev(`hkCartQty(document.querySelector('#hkCartBody .qty-btn').getAttribute('onclick').match(/'(.+?)'/)[1], 1)`,'cart-plus');
  await ev(`closeSheet('sheetHkCart')`);
  await ev(`openPromoListSheet()`,'promo-list');
  await ev(`pilihPromoSementara(PROMO_PROGRAMS.find(p=>p.name.includes('Jersey')).id); simpanPromoSelection()`, 'promo-applied');
  await ev(`goToPayment()`,'pay');
  await ev(`selectPayment('transfer')`,'pay-transfer');
  await ev(`selectPayment('cash')`,'pay-cash');
  await ev(`document.querySelectorAll('#cashPanelWrap [onclick*="pickCashPreset"]')[1].click()`);
  await ev(`prosesBayar()`,'success');
  await ev(`finishOrder()`);
  // simpan pesanan, buka lagi, hapus → harus kembali ke daftar order
  await tap('.pcard:has-text("Topi")'); await ev(`simpanOrderKeDaftarOrder()`);
  await ev(`switchTab('daftarorder')`,'daftar-order');
  await ev(`resumeOrder(HELD_ORDERS[0].id)`); await ev(`konfirmasiHapusPesanan()`); await ev(`switchTab('daftarorder')`,'after-hapus');
  await ev(`switchTab('penjualan')`);
  // riwayat + void (Sari kasir → perlu PIN atasan)
  await ev(`openSheet('sheetMainMenu')`,'menu');
  await ev(`hkBukaRiwayat()`); await p.waitForTimeout(400); await shot('riwayat');
  await ev(`hkRwOpen(document.querySelector('.hk-rw').getAttribute('onclick').match(/'(.+?)'/)[1])`,'trx-detail');
  await ev(`hkVoidAlasan(document.querySelector('#hkVoidChips .chip'),'Salah input'); hkVoid()`); await p.waitForTimeout(400); await shot('sup-pin');
  for(const c of '222222') await ev(`hkSupKey('${c}')`); await shot('riwayat-void');
  await ev(`hkGo('view-home')`);
  // laporan + kas kasir
  await ev(`openLaporan()`,'laporan');
  await ev(`openKasKasir()`,'kaskasir');
  await ev(`openTambahKasKasir(); setKkJenis('keluar'); document.getElementById('kkNamaInput').value='Beli lakban'; onKkNominalInput('15000'); simpanTransaksiKasKasir()`,'kaskasir-after');
  await ev(`closeKasKasir(); closeLaporan()`);
  // terima mutasi
  await ev(`hkOpenEventInfo()`,'event-info'); await ev(`closeSheet('sheetHkEvent')`);
  await ev(`bukaMenuInventori(); switchInvTab('mutasi')`,'inv-mutasi');
  await ev(`mutasiOpenTambah()`,'mutasi-form');
  await ev(`const f=document.querySelector('.hk-tm'); f.value=String(Math.max(0,+f.value-1)); document.getElementById('hkTmCatatan').value='1 pcs kurang'; hkTerimaSimpan()`,'mutasi-done');
  // stok opname
  await ev(`switchInvTab('stokopname'); soOpenTambah(); const i=document.querySelector('.hk-so-fisik[data-sku="KP-004"]'); i.value=String(+i.dataset.sistem-2); i.dispatchEvent(new Event('input',{bubbles:true}));`,'so-produk');
  await ev(`hkSOKirim()`,'so-done');
  await ev(`closeInventori()`);
  // produk terjual
  await ev(`openLaporan(); openProdukTerjual()`,'produk-terjual'); await ev(`closeProdukTerjual(); closeLaporan()`);
  // kunci layar
  await ev(`konfirmasiKunciLayar()`,'lock'); await ev(`'333333'.split('').forEach(c=>pinPress(c))`); await p.waitForTimeout(500);
  // reload: keranjang harus tetap ada
  await tap('.pcard:has-text("Totebag")'); await p.reload(); await p.waitForTimeout(800); await shot('after-reload');
  // tutup kasir
  await ev(`hkMenuTutup()`); await p.waitForTimeout(400); await shot('tutup');
  await ev(`const i=document.getElementById('hkTutupInput'); const s=D=>0; i.value='900000'; hkTutupIn(i)`,'tutup-isi');
  await ev(`hkTutupLanjut()`); await p.waitForTimeout(400); await shot('tutup-pin');
  for(const c of '333333') await ev(`tkPinPress('${c}')`); await p.waitForTimeout(900); await shot('after-tutup');
  // dashboard
  const d=await ctx.newPage(); d.on('pageerror',e=>errs.push('DASH: '+e.message)); await d.setViewportSize({width:1440,height:900});
  await d.goto(base+'dashboard.html'); await d.evaluate(()=>localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Dimas Pratama'}))); await d.reload(); await d.waitForTimeout(500); await d.waitForTimeout(600);
  await d.evaluate(()=>{ state.hk.evId='ev-bdg'; state.view='event-detail'; render(); }); await d.waitForTimeout(300);
  await d.screenshot({path:'shots/n/d-event.png', fullPage:true});
  await d.evaluate(()=>{ state.view='karyawan'; render(); }); await d.screenshot({path:'shots/n/d-karyawan.png'});
  await d.evaluate(()=>{ state.view='promo-produk'; render(); }); await d.screenshot({path:'shots/n/d-promo.png'});
  await d.evaluate(()=>{ state.view='stok-opname'; render(); }); await d.screenshot({path:'shots/n/d-opname.png'});
  console.log(JSON.stringify(await d.evaluate(()=>({trx:state.posTrx.length, void:state.posTrx.filter(t=>t.status==='Void').length, last:state.posTrx[state.posTrx.length-1], mut:state.mutasi.map(m=>m.no+':'+m.status), opn:state.posOpname.length, masuk:state.masukPos.length})),null,0).slice(0,1500));
  console.log('ERR', JSON.stringify(errs,null,1));
  await b.close();
})();
