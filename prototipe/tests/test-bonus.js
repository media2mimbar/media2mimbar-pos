const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(); const errs=[]; const out={};
 const base='file://'+process.cwd()+'/out/';
 const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('P:'+e.message)); await p.setViewportSize({width:390,height:844});
 await p.goto(base+'pos.html'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
 await p.click('text=Sari Handayani'); for(const c of '333333') await p.click(`#hkLoginBody .pin-key:text-is("${c}")`); await p.waitForTimeout(500);
 const stok=sku=>p.evaluate(sku=>hkStokDi(JSON.parse(localStorage.getItem('hk2:stok')),sku,'Hikayat Fest Bandung'),sku);
 out.promos=await p.evaluate(()=>PROMO_PROGRAMS.map(x=>x.name+':'+x.type));
 out.syarat=await p.evaluate(()=>PROMO_PROGRAMS.filter(x=>x.type==='bonus'||x.type==='bundle').map(hkPromoHitung.syaratPromo));
 // bonus: 1 jersey -> belum cukup
 const topi0=await stok('TB-002');
 await p.evaluate(()=>{ const id=PRODUCTS.find(x=>x.sku==='JRS-006-L').id; addToCart(id); }); await p.waitForTimeout(150);
 out.kurang1=await p.evaluate(()=>hkPromoHitung.kurangPromo(PROMO_PROGRAMS.find(x=>x.type==='bonus'),promoSessionItems()));
 await p.evaluate(()=>{ const id=PRODUCTS.find(x=>x.sku==='JRS-006-M').id; addToCart(id); }); await p.waitForTimeout(150);
 await p.evaluate(()=>{ activeCat='promo'; renderProductArea(); }); await p.waitForTimeout(150);
 await p.evaluate(()=>hkPakaiPromo(PROMO_PROGRAMS.find(x=>x.type==='bonus').id)); await p.waitForTimeout(300);
 out.bonus=await p.evaluate(()=>({promo:appliedPromo&&appliedPromo.name, topiDiKeranjang:cart[PRODUCTS.find(x=>x.sku==='TB-002').id]||0, diskon:billCtx().discount, total:billCtx().total}));
 await p.screenshot({path:'shots/bonus-pos.png'});
 await p.evaluate(()=>{ goToPayment(); selectPayment('cash'); cashTendered=billCtx().amountNow; prosesBayar(); }); await p.waitForTimeout(500);
 out.trx1=await p.evaluate(()=>{ const t=JSON.parse(localStorage.getItem('hk2:trx')).slice(-1)[0]; return {promo:t.promo, diskon:t.diskon, bonus:t.bonus, items:t.items.map(i=>i.sku+'x'+i.qty)}; });
 out.topiStok=[topi0, await stok('TB-002')];
 await p.evaluate(()=>{ try{ finishOrder(); }catch(e){} }); await p.waitForTimeout(300);
 // kelipatan: 4 jersey -> 2 topi gratis
 out.kelipatan=await p.evaluate(()=>{ const j=PRODUCTS.find(x=>x.sku==='JRS-006-L').id, t=PRODUCTS.find(x=>x.sku==='TB-002').id; const pr=PROMO_PROGRAMS.find(x=>x.type==='bonus'); return [hkPromoHitung.bonusInfo(pr,[{id:j,qty:4,price:175000},{id:t,qty:2,price:35000}]).gratis.length, hkPromoHitung.bonusInfo(pr,[{id:j,qty:3,price:175000},{id:t,qty:2,price:35000}]).gratis.length]; });
 // bundling
 await p.evaluate(()=>{ addToCart(PRODUCTS.find(x=>x.sku==='TMB-007').id); }); await p.waitForTimeout(150);
 out.kurangPaket=await p.evaluate(()=>hkPromoHitung.kurangPromo(PROMO_PROGRAMS.find(x=>x.type==='bundle'),promoSessionItems()));
 await p.evaluate(()=>{ addToCart(PRODUCTS.find(x=>x.sku==='TOT-009').id); }); await p.waitForTimeout(150);
 await p.evaluate(()=>hkPakaiPromo(PROMO_PROGRAMS.find(x=>x.type==='bundle').id)); await p.waitForTimeout(300);
 out.paket=await p.evaluate(()=>({promo:appliedPromo&&appliedPromo.name, sub:itemsTotal(promoSessionItems()), diskon:billCtx().discount, total:billCtx().total}));
 // satu promo per pesanan: pasang promo lain menggantikan
 await p.evaluate(()=>{ tempPromoSelId=PROMO_PROGRAMS.find(x=>x.name==='Belanja Rp300 ribu')?.id||null; });
 await p.evaluate(()=>{ goToPayment(); selectPayment('cash'); cashTendered=billCtx().amountNow; prosesBayar(); }); await p.waitForTimeout(500);
 out.trx2=await p.evaluate(()=>{ const t=JSON.parse(localStorage.getItem('hk2:trx')).slice(-1)[0]; return {promo:t.promo, diskon:t.diskon, total:t.total, paket:t.paket}; });
 // dashboard form
 const d=await ctx.newPage(); d.on('pageerror',e=>errs.push('D:'+e.message)); await d.setViewportSize({width:1440,height:900});
 await d.goto(base+'dashboard.html'); await d.evaluate(()=>localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Rina Wijaya'}))); await d.reload(); await d.waitForTimeout(600);
 await d.evaluate(()=>{ state.view='promo-produk'; render(); }); await d.waitForTimeout(300);
 out.list=await d.evaluate(()=>[...document.querySelectorAll('.main table tbody tr')].map(r=>{ const c=[...r.children]; return c.slice(0,5).map(x=>x.innerText.replace(/\n/g,' ')).join(' | ')+' | dipakai '+c[c.length-3].innerText; }));
 await d.screenshot({path:'shots/bonus-list.png'});
 await d.click('[data-inv="pr-baru"]'); await d.waitForTimeout(150); await d.click('[data-inv="pr-jenis"][data-inv-arg="promoProduk"]'); await d.waitForTimeout(300);
 await d.evaluate(()=>{ const f=state.promoProdukForm; f.nama='Paket Kaos'; f.deskripsi='Tes paket'; f.step=2; f.jenisBonus='bundling'; f.produkPromo=['Kaos Polos','Topi Bordir']; renderPromoFormModal(); }); await d.waitForTimeout(200);
 await d.screenshot({path:'shots/bundling-form.png'});
 out.normalTxt=await d.evaluate(()=>document.querySelector('#promoProdukHargaPaketInput').parentElement.innerText.slice(-80));
 await d.fill('#promoProdukHargaPaketInput','90.000'); await d.click('[data-request-save-promoProduk]'); await d.waitForTimeout(200); out.cekMahal=await d.evaluate(()=>document.querySelector('.toast')?.textContent);
 await d.evaluate(()=>{ const f=state.promoProdukForm; f.jenisBonus='bonus-produk'; f.produkPromo=['Kaos Polos']; f.bonusProduk=[]; f.minKuantitas='3'; renderPromoFormModal(); }); await d.waitForTimeout(200);
 await d.screenshot({path:'shots/bonus-form.png'});
 await d.click('[data-request-save-promoProduk]'); await d.waitForTimeout(200); out.cekBonus=await d.evaluate(()=>document.querySelector('.toast')?.textContent);
 console.log(JSON.stringify({out,errs},null,1)); await b.close(); })();
