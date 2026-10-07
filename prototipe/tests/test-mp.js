const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const d=await (await b.newContext({viewport:{width:1440,height:900}})).newPage(); const errs=[]; d.on('pageerror',e=>errs.push(e.message));
 await d.goto('file://'+process.cwd()+'/out/dashboard.html'); await d.evaluate(()=>{ localStorage.clear(); localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Rina Wijaya'})); }); await d.reload(); await d.waitForTimeout(700);
 const ch=()=>d.evaluate(()=>JSON.parse(localStorage.getItem('hk2:channel')).map(c=>c.nama+':'+c.produk.filter(x=>x.sku.startsWith('KBP')).map(x=>x.sku.replace('KBP-005-','')+'='+x.hargaJual).join(',')));
 const nav=await d.evaluate(()=>[...document.querySelectorAll('.sidebar')].map(x=>x.innerText).join('|').replace(/\n+/g,' / '));
 await d.evaluate(()=>{ state.view='produk-list'; render(); }); await d.waitForTimeout(300); await d.screenshot({path:'shots/mp-list.png'});
 const kbp=await d.evaluate(()=>state.products.findIndex(p=>p.sku==='KBP-005'));
 await d.click(`[data-hk-act="prod-edit"][data-hk-arg="${kbp}"]`); await d.waitForTimeout(300);
 const awal=await d.evaluate(()=>state.hk.prodForm.mp.map(m=>m.aktif));
 // Tokopedia on, harga XL 140000; Shopee off
 await d.click('[data-hk-toggle="hk.prodForm.mp.1.aktif"]'); await d.waitForTimeout(200);
 await d.fill('[data-hk-bind="hk.prodForm.mp.1.harga.v3"]','140000'); await d.dispatchEvent('[data-hk-bind="hk.prodForm.mp.1.harga.v3"]','change');
 await d.evaluate(()=>document.querySelector('.hk-mp').scrollIntoView({block:'start'})); await d.waitForTimeout(200); await d.screenshot({path:'shots/mp-form.png'});
 await d.click('[data-hk-toggle="hk.prodForm.mp.0.aktif"]'); await d.waitForTimeout(200);
 await d.click('[data-hk-act="prod-save"]'); await d.waitForTimeout(300); const sesudah=await ch();
 // biaya marketplace masih bisa disimpan
 await d.evaluate(()=>{ state.view='marketplace'; render(); }); await d.waitForTimeout(300); await d.screenshot({path:'shots/mp-biaya.png'});
 const judul=await d.locator('.page-title').first().innerText();
 // pesanan manual Tokopedia: hanya produk terdaftar
 await d.evaluate(()=>{ state.view='pesanan-online'; render(); }); await d.click('[data-po-new]'); await d.waitForTimeout(300);
 await d.click('[data-po-form-chan="Tokopedia"]'); await d.waitForTimeout(200);
 const opsi=await d.evaluate(()=>[...document.querySelectorAll('[data-po-item-sku="0"] option')].map(o=>o.value).filter(Boolean));
 console.log(JSON.stringify({nav, awal, sesudah, judul, opsi, errs})); await b.close(); })();
