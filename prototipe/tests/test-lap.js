const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1440,height:860}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.cwd()+'/out/dashboard.html'); await p.evaluate(()=>localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Dimas Pratama'}))); await p.reload(); await p.waitForTimeout(500); await p.waitForTimeout(500);
 await p.click('button[data-nav="lap-saluran"]'); await p.waitForTimeout(300); await p.screenshot({path:'shots/lap-1.png'});
 const r={};
 for(const k of ['lap-event','lap-produk','lap-harian']){ await p.click(`.nav-child[data-nav="${k}"]`); await p.waitForTimeout(250); r[k]=await p.evaluate(()=>document.querySelector('.page-title').textContent+' | '+document.querySelector('.nav-child.active').textContent); }
 await p.screenshot({path:'shots/lap-2.png'});
 await p.click('.nav-head[data-nav="dashboard"]'); await p.waitForTimeout(200);
 await p.click('.nav-head[data-toggle-group="laporan"]'); await p.waitForTimeout(200);
 r.toggle=await p.evaluate(()=>[...document.querySelectorAll('.nav-child')].filter(x=>x.offsetParent).map(x=>x.textContent).join(','));
 console.log(JSON.stringify({r,errs})); await b.close(); })();
