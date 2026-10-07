import re, pathlib, sys
W = pathlib.Path(__file__).parent
src = (W / 'dashboard.html').read_text(encoding='utf-8')
shared = (W / 'src/shared.js').read_text(encoding='utf-8')
addon = (W / 'src/addon.js').read_text(encoding='utf-8')
_inv = (W / 'src/inventori.js').read_text(encoding='utf-8') + '\n' + (W / 'src/keuangan.js').read_text(encoding='utf-8')
assert addon.rstrip().endswith('render();\n})();')
addon = addon.rstrip()[:-len('render();\n})();')] + _inv + '\nrender();\n})();\n'

def rep(old, new, count=None, s=None):
    global src
    n = src.count(old)
    if n == 0 or (count is not None and n != count):
        sys.exit(f'GAGAL ({n}x): {old[:80]}')
    src = src.replace(old, new)

# outlet tetap → gudang + event
rep("'TLTele3B'", "'Gudang Pusat'")


# harga marketplace pindah ke form produk; menu jadi Biaya Marketplace di Penjualan Online
rep("    {id:'marketplace', label:'Harga Marketplace'},\n", "", 1)
rep("  {id:'riwayat-impor', label:'Riwayat Impor'},\n]});", "  {id:'riwayat-impor', label:'Riwayat Impor'},\n  {id:'marketplace', label:'Biaya Marketplace'},\n]});", 1)
rep('Daftar Harga Marketplace</span><span class="help-icon" title="Atur harga jual khusus untuk tiap platform marketplace.">?</span>', 'Biaya Marketplace</span><span class="help-icon" title="Status toko dan perkiraan potongan tiap marketplace. Harga per produk diatur di Daftar Produk.">?</span>', 1)
rep('<div class="form-section-title">Atur Produk & Harga</div><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><label style="margin:0;">Pilih Produk*</label><button class="btn btn-primary" data-open-marketplace-picker>+ Tambah Produk</button></div><div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0 8px;"><span class="subfield-title" style="margin:0;">Atur Harga</span><button class="btn" data-open-marketplace-preset>Preset Harga Produk</button></div><div class="card" style="padding:0;overflow:auto;margin-bottom:4px;"><table><thead><tr><th>Produk</th><th>Satuan</th><th>Harga Awal</th><th>Harga Jual</th><th></th></tr></thead><tbody id="marketplaceHargaTbody">${marketplaceHargaRowsHTML()}</tbody></table></div>',
    '<div class="form-section-title">Produk & Harga</div><div class="help-text">${m.produk.length} SKU terdaftar. Produk dan harganya diatur dari Produk › Daftar Produk › Ubah Produk › Harga Marketplace.</div>', 1)
rep("if(!m.produk.length){ toast('Pilih minimal satu produk'); return; } ", "", 1)
rep('<th>Produk Terdaftar</th>', '<th>SKU Terdaftar</th>', 1)
rep('<select data-po-item-sku="${i}"><option value="">Pilih produk...</option>${cat.map(', '<select data-po-item-sku="${i}"><option value="">Pilih produk...</option>${cat.filter(c=>hkDiSaluran(f.saluran,c.sku)||c.sku===it.sku).map(', 1)


# impor: produk yang belum terdaftar di marketplace harus didaftarkan harganya dulu
rep("""    <div class="po-stats"><div><b>${st.siap}</b>siap diimpor</div><div><b>${st.dup}</b>sudah pernah masuk</div><div><b>${st.batal}</b>dibatalkan</div><div><b>${st.gagal}</b>bermasalah</div></div>""",
    """    <div class="po-stats"><div><b>${st.siap}</b>siap diimpor</div><div><b>${st.dup}</b>sudah pernah masuk</div><div><b>${st.batal}</b>dibatalkan</div><div><b>${st.gagal}</b>bermasalah</div></div>${hkMpBelumHTML()}""", 1)
rep("""<button class="btn btn-primary" data-po-do-import ${st.siap?'':'disabled style="opacity:.5;"'}>${st.siap?`Impor ${st.siap} Pesanan`:'Tidak ada pesanan baru'}</button>""",
    """<button class="btn btn-primary" data-po-do-import ${st.siap&&!hkMpBelum().length?'':'disabled style="opacity:.5;"'}>${hkMpBelum().length?'Daftarkan harga marketplace dulu':st.siap?`Impor ${st.siap} Pesanan`:'Tidak ada pesanan baru'}</button>""", 1)
