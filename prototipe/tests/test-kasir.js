const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({acceptDownloads:true}); const d=await ctx.newPage(); const errs=[]; d.on('pageerror',e=>errs.push(e.message)); await d.setViewportSize({width:1440,height:900});
 await d.goto('file://'+process.cwd()+'/out/dashboard.html'); await d.evaluate(()=>{ localStorage.clear(); localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Dimas Pratama'})); }); await d.reload(); await d.waitForTimeout(700);
 const nav=await d.evaluate(()=>NAV.find(n=>n.id==='laporan').children.map(c=>c.label));
 await d.evaluate(()=>{ state.view='lap-kasir'; render(); }); await d.click('[data-hk-act="lap-per"][data-hk-arg="semua"]'); await d.waitForTimeout(300);
 await d.screenshot({path:'shots/kasir-lap.png'});
 const rows=await d.evaluate(()=>[...document.querySelectorAll('.main table tbody tr')].map(r=>[...r.children].slice(0,4).map(c=>c.innerText.replace(/\n/g,' / ')).join(' | ')));
 const [dl]=await Promise.all([d.waitForEvent('download'), d.click('[data-hk-act="lap-csv"]')]); const p=await dl.path(); const csv=require('fs').readFileSync(p,'utf8').split('\n').slice(0,3);
 // impor manual pesanan tercatat atas nama akun
 await d.evaluate(()=>{ state.view='pesanan-online'; render(); }); await d.click('[data-po-new]'); await d.waitForTimeout(200);
 await d.fill('#poNoInput','TESKASIR01'); await d.click('[data-hk-act="pil-buka"][data-hk-arg="order"]'); await d.waitForTimeout(150); await d.click('td[data-hk-act="pil-cek"] >> nth=0'); await d.click('[data-hk-act="pil-simpan"]'); await d.waitForTimeout(150);
 await d.evaluate(()=>{ const b=[...document.querySelectorAll('.main button.btn-primary')].pop(); b.click(); }); await d.waitForTimeout(300); await d.click('[data-po-confirm-save]'); await d.waitForTimeout(300);
 const o=await d.evaluate(()=>JSON.parse(localStorage.getItem('hk2:orders')).find(x=>x.noPesanan==='TESKASIR01'));
 console.log(JSON.stringify({nav,rows,csv,oleh:o&&o.oleh,errs},null,1)); await b.close(); })();
