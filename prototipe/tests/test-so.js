const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(); const errs=[]; const out={};
 const base='file://'+process.cwd()+'/out/';
 const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('P:'+e.message)); await p.setViewportSize({width:390,height:844});
 const LS=k=>p.evaluate(k=>JSON.parse(localStorage.getItem('hk2:'+k)),k);
 await p.goto(base+'pos.html'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
 await p.click('text=Sari Handayani'); for(const c of '333333') await p.click(`#hkLoginBody .pin-key:text-is("${c}")`); await p.waitForTimeout(500);
 // 1. kasir kirim opname
 await p.evaluate(()=>{ bukaMenuInventori(); }); await p.waitForTimeout(300); await p.evaluate(()=>soOpenTambah()); await p.waitForTimeout(400);
 out.baris=await p.evaluate(()=>document.querySelectorAll('.hk-so-fisik').length);
 const f=p.locator('.hk-so-fisik').first(); const sis=+(await f.getAttribute('data-sistem')); await f.fill(String(sis-2)); await p.fill('#hkSoCatatan','2 kaos S hilang'); await p.waitForTimeout(150);
 await p.screenshot({path:'shots/so-pos.png'});
 await p.evaluate(()=>hkSOKirim()); await p.waitForTimeout(400);
 const so1=(await LS('opname'))[0]; out.so1={no:so1.no,status:so1.status,oleh:so1.oleh,kurang:so1.produk.filter(x=>x.selisih<0).length};
 // 2. dashboard: admin minta ulang
 const d=await ctx.newPage(); d.on('pageerror',e=>errs.push('D:'+e.message)); await d.setViewportSize({width:1440,height:900});
 await d.goto(base+'dashboard.html'); await d.evaluate(()=>{ localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Dimas Pratama'})); }); await d.reload(); await d.waitForTimeout(600);
 await d.evaluate(()=>{ state.hk.evId='ev-bdg'; state.view='event-detail'; render(); }); await d.waitForTimeout(200);
 out.detailNote=await d.evaluate(()=>[...document.querySelectorAll('.main .hk-note')].map(x=>x.innerText).join(' | ').slice(0,160));
 await d.click('[data-inv="o-ke"]'); await d.waitForTimeout(200); await d.click('[data-inv="o-periksa"]'); await d.waitForTimeout(300);
 out.modal=await d.evaluate(()=>state.hk.modal&&state.hk.modal.type);
 await d.screenshot({path:'shots/so-dash.png'});
 await d.click('[data-hk-act="so-ulang"]'); await d.waitForTimeout(200); out.tanpaAlasan=await d.evaluate(()=>!!state.hk.modal);
 await d.fill('[data-hk-bind="hk.modal.ulang"]','Hitung ulang rak belakang'); await d.click('[data-hk-act="so-ulang"]'); await d.waitForTimeout(300);
 out.so1b=(await LS('opname')).find(o=>o.no===so1.no).status;
 // 3. kasir lihat permintaan & hitung ulang
 await p.reload(); await p.waitForTimeout(600); await p.evaluate(()=>{ bukaMenuInventori(); }); await p.waitForTimeout(300); await p.evaluate(()=>{ switchInvTab('stokopname'); renderSoList(); }); await p.waitForTimeout(200);
 out.banner=await p.evaluate(()=>(document.querySelector('#soList .hk-note')||{}).innerText);
 await p.evaluate(()=>soOpenTambah()); await p.waitForTimeout(300); await p.locator('.hk-so-fisik').first().fill(String(sis-1)); await p.evaluate(()=>hkSOKirim()); await p.waitForTimeout(300);
 const ops=await LS('opname'); out.so2={status:ops[0].status, lama:ops.find(o=>o.no===so1.no).status};
 // 4. owner setujui dari POS
 await p.evaluate(()=>{ const sh=JSON.parse(localStorage.getItem('hk2:shift')); sh.forEach(s=>{ if(!s.tutup) s.tutup='2026-10-06T10:00'; }); localStorage.setItem('hk2:shift',JSON.stringify(sh)); localStorage.removeItem('hk2pos:sesi2'); }); await p.reload(); await p.waitForTimeout(500);
 await p.evaluate(()=>{ try{hkKeluar()}catch(e){} }); await p.waitForTimeout(200); await p.click('text=Rina Wijaya'); for(const c of '111111') await p.click(`#hkLoginBody .pin-key:text-is("${c}")`); await p.waitForTimeout(300);
 await p.evaluate(()=>hkTutupEventOpen('ev-bdg')); await p.waitForTimeout(400); await p.screenshot({path:'shots/so-tutup-pos.png'});
 out.tombol=await p.evaluate(()=>[...document.querySelectorAll('#hkTevBody button')].map(x=>x.textContent.trim()));
 out.tutupDiblok=await p.evaluate(()=>{ hkTutupEventOk('ev-bdg'); return document.querySelector('.toast,#toast').textContent; });
 await p.evaluate(no=>{ closeSheet('sheetHkTutupEv'); hkSOPeriksa(no); },ops[0].no); await p.waitForTimeout(300); await p.fill('#hkSsAlasan','1 kaos S tidak ditemukan'); await p.evaluate(no=>hkSOSetuju(no),ops[0].no); await p.waitForTimeout(300);
 await p.evaluate(()=>hkTutupEventOpen('ev-bdg')); await p.waitForTimeout(300); await p.evaluate(()=>hkTutupEventOk('ev-bdg')); await p.waitForTimeout(400);
 const ev=(await LS('events')).find(e=>e.id==='ev-bdg'), ops2=await LS('opname');
 out.tutup={ditutup:ev.ditutup, kerugian:ev.tutup&&ev.tutup.kerugian, soStatus:ops2.find(o=>o.no===ops[0].no).status, soKerugian:ops2.find(o=>o.no===ops[0].no).kerugian, soOleh:(ops2.find(o=>o.no===ops[0].no).disetujui||{}).oleh};
 await d.reload(); await d.waitForTimeout(500); await d.evaluate(()=>{ state.hk.evId='ev-bdg'; state.view='event-detail'; render(); }); out.detailTutup=await d.evaluate(()=>document.querySelector('.main .hk-note').innerText.slice(0,200));
 console.log(JSON.stringify({out,errs},null,1)); await b.close(); })();