rep("if(q('[data-po-do-import]')){ if(importStats().siap) doImport(); return; }", "if(q('[data-po-do-import]')){ if(importStats().siap&&!hkMpBelum().length) doImport(); return; }", 1)


# fungsi impor dipakai addon (daftarkan harga marketplace)
rep("\nrender();\n})();\n</script>", "\nwindow.hkPOImpor={resolvedLines, importStats, doImport, hargaSaluran, refreshItems};\nrender();\n})();\n</script>", 1)
# pesanan manual: tabel produk + tombol "+ Produk" (pemilih umum di addon)
rep("""    <td style="width:46%;"><select data-po-item-sku="${i}"><option value="">Pilih produk...</option>${cat.filter(c=>hkDiSaluran(f.saluran,c.sku)||c.sku===it.sku).map(c=>`<option value="${esc(c.sku)}" ${c.sku===it.sku?'selected':''}>${esc(c.nama)} (${esc(c.sku)})</option>`).join('')}</select></td>""",
    """    <td style="width:46%;"><b>${esc((cat.find(c=>c.sku===it.sku)||{nama:it.sku}).nama)}</b><div style="font-size:11px;color:var(--text-mut);">${esc(it.sku)}</div></td>""", 1)
rep("""${f.items.length>1?`<span class="icon-btn" data-po-item-del="${i}" title="Hapus baris">✕</span>`:''}</td></tr>`).join('');""",
    """<span class="icon-btn" data-po-item-del="${i}" title="Hapus baris">✕</span></td></tr>`).join('')+`<tr><td colspan="5" style="padding:8px;"><button type="button" class="btn" style="width:100%;border-style:dashed;" data-hk-act="pil-buka" data-hk-arg="order">+ Produk</button></td></tr>`;""", 1)
rep("""    <div style="margin-top:8px;"><span class="po-link" data-po-item-add>+ Tambah produk</span></div>""", "", 1)
rep("""kurangiStok:true, outlet:state.outlet, items:[{sku:'', qty:1, harga:0}]};""", """kurangiStok:true, outlet:state.outlet, items:[]};""", 1)
# promo: isian wajib di halaman 1 dicek sebelum lanjut ke halaman 2
rep("if(e.target.closest('[data-promoProduk-next-1]')){ state.promoProdukForm.step=2;", "if(e.target.closest('[data-promoProduk-next-1]')){ if(!hkPromoCek1(state.promoProdukForm,'promoProduk')) return; state.promoProdukForm.step=2;", 1)
rep("if(e.target.closest('[data-promoTotal-next-1]')){ state.promoTotalForm.step=2;", "if(e.target.closest('[data-promoTotal-next-1]')){ if(!hkPromoCek1(state.promoTotalForm,'promoTotal')) return; state.promoTotalForm.step=2;", 1)
# pesanan manual: pilihan lokasi stok pindah ke atas No. Pesanan, gaya sama dengan isian lain
rep("""        <div class="po-inline" style="margin-top:14px;"><label><input type="checkbox" id="poKurangiStok" ${f.kurangiStok?'checked':''}> Kurangi stok outlet</label>
          <select id="poOutletInput" style="padding:7px 9px;border:1px solid var(--border-strong);border-radius:8px;">${OUTLETS.map(o=>`<option ${f.outlet===o?'selected':''}>${o}</option>`).join('')}</select></div>
""", "", 1)
rep("""    <div class="field"><label>No. Pesanan<span class="req">*</span>""", """    <div class="field"><label>Lokasi Stok<span class="req">*</span><div class="help-text">Tempat barang pesanan ini diambil. Biasanya Gudang Pusat.</div></label><div><select id="poOutletInput">${OUTLETS.map(o=>`<option ${f.outlet===o?'selected':''}>${o}</option>`).join('')}</select><label style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12.5px;font-weight:500;color:var(--text-2);"><input type="checkbox" id="poKurangiStok" ${f.kurangiStok?'checked':''}> Kurangi stok di lokasi ini saat pesanan disimpan</label></div></div>
    <div class="field"><label>No. Pesanan<span class="req">*</span>""", 1)
# promo: chip pilihan produk jadi tabel + "+ Produk"
rep("""function productChipsHTML(f, key, rmAttr, addAttr){
""", """function productChipsHTML(f, key, rmAttr, addAttr){
  if(window.hkProdukTabel) return hkProdukTabel(f, key, rmAttr);
""", 1)


