const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const errs=[]; const out={};
 const d=await b.newPage({viewport:{width:1440,height:900}}); d.on('pageerror',e=>errs.push(e.message));
 await d.goto('file://'+process.cwd()+'/out/dashboard.html'); await d.evaluate(()=>{localStorage.clear();localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Dimas Pratama'}))}); await d.reload(); await d.waitForTimeout(500);
 const toast=()=>d.evaluate(()=>document.querySelector('.toast')?.textContent);
 // 1. kirim stok
 await d.evaluate(()=>{ state.hk.evId='ev-bdg'; state.view='event-detail'; render(); }); await d.click('[data-hk-act="alok-open"][data-hk-arg="kirim"]'); await d.waitForTimeout(200);
 out.alokAwal=await d.evaluate(()=>document.querySelectorAll('[data-hk-alok]').length);
 await d.click('[data-hk-act="pil-buka"][data-hk-arg="alok"]'); await d.waitForTimeout(200);
 out.alokPilihan=await d.evaluate(()=>document.querySelectorAll('.hk-pilih tbody tr').length);
 await d.fill('[data-hk-bind="hk.modal.cari"]','jersey'); await d.waitForTimeout(150);
 await d.click('[data-hk-act="pil-semua"]'); await d.screenshot({path:'shots/pil-alok.png'});
 await d.click('[data-hk-act="pil-simpan"]'); await d.waitForTimeout(200);
 out.alokBaris=await d.evaluate(()=>[...document.querySelectorAll('[data-hk-alok]')].map(x=>x.dataset.hkAlok));
 await d.fill('[data-hk-alok="JRS-006-L"]','3'); await d.screenshot({path:'shots/pil-alok2.png'});
 await d.click('[data-hk-act="alok-save"]'); await d.waitForTimeout(200); out.alokToast=await toast();
 // 2. pesanan manual
 await d.evaluate(()=>{ state.view='pesanan-online'; render(); }); await d.waitForTimeout(200); await d.click('[data-po-new]'); await d.waitForTimeout(300);
 out.poRows0=await d.evaluate(()=>document.getElementById('poItemsTbody')?.innerText.trim());
 await d.click('[data-hk-act="pil-buka"][data-hk-arg="order"]'); await d.waitForTimeout(200);
 out.poCols=await d.evaluate(()=>[...document.querySelectorAll('.hk-pilih thead th')].map(x=>x.innerText.trim()));
 await d.click('td[data-hk-act="pil-cek"] >> nth=0'); await d.click('td[data-hk-act="pil-cek"] >> nth=2');
 await d.click('[data-hk-act="pil-simpan"]'); await d.waitForTimeout(200);
 out.poItems=await d.evaluate(()=>state.po.form.items); await d.screenshot({path:'shots/pil-po.png'});
 // 3. promo
 await d.evaluate(()=>{ state.view='promo-produk'; render(); }); await d.click('[data-inv="pr-baru"]'); await d.waitForTimeout(150); await d.click('[data-inv="pr-jenis"][data-inv-arg="promoProduk"]'); await d.waitForTimeout(200);
 await d.evaluate(()=>{ const f=state.promoProdukForm; f.nama='Tes'; f.step=2; f.jenisBonus='bonus-produk'; renderPromoFormModal(); }); await d.waitForTimeout(200);
 out.promoBtn=await d.evaluate(()=>document.querySelectorAll('[data-hk-act="pil-buka"][data-hk-arg^="promo"]').length);
 await d.click('[data-hk-act="pil-buka"][data-hk-arg="promo|promoProdukForm|produkPromo"]'); await d.waitForTimeout(200);
 out.promoVisible=await d.evaluate(()=>{ const r=document.querySelector('.hk-pilih'); const el=document.elementFromPoint(720,450); return !!r && !!el.closest('#hkModalRoot'); });
 await d.click('td[data-hk-act="pil-cek"] >> nth=0'); await d.click('[data-hk-act="pil-simpan"]'); await d.waitForTimeout(200);
 await d.click('[data-hk-act="pil-buka"][data-hk-arg="promo|promoProdukForm|bonusProduk"]'); await d.waitForTimeout(200);
 out.bonusRadio=await d.evaluate(()=>document.querySelector('.hk-pilih tbody input').type);
 await d.click('td[data-hk-act="pil-cek"] >> nth=10'); await d.click('td[data-hk-act="pil-cek"] >> nth=12'); await d.click('[data-hk-act="pil-simpan"]'); await d.waitForTimeout(200);
 out.promo=await d.evaluate(()=>({produk:state.promoProdukForm.produkPromo, bonus:state.promoProdukForm.bonusProduk}));
 await d.screenshot({path:'shots/pil-promo.png'});
 await d.evaluate(()=>document.querySelector('[data-remove-promoProduk-produk]').click()); await d.waitForTimeout(150);
 out.promoHapus=await d.evaluate(()=>state.promoProdukForm.produkPromo);
 console.log(JSON.stringify({out,errs},null,1)); await b.close(); })();
