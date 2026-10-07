const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:1.5}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 const base='file://'+process.cwd()+'/out/'; await p.goto(base+'pos.html'); await p.waitForTimeout(600);
 const sh=async n=>{ await p.waitForTimeout(500); await p.screenshot({path:`shots/v9-${n}.png`}); };
 const LS=k=>p.evaluate(k=>JSON.parse(localStorage.getItem('hk2:'+k)),k);
 await p.click('text=Rina Wijaya'); for(const c of '111111') await p.click(`#hkLoginBody .pin-key:text-is("${c}")`); await sh('01-pilih');
 await p.click('#hkLoginBody .order-type-item:has-text("Kajian")'); await p.click('button:has-text("Buka Kasir")'); await sh('02-presale-home');
 const stokSebelum=(await LS('stok')).find(s=>s.sku==='KBP-005-S').akhir;
 await p.evaluate(()=>{ hkOpenVarian('KBP-005'); const id=PRODUCTS.find(x=>x.sku==='KBP-005-S').id; addToCart(id); addToCart(id); }); await sh('03-varian');
 await p.evaluate(()=>{ closeSheet('sheetHkVarian'); selectCustomer(customers[0].code); goToPayment(); selectPayment('cash'); cashTendered=billCtx().amountNow; prosesBayar(); }); await sh('04-struk-presale');
 const t1=(await LS('trx')).slice(-1)[0]; const stokSesudah=(await LS('stok')).find(s=>s.sku==='KBP-005-S').akhir;
 await p.evaluate(()=>{ finishOrder(); hkOpenEventInfo(); }); await sh('05-info');
 await p.evaluate(()=>{ closeSheet('sheetHkEvent'); hkTutupEventOpen('ev-jkt'); }); await sh('06-tutup-blok');
 // kunci otomatis
 await p.evaluate(()=>{ closeSheet('sheetHkTutupEv'); const r=Date.now; Date.now=()=>r()+21*60000; hkCekKunci(); Date.now=r; }); await sh('07-autolock');
 const locked=await p.evaluate(()=>document.getElementById('view-lock').classList.contains('active'));
 for(const c of '111111') await p.evaluate(c=>pinPress(c),c); await p.waitForTimeout(500);
 // Bandung: harga event
 await p.evaluate(()=>hkGantiTempat()); await p.waitForTimeout(300); await p.click('#hkLoginBody .order-type-item:has-text("Hikayat Fest")'); await p.click('button:has-text("Masuk ke Kasir")'); await sh('08-bdg-harga');
 const hargaTot=await p.evaluate(()=>PRODUCTS.find(x=>x.sku==='TOT-009').price);
 // simulasi hari H Kajian: event mulai hari ini + stok dikirim
 await p.evaluate(()=>{ const ev=JSON.parse(localStorage.getItem('hk2:events')); const k=ev.find(e=>e.id==='ev-jkt'); const t=new Date(); const y=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; k.mulai=y; localStorage.setItem('hk2:events',JSON.stringify(ev));
   const st=JSON.parse(localStorage.getItem('hk2:stok')); const it=st.find(s=>s.sku==='KBP-005-S'); const g=it.perOutlet.find(o=>o.outlet==='Gudang Pusat'); g.akhir-=5; g.keluar+=5; it.perOutlet.push({outlet:'Kajian Akbar Istiqlal',awal:0,masuk:5,keluar:0,terjual:0,akhir:5}); localStorage.setItem('hk2:stok',JSON.stringify(st)); });
 await p.reload(); await p.waitForTimeout(700);
 await p.evaluate(()=>hkGantiTempat()); await p.waitForTimeout(300); await p.click('#hkLoginBody .order-type-item:has-text("Kajian")'); await p.click('button:has-text("Masuk ke Kasir")'); await p.waitForTimeout(400);
 await p.evaluate(()=>{ hkBukaRiwayat(); }); await p.waitForTimeout(500); await p.evaluate(()=>hkRwScope('presale')); await sh('09-presale-list');
 await p.evaluate(id=>hkRwOpen(id), t1.id); await sh('10-serahkan');
 await p.evaluate(id=>hkSerahkan(id), t1.id); await p.waitForTimeout(300);
 const t1b=(await LS('trx')).find(t=>t.id===t1.id); const stokKajian=(await LS('stok')).find(s=>s.sku==='KBP-005-S').perOutlet.find(o=>o.outlet==='Kajian Akbar Istiqlal').akhir;
 // dashboard
 const d=await ctx.newPage(); d.on('pageerror',e=>errs.push('D:'+e.message)); await d.setViewportSize({width:1440,height:900}); await d.goto(base+'dashboard.html'); await d.evaluate(()=>localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Dimas Pratama'}))); await d.reload(); await d.waitForTimeout(500); await d.waitForTimeout(500);
 await d.evaluate(()=>{ state.view='produk-list'; render(); document.querySelector('[data-hk-act="harga-open"]').click(); }); await d.waitForTimeout(300); await d.screenshot({path:'shots/v9-d-harga.png'});
 await d.evaluate(()=>{ state.hk.modal=null; state.hk.evForm={...state.events.find(e=>e.id==='ev-jkt'), kasir:['Budi Santoso'], presale:'ambil'}; state.view='event-form'; render(); }); await d.screenshot({path:'shots/v9-d-form.png', fullPage:true});
 await d.evaluate(()=>{ state.view='pengaturan-pos'; render(); }); await d.screenshot({path:'shots/v9-d-set.png'});
 await d.evaluate(()=>{ state.view='daftar-stok'; render(); }); const tabs=await d.evaluate(()=>[...document.querySelectorAll('[data-inv="s-tab"]')].map(x=>x.innerText).join('|'));
 console.log(JSON.stringify({stokSebelum, stokSesudah, peng:t1.pengambilan, harga:t1.items[0].harga, locked, hargaTot, t1b:t1b.pengambilan, stokKajian, tabs, errs}));
 await b.close(); })();