# pesanan online mencatat akun dashboard yang menginput/mengimpor (dipakai Laporan per Kasir)
rep("pembeli:o.pembeli, status:'Selesai', potongan:o.potongan, sumber:'Impor', batchId,", "pembeli:o.pembeli, status:'Selesai', potongan:o.potongan, sumber:'Impor', oleh:(window.hkAkun&&window.hkAkun()?window.hkAkun().nama:'Admin'), batchId,", 1)
rep("const o={id:nextId(), ...d, sumber:'Manual', batchId:null, moves:[]};", "const o={id:nextId(), ...d, sumber:'Manual', oleh:(window.hkAkun&&window.hkAkun()?window.hkAkun().nama:'Admin'), batchId:null, moves:[]};", 1)


# qty pesanan online tidak boleh melebihi stok lokasi yang dikurangi
rep('<td style="width:12%;"><input type="number" min="1" value="${it.qty}" data-po-item-qty="${i}"></td>', '<td style="width:12%;"><input type="number" min="1" ${f.kurangiStok&&it.sku?`max="${Math.max(1,hkStokDi(state.stokItems,it.sku,f.outlet||HK_GUDANG))}" data-batas="stok ${esc(f.outlet||HK_GUDANG)}"`:\'\'} value="${it.qty}" data-po-item-qty="${i}"></td>', 1)


# ── promosi: rapikan form & daftar supaya hanya pengaturan yang dipakai POS ──
rep("""    <div class="page-sub" style="display:flex;align-items:center;gap:6px;"><span>📅</span> <span>${state.promoProdukPeriode}</span></div>""", """    <div class="page-sub">Potongan untuk produk tertentu di POS. Status Terjadwal/Berakhir dihitung otomatis dari tanggal promo.</div>""", 1)
rep("""    <div class="page-sub" style="display:flex;align-items:center;gap:6px;"><span>📅</span> <span>${state.promoTotalPeriode}</span></div>""", """    <div class="page-sub">Potongan berdasarkan total belanja di POS. Status Terjadwal/Berakhir dihitung otomatis dari tanggal promo.</div>""", 1)
rep("""      <button class="btn">📅 ${state.promoProdukPeriode}</button>""", "", 1)
rep("""      <button class="btn">📅 ${state.promoTotalPeriode}</button>""", "", 1)
rep("""    <div class="field"><label>Unggah Banner</label>
      <div class="help-text" style="margin-bottom:6px;">Format gambar .jpg .jpeg .png dengan rekomendasi ukuran 480px x 180px</div>
      <div class="upload-box"><div class="up-icon">⬆</div><span class="up-label">Pilih</span> atau letakkan berkas di sini</div>
    </div>`;""", "`;", 1)
