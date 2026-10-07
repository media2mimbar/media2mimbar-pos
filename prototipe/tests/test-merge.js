const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(); const errs=[]; const out={}; const base='file://'+process.cwd()+'/out/';
 const d=await ctx.newPage(); d.on('pageerror',e=>errs.push('D:'+e.message)); await d.setViewportSize({width:1440,height:900});
 await d.goto(base+'dashboard.html'); await d.evaluate(()=>{localStorage.clear();localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Rina Wijaya'}))}); await d.reload(); await d.waitForTimeout(500);
 const toast=()=>d.evaluate(()=>document.querySelector('.toast')?.textContent);
 // 1 promo gabung
 out.navPromo=await d.evaluate(()=>{ const n=NAV.find(n=>n.id==='promo'); return n&&{label:n.label, anak:!!n.children}; });
 await d.evaluate(()=>{ state.view='promo-produk'; render(); }); await d.waitForTimeout(200);
 out.promoView=await d.evaluate(()=>({view:state.view, rows:[...document.querySelectorAll('.main tbody tr')].map(r=>r.children[0].innerText.split('\n')[0]+' | '+r.children[1].innerText)}));
 await d.screenshot({path:'shots/m-promo.png'});
 await d.selectOption('[data-hk-bind="hk.inv.pJenis"]','Total belanja'); await d.waitForTimeout(200); out.filterTotal=await d.evaluate(()=>document.querySelectorAll('.main tbody tr').length);
 await d.selectOption('[data-hk-bind="hk.inv.pJenis"]',''); await d.waitForTimeout(150);
 await d.click('[data-inv="pr-baru"]'); await d.waitForTimeout(200); await d.screenshot({path:'shots/m-promo-jenis.png'});
 await d.click('[data-inv="pr-jenis"][data-inv-arg="promoTotal"]'); await d.waitForTimeout(250);
 out.formTotal=await d.evaluate(()=>!!state.promoTotalForm&&!!document.querySelector('[data-promoTotal-next-1]'));
 await d.evaluate(()=>{ state.promoTotalForm=null; renderPromoFormModal(); });
 await d.click('[data-edit-promoProduk="0"]'); await d.waitForTimeout(200); out.edit=await d.evaluate(()=>state.promoProdukForm&&state.promoProdukForm.nama);
 await d.evaluate(()=>{ state.promoProdukForm=null; renderPromoFormModal(); });
 // 2 & 3 event detail & form
 await d.evaluate(()=>{ state.hk.evId='ev-bdg'; state.view='event-detail'; render(); });
 out.tombolDetail=await d.evaluate(()=>[...document.querySelectorAll('.page-head button')].map(x=>x.textContent.trim()));
 await d.click('[data-hk-act="ev-edit"]'); await d.waitForTimeout(200);
 out.kolomForm=await d.evaluate(()=>[...document.querySelectorAll('.hk-evtabel thead th')].map(x=>x.innerText.trim()));
 // event baru: catatan kirim stok
 await d.evaluate(()=>{ state.view='event'; render(); document.querySelector('[data-hk-act="ev-new"]').click(); });
 await d.fill('[data-hk-bind="hk.evForm.nama"]','Bazar Tes'); await d.click('[data-hk-act="evp-buka"]'); await d.waitForTimeout(150); await d.click('td[data-hk-act="pil-cek"] >> nth=0'); await d.click('[data-hk-act="pil-simpan"]'); await d.waitForTimeout(150);
 await d.selectOption('[data-hk-bind="hk.evForm.pj"]','Sari Handayani'); await d.click('[data-hk-act="ev-save"]'); await d.waitForTimeout(250);
 out.evBaru={toast:await toast(), note:await d.evaluate(()=>[...document.querySelectorAll('.main .hk-note')].map(x=>x.innerText).join(' | ').slice(0,140)), mutasi:await d.evaluate(()=>state.mutasi.filter(m=>m.ke==='Bazar Tes').length)};
 await d.screenshot({path:'shots/m-event-baru.png'});
 // 5 retur di stok terbuang
 out.lapNav=await d.evaluate(()=>NAV.find(n=>n.id==='laporan').children.map(c=>c.label));
 await d.evaluate(()=>{ state.view='lap-retur'; render(); }); out.returRedirect=await d.evaluate(()=>({view:state.view, jenis:state.hk.inv.tJenis, kolom:[...document.querySelectorAll('.main thead th')].map(x=>x.innerText)}));
 // 4 + 6 di POS
 const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('P:'+e.message)); await p.setViewportSize({width:390,height:844});
 await p.goto(base+'pos.html'); await p.waitForTimeout(500);
 const pin=async s=>{ for(const c of s) await p.click(`#hkLoginBody .pin-key:text-is("${c}")`); await p.waitForTimeout(300); };
 await p.click('text=Sari Handayani'); await pin('333333');
 await p.evaluate(()=>{ bukaMenuInventori(); soOpenTambah(); }); await p.waitForTimeout(300); await p.locator('.hk-so-fisik').first().fill('1'); await p.evaluate(()=>hkSOKirim()); await p.waitForTimeout(300);
 // promo button langsung Promo Tersedia
 await p.evaluate(()=>{ hkGo('view-home'); addToCart(PRODUCTS.find(x=>x.sku==='JRS-006-L').id); }); await p.waitForTimeout(200);
 await p.evaluate(()=>openPromoQuickMenu({currentTarget:document.body, stopPropagation(){}})); await p.waitForTimeout(300);
 out.promoPos={tersedia:await p.evaluate(()=>document.getElementById('sheetListPromo').classList.contains('show')), quick:await p.evaluate(()=>document.getElementById('promoQuickMenu').classList.contains('show'))};
 await p.screenshot({path:'shots/m-pos-promo.png'});
 await p.evaluate(()=>{ document.querySelectorAll('.sheet.show').forEach(s=>closeSheet(s.id)); hkKeluar(); }); await p.waitForTimeout(200);
 await p.click('text=Rina Wijaya'); await pin('111111'); await p.click('#hkLoginBody .order-type-item:has-text("Hikayat Fest")'); await p.click('#hkLoginBody button.btn-primary'); await p.waitForTimeout(400);
 await p.evaluate(()=>hkTutupEventOpen('ev-bdg')); await p.waitForTimeout(300); await p.screenshot({path:'shots/m-pos-tutup.png'});
 out.posTutup=await p.evaluate(()=>({note:[...document.querySelectorAll('#hkTevBody .hk-note')].map(x=>x.innerText).find(t=>/menunggu persetujuan/.test(t))?.slice(0,90), tombol:[...document.querySelectorAll('#hkTevBody button')].map(x=>x.textContent.trim()+(x.disabled?' (mati)':''))}));
 // dashboard: detail event & tutup diarahkan ke stok opname
 await d.reload(); await d.waitForTimeout(400); await d.evaluate(()=>{ state.hk.evId='ev-bdg'; state.view='event-detail'; render(); });
 out.detailNote=await d.evaluate(()=>[...document.querySelectorAll('.main .hk-note')].map(x=>x.innerText).join(' | ').slice(0,150));
 await d.click('[data-inv="o-ke"]'); await d.waitForTimeout(200); out.oKe=await d.evaluate(()=>({view:state.view, lok:state.hk.inv.oLok, n:document.querySelectorAll('.main tbody tr').length}));
 await d.evaluate(()=>{ state.hk.evId='ev-bdg'; state.view='event-detail'; render(); }); await d.click('[data-hk-act="tutup-open"]'); await d.waitForTimeout(200);
 out.tutupDash=await d.evaluate(()=>[...document.querySelectorAll('.hk-modal .hk-note')].map(x=>x.innerText).find(t=>/menunggu persetujuan/.test(t))?.slice(0,100));
 out.tutupTombol=await d.evaluate(()=>[...document.querySelectorAll('.hk-modal .hk-mf button')].map(x=>x.textContent+(x.disabled?'(mati)':''))); await d.screenshot({path:'shots/m-tutup-dash.png'});
 console.log(JSON.stringify({out,errs},null,1)); await b.close(); })();
