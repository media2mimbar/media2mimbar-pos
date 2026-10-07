const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({acceptDownloads:true,viewport:{width:390,height:844}}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.cwd()+'/out/pos.html'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
 await p.click('text=Rina Wijaya'); for(const c of '111111') await p.click(`#hkLoginBody .pin-key:text-is("${c}")`);
 await p.click('#hkLoginBody .order-type-item:has-text("Kajian")'); await p.click('button:has-text("Buka Kasir")'); await p.waitForTimeout(400);
 await p.evaluate(()=>{ const id=PRODUCTS.find(x=>x.sku==='KBP-005-M').id; addToCart(id); selectCustomer(customers[0].code); }); await p.waitForTimeout(300);
 await p.evaluate(()=>{ goToPayment(); selectPayment('cash'); cashTendered=billCtx().amountNow; prosesBayar(); }); await p.waitForTimeout(900);
 await p.evaluate(()=>document.querySelector('.hk-wabox').scrollIntoView({block:'center'})); await p.screenshot({path:'shots/r4b-sukses.png'});

 const st=await p.evaluate(()=>JSON.parse(localStorage.getItem('hk2:trx')).slice(-1)[0].struk);
 const [dl]=await Promise.all([p.waitForEvent('download'), p.click('.hk-wabox button:has-text("Lihat PDF")')]); await dl.saveAs('shots/r4b-struk.pdf');
 console.log(JSON.stringify({st,errs})); await b.close(); })();
