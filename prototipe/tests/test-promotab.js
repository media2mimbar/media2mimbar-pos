const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const errs=[]; const out={};
 for(const w of [390,340]){
 const p=await b.newPage({viewport:{width:w,height:780}}); p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.cwd()+'/out/pos.html'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
 await p.click('text=Rina Wijaya'); for(const c of '111111') await p.click(`#hkLoginBody .pin-key:text-is("${c}")`);
 await p.click('#hkLoginBody .order-type-item:has-text("Hikayat Fest")'); await p.click('#hkLoginBody button.btn-primary'); await p.waitForTimeout(400);
 await p.evaluate(()=>{ const c=[...document.querySelectorAll('#catChips *')].find(x=>x.textContent.trim().endsWith('Promo')&&x.onclick)||[...document.querySelectorAll('div,button')].find(x=>x.textContent.trim()==='🏷️ Promo'); c&&c.click(); }); await p.waitForTimeout(300);
 const klik=async t=>{ await p.click(`.hk-pd:has-text("${t}")`); await p.waitForTimeout(350); return p.evaluate(()=>({toast:document.querySelector('.toast,#toast')?.textContent, promo:appliedPromo&&appliedPromo.name})); };
 const r={};
 r.kosong=await klik('Jersey Fest');
 await p.evaluate(()=>addToCart(PRODUCTS.find(x=>x.sku==='KBP-005-L').id)); await p.waitForTimeout(200);
 r.kurangQty=await klik('Hemat Kaos');
 r.jersey=await klik('Jersey Fest');
 await p.evaluate(()=>addToCart(PRODUCTS.find(x=>x.sku==='JRS-006-L').id)); await p.waitForTimeout(200);
 r.jersey2=await klik('Jersey Fest');
 await p.evaluate(()=>document.querySelectorAll('.sheet.show').forEach(s=>closeSheet(s.id))); await p.waitForTimeout(400);
 r.posisi=await p.evaluate(()=>{ const m=document.getElementById('miniActionsBar').getBoundingClientRect(), c=document.getElementById('cartBar').getBoundingClientRect(); return {miniBawah:Math.round(m.bottom), cartAtas:Math.round(c.top), tertutup:m.bottom>c.top}; });
 await p.screenshot({path:`shots/promotab-${w}.png`}); out[w]=r; await p.close(); }
 console.log(JSON.stringify({out,errs},null,1)); await b.close(); })();