rep("const jenisOpts = [['persen','Potongan (%)'],['rp','Potongan (Rp)'],['bonus-produk','Bonus Produk'],['harga-coret','Harga Coret']];", "const jenisOpts = [['persen','Potongan (%)'],['rp','Potongan (Rp)'],['bonus-produk','Bonus Produk'],['bundling','Bundling']];", 1)
# bonus produk (beli X gratis Y) dan bundling (harga paket)
_a = src.index("""    <div class="field"><label>Produk Promo (syarat pembelian)<span class="req">*</span></label>""")
_b = src.index("""  } else if(f.jenisBonus==='harga-coret'){""", _a)
src = src[:_a] + """    <div class="help-text" style="background:var(--accent-bg);color:var(--accent-text);padding:10px 12px;border-radius:8px;margin-bottom:10px;">Pembeli yang membeli produk syarat dalam jumlah minimal mendapat produk bonus gratis. Barang bonus tetap mengurangi stok event. Satu pesanan hanya bisa memakai satu promo.</div>
    <div class="field"><label>Produk yang dibeli<span class="req">*</span></label>${productChipsHTML(f,'produkPromo','remove-promoProduk-produk','add-promoProduk-produk')}</div>
    <div class="row-2"><div class="field"><label>Beli minimal (pcs)<span class="req">*</span></label><input id="promoProdukMinKuantitasInput" type="number" min="1" placeholder="Contoh: 2" value="${f.minKuantitas||''}"></div>
    <div class="field"><label>Jumlah bonus (pcs)<span class="req">*</span></label><input id="promoProdukJumlahBonusInput" type="number" min="1" placeholder="1" value="${f.jumlahBonus||''}"></div></div>
    <div class="field"><label>Produk bonus (gratis)<span class="req">*</span></label>${productChipsHTML(f,'bonusProduk','remove-promoProduk-bonus','add-promoProduk-bonus')}<div class="help-text" style="margin-top:4px;">Pilih satu produk. Kalau produknya punya beberapa ukuran, kasir memilih ukurannya di POS.</div></div>
    <div class="field"><label style="display:flex;align-items:center;gap:6px;font-weight:500;"><input type="checkbox" ${f.berlakuKelipatan?'checked':''} data-toggle-promoProduk-berlakuKelipatan> Berlaku kelipatan (beli 4 dapat 2, beli 6 dapat 3, dan seterusnya)</label></div>`;
  } else if(f.jenisBonus==='bundling'){
    html += `
    <div class="help-text" style="background:var(--accent-bg);color:var(--accent-text);padding:10px 12px;border-radius:8px;margin-bottom:10px;">Beberapa produk dijual dengan satu harga paket. Promo berlaku kalau semua produk paket ada di keranjang. Satu pesanan hanya bisa memakai satu promo.</div>
    <div class="field"><label>Produk dalam paket<span class="req">*</span></label>${productChipsHTML(f,'produkPromo','remove-promoProduk-produk','add-promoProduk-produk')}<div class="help-text" style="margin-top:4px;">Minimal dua produk, masing-masing satu pcs per paket. Ukuran apa saja.</div></div>
    <div class="field"><label>Harga paket (Rp)<span class="req">*</span></label><input id="promoProdukHargaPaketInput" placeholder="Contoh: 110.000" value="${f.hargaPaket||''}">${hkPaketNormal(f)}</div>
    <div class="field"><label style="display:flex;align-items:center;gap:6px;font-weight:500;"><input type="checkbox" ${f.berlakuKelipatan?'checked':''} data-toggle-promoProduk-berlakuKelipatan> Berlaku kelipatan (2 paket di keranjang dihitung 2 × harga paket)</label></div>`;
""" + src[_b:]
rep("""      if(e.target.id===`${prefix}JumlahMaksimalInput`){ f.jumlahMaksimalTransaksi=e.target.value; return; }""", """      if(e.target.id===`${prefix}JumlahMaksimalInput`){ f.jumlahMaksimalTransaksi=e.target.value; return; }
      if(e.target.id===`${prefix}JumlahBonusInput`){ f.jumlahBonus=e.target.value; return; }
      if(e.target.id===`${prefix}HargaPaketInput`){ f.hargaPaket=e.target.value; return; }""", 1)
rep("""  if(f.jenisBonus==='bonus-produk') return 'Bonus Produk';
  if(f.jenisBonus==='harga-coret') return 'Harga Coret';""", """  if(f.jenisBonus==='bonus-produk') return `Gratis ${f.jumlahBonus||1} ${(f.bonusProduk||[]).join(', ')}`;
  if(f.jenisBonus==='bundling') return `Paket Rp ${f.hargaPaket||0}`;
  if(f.jenisBonus==='harga-coret') return 'Harga Coret';""", 1)
rep("""function promoKriteriaLabel(f){
""", """function promoKriteriaLabel(f){
  if(f.jenisBonus==='bundling') return `Paket : ${(f.produkPromo||[]).join(' + ')}`;
""", 1)
rep("const jenisOpts = [['persen','Potongan (%)'],['rp','Potongan (Rp)'],['bonus-produk','Bonus Produk']];", "const jenisOpts = [['persen','Potongan (%)'],['rp','Potongan (Rp)']];", 1)
rep("""    <div class="field"><label>Outlet<span class="req">*</span></label>
      <select id="${prefix}OutletInput"><option value="">Pilih Outlet</option>${OUTLETS.map(o=>`<option ${f.outlet===o?'selected':''}>${o}</option>`).join('')}</select>
    </div>""", """    <div class="field"><label>Berlaku di<span class="req">*</span></label>
      ${hkLokasiPilih(f, prefix)}
      <div class="help-text" style="margin-top:4px;">Bisa pilih lebih dari satu. Promo hanya berlaku di POS; promo marketplace diatur di Seller Center masing-masing.</div>
    </div>""", 1)
