const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(); const errs=[]; const out={};
 const base='file://'+process.cwd()+'/out/';
 const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('P:'+e.message)); await p.setViewportSize({width:390,height:844});
 const LS=k=>p.evaluate(k=>JSON.parse(localStorage.getItem('hk2:'+k)),k);
 const pin=async s=>{ for(const c of s) await p.click(`#hkLoginBody .pin-key:text-is("${c}")`); await p.waitForTimeout(300); };
 const toast=()=>p.evaluate(()=>document.querySelector('.toast,#toast').textContent);
 await p.goto(base+'pos.html'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
 // 1. Sari kirim opname (kurang 2)
 await p.click('text=Sari Handayani'); await pin('333333');
 await p.evaluate(()=>{ bukaMenuInventori(); soOpenTambah(); }); await p.waitForTimeout(300);
 const f=p.locator('.hk-so-fisik').first(); const sku=await f.getAttribute('data-sku'); const sis=+(await f.getAttribute('data-sistem')); await f.fill(String(sis-2)); await p.fill('#hkSoCatatan','2 hilang'); await p.evaluate(()=>hkSOKirim()); await p.waitForTimeout(300);
 out.kasirBanner=await p.evaluate(()=>{ switchInvTab('stokopname'); renderSoList(); return (document.getElementById('hkSoTunggu')||{}).innerText; });
 await p.evaluate(()=>hkKeluar()); await p.waitForTimeout(200);
 // 2. Owner setujui di tengah event dari POS
 await p.click('text=Rina Wijaya'); await pin('111111');
 await p.click('#hkLoginBody .order-type-item:has-text("Hikayat Fest")'); await p.click('#hkLoginBody button.btn-primary'); await p.waitForTimeout(400);
 await p.evaluate(()=>{ bukaMenuInventori(); switchInvTab('stokopname'); renderSoList(); }); await p.waitForTimeout(200);
 await p.click('#hkSoTunggu'); await p.waitForTimeout(300); await p.screenshot({path:'shots/mid-pos.png'});
 await p.fill('#hkSsAlasan',''); await p.evaluate(()=>{ const b=[...document.querySelectorAll('#hkSsBody button')].find(x=>x.textContent==='Setujui'); b.click(); }); out.tanpaAlasan=await toast();
 await p.fill('#hkSsAlasan','Hilang saat ramai'); await p.evaluate(()=>{ [...document.querySelectorAll('#hkSsBody button')].find(x=>x.textContent==='Setujui').click(); }); await p.waitForTimeout(300); out.toastSetuju=await toast();
 const so1=(await LS('opname'))[0]; out.so1={status:so1.status, oleh:so1.disetujui&&so1.disetujui.oleh, kerugian:so1.kerugian, pj:so1.tanggungJawab&&so1.tanggungJawab.pj};
 out.stokSetelah=await p.evaluate(sku=>hkStokDi(JSON.parse(localStorage.getItem('hk2:stok')),sku,'Hikayat Fest Bandung'),sku); out.stokSebelum=sis;
 out.eventMasihBuka=!(await LS('events')).find(e=>e.id==='ev-bdg').ditutup;
 await p.evaluate(()=>hkTutupEventOpen('ev-bdg')); await p.waitForTimeout(300); out.kartuTutup=await p.evaluate(()=>document.querySelector('#hkTevBody .hk-note[style*="E8F5EC"]')?.innerText.slice(0,90));
 await p.evaluate(()=>closeSheet('sheetHkTutupEv'));
 // 3. Kas kurang saat tutup kasir Budi oleh Owner
 const budi=(await LS('shift')).find(s=>!s.tutup&&s.eventId==='ev-bdg'&&s.kasir==='Budi Santoso'); out.laciDitutup=budi&&budi.kasir;
 await p.evaluate(id=>hkTutupKasirDari(id,'ev-bdg'),budi.id); await p.waitForTimeout(500);
 await p.fill('#hkTutupInput','1000'); await p.evaluate(()=>hkTutupIn(document.getElementById('hkTutupInput'))); await p.waitForTimeout(150);
 out.adaPj=await p.evaluate(()=>!!document.getElementById('hkKasPj')); await p.screenshot({path:'shots/mid-kas.png'});
 await p.evaluate(()=>hkTutupLanjut()); out.tanpaAlasanKas=await toast();
 await p.fill('#hkKasAlasan','Kembalian salah'); await p.evaluate(()=>hkKasAlasanIn(document.getElementById('hkKasAlasan')));
 await p.evaluate(()=>hkTutupLanjut()); await p.waitForTimeout(400);
 for(const c of '111111') await p.evaluate(c=>tkPinPress(c),c); await p.waitForTimeout(1200);
 const sh=(await LS('shift')).find(s=>s.id===budi.id); out.shift={tutup:!!sh.tutup, ditutupOleh:sh.ditutupOleh, kasKurang:sh.kasKurang};
 // 4. Dashboard: Selisih & Kerugian berisi stok + kas
 const d=await ctx.newPage(); d.on('pageerror',e=>errs.push('D:'+e.message)); await d.setViewportSize({width:1440,height:900});
 await d.goto(base+'dashboard.html'); await d.evaluate(()=>{ localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Dimas Pratama'})); }); await d.reload(); await d.waitForTimeout(600);
 await d.evaluate(()=>{ state.view='lap-kerugian'; render(); }); await d.waitForTimeout(200); await d.screenshot({path:'shots/mid-kerugian.png'});
 out.kerugianRows=await d.evaluate(()=>[...document.querySelectorAll('.main tbody tr')].map(r=>r.innerText.replace(/\s+/g,' ').slice(0,120)));
 await d.evaluate(k=>{ document.querySelector(`[data-hk-act="kr-open"][data-hk-arg="${k}"]`)?.click(); },'KAS:'+budi.id); await d.waitForTimeout(200);
 out.krModal=await d.evaluate(()=>state.hk.modal&&state.hk.modal.type);
 if(out.krModal){ await d.click('[data-hk-act="kr-save"]'); await d.waitForTimeout(300); out.kasStatus=(await d.evaluate(()=>JSON.parse(localStorage.getItem('hk2:shift')))).find(s=>s.id===budi.id).kasKurang.status; }
 // 5. Sari opname lagi → Dimas setujui dari dashboard
 await p.evaluate(()=>{ localStorage.removeItem('hk2pos:sesi2'); }); await p.reload(); await p.waitForTimeout(500); await p.evaluate(()=>{ try{hkKeluar()}catch(e){} });
 await p.click('text=Sari Handayani'); await pin('333333');
 out.loginSari2=await p.evaluate(()=>document.querySelector('.app > .view.active').id+' '+document.getElementById('hkLoginBody').innerText.slice(0,200)); await p.click('#hkLoginBody button.btn-primary'); await p.waitForTimeout(400);
 await p.evaluate(()=>{ bukaMenuInventori(); soOpenTambah(); }); await p.waitForTimeout(300); const f2=p.locator('.hk-so-fisik').first(); const sis2=+(await f2.getAttribute('data-sistem')); await f2.fill(String(sis2-1)); await p.evaluate(()=>hkSOKirim()); await p.waitForTimeout(300);
 const so2no=(await LS('opname'))[0].no;
 await d.reload(); await d.waitForTimeout(500); await d.evaluate(()=>{ state.hk.evId='ev-bdg'; state.view='event-detail'; render(); }); await d.waitForTimeout(200);
 await d.click('[data-inv="o-ke"]'); await d.waitForTimeout(200); await d.click('[data-inv="o-periksa"]'); await d.waitForTimeout(300); await d.screenshot({path:'shots/mid-dash.png'});
 await d.fill('[data-hk-bind="hk.modal.alasan"]','Selisih kecil'); await d.click('[data-hk-act="so-setuju"]'); await d.waitForTimeout(300);
 const so2=(await d.evaluate(()=>JSON.parse(localStorage.getItem('hk2:opname')))).find(o=>o.no===so2no); out.so2={status:so2.status, oleh:so2.disetujui&&so2.disetujui.oleh, kerugian:so2.kerugian};
 out.detailNote=await d.evaluate(()=>[...document.querySelectorAll('.main .hk-note')].map(x=>x.innerText).join(' | ').slice(0,200));
 console.log(JSON.stringify({out,errs},null,1)); await b.close(); })();
