const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const errs=[]; const d=await b.newPage({viewport:{width:1100,height:900}}); d.on('pageerror',e=>errs.push(e.message));
 await d.goto('file://'+process.cwd()+'/out/dashboard.html'); await d.evaluate(()=>{localStorage.clear();localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Rina Wijaya',email:'rina@hikayat.id'}))}); await d.reload(); await d.waitForTimeout(500);
 await d.evaluate(()=>{ state.hk.keu={evId:'ev-sby', per:'bulan'}; state.view='keu-event'; render(); }); await d.waitForTimeout(300);
 await d.emulateMedia({media:'print'}); await d.pdf({path:'shots/keu-event.pdf', format:'A4', printBackground:true});
 await d.screenshot({path:'shots/keu-print.png', fullPage:false});
 console.log(JSON.stringify({errs})); await b.close(); })();
