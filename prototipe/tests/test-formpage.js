const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900}}); const d=await ctx.newPage(); const errs=[]; d.on('pageerror',e=>errs.push(e.message));
 await d.goto('file://'+process.cwd()+'/out/dashboard.html'); await d.evaluate(()=>{ localStorage.clear(); localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Rina Wijaya'})); }); await d.reload(); await d.waitForTimeout(700);
 const out={}; const shot=async(n)=>{ await d.waitForTimeout(350); await d.screenshot({path:`shots/fp-${n}.png`}); out[n]=await d.evaluate(()=>{ const pg=[...document.querySelectorAll('.overlay.open > .confirm-box')].map(x=>({page:x.classList.contains('hk-page'),w:Math.round(x.getBoundingClientRect().width)})); const card=document.querySelector('.body.form-mode .main .card'); return {pg, card:card?Math.round(card.getBoundingClientRect().width):null}; }); };
 const go=async(v)=>{ await d.evaluate(v=>{ state.view=v; render(); },v); await d.waitForTimeout(250); };
 const esc=async()=>{ await d.evaluate(()=>{ state.hk.modal=null; state.promoProdukForm=null; state.customerImportOpen=null; render(); renderPromoFormModal&&renderPromoFormModal(); }); };
 await go('event'); await d.click('[data-hk-act="ev-new"]'); await shot('event-form');
 await go('produk-list'); await d.evaluate(()=>{ const x=document.querySelector('[data-hk-act="prod-new"],[data-hk-act="produk-new"]'); x&&x.click(); }); await shot('produk-form');
 await d.evaluate(()=>{ state.view='produk-list'; render(); }); await d.click('[data-hk-act="harga-open"]'); await shot('harga');
 // klik area kosong tidak menutup
 await d.mouse.click(60,500); await d.waitForTimeout(200); out.masihTerbuka=await d.evaluate(()=>!!state.hk.modal);
 await esc(); await d.evaluate(()=>{ state.hk.evId='ev-bdg'; state.view='event-detail'; render(); }); await d.click('[data-hk-act="alok-open"][data-hk-arg="kirim"]'); await shot('kirim');
 await esc(); await go('presale'); await d.evaluate(()=>{ state.hk.psTab='Perlu Refund'; render(); }); await d.click('[data-hk-act="ps-refund"]'); await shot('refund');
 await esc(); await d.click('.topbar >> text=Karyawan'); await d.waitForTimeout(300); await d.click('[data-hk-act="staff-new"]'); await shot('staff');
 await esc(); await d.click('.topbar >> text=Penjualan'); await go('promo-produk'); await d.click('[data-inv="pr-baru"]'); await d.waitForTimeout(150); await d.click('[data-inv="pr-jenis"][data-inv-arg="promoProduk"]'); await shot('promo');
 await esc(); await go('pelanggan-list'); await d.click('[data-open-customer-import]'); await shot('import-pelanggan');
 await esc(); await go('pesanan-online'); await d.click('[data-po-open-import]'); await shot('import-pesanan');
 await d.evaluate(()=>{ const c=document.querySelector('#poModalRoot [data-po-close]'); c&&c.click(); }); await go('pesanan-online'); await d.click('[data-po-new]'); await shot('pesanan-manual');
 console.log(JSON.stringify({out,errs})); await b.close(); })();
