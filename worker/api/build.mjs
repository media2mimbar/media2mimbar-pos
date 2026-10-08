// Build tanpa dependensi npm: halaman HTML di ui/ ditanam ke src/halaman.ts, lalu tsc menulis dist/.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const dir = new URL(".", import.meta.url).pathname;
const halaman = {
  "/": "dashboard.html", "/dash-katalog.js": "dash-katalog.js", "/dash-inventori.js": "dash-inventori.js", "/dash-penjualan.js": "dash-penjualan.js",
  "/pos": "pos.html", "/pos-app.js": "pos-app.js", "/pos-data.js": "pos-data.js", "/pos-struk.js": "pos-struk.js",
  "/pos-qrcode.js": "pos-qrcode.js", "/pos-sw.js": "pos-sw.js", "/pos.webmanifest": "pos.webmanifest", "/pos-ikon.svg": "pos-ikon.svg",
};
const baca = (f) => readFileSync(dir + "ui/" + f, "utf8");
// Versi service worker = sidik isi semua file POS, supaya HP mengambil versi baru setiap ada perubahan.
const versi = createHash("sha256").update(Object.values(halaman).filter((f) => f.startsWith("pos")).map(baca).join("\n")).digest("hex").slice(0, 12);
const isi = Object.entries(halaman).map(([p, f]) => `  ${JSON.stringify(p)}: ${JSON.stringify(baca(f).replace("__VERSI__", versi))},`);
writeFileSync(dir + "src/halaman.ts", `// Dibuat oleh build.mjs dari ui/. Jangan diubah langsung.\nexport const HALAMAN = {\n${isi.join("\n")}\n};\n`);
rmSync(dir + "dist", { recursive: true, force: true });
try {
  execSync("tsc -p " + dir, { stdio: "inherit" });
} catch {
  process.exit(1);
}
console.log("dist/ siap");
