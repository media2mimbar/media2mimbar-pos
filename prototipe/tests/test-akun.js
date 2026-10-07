const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(); const errs=[]; const out={}; const base='file://'+process.cwd()+'/out/';
 const d=await ctx.newPage(); d.on('pageerror',e=>errs.push('D:'+e.message)); await d.setViewportSize({width:1440,height:900});
 await d.goto(base+'dashboard.html'); await d.evaluate(()=>localStorage.clear()); await d.reload(); await d.waitForTimeout(500);
 const toast=()=>d.evaluate(()=>document.querySelector('.toast')?.textContent);
 const err=()=>d.evaluate(()=>document.querySelector('.hk-login-err')?.textContent);
 await d.screenshot({path:'shots/akun-login.png'});
 // salah password, lalu Owner masuk
 await d.fill('#hkDashEmail','rina@hikayat.id'); await d.fill('#hkDashPw','salah123'); await d.click('[data-hk-login-ok]'); await d.waitForTimeout(150); out.salah=await err();
 await d.fill('#hkDashEmail','sari@hikayat.id'); await d.fill('#hkDashPw','x'); await d.press('#hkDashPw','Enter'); await d.waitForTimeout(150); out.tanpaAkun=await err();
 await d.fill('#hkDashEmail','Rina@Hikayat.id'); await d.fill('#hkDashPw','hikayat123'); await d.press('#hkDashPw','Enter'); await d.waitForTimeout(300);
 out.owner=await d.evaluate(()=>hkAkun()&&hkAkun().nama);
 // Owner tambah karyawan
 await d.evaluate(()=>{ state.view='karyawan'; render(); }); await d.waitForTimeout(200);
 out.kolom=await d.evaluate(()=>[...document.querySelectorAll('.main table')[0].querySelectorAll('thead th')].map(x=>x.innerText));
 await d.screenshot({path:'shots/akun-karyawan.png'});
 await d.click('[data-hk-act="staff-new"]'); await d.waitForTimeout(200);
 await d.fill('#hkStNama','Andi Kasir'); await d.click('[data-hk-act="staff-save"]'); await d.waitForTimeout(100); // kasir saja, PIN acak
 out.kasirBaru=await d.evaluate(()=>({modal:state.hk.modal&&state.hk.modal.type, pin:state.hk.modal&&state.hk.modal.pin, s:state.staff.find(x=>x.nama==='Andi Kasir')}));
 await d.screenshot({path:'shots/akun-info.png'});
 await d.click('#hkModalRoot [data-hk-act="modal-close"] >> nth=-1'); await d.waitForTimeout(150);
 await d.click('[data-hk-act="staff-new"]'); await d.waitForTimeout(150);
 await d.fill('#hkStNama','Maya Admin'); await d.click('[data-hk-act="staff-role"][data-hk-arg="Admin"]'); await d.click('[data-hk-act="staff-role"][data-hk-arg="Kasir"]'); await d.waitForTimeout(150);
 await d.screenshot({path:'shots/akun-form.png'});
 await d.click('[data-hk-act="staff-save"]'); out.tanpaEmail=await toast();
 await d.fill('#hkStEmail','dimas@hikayat.id'); await d.click('[data-hk-act="staff-save"]'); out.emailDobel=await toast();
 await d.fill('#hkStEmail','maya@hikayat.id'); await d.fill('#hkStPw','abc'); await d.click('[data-hk-act="staff-save"]'); out.pwLemah=await toast();
 await d.fill('#hkStPw','mulai2026'); await d.fill('#hkStPin','123456'); await d.click('[data-hk-act="staff-save"]'); out.pinLemah=await toast();
 await d.fill('#hkStPin','111111'); await d.click('[data-hk-act="staff-save"]'); out.pinSama=await toast();
 await d.fill('#hkStPin','730418'); await d.click('[data-hk-act="staff-save"]'); await d.waitForTimeout(200);
 out.info=await d.evaluate(()=>({...state.hk.modal}));
 await d.click('#hkModalRoot [data-hk-act="modal-close"] >> nth=-1');
 // Admin tidak bisa ubah karyawan
 await d.evaluate(()=>{ localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Dimas Pratama'})); }); await d.reload(); await d.waitForTimeout(400);
 await d.evaluate(()=>{ state.view='karyawan'; render(); }); out.adminTombol=await d.evaluate(()=>!!document.querySelector('[data-hk-act="staff-new"]')+'/'+document.querySelectorAll('[data-hk-act="staff-edit"]').length);
 // Maya login pertama -> wajib ganti password
 await d.click('.user-box .kebab').catch(()=>{}); await d.evaluate(()=>{ localStorage.removeItem('hk2dash:sesi'); render(); }); await d.waitForTimeout(200);
 await d.fill('#hkDashEmail','maya@hikayat.id'); await d.fill('#hkDashPw','mulai2026'); await d.press('#hkDashPw','Enter'); await d.waitForTimeout(250);
 out.wajib={judul:await d.evaluate(()=>document.querySelector('.hk-login-judul')?.textContent), akun:await d.evaluate(()=>!!hkAkun())};
 await d.screenshot({path:'shots/akun-gantipw.png'});
 await d.fill('#hkPwBaru','mulai2026'); await d.fill('#hkPwUlang','mulai2026'); await d.click('[data-hk-pw-simpan]'); await d.waitForTimeout(100); out.samaLama=await err();
 await d.fill('#hkPwBaru','mayaKuat99'); await d.fill('#hkPwUlang','mayaKuat98'); await d.click('[data-hk-pw-simpan]'); await d.waitForTimeout(100); out.tidakSama=await err();
 await d.fill('#hkPwUlang','mayaKuat99'); await d.click('[data-hk-pw-simpan]'); await d.waitForTimeout(250);
 out.masukMaya={akun:await d.evaluate(()=>hkAkun()&&hkAkun().nama), pwBaru:await d.evaluate(()=>state.staff.find(x=>x.nama==='Maya Admin').pwBaru), toast:await toast()};
 // ganti password sukarela
 await d.evaluate(()=>{ document.querySelector('[data-hk-act="dash-gantipw"]').click(); }); await d.waitForTimeout(150);
 await d.fill('#hkPwLama','salah'); await d.fill('#hkPwBaru','mayaBaru77'); await d.fill('#hkPwUlang','mayaBaru77'); await d.click('[data-hk-pw-simpan]'); await d.waitForTimeout(100); out.lamaSalah=await err();
 await d.fill('#hkPwLama','mayaKuat99'); await d.click('[data-hk-pw-simpan]'); await d.waitForTimeout(150); out.sukarela=await toast();
 // POS: Maya login dengan PIN sementara
 const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('P:'+e.message)); await p.setViewportSize({width:390,height:844});
 await p.goto(base+'pos.html'); await p.waitForTimeout(500);
 const key=async s=>{ for(const c of s){ await p.click(`#hkLoginBody .pin-key:text-is("${c}")`); } await p.waitForTimeout(400); };
 await p.click('text=Maya Admin'); await key('730418');
 out.posWajib=await p.evaluate(()=>document.querySelector('#hkLoginBody .lock-title').textContent);
 await p.screenshot({path:'shots/akun-pos-pinbaru.png'});
 await key('730418'); out.posSama=await p.evaluate(()=>document.querySelector('#hkLoginBody .pin-hint').innerText);
 await key('222222'); out.posLemah=await p.evaluate(()=>document.querySelector('#hkLoginBody .pin-hint').innerText);
 await key('905127'); out.posUlang=await p.evaluate(()=>document.querySelector('#hkLoginBody .lock-title').textContent);
 await key('905128'); out.posTidakSama=await p.evaluate(()=>document.querySelector('#hkLoginBody .pin-hint').innerText);
 await key('905127'); await key('905127'); await p.waitForTimeout(300);
 out.posLanjut=await p.evaluate(()=>({judul:document.querySelector('#hkLoginBody .lock-title')?.textContent, st:JSON.parse(localStorage.getItem('hk2:staff')).find(x=>x.nama==='Maya Admin')}));
 // PIN sementara tidak bisa jadi persetujuan atasan
 out.supSementara=await p.evaluate(()=>{ const D=hkLoad(); return D.staff.filter(x=>x.pinBaru).map(x=>x.nama); });
 // dashboard: status akun
 await d.reload(); await d.waitForTimeout(400); await d.evaluate(()=>{ localStorage.setItem('hk2dash:sesi',JSON.stringify({nama:'Rina Wijaya'})); }); await d.reload(); await d.waitForTimeout(400);
 await d.evaluate(()=>{ state.view='karyawan'; render(); }); await d.waitForTimeout(150);
 out.statusMaya=await d.evaluate(()=>[...document.querySelectorAll('.main tbody tr')].find(r=>/Maya/.test(r.innerText))?.innerText.replace(/\s+/g,' ').slice(0,140));
 // reset PIN oleh Owner
 await d.evaluate(()=>{ const i=state.staff.findIndex(x=>x.nama==='Maya Admin'); document.querySelector(`[data-hk-act="staff-edit"][data-hk-arg="${i}"]`).click(); }); await d.waitForTimeout(150);
 await d.click('[data-hk-act="staff-reset"][data-hk-arg="pin"]'); await d.click('[data-hk-act="staff-save"]'); await d.waitForTimeout(200);
 out.reset=await d.evaluate(()=>({info:state.hk.modal&&state.hk.modal.pin?'ada PIN':'-', pinBaru:state.staff.find(x=>x.nama==='Maya Admin').pinBaru, pwBaru:state.staff.find(x=>x.nama==='Maya Admin').pwBaru}));
 console.log(JSON.stringify({out,errs},null,1)); await b.close(); })();