rep("""    <div class="field"><label>Platform<span class="req">*</span></label>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        ${platforms.map(p=>`<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-2);"><input type="checkbox" ${f.platform.includes(p)?'checked':''} data-toggle-${prefix}-platform="${p}"> ${p}</label>`).join('')}
      </div>
    </div>""", "", 1)
rep("aktivasi:'otomatis', platform:[], tglMulai:", "aktivasi:'otomatis', platform:['POS'], tglMulai:", 1)
rep("outlet: f.outlet||'-', status: f.statusPromo?'Aktif':'Tidak Aktif', detail: JSON.parse(JSON.stringify(f)) };", "outlet: f.outlet||'Semua lokasi', status: f.statusPromo?'Aktif':'Tidak Aktif', detail: JSON.parse(JSON.stringify({...f, platform:['POS']})) };", 2)
rep("""    if(!f.nama.trim()){ toast('Nama Promo wajib diisi'); return; }
    state.promoProdukPendingConfirm""", """    if(!f.nama.trim()){ toast('Nama Promo wajib diisi'); return; }
    { const err=hkPromoCek(f,'produk'); if(err){ toast(err); return; } }
    state.promoProdukPendingConfirm""", 1)
rep("""    if(!f.nama.trim()){ toast('Nama Promo wajib diisi'); return; }
    state.promoTotalPendingConfirm""", """    if(!f.nama.trim()){ toast('Nama Promo wajib diisi'); return; }
    { const err=hkPromoCek(f,'total'); if(err){ toast(err); return; } }
    state.promoTotalPendingConfirm""", 1)
rep("if(e.target.closest('[data-save-draft-promoProduk]')){ state.promoProdukForm=null; toast('Promo tersimpan sebagai draf'); renderPromoFormModal(); return; }",
    "if(e.target.closest('[data-save-draft-promoProduk]')){ if(hkPromoDraf('produk')){ render(); renderPromoFormModal(); } return; }", 1)
rep("if(e.target.closest('[data-save-draft-promoTotal]')){ state.promoTotalForm=null; toast('Promo tersimpan sebagai draf'); renderPromoFormModal(); return; }",
    "if(e.target.closest('[data-save-draft-promoTotal]')){ if(hkPromoDraf('total')){ render(); renderPromoFormModal(); } return; }", 1)
rep("""    'Kadaluarsa': ['var(--danger-bg)','var(--danger-text)'],""", """    'Kadaluarsa': ['var(--danger-bg)','var(--danger-text)'],
    'Berakhir': ['var(--bg)','var(--text-mut)'],
    'Terjadwal': ['var(--info-bg, #E8F0FE)','var(--info-text, #1F5FBF)'],
    'Draf': ['var(--bg)','var(--text-2)'],""", 1)
rep("<td>${promoStatusBadge(p.status)}</td>", "<td>${hkPromoPakai(p.nama)}</td><td>${promoStatusBadge(hkPromoStatus(p))}</td>", 2)
rep("<th>Durasi</th><th>Outlet</th><th>Status</th><th></th></tr></thead>", "<th>Durasi</th><th>Berlaku di</th><th>Dipakai</th><th>Status</th><th></th></tr></thead>", 2)

# form popup jadi halaman penuh
rep('<div class="confirm-box" style="width:440px;max-width:92vw;padding:0;overflow:hidden;"><div class="slideover-head"><span class="title" style="flex:1;">Impor Data Pelanggan', '<div class="confirm-box hk-page" style="width:440px;max-width:92vw;padding:0;overflow:hidden;"><div class="slideover-head"><span class="title" style="flex:1;">Impor Data Pelanggan', 1)
rep('class="confirm-box" style="width:640px;max-width:92vw;padding:0;overflow:hidden;display:flex;"', 'class="confirm-box hk-page" style="width:640px;max-width:92vw;padding:0;overflow:hidden;display:flex;"', 3)
rep('<div class="confirm-box" style="width:900px;max-width:95vw;max-height:90vh;padding:0;overflow:hidden;display:flex;">${stepsNav(step)}', '<div class="confirm-box hk-page" style="width:900px;max-width:95vw;max-height:90vh;padding:0;overflow:hidden;display:flex;">${stepsNav(step)}', 1)
rep('<div class="confirm-box promo-modal" style="padding:0;overflow:hidden;">', '<div class="confirm-box promo-modal hk-page" style="padding:0;overflow:hidden;">', 1)

