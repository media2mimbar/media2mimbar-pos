const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}}); const errs=[]; const out={}; p.on('pageerror',e=>errs.push(e.message));
 const LS=k=>p.evaluate(k=>JSON.parse(localStorage.getItem('hk2:'+k)),k);
 await p.goto('file://'+process.cwd()+'/out/pos.html'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
 const pin=async s=>{ for(const c of s) await p.click(`#hkLoginBody .pin-key:text-is("${c}")`); await p.waitForTimeout(300); };
 // kasir kirim opname
 await p.click('text=Sari Handayani'); await pin('333333'); await p.waitForTimeout(300);
 await p.evaluate(()=>{ bukaMenuInventori(); soOpenTambah(); }); await p.waitForTimeout(300); await p.locator('.hk-so-fisik').first().fill('7'); await p.fill('#hkSoCatatan','2 kaos S hilang'); await p.evaluate(()=>hkSOKirim()); await p.waitForTimeout(300);
 await p.evaluate(()=>hkKeluar()); await p.waitForTimeout(200);
 // owner masuk ke kasir Bandung (gabung laci Budi)
 await p.click('text=Rina Wijaya'); await pin('111111');
 await p.click('#hkLoginBody .order-type-item:has-text("Hikayat Fest")'); await p.click('#hkLoginBody button.btn-primary'); await p.waitForTimeout(400);
 await p.evaluate(()=>hkTutupEventOpen('ev-bdg')); await p.waitForTimeout(400); await p.screenshot({path:'shots/tk-1.png'});
 out.tombol=await p.evaluate(()=>[...document.querySelectorAll('#hkTevBody button')].map(x=>x.textContent.trim()).slice(0,2));
 await p.click('#hkTevBody button:has-text("Tutup kasir")'); await p.waitForTimeout(500);
 out.view1=await p.evaluate(()=>document.querySelector('.app > .view.active').id);
 await p.evaluate(()=>{ hkTutupIn({value:'0'}); }).catch(()=>{});
 await p.evaluate(()=>hkTutupLanjut()); await p.waitForTimeout(400);
 for(const c of '111111') await p.evaluate(c=>tkPinPress(c),c); await p.waitForTimeout(1200);
 out.view2=await p.evaluate(()=>document.querySelector('.app > .view.active').id);
 out.masihMasuk=await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem('hk2pos:sesi2')||'{}'); return s.kasir; });
 out.sheetTerbuka=await p.evaluate(()=>document.getElementById('sheetHkTutupEv').classList.contains('show'));
 await p.screenshot({path:'shots/tk-2.png'});
 out.tombol2=await p.evaluate(()=>[...document.querySelectorAll('#hkTevBody button')].map(x=>x.textContent.trim()));
 out.diblokOpname=await p.evaluate(()=>[...document.querySelectorAll('#hkTevBody button')].some(b=>/Tutup Event/.test(b.textContent)&&b.disabled));
 await p.evaluate(()=>{ const so=hkSOAkhir(hkLoad(),'ev-bdg'); closeSheet('sheetHkTutupEv'); hkSOPeriksa(so.no); }); await p.waitForTimeout(300); await p.fill('#hkSsAlasan','2 kaos S hilang'); await p.evaluate(()=>hkSOSetuju(hkSOAkhir(hkLoad(),'ev-bdg').no)); await p.waitForTimeout(300);
 await p.evaluate(()=>hkTutupEventOpen('ev-bdg')); await p.waitForTimeout(300); await p.evaluate(()=>hkTutupEventOk('ev-bdg')); await p.waitForTimeout(400);
 const ev=(await LS('events')).find(e=>e.id==='ev-bdg'); out.ditutup=ev.ditutup; out.kerugian=ev.tutup&&ev.tutup.kerugian;
 console.log(JSON.stringify({out,errs},null,1)); await b.close(); })();
