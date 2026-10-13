# Membuat file .xlsx kecil untuk uji impor (tanpa pustaka): shared strings, angka, dan tanggal seri Excel.
# Pakai: python3 tests/buat-xlsx.py keluaran.xlsx "judul1|judul2" "isi1|isi2" ...
import sys, zipfile
from xml.sax.saxutils import escape
out, *baris = sys.argv[1:]
rows = [b.split("|") for b in baris]
strings = []
def sel(ref, v):
    if v.startswith("#"):  # angka apa adanya (misalnya tanggal seri Excel)
        return f'<c r="{ref}"><v>{v[1:]}</v></c>'
    if v not in strings: strings.append(v)
    return f'<c r="{ref}" t="s"><v>{strings.index(v)}</v></c>'
huruf = lambda i: chr(65 + i)
sheet = "".join(f'<row r="{r+1}">' + "".join(sel(f"{huruf(c)}{r+1}", v) for c, v in enumerate(row)) + "</row>" for r, row in enumerate(rows))
ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
    z.writestr("xl/workbook.xml", f'<?xml version="1.0"?><workbook {ns} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Pesanan" sheetId="1" r:id="rId1"/></sheets></workbook>')
    z.writestr("xl/_rels/workbook.xml.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/data.xml" Type="x"/></Relationships>')
    z.writestr("xl/worksheets/data.xml", f'<?xml version="1.0"?><worksheet {ns}><sheetData>{sheet}</sheetData></worksheet>')
    z.writestr("xl/sharedStrings.xml", f'<?xml version="1.0"?><sst {ns}>' + "".join(f"<si><t>{escape(s)}</t></si>" for s in strings) + "</sst>")