src = src.replace('TLTele3B', 'Gudang Pusat')
src = src.replace('Outlet Kemang', 'Hikayat Fest Bandung')
rep('<div class="lbl">Outlet</div>', '<div class="lbl">Lokasi</div>', 1)
src = src.replace('Semua Outlet', 'Semua Lokasi')
rep('<span style="color:var(--text-mut);margin-left:auto;">2 outlet</span>', '<span style="color:var(--text-mut);margin-left:auto;">${OUTLETS.length} lokasi</span>', 1)
rep('<div class="outlet-add">+ Tambah Outlet</div>', '<div class="outlet-add" data-nav="event">+ Buat Event</div>', 1)
rep('placeholder="Cari outlet..."', 'placeholder="Cari lokasi..."')
rep('+ Tambah outlet', '+ Tambah lokasi')
src = src.replace('>Daftar Outlet*<', '>Lokasi*<').replace('>Outlet*<', '>Lokasi*<').replace('<th>Outlet</th>', '<th>Lokasi</th>')
rep('Kurangi stok outlet', 'Kurangi stok lokasi')
rep('Diperbaharui', 'Diperbarui')
rep("<span class=\"icon\">🏬</span>", "<span class=\"icon\">📍</span>", 1)

# tidak produksi sendiri: faktur & retur contoh memakai barang jadi, tab Bahan Baku disembunyikan
for a_,b_ in [('Kain Flanel (m)','Kaos Polos'),('Benang Jahit','Topi Bordir'),('Kain Katun (m)','Totebag Hikayat'),('Gesper Tas','Tumbler Hikayat'),('Kaos Polos Bahan','Kemeja Flanel'),
              ('CV Kain Nusantara','CV Konveksi Mitra'),('Sumber Benang Textile','Sablon Jaya Bandung'),("satuan:'Meter'","satuan:'Pcs'"),("satuan:'Roll'","satuan:'Pcs'")]:
    src = src.replace(a_, b_)
rep('<div class="tab ${state.stokTab===\'bahan\'?\'active\':\'\'}" data-stok-tab="bahan">Bahan Baku</div>', '', 1)
# pencatat aksi = akun yang login di dashboard
src = src.replace("dibuatOleh:'Admin'", "dibuatOleh:(window.hkAkun&&window.hkAkun()?window.hkAkun().nama:'Admin')")
# saluran online: tambah TikTok Shop
rep("const PO_SALURAN = ['Shopee','Tokopedia','Lainnya'];", "const PO_SALURAN = ['Shopee','Tokopedia','TikTok Shop','Lainnya'];", 1)
rep("function chanClass(c){ return c==='Shopee'?'shopee':c==='Tokopedia'?'tokopedia':''; }",
    "function chanClass(c){ return c==='Shopee'?'shopee':c==='Tokopedia'?'tokopedia':c==='TikTok Shop'?'tiktok':''; }", 1)

# biaya marketplace: admin % + layanan % + biaya per pesanan
rep("""<span>Hitung Estimasi Komisi Marketplace</span></div>${m.komisiAktif?`<div class="field" style="max-width:220px;"><label>Persentase Komisi (%)</label><input id="marketplaceKomisiPersenInput" placeholder="Contoh: 20" value="${m.komisiPersen}"></div>`:''}""",
    """<span>Hitung Estimasi Potongan Marketplace</span></div><div class="help-text" style="margin-top:-4px;">Dipakai sebagai perkiraan saat input pesanan manual. Pesanan hasil impor memakai potongan asli dari file Seller Center.</div>${m.komisiAktif?`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;max-width:640px;"><div class="field"><label>Biaya admin (%)</label><input data-hk-bind="marketplaceForm.biayaAdmin" placeholder="Contoh: 8" value="${m.biayaAdmin||''}"></div><div class="field"><label>Biaya layanan / program (%)</label><input data-hk-bind="marketplaceForm.biayaLayanan" placeholder="Contoh: 2" value="${m.biayaLayanan||''}"></div><div class="field"><label>Biaya per pesanan (Rp)</label><input data-hk-bind="marketplaceForm.biayaPesanan" placeholder="Contoh: 1250" value="${m.biayaPesanan||''}"></div></div><div class="help-text">Cek angka terbaru di Seller Center. Tarif berubah per kategori dan program yang diikuti.</div>`:''}""", 1)
