const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const d=await b.newPage({viewport:{width:1440,height:860}}); const errs=[]; d.on('pageerror',e=>errs.push(e.message));
 await d.goto('file://'+process.cwd()+'/out/dashboard.html'); await d.evaluate(()=>localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Rina Wijaya'}))); await d.reload(); await d.waitForTimeout(500);
 await d.screenshot({path:'shots/nolok.png'});
 const vis=await d.evaluate(()=>{ const o=document.querySelector('.outlet-switch'); return o?o.offsetParent!==null:false; });
 await d.evaluate(()=>{ state.view='daftar-stok'; render(); }); const sub=await d.evaluate(()=>document.querySelector('.page-sub').textContent);
 console.log(JSON.stringify({vis, sub, errs})); await b.close(); })();
