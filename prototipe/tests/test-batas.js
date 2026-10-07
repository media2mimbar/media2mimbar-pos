const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(); const errs=[]; const out={};
 const base='file://'+process.cwd()+'/out/';
 const d=await ctx.newPage(); d.on('pageerror',e=>errs.push('D:'+e.message)); await d.setViewportSize({width:1440,height:900});
 await d.goto(base+'dashboard.html'); await d.evaluate(()=>{ localStorage.clear(); localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Rina Wijaya'})); }); await d.reload(); await d.waitForTimeout(700);
 // form event: kirim
 await d.evaluate(()=>{ state.hk.evId='ev-bdg'; state.view='event-detail'; render(); }); await d.click('[data-hk-act="ev-edit"]'); await d.waitForTimeout(300);
 out.kirimEvent='kolom kirim tidak ada lagi di form event';
 out.toast1=await d.evaluate(()=>document.querySelector('.toast')?.textContent);
 await d.screenshot({path:'shots/batas-event.png'});
 // kirim stok (alok)
 await d.evaluate(()=>{ state.hk.evForm=null; state.view='event-detail'; render(); }); await d.click('[data-hk-act="alok-open"][data-hk-arg="kirim"]'); await d.waitForTimeout(300); await d.click('[data-hk-act="alok-semua"]'); await d.waitForTimeout(200);
 const a=d.locator('[data-hk-alok]:not([disabled])').first(); await a.fill('9999'); await d.waitForTimeout(150);
 out.alok={max:await a.getAttribute('max'), nilai:await a.inputValue()};
 await d.evaluate(()=>{ state.hk.modal=null; render(); });
 // pesanan manual
 await d.evaluate(()=>{ state.view='pesanan-online'; render(); }); await d.click('[data-po-new]'); await d.waitForTimeout(200);
 await d.click('[data-hk-act="pil-buka"][data-hk-arg="order"]'); await d.waitForTimeout(150); await d.click('td[data-hk-act="pil-cek"] >> nth=0'); await d.click('[data-hk-act="pil-simpan"]'); await d.waitForTimeout(150); await d.waitForTimeout(200);
 const q=d.locator('[data-po-item-qty="0"]'); await q.fill('500'); await d.waitForTimeout(150); out.po={max:await q.getAttribute('max'), nilai:await q.inputValue()};
 // POS
 const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('P:'+e.message)); await p.setViewportSize({width:390,height:844});
 await p.goto(base+'pos.html'); await p.waitForTimeout(600);
 await p.click('text=Budi Santoso'); for(const c of '444444') await p.click(`#hkLoginBody .pin-key:text-is("${c}")`); await p.waitForTimeout(500);
 // pisah bayar
 await p.evaluate(()=>{ addToCart(PRODUCTS.find(x=>x.sku==='TOT-009').id); goToPayment(); splitKeypadValue='999999'; updateSplitKeypadDisplay(); }); await p.waitForTimeout(200);
 out.split={nilai:await p.evaluate(()=>splitKeypadValue), sisa:await p.evaluate(()=>billCtx().amountNow)};
 // kas keluar
 await p.evaluate(()=>{ openKasKasir(); }); await p.waitForTimeout(300);
 await p.evaluate(()=>{ kkJenisAktif='keluar'; }); await p.evaluate(()=>{ const i=document.getElementById('kkNominalInput'); i.value='99999999'; i.dispatchEvent(new Event('input',{bubbles:true})); }); await p.waitForTimeout(150);
 out.kas={nilai:await p.evaluate(()=>document.getElementById('kkNominalInput').value), laci:await p.evaluate(()=>{ const D=hkLoad(); return hkShiftKas(D,D.shift.find(s=>s.kasir==='Budi Santoso'&&!s.tutup)).harus; })};
 console.log(JSON.stringify({out,errs},null,1)); await b.close(); })();
