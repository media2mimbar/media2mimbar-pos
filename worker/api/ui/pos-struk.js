// POS: struk PDF dibuat di HP (tanpa server). Pembuat PDF mini dari prototipe (pos-bridge.js), teks Helvetica.

const HkPdf=(()=>{
  const WR=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const WB=[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
  const EXTRA={'·':[183,278,278],'×':[215,584,584],'–':[150,556,556],'—':[151,1000,1000]};
  const K=72/25.4;
  return class{
    constructor(wmm,hmm){ this.w=wmm; this.h=hmm; this.ops=[]; this.bold=false; this.size=10; }
    setFont(_,st){ this.bold=st==='bold'; } setFontSize(n){ this.size=n; }
    setDrawColor(g){ this.ops.push(`${(g/255).toFixed(3)} G`); } setFillColor(g){ this.ops.push(`${(g/255).toFixed(3)} g`); }
    width(str){ let u=0; for(const ch of String(str)){ const c=ch.charCodeAt(0); u+=c>=32&&c<=126?(this.bold?WB:WR)[c-32]:EXTRA[ch]?EXTRA[ch][this.bold?2:1]:556; } return u/1000*this.size/K; }
    enc(str){ let o=''; for(const ch of String(str)){ const c=ch.charCodeAt(0); if(ch==='('||ch===')'||ch==='\\') o+='\\'+ch; else if(c>=32&&c<=126) o+=ch; else if(EXTRA[ch]) o+='\\'+EXTRA[ch][0].toString(8); else o+='?'; } return o; }
    text(str,x,y,o){ o=o||{}; const w=this.width(str), x0=o.align==='right'?x-w:o.align==='center'?x-w/2:x;
      this.ops.push(`BT /${this.bold?'F2':'F1'} ${this.size} Tf ${(x0*K).toFixed(2)} ${((this.h-y)*K).toFixed(2)} Td (${this.enc(str)}) Tj ET`); }
    line(x1,y1,x2,y2){ this.ops.push(`0.3 w ${(x1*K).toFixed(2)} ${((this.h-y1)*K).toFixed(2)} m ${(x2*K).toFixed(2)} ${((this.h-y2)*K).toFixed(2)} l S`); }
    rect(x,y,w,h){ this.ops.push(`${(x*K).toFixed(2)} ${((this.h-y-h)*K).toFixed(2)} ${(w*K).toFixed(2)} ${(h*K).toFixed(2)} re f`); }
    splitTextToSize(str,max){ const out=[]; let cur=''; String(str).split(/\s+/).filter(Boolean).forEach(wd=>{ const t=cur?cur+' '+wd:wd; if(this.width(t)>max&&cur){ out.push(cur); cur=wd; } else cur=t; }); if(cur) out.push(cur); return out; }
    build(){ const st=this.ops.join('\n'), objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${(this.w*K).toFixed(2)} ${(this.h*K).toFixed(2)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
      `<< /Length ${st.length} >>\nstream\n${st}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
      let pdf='%PDF-1.4\n'; const off=[]; objs.forEach((o,i)=>{ off.push(pdf.length); pdf+=`${i+1} 0 obj\n${o}\nendobj\n`; });
      const xref=pdf.length; pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+off.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return pdf; }
    output(type){ const s=this.build(), b=new Uint8Array(s.length); for(let i=0;i<s.length;i++) b[i]=s.charCodeAt(i)&255; return type==='blob'?new Blob([b],{type:'application/pdf'}):b.buffer; }
    save(name){ const a=document.createElement('a'); a.href=URL.createObjectURL(this.output('blob')); a.download=name; document.body.appendChild(a); a.click(); a.remove(); }
  };
})();

// t: transaksi lokal; tempat: {nama}; st: pengaturan.struk
function strukPdf(t, tempat, st) {
  const W = 80, L = 5, R = W - 5;
  const tinggi = 70 + t.items.length * 9 + t.pembayaran.length * 5 + (t.diskon ? 5 : 0) + (t.pajak ? 5 : 0) + (t.pembulatan ? 5 : 0);
  const doc = new HkPdf(W, Math.max(120, tinggi));
  let y = 8;
  const tx = (s, x, o) => doc.text(String(s), x, y, o || {});
  const row = (a, b, bold) => { doc.setFont("helvetica", bold ? "bold" : "normal"); tx(a, L); tx(b, R, { align: "right" }); y += 5; };
  const garis = () => { doc.setDrawColor(200); doc.line(L, y - 2, R, y - 2); y += 2; };
  const fmt = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); tx(st.nama, W / 2, { align: "center" }); y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  if (st.info) { tx(st.info, W / 2, { align: "center" }); y += 4; }
  if (st.tampil_event) { tx(tempat.nama, W / 2, { align: "center" }); y += 4; }
  y += 2; garis();
  const w = new Date(t.waktu);
  row("No. transaksi", t.no);
  row("Waktu", w.toLocaleDateString("id-ID") + " " + w.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
  if (st.tampil_kasir) row("Kasir", t.kasir_nama);
  if (t.pelanggan_nama) row("Pembeli", t.pelanggan_nama);
  garis();
  t.items.forEach((i) => { doc.setFont("helvetica", "normal"); tx(doc.splitTextToSize(i.nama, R - L)[0], L); y += 4; row(`  ${i.qty} x ${fmt(i.harga)}`, fmt(i.qty * i.harga)); });
  garis(); row("Subtotal", fmt(t.subtotal));
  if (t.diskon) row(t.promo || "Diskon", "-" + fmt(t.diskon));
  if (t.pajak) row("PPN", fmt(t.pajak));
  if (t.pembulatan) row("Pembulatan", "-" + fmt(t.pembulatan));
  doc.setFontSize(10); row("TOTAL", fmt(t.total), true); doc.setFontSize(8);
  t.pembayaran.forEach((b) => row(b.metode + (b.ref ? " (ref " + b.ref + ")" : ""), fmt(b.jumlah)));
  if (t.kembalian) row("Kembalian", fmt(t.kembalian));
  y += 2; garis();
  doc.splitTextToSize(st.footer || "", R - L).forEach((l) => { tx(l, W / 2, { align: "center" }); y += 4; });
  return doc;
}
