const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(); const errs=[]; const out={};
 const base='file://'+process.cwd()+'/out/';
 const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('P:'+e.message)); await p.setViewportSize({width:390,height:844});
 await p.goto(base+'pos.html'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
 const pin=async s=>{ for(const c of s) await p.click(`#hkLoginBody .pin-key:text-is("${c}")`); await p.waitForTimeout(400); };
 await p.click('text=Sari Handayani'); await pin('123456'); await pin('333333'); await p.waitForTimeout(400);
 // kunci layar lalu buka
 await p.evaluate(()=>{ hkGo('view-lock'); }); for(const c of '333333') await p.evaluate(c=>pinPress(c),c); await p.waitForTimeout(600);
 await p.evaluate(()=>{ openSheet('sheetMainMenu'); }); await p.waitForTimeout(300);
 out.menu=await p.evaluate(()=>[...document.querySelectorAll('#sheetMainMenu .oti-name')].map(x=>x.textContent));
 await p.evaluate(()=>hkBukaMasuk()); await p.waitForTimeout(600); await p.screenshot({path:'shots/masuk-sari.png'});
 out.sariLihat=await p.evaluate(()=>[...new Set([...document.querySelectorAll('.hk-ms-nama')].map(x=>x.firstChild.textContent.trim()))]);
 out.log=(await p.evaluate(()=>JSON.parse(localStorage.getItem('hk2:masuk')))).slice(0,5).map(m=>m.nama+':'+m.aksi+':'+m.tempat+':'+m.perangkat);
 // keluar, Rina masuk dan lihat semua
 await p.evaluate(()=>hkKeluar()); await p.waitForTimeout(300); await p.click('text=Rina Wijaya'); await pin('111111');
 await p.click('#hkLoginBody .order-type-item:has-text("Gudang Pusat")'); await p.click('#hkLoginBody button.btn-primary'); await p.waitForTimeout(400);
 await p.evaluate(()=>hkBukaMasuk()); await p.waitForTimeout(600); await p.evaluate(()=>hkMsScope('semua')); await p.waitForTimeout(200); await p.screenshot({path:'shots/masuk-rina.png'});
 out.rinaLihat=await p.evaluate(()=>[...new Set([...document.querySelectorAll('.hk-ms-nama')].map(x=>x.firstChild.textContent.trim()))]);
 // dashboard
 const d=await ctx.newPage(); d.on('pageerror',e=>errs.push('D:'+e.message)); await d.setViewportSize({width:1440,height:900});
 await d.goto(base+'dashboard.html'); await d.evaluate(()=>localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Rina Wijaya'}))); await d.reload(); await d.waitForTimeout(600);
 await d.click('.topbar >> text=Karyawan'); await d.waitForTimeout(400); await d.screenshot({path:'shots/masuk-dash.png', fullPage:true});
 await d.selectOption('[data-hk-bind="hk.msNama"]','Sari Handayani'); await d.waitForTimeout(300);
 out.dashFilter=await d.evaluate(()=>[...new Set([...document.querySelectorAll('table')[1].querySelectorAll('tbody td:nth-child(2) b')].map(x=>x.textContent))]);
 console.log(JSON.stringify({out,errs},null,1)); await b.close(); })();
