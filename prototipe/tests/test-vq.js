const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.cwd()+'/out/pos.html'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
 await p.click('text=Sari Handayani'); for(const c of '333333') await p.click(`#hkLoginBody .pin-key:text-is("${c}")`); await p.waitForTimeout(500);
 await p.evaluate(()=>{ hkOpenVarian(PRODUCTS.find(x=>x.sku==='KBP-005-M').parent); addToCart(PRODUCTS.find(x=>x.sku==='KBP-005-M').id); addToCart(PRODUCTS.find(x=>x.sku==='KBP-005-M').id); }); await p.waitForTimeout(500);
 const r=await p.evaluate(()=>{ const q=document.querySelector('#hkVarBody .hk-vq'), body=document.getElementById('hkVarBody'); const a=q.getBoundingClientRect(), c=body.getBoundingClientRect(); return {teks:q.textContent, dalam:a.top>=c.top&&a.right<=c.right}; });
 await p.screenshot({path:'shots/vq.png'}); console.log(JSON.stringify({r,errs})); await b.close(); })();
