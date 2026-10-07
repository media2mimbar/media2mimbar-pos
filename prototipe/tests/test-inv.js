const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const errs=[]; const out={};
 const d=await b.newPage({viewport:{width:1440,height:900}}); d.on('pageerror',e=>errs.push(e.message));
 const P=process.cwd(); await d.goto('file://'+P+'/out/dashboard.html'); await d.evaluate(()=>{localStorage.clear();localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Dimas Pratama'}))}); await d.reload(); await d.waitForTimeout(500);
 const toast=()=>d.evaluate(()=>document.querySelector('.toast')?.textContent);
 const go=async v=>{ await d.evaluate(v=>{ state.view=v; render(); },v); await d.waitForTimeout(200); };
 out.sidebar=await d.evaluate(()=>NAV.find(n=>n.id==='inventori').children.map(c=>c.label));
 // FAKTUR
 await go('faktur-list'); out.fakturList=await d.evaluate(()=>[...document.querySelectorAll('.main tbody tr')].map(r=>r.innerText.replace(/\s+/g,' ').slice(0,120)));
 await d.screenshot({path:'shots/inv2-faktur-list.png'});
 await d.click('[data-inv="f-baru"]'); await d.waitForTimeout(200);
 await d.click('[data-inv="f-simpan"]'); await d.waitForTimeout(150); out.fTolak={toast:await toast(), merah:await d.evaluate(()=>[...document.querySelectorAll('.hk-invalid')].map(x=>x.id))};
 await d.selectOption('#ivFSup','sup1');
 await d.click('[data-inv="pilih"][data-inv-arg="faktur"]'); await d.waitForTimeout(200);
 await d.fill('[data-hk-bind="hk.modal.cari"]','kaos polos'); await d.waitForTimeout(150); await d.click('td[data-hk-act="pil-cek"] >> nth=0');
 await d.fill('[data-hk-bind="hk.modal.cari"]','jersey dewasa l'); await d.waitForTimeout(150); await d.click('td[data-hk-act="pil-cek"] >> nth=0');
 await d.click('[data-hk-act="pil-simpan"]'); await d.waitForTimeout(200);
 const hppLama=await d.evaluate(()=>state.products.find(p=>p.sku==='KP-004').modal);
 const gLama=await d.evaluate(()=>hkStokDi(state.stokItems,'KP-004','Gudang Pusat'));
 await d.fill('[data-hk-bind="hk.inv.faktur.items.0.qty"]','100'); await d.fill('[data-hk-bind="hk.inv.faktur.items.0.harga"]','16000');
 await d.fill('[data-hk-bind="hk.inv.faktur.items.1.qty"]','10'); await d.fill('[data-hk-bind="hk.inv.faktur.items.1.harga"]','80000');
 out.fTotal=await d.evaluate(()=>document.getElementById('ivFTotal').textContent);
 await d.click('[data-inv="f-bayar"][data-inv-arg="Belum lunas"]'); await d.waitForTimeout(150);
 await d.click('[data-inv="f-simpan"]'); await d.waitForTimeout(150); out.fTempo=await toast();
 const tempo=await d.evaluate(()=>hkYmd(hkAddDays(new Date(),14))); await d.fill('#ivFTempo',tempo); await d.fill('#ivFDp','500000');
 await d.screenshot({path:'shots/inv2-faktur-form.png', fullPage:true});
 await d.click('[data-inv="f-simpan"]'); await d.waitForTimeout(250); out.fToast=await toast();
 out.fHasil=await d.evaluate(()=>{ const f=state.faktur[0]; return {no:f.no, total:f.total, status:hkFakturStatus(f), sisa:hkFakturSisa(f), hpp:f.hpp}; });
 out.gudang={lama:gLama, baru:await d.evaluate(()=>hkStokDi(state.stokItems,'KP-004','Gudang Pusat')), hppLama, hppBaru:await d.evaluate(()=>state.products.find(p=>p.sku==='KP-004').modal)};
 // bayar
 await d.click('.main tbody tr >> nth=0'); await d.waitForTimeout(200);
 await d.click('[data-inv="f-lunasi"]'); await d.waitForTimeout(100); await d.click('[data-inv="f-bayar-simpan"]'); await d.waitForTimeout(200);
 out.lunas=await d.evaluate(()=>hkFakturStatus(state.faktur[0])); await d.screenshot({path:'shots/inv2-faktur-detail.png'});
 await d.evaluate(()=>{ state.hk.modal=null; render(); });
 // PEMASOK baru dari faktur
 await d.click('[data-inv="f-baru"]'); await d.waitForTimeout(150); await d.click('[data-inv="p-baru"][data-inv-arg="faktur"]'); await d.waitForTimeout(150);
 await d.click('[data-inv="p-simpan"]'); out.pTolak=await toast();
 await d.fill('#ivPNama','Konveksi Baru'); await d.fill('#ivPTelp','0811'); await d.click('[data-inv="p-simpan"]'); await d.waitForTimeout(200);
 out.pBalik=await d.evaluate(()=>({view:state.view, sup:state.hk.inv.faktur.pemasokId&&state.pemasok.find(s=>s.id===state.hk.inv.faktur.pemasokId).nama}));
 await go('pemasok'); await d.screenshot({path:'shots/inv2-pemasok.png'});
 // OPNAME GUDANG
 await go('stok-opname'); out.soList=await d.evaluate(()=>document.querySelectorAll('.main tbody tr').length);
 await d.click('[data-inv="o-baru"]'); await d.waitForTimeout(200);
 const sis=await d.evaluate(()=>hkStokDi(state.stokItems,'TB-002','Gudang Pusat'));
 await d.fill('.iv-og[data-sku="TB-002"]',String(sis-3)); await d.waitForTimeout(100);
 out.ogSum=await d.evaluate(()=>document.getElementById('ivOgSum').innerText);
 await d.click('[data-inv="o-kirim"]'); out.ogTanpaCatatan=await toast();
 await d.fill('[data-hk-bind="hk.inv.og.catatan"]','3 topi tidak ada di rak'); await d.screenshot({path:'shots/inv2-opname-form.png'});
 await d.click('[data-inv="o-kirim"]'); await d.waitForTimeout(200); out.ogKirim=await toast();
 const soNo=await d.evaluate(()=>state.posOpname[0].no);
 await d.click(`[data-inv="o-periksa"][data-inv-arg="${soNo}"]`); await d.waitForTimeout(150); out.selfApprove=await toast();
 await d.screenshot({path:'shots/inv2-opname-list.png'});
 // Rina menyetujui
 await d.evaluate(()=>{ localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Rina Wijaya'})); }); await d.reload(); await d.waitForTimeout(400); await go('stok-opname');
 await d.click(`[data-inv="o-periksa"][data-inv-arg="${soNo}"]`); await d.waitForTimeout(200);
 await d.click('[data-hk-act="so-setuju"]'); await d.waitForTimeout(200);
 out.soHasil=await d.evaluate(no=>{ const o=state.posOpname.find(x=>x.no===no); return {status:o.status, oleh:o.disetujui&&o.disetujui.oleh, kerugian:o.kerugian, pj:o.tanggungJawab&&o.tanggungJawab.pj}; },soNo);
 out.topiGudang={sebelum:sis, sesudah:await d.evaluate(()=>hkStokDi(state.stokItems,'TB-002','Gudang Pusat'))};
 // TERBUANG manual
 await go('stok-terbuang'); out.tbAwal=await d.evaluate(()=>[...document.querySelectorAll('.main tbody tr')].map(r=>r.innerText.replace(/\s+/g,' ').slice(0,90)));
 await d.screenshot({path:'shots/inv2-terbuang.png'});
 await d.click('[data-inv="t-baru"]'); await d.waitForTimeout(150); await d.click('[data-inv="t-simpan"]'); out.tTolak=await toast();
 await d.selectOption('#ivTAlasan','Berjamur atau lembap'); await d.fill('#ivTPenj','Atap gudang bocor, 2 totebag kena air dan berjamur');
 await d.click('[data-inv="pilih"][data-inv-arg="terbuang"]'); await d.waitForTimeout(150); await d.fill('[data-hk-bind="hk.modal.cari"]','totebag'); await d.waitForTimeout(150); await d.click('td[data-hk-act="pil-cek"] >> nth=0'); await d.click('[data-hk-act="pil-simpan"]'); await d.waitForTimeout(150);
 await d.fill('[data-hk-bind="hk.inv.tb.items.0.qty"]','2'); const tot0=await d.evaluate(()=>hkStokDi(state.stokItems,'TOT-009','Gudang Pusat'));
 await d.screenshot({path:'shots/inv2-terbuang-form.png'});
 await d.click('[data-inv="t-simpan"]'); await d.waitForTimeout(200); out.tToast=await toast();
 out.totebag={sebelum:tot0, sesudah:await d.evaluate(()=>hkStokDi(state.stokItems,'TOT-009','Gudang Pusat'))};
 out.tbJenis=await d.evaluate(()=>[...new Set([...document.querySelectorAll('.main tbody tr td:nth-child(2)')].map(x=>x.innerText))]);
 // DAFTAR STOK
 await go('daftar-stok'); out.stokHead=await d.evaluate(()=>[...document.querySelectorAll('.main thead th')].map(x=>x.innerText));
 await d.screenshot({path:'shots/inv2-stok.png'});
 await d.click('[data-inv="s-min"]'); await d.waitForTimeout(150); out.minRows=await d.evaluate(()=>document.querySelectorAll('.main tbody tr').length);
 await d.click('[data-inv="s-tab"][data-inv-arg="gerak"]'); await d.waitForTimeout(200); out.gerak=await d.evaluate(()=>[...document.querySelectorAll('.main tbody tr')].filter(r=>/KP-004|TOT-009|TB-002/.test(r.innerText)).map(r=>r.innerText.replace(/\s+/g,' ')));
 await d.screenshot({path:'shots/inv2-gerak.png'});
 console.log(JSON.stringify({out,errs},null,1)); await b.close(); })();
