const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({acceptDownloads:true}); const errs=[]; const out={};
 const base='file://'+process.cwd()+'/out/';
 const d=await ctx.newPage(); d.on('pageerror',e=>errs.push('D:'+e.message)); await d.setViewportSize({width:1440,height:900});
 await d.goto(base+'dashboard.html'); await d.evaluate(()=>{ localStorage.clear(); localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Dimas Pratama'})); }); await d.reload(); await d.waitForTimeout(700);
 const LS=(p,k)=>p.evaluate(k=>JSON.parse(localStorage.getItem('hk2:'+k)),k);
 // 7: impor Shopee dengan produk belum terdaftar
 await d.evaluate(()=>{ state.view='pesanan-online'; render(); }); await d.click('[data-po-open-import]'); await d.waitForTimeout(300);
 await d.click('[data-po-sample]'); await d.waitForTimeout(300);
 for(let i=0;i<3;i++){ const nx=d.locator('#poModalRoot button.btn-primary').last(); const txt=await nx.innerText(); if(/Impor|Daftarkan|Tidak ada/.test(txt)) break; await nx.click(); await d.waitForTimeout(300); }
 out.belum=await d.evaluate(()=>hkMpBelum().map(x=>x.sku)); out.btnImpor=await d.locator('[data-po-do-import]').innerText();
 await d.screenshot({path:'shots/r4-impor-warn.png'});
 const ordersAwal=(await LS(d,'orders')).length;
 await d.click('[data-hk-act="mpreg-open"]'); await d.waitForTimeout(300); await d.screenshot({path:'shots/r4-mpreg.png'});
 await d.click('[data-hk-act="mpreg-save"]'); await d.waitForTimeout(500);
 out.impor={orders:(await LS(d,'orders')).length-ordersAwal, shopee:(await LS(d,'channel'))[0].produk.map(x=>x.sku)};
 // 6: tutup Bandung dengan opname (tutup shift Budi dulu)
 await d.evaluate(()=>{ const sh=JSON.parse(localStorage.getItem('hk2:shift')); sh.forEach(s=>{ if(!s.tutup) s.tutup=new Date().toISOString().slice(0,16); }); localStorage.setItem('hk2:shift',JSON.stringify(sh)); }); await d.reload(); await d.waitForTimeout(600);
 await d.evaluate(()=>{ state.hk.evId='ev-bdg'; state.view='event-detail'; render(); }); await d.click('[data-hk-act="tutup-open"]'); await d.waitForTimeout(300);
 const first=d.locator('[data-hk-fisik]').first(); const sku=await first.getAttribute('data-hk-fisik'); const sist=+(await first.getAttribute('data-sistem'));
 await first.fill(String(sist-2)); await d.waitForTimeout(150); out.rugiLive=await d.locator('#hkRugiTotal').innerText();
 await d.fill('[data-hk-bind="hk.modal.alasan"]','Hilang saat bongkar booth'); await d.dispatchEvent('[data-hk-bind="hk.modal.alasan"]','input');
 await d.screenshot({path:'shots/r4-tutup.png'});
 await d.click('[data-hk-act="tutup-save"]'); await d.waitForTimeout(400);
 const ev=(await LS(d,'events')).find(e=>e.id==='ev-bdg'); const op=(await LS(d,'opname'))[0];
 out.tutup={ditutup:ev.ditutup, selisih:ev.tutup.selisih, kerugian:ev.tutup.kerugian, kembali:ev.tutup.kembali[sku], sist, opname:op&&{jenis:op.jenis, kerugian:op.kerugian, n:op.produk.length}};
 await d.screenshot({path:'shots/r4-detail.png'});
 // 3: tutup Kajian -> pre-sale tetap Menunggu dengan batas 7 hari
 await d.evaluate(()=>{ state.hk.evId='ev-jkt'; state.view='event-detail'; render(); }); await d.click('[data-hk-act="tutup-open"]'); await d.waitForTimeout(200); await d.click('[data-hk-act="tutup-save"]'); await d.waitForTimeout(300);
 out.ps=(await LS(d,'trx')).filter(t=>t.eventId==='ev-jkt'&&t.pengambilan).map(t=>t.pengambilan.status+':'+(t.pengambilan.batas||'').slice(0,10));
 await d.evaluate(()=>{ state.view='presale'; state.hk.psEvent=''; state.hk.psTab='Menunggu'; render(); }); await d.waitForTimeout(300); await d.screenshot({path:'shots/r4-presale.png'});
 // lewat 7 hari
 await d.evaluate(()=>{ const t=JSON.parse(localStorage.getItem('hk2:trx')); t.forEach(x=>{ if(x.eventId==='ev-jkt'&&x.pengambilan&&x.pengambilan.status==='Menunggu') x.pengambilan.batas='2026-01-01T00:00'; }); localStorage.setItem('hk2:trx',JSON.stringify(t)); }); await d.reload(); await d.waitForTimeout(500);
 out.lewat=(await LS(d,'trx')).filter(t=>t.eventId==='ev-jkt'&&t.pengambilan).map(t=>t.pengambilan.status);
 // 2: Admin Dimas di Gudang Pusat
 const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('P:'+e.message)); await p.setViewportSize({width:390,height:844});
 await p.goto(base+'pos.html'); await p.waitForTimeout(600);
 await p.click('text=Dimas Pratama'); for(const c of '222222') await p.click(`#hkLoginBody .pin-key:text-is("${c}")`); await p.waitForTimeout(300);
 out.dimasOpsi=await p.evaluate(()=>[...document.querySelectorAll('#hkLoginBody .order-type-item .oti-name')].map(x=>x.textContent));
 await p.click('#hkLoginBody .order-type-item:has-text("Gudang Pusat")'); await p.click('button:has-text("Buka Kasir")'); await p.waitForTimeout(400);
 await p.evaluate(()=>addToCart(PRODUCTS[0].id)); await p.waitForTimeout(200); out.dimasCart=await p.evaluate(()=>cartCount()); out.dimasToast=await p.evaluate(()=>document.querySelector('.toast,#toast').textContent);
 await p.evaluate(()=>hkBukaRiwayat()); await p.waitForTimeout(400); out.dimasPS=await p.evaluate(()=>document.getElementById('hkRwChips').innerText.replace(/\n/g,' | ')); await p.screenshot({path:'shots/r4-dimas.png'});
 // 1: struk PDF ke WA, Rina jual biasa di Gudang lalu kirim manual
 await p.evaluate(()=>{ localStorage.removeItem('hk2pos:sesi2'); }); await p.reload(); await p.waitForTimeout(500);
 await p.click('text=Rina Wijaya'); for(const c of '111111') await p.click(`#hkLoginBody .pin-key:text-is("${c}")`); await p.waitForTimeout(300);
 await p.click('#hkLoginBody .order-type-item:has-text("Gudang Pusat")'); await p.click('#hkLoginBody button.btn-primary'); await p.waitForTimeout(400);
 await p.evaluate(()=>{ const id=PRODUCTS.find(x=>x.sku==='TOT-009').id; addToCart(id); goToPayment(); selectPayment('cash'); cashTendered=billCtx().amountNow; prosesBayar(); }); await p.waitForTimeout(600);
 await p.screenshot({path:'shots/r4-sukses.png'});
 await p.fill('[id^="hkWaNo-"]','081234567890'); await p.click('.hk-wabox .btn-confirm-primary'); await p.waitForTimeout(300);
 const t=(await LS(p,'trx')).slice(-1)[0]; out.struk=t.struk;

 const [dl]=await Promise.all([p.waitForEvent('download'), p.click('.hk-wabox button:has-text("Lihat PDF")')]); await dl.saveAs('shots/r4-struk.pdf'); out.dl=dl.suggestedFilename();
 await p.screenshot({path:'shots/r4-sukses-wa.png'});
 console.log(JSON.stringify({out,errs},null,1)); await b.close(); })();
