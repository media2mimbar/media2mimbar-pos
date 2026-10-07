const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const out={}; const errs=[];
 for(const w of [390,340]){ const p=await b.newPage({viewport:{width:w,height:760}}); p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.cwd()+'/out/pos.html'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
 await p.click('text=Rina Wijaya'); for(const c of '111111') await p.click(`#hkLoginBody .pin-key:text-is("${c}")`);
 await p.click('#hkLoginBody .order-type-item:has-text("Hikayat Fest")'); await p.click('#hkLoginBody button.btn-primary'); await p.waitForTimeout(400);
 await p.evaluate(()=>{ addToCart(PRODUCTS.find(x=>x.sku==='JRS-006-L').id); addToCart(PRODUCTS.find(x=>x.sku==='KBP-005-L').id); }); await p.waitForTimeout(300);
 await p.evaluate(()=>{ const c=[...document.querySelectorAll('div,button')].find(x=>x.textContent.trim()==='🏷️ Promo'); c&&c.click(); }); await p.waitForTimeout(300);
 await p.evaluate(()=>{ const s=document.getElementById('homeScroll'); s.scrollTop=s.scrollHeight; }); await p.waitForTimeout(300);
 out[w]=await p.evaluate(()=>{ const cards=[...document.querySelectorAll('#promoDepositList .pd-card')], last=cards[cards.length-1].getBoundingClientRect(), mb=document.getElementById('miniActionsBar').getBoundingClientRect(); return {terakhir:cards[cards.length-1].querySelector('.pd-title').textContent.trim(), bawahKartu:Math.round(last.bottom), atasBar:Math.round(mb.top), terlihat:last.bottom<=mb.top}; });
 await p.screenshot({path:`shots/promobawah-${w}.png`}); await p.close(); }
 console.log(JSON.stringify({out,errs},null,1)); await b.close(); })();
