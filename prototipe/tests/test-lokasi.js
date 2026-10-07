const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const errs=[]; const out={};
 const d=await b.newPage({viewport:{width:1440,height:900}}); d.on('pageerror',e=>errs.push(e.message));
 await d.goto('file://'+process.cwd()+'/out/dashboard.html'); await d.evaluate(()=>{localStorage.clear();localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Rina Wijaya'}))}); await d.reload(); await d.waitForTimeout(500);
 const toast=()=>d.evaluate(()=>document.querySelector('.toast')?.textContent);
 await d.evaluate(()=>{ state.view='promo-produk'; render(); }); await d.click('[data-inv="pr-baru"]'); await d.waitForTimeout(150); await d.click('[data-inv="pr-jenis"][data-inv-arg="promoProduk"]'); await d.waitForTimeout(200);
 out.awal=await d.evaluate(()=>({semua:state.promoProdukForm.lokasiSemua, chip:document.querySelectorAll('[data-hk-act="pr-lok"]').length}));
 // pilih Bandung + Kajian (multi)
 await d.click('[data-hk-act="pr-lok"][data-hk-arg="promoProduk|Hikayat Fest Bandung"]'); await d.click('[data-hk-act="pr-lok"][data-hk-arg="promoProduk|Kajian Akbar Istiqlal"]');
 out.lokasi=await d.evaluate(()=>({l:state.promoProdukForm.lokasi, semua:state.promoProdukForm.lokasiSemua, outlet:state.promoProdukForm.outlet}));
 // kosongkan nama & hari, lanjut -> ditolak
 await d.evaluate(()=>{ state.promoProdukForm.hari=[]; renderPromoFormModal(); });
 await d.click('[data-promoProduk-next-1]'); await d.waitForTimeout(200);
 out.tolak={step:await d.evaluate(()=>state.promoProdukForm.step), toast:await toast(), merah:await d.evaluate(()=>[...document.querySelectorAll('.hk-invalid')].map(x=>x.id||x.className.split(' ')[0]))};
 await d.screenshot({path:'shots/lok-tolak.png'});
 // lepas kedua lokasi -> ditolak lokasi
 await d.fill('#promoProdukNamaInput','Promo Dua Event'); await d.fill('#promoProdukDeskripsiInput','Tes lokasi'); await d.click('[data-toggle-promoProduk-semua-hari]');
 await d.click('[data-hk-act="pr-lok"][data-hk-arg="promoProduk|Hikayat Fest Bandung"]'); await d.click('[data-hk-act="pr-lok"][data-hk-arg="promoProduk|Kajian Akbar Istiqlal"]');
 await d.click('[data-promoProduk-next-1]'); await d.waitForTimeout(150); out.tolakLokasi=await toast();
 await d.click('[data-hk-act="pr-lok"][data-hk-arg="promoProduk|Hikayat Fest Bandung"]'); await d.click('[data-hk-act="pr-lok"][data-hk-arg="promoProduk|Gudang Pusat"]');
 await d.screenshot({path:'shots/lok-ok.png'});
 await d.click('[data-promoProduk-next-1]'); await d.waitForTimeout(150); out.step=await d.evaluate(()=>state.promoProdukForm.step);
 await d.evaluate(()=>{ const f=state.promoProdukForm; f.jenisBonus='persen'; f.besaranPotongan='10'; f.produkPromo=['Kaos Polos']; f.promoBerdasarkan='pembelian'; renderPromoFormModal(); });
 await d.click('[data-request-save-promoProduk]'); await d.waitForTimeout(200);
 await d.evaluate(()=>{ const b=[...document.querySelectorAll('#confirmModalRoot button, .confirm-box button')].find(x=>/Simpan|Ya/.test(x.textContent)&&x.offsetParent); b&&b.click(); }); await d.waitForTimeout(300);
 out.list=await d.evaluate(()=>{ const p=state.promoProdukList.find(x=>x.nama==='Promo Dua Event'); return p&&{outlet:p.outlet, lokasi:p.detail.lokasi}; });
 out.aktif=await d.evaluate(()=>{ const D=hkLoad(); return ['Hikayat Fest Bandung','Gudang Pusat','Kajian Akbar Istiqlal'].map(l=>l+':'+hkPromoAktif(D,l).some(p=>p.name==='Promo Dua Event')); });
 console.log(JSON.stringify({out,errs},null,1)); await b.close(); })();
