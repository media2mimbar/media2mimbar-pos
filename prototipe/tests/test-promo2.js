const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(); const errs=[]; const out={};
 const base='file://'+process.cwd()+'/out/';
 const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('P:'+e.message)); await p.setViewportSize({width:390,height:844});
 await p.goto(base+'pos.html'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
 await p.evaluate(()=>{ const t=JSON.parse(localStorage.getItem('hk2:promoTotal')); const x=JSON.parse(JSON.stringify(t[0])); x.nama='Kelipatan 100rb'; Object.assign(x.detail,{nama:x.nama,jenisBonus:'rp',besaranPotongan:'10.000',minPembelian:'100.000',berlakuKelipatan:true,aktivasi:'manual',maksimalPotongan:false}); t.push(x); localStorage.setItem('hk2:promoTotal',JSON.stringify(t)); });
 await p.reload(); await p.waitForTimeout(400);
 await p.click('text=Rina Wijaya'); for(const c of '111111') await p.click(`#hkLoginBody .pin-key:text-is("${c}")`);
 await p.click('#hkLoginBody .order-type-item:has-text("Hikayat Fest")'); await p.click('#hkLoginBody button.btn-primary'); await p.waitForTimeout(400);
 // kelipatan: 2 jersey L = 350rb -> 3x10rb
 out.kelipatan=await p.evaluate(()=>{ const id=PRODUCTS.find(x=>x.sku==='JRS-006-L').id; const pr=PROMO_PROGRAMS.find(x=>x.name==='Kelipatan 100rb'); return promoDiscountAmount(pr,[{id,qty:2,price:175000}]); });
 // otomatis lalu dilepas kasir
 await p.evaluate(()=>{ const id=PRODUCTS.find(x=>x.sku==='JRS-006-L').id; addToCart(id); addToCart(id); }); await p.waitForTimeout(200);
 out.auto1=await p.evaluate(()=>appliedPromo&&appliedPromo.name);
 await p.evaluate(()=>{ tempPromoSelId=null; simpanPromoSelection(); const id=PRODUCTS.find(x=>x.sku==='KP-004').id; addToCart(id); }); await p.waitForTimeout(200);
 out.setelahDilepas=await p.evaluate(()=>appliedPromo&&appliedPromo.name);
 // kasir pilih promo manual
 await p.evaluate(()=>{ tempPromoSelId='pp-Jersey Fest'; simpanPromoSelection(); }); await p.waitForTimeout(400);
 await p.evaluate(()=>{ document.querySelectorAll('.sheet.show').forEach(s=>closeSheet(s.id)); const id=PRODUCTS.find(x=>x.sku==='TOT-009').id; addToCart(id); }); await p.waitForTimeout(200);
 out.manualTetap=await p.evaluate(()=>appliedPromo&&appliedPromo.name);
 // bayar -> tercatat promo
 await p.evaluate(()=>{ goToPayment(); selectPayment('cash'); cashTendered=billCtx().amountNow; prosesBayar(); }); await p.waitForTimeout(500);
 out.trx=await p.evaluate(()=>{ const t=JSON.parse(localStorage.getItem('hk2:trx')).slice(-1)[0]; return {promo:t.promo, diskon:t.diskon}; });
 // dashboard
 const d=await ctx.newPage(); d.on('pageerror',e=>errs.push('D:'+e.message)); await d.setViewportSize({width:1440,height:900});
 await d.goto(base+'dashboard.html'); await d.evaluate(()=>localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Rina Wijaya'}))); await d.reload(); await d.waitForTimeout(600);
 await d.evaluate(()=>{ state.view='promo-produk'; render(); }); await d.waitForTimeout(300); await d.screenshot({path:'shots/promo-list.png'});
 out.list=await d.evaluate(()=>[...document.querySelectorAll('.main table tbody tr')].map(r=>{ const c=[...r.children]; return c[0].innerText+' | '+c[c.length-3].innerText.replace(/\n/g,' ')+' | '+c[c.length-2].innerText; }));
 // form: validasi & draf
 await d.click('[data-inv="pr-baru"]'); await d.waitForTimeout(150); await d.click('[data-inv="pr-jenis"][data-inv-arg="promoProduk"]'); await d.waitForTimeout(300);
 out.platform=await d.evaluate(()=>document.querySelector('#promoFormRoot').innerText.includes('Consumer Apps'));
 out.berlakuDi=await d.evaluate(()=>document.querySelector('[data-hk-act="pr-lok"]').innerText.replace(/\n/g,' '));
 await d.screenshot({path:'shots/promo-form1.png'});
 await d.evaluate(()=>{ state.promoProdukForm.nama='Draf Tes'; }); await d.click('[data-save-draft-promoProduk]'); await d.waitForTimeout(300);
 out.draf=await d.evaluate(()=>{ const x=state.promoProdukList.find(p=>p.nama==='Draf Tes'); return x&&hkPromoStatus(x); });
 await d.click('[data-inv="pr-baru"]'); await d.waitForTimeout(150); await d.click('[data-inv="pr-jenis"][data-inv-arg="promoProduk"]'); await d.waitForTimeout(200);
 await d.evaluate(()=>{ state.promoProdukForm.nama='Tanpa Produk'; state.promoProdukForm.step=2; renderPromoFormModal(); }); await d.waitForTimeout(200);
 out.jenisOpsi=await d.evaluate(()=>[...document.querySelectorAll('input[name="promoProdukJenisBonus"]')].length);
 await d.evaluate(()=>{ state.promoProdukForm.besaranPotongan='150'; }); await d.click('[data-request-save-promoProduk]'); await d.waitForTimeout(200);
 await d.waitForTimeout(150); out.validasi=await d.evaluate(()=>({toast:document.querySelector(".toast")?.textContent, step:state.promoProdukForm.step, merah:document.querySelectorAll(".hk-invalid").length}));
 console.log(JSON.stringify({out,errs},null,1)); await b.close(); })();