rep("komisiAktif:false,komisiPersen:''}; state.view='marketplace-form'", "komisiAktif:false,komisiPersen:'',biayaAdmin:'',biayaLayanan:'',biayaPesanan:''}; state.view='marketplace-form'", 1)
rep("komisiAktif:c.komisiAktif,komisiPersen:c.komisiPersen};", "komisiAktif:c.komisiAktif,komisiPersen:c.komisiPersen,biayaAdmin:c.biayaAdmin||'',biayaLayanan:c.biayaLayanan||'',biayaPesanan:c.biayaPesanan||''};", 1)
rep("komisiAktif:m.komisiAktif,komisiPersen:m.komisiPersen}; render(); return; }", "komisiAktif:m.komisiAktif,komisiPersen:m.komisiPersen,biayaAdmin:m.biayaAdmin,biayaLayanan:m.biayaLayanan,biayaPesanan:m.biayaPesanan}; render(); return; }", 1)
rep("komisiAktif:d.komisiAktif,komisiPersen:d.komisiPersen};", "komisiAktif:d.komisiAktif,komisiPersen:d.komisiPersen,biayaAdmin:d.biayaAdmin,biayaLayanan:d.biayaLayanan,biayaPesanan:d.biayaPesanan};", 1)
rep("return ch&&ch.komisiAktif&&Number(ch.komisiPersen)?Number(ch.komisiPersen):0;",
    "return ch&&ch.komisiAktif?1:0;", 1)
rep("${k?`<div class=\"po-src\" style=\"text-align:right;margin-top:4px;\">Komisi ${f.saluran} di Harga Marketplace: ${k}%. <span class=\"po-link\" data-po-hitung-komisi>Pakai angka ini</span></div>`:''}",
    "${k?`<div class=\"po-src\" style=\"text-align:right;margin-top:4px;\">Perkiraan potongan ${f.saluran}: ${fmt(hkEstimasiPotongan(f.saluran,gross))}. <span class=\"po-link\" data-po-hitung-komisi>Pakai angka ini</span></div>`:''}", 1)
rep("f.potongan=Math.round(g*komisiSaluran(f.saluran)/100);", "f.potongan=hkEstimasiPotongan(f.saluran,g);", 1)

# CSS kecil untuk badge TikTok
rep('</style>\n</head>', '  .po-chan.tiktok{background:#E9F7F8;color:#0B7C86;}\n</style>\n</head>', 1)

# sisipkan modul
rep('</body>', f'<script>\n{shared}\n</script>\n<script>\n{addon}\n</script>\n</body>', 1)
src = src.replace('<title>', '<title>', 1)
src = re.sub(r'<title>.*?</title>', '<title>Hikayat Dashboard</title>', src, count=1)

# semua sudut membulat sama: 8px. Lingkaran (50%), sakelar, dan sudut kecil (<=4px, mis. kotak centang) tidak diubah
def _radius(m):
    v=m.group(2)
    if '%' in v or '$' in v or 'var(' in v: return m.group(0)
    def satu(x):
        n=float(x.group(1)); return x.group(0) if n<=4 else '8px'
    return m.group(1)+re.sub(r'(\d+(?:\.\d+)?)px', satu, v)
src = re.sub(r'(border-radius:\s*)([^;"}\n]+)', _radius, src)
rep('</style>\n</head>', '  .toggle{border-radius:999px;}\n</style>\n</head>', 1)

out = W / 'out'
out.mkdir(exist_ok=True)
(out / 'dashboard.html').write_text(src, encoding='utf-8')

k = (W / 'kasir-asli.html').read_text(encoding='utf-8')
bridge = (W / 'src/pos-bridge.js').read_text(encoding='utf-8')
def krep(old, new, cnt=1):
    global k
    n = k.count(old)
    if n != cnt: sys.exit(f'POS GAGAL ({n}x): {old[:70]}')
    k = k.replace(old, new)
