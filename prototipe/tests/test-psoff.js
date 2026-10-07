const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({deviceScaleFactor:1}); const errs=[];
 const base='file://'+process.cwd()+'/out/';
 // POS: Rina buka kasir di Kajian selagi pre-sale aktif, isi keranjang
 const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('P:'+e.message)); await p.setViewportSize({width:390,height:844});
 await p.goto(base+'pos.html'); await p.waitForTimeout(600);
 await p.click('text=Rina Wijaya'); for(const c of '111111') await p.click(`#hkLoginBody .pin-key:text-is("${c}")`);
 await p.click('#hkLoginBody .order-type-item:has-text("Kajian")'); await p.click('button:has-text("Buka Kasir")'); await p.waitForTimeout(400);
 // Dashboard: matikan pre-sale Kajian
 const d=await ctx.newPage(); d.on('pageerror',e=>errs.push('D:'+e.message)); await d.setViewportSize({width:1440,height:900});
 await d.goto(base+'dashboard.html'); await d.evaluate(()=>localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Rina Wijaya'}))); await d.reload(); await d.waitForTimeout(600);
 await d.evaluate(()=>{ state.hk.evId='ev-jkt'; state.view='event-detail'; render(); }); await d.click('[data-hk-act="ev-edit"]'); await d.waitForTimeout(300);
 await d.evaluate(()=>document.querySelector('[data-hk-toggle="hk.evForm.presaleAktif"]').scrollIntoView({block:'center'})); await d.screenshot({path:'shots/psoff-on.png'});
 await d.click('[data-hk-toggle="hk.evForm.presaleAktif"]'); await d.waitForTimeout(300);
 await d.evaluate(()=>document.querySelector('[data-hk-toggle="hk.evForm.presaleAktif"]').scrollIntoView({block:'center'})); await d.screenshot({path:'shots/psoff-off.png'});
 const radios=await d.locator('[data-hk-act="ev-presale"]').count();
 await d.click('[data-hk-act="ev-save"]'); await d.waitForTimeout(400); const sub=await d.locator('.page-sub').first().innerText();
 const ev=await d.evaluate(()=>JSON.parse(localStorage.getItem('hk2:events')).find(e=>e.id==='ev-jkt').presaleAktif);
 // POS: pembayaran ditolak
 await p.waitForTimeout(500); const pill=await p.evaluate(()=>document.querySelector('#orderPill .l1').textContent);
 const n0=await p.evaluate(()=>JSON.parse(localStorage.getItem('hk2:trx')).length);
 await p.evaluate(()=>{ const id=PRODUCTS.find(x=>x.sku==='KBP-005-S').id; addToCart(id); }); await p.waitForTimeout(300);
 const toastAdd=await p.evaluate(()=>document.querySelector('.toast,#toast')?.textContent||''); const cartN=await p.evaluate(()=>cartCount());
 // keranjang yang sudah terisi sebelum pre-sale dimatikan
 await p.evaluate(()=>{ const id=PRODUCTS.find(x=>x.sku==='KBP-005-S').id; cart[id]=1; goToPayment(); }); await p.waitForTimeout(300);
 const toast=await p.evaluate(()=>document.querySelector('.toast,#toast')?.textContent||''); await p.screenshot({path:'shots/psoff-pos-tolak.png'});
 const payView=await p.evaluate(()=>document.querySelector('.view.active')?.id);
 // POS: pilih tempat, Kajian tidak bisa dipilih
 await p.evaluate(()=>{ cart={}; hkGantiTempat(); }); await p.waitForTimeout(900); await p.screenshot({path:'shots/psoff-pos-pilih.png'});
 await p.evaluate(()=>hkLoginEvent('ev-jkt')); await p.waitForTimeout(200);
 const pilihKajian=await p.evaluate(()=>!!document.querySelector('#hkLoginBody .order-type-item.featured')); const btnMati=await p.locator('#hkLoginBody button.btn-primary').isDisabled();
 const tag=await p.locator('#hkLoginBody .order-type-item:has-text("Kajian") .hk-tags').innerText();
 console.log(JSON.stringify({toastAdd, cartN, radios, sub, ev, pill, toast, payView, n0, pilihKajian, btnMati, tag, errs})); await b.close(); })();