krep('<title>majoo POS — Ojek Online Prototype</title>', '<title>Hikayat POS</title>')
krep('''    --ink:#0E2622;
    --ink-soft:#4C6560;
    --paper:#F5F3EC;
    --card:#FFFFFF;
    --line:#E4E1D6;
    --primary:#0E8C7F;
    --primary-dark:#0A6659;
    --primary-tint:#E3F3F0;
    --accent:#FF6B4A;
    --accent-tint:#FFEBE4;''', '''    --ink:#1E2321;
    --ink-soft:#5B615C;
    --paper:#F4F5F3;
    --card:#FFFFFF;
    --line:#E7E8E4;
    --primary:#FF6100;
    --primary-dark:#C44A00;
    --primary-tint:#FFF0E5;
    --accent:#C0392B;
    --accent-tint:#FDECEA;''')
krep('#eef8f4', '#FFF1E6'); krep('#eaf7f3', '#FFF1E6')
krep('.pay-method.selected .pm-check{', '.pay-method:not(.selected) .pm-check{color:transparent;}\n  .pay-method.selected .pm-check{')
krep('Prototype interaktif &middot; <b>majoo POS — Pencatatan Ojek Online</b> &middot; ketuk untuk mencoba alurnya', 'Prototipe interaktif &middot; <b>Hikayat Merchandise — POS Event</b> &middot; terhubung dengan dashboard')
krep('QRIS majoo Dinamis', 'QRIS')
krep('<div class="subbar-sub">Snack Corner Kahuripan</div>', '<div class="subbar-sub hk-evname">-</div>', 4)
krep('rgba(14,140,127,.92)', 'rgba(255,97,0,.92)')
# mode tampilan kasir: hanya Grid dan SKU
krep('''              <div class="mode-tile" onclick="pilihMode('Meja', this)"><div class="mt-ic">🍽️</div><div class="mt-label">Meja</div></div>
              <div class="mode-tile" onclick="pilihMode('Jasa', this)"><div class="mt-ic">🧰</div><div class="mt-label">Jasa</div></div>
              <div class="mode-tile" onclick="pilihMode('E-Commerce', this)"><div class="mt-ic">🛒</div><div class="mt-label">E-Commerce</div></div>
              <div class="mode-tile" onclick="pilihMode('Buku Menu', this)"><div class="mt-ic">📖</div><div class="mt-label">Buku Menu</div></div>
              <div class="mode-tile" onclick="pilihMode('Reservasi', this)"><div class="mt-ic">📅</div><div class="mt-label">Reservasi</div></div>
''', '')
krep('<div class="mt-label">Grid</div><div class="mt-tag">Aktif</div>', '<div class="mt-label">Grid</div><div class="mt-desc">Kartu produk, varian lewat pilihan ukuran</div><div class="mt-tag">Aktif</div>')
krep('<div class="mt-label">SKU</div><div class="mt-tag">Aktif</div>', '<div class="mt-label">SKU</div><div class="mt-desc">Daftar per varian, cocok untuk scan barcode</div><div class="mt-tag">Aktif</div>')
krep('<div class="sheet-sub">Ganti tampilan kasir sesuai kebutuhan bisnis</div>', '<div class="sheet-sub">Pilih cara produk ditampilkan di kasir</div>')
krep('  .mode-tile .mt-tag{font-size:9px; color:var(--primary-dark); font-weight:700;}',
     '  .mode-tile .mt-tag{font-size:9px; color:var(--primary-dark); font-weight:700; display:none;}\n  .mode-tile.active .mt-tag{display:block;}\n  .mode-tile .mt-desc{font-size:10.5px; color:var(--ink-soft); line-height:1.35; text-align:center;}')
krep('QRIS<span>•</span>majoo', 'QRIS<span>•</span>Hikayat')
krep("amount: amountNow, splitType: splitMode, time: nowLabel()", "amount: amountNow, splitType: splitMode, time: nowLabel(), ref: selectedPayment==='qris' ? qrisReferensi : null")
krep('<div class="mr-row"><span>Referensi</span>', '<div class="mr-row"><span>4 digit referensi</span>')
QRLIB = W / 'vendor'
qrgen = (QRLIB / 'qrcode.js').read_text(encoding='utf-8')
jsqr = (QRLIB / 'jsQR.js').read_text(encoding='utf-8')
krep('</body>', f'<script>/* qrcode-generator 2.0.4 (MIT, Kazuhiko Arase) */\n{qrgen}\n</script>\n<script>/* jsQR 1.4.0 (Apache-2.0, cozmo) */\n{jsqr}\n</script>\n<script>\n{shared}\n</script>\n<script>\n{bridge}\n</script>\n</body>')
(out / 'pos.html').write_text(k, encoding='utf-8')
print('ok')
