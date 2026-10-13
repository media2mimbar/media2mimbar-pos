// Build tanpa dependensi npm:
// 1. tsc menulis dist/ dari src/.
// 2. Rumus bersama (dist/promo.js) diubah jadi skrip biasa untuk HP: /pos-promo.js (window.HkPromo).
// 3. Semua halaman dan skrip di ui/ ditanam ke dist/halaman.js, dilayani Worker.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const dir = new URL(".", import.meta.url).pathname;
const halaman = {
  "/": "dashboard.html", "/dash-katalog.js": "dash-katalog.js", "/dash-inventori.js": "dash-inventori.js", "/dash-penjualan.js": "dash-penjualan.js", "/dash-event.js": "dash-event.js", "/dash-promo.js": "dash-promo.js", "/dash-online.js": "dash-online.js", "/dash-laporan.js": "dash-laporan.js",
  "/pos": "pos.html", "/pos-app.js": "pos-app.js", "/pos-data.js": "pos-data.js", "/pos-struk.js": "pos-struk.js", "/pos-lengkap.js": "pos-lengkap.js", "/pos-jsqr.js": "pos-jsqr.js",
  "/pos-qrcode.js": "pos-qrcode.js", "/pos-sw.js": "pos-sw.js", "/pos.webmanifest": "pos.webmanifest", "/pos-ikon.svg": "pos-ikon.svg",
};
const baca = (f) => readFileSync(dir + "ui/" + f, "utf8");

// halaman.ts sementara supaya tsc bisa memeriksa tipe; isinya ditulis ulang setelah tsc.
writeFileSync(dir + "src/halaman.ts", "// Dibuat oleh build.mjs. Jangan diubah langsung.\nexport const HALAMAN: Record<string, string> = {};\n");
rmSync(dir + "dist", { recursive: true, force: true });
try {
  execSync("tsc -p " + dir, { stdio: "inherit" });
} catch {
  process.exit(1);
}

// Rumus promo dipakai server dan HP dari satu sumber.
const promo = readFileSync(dir + "dist/promo.js", "utf8");
const nama = [...promo.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
const isiFile = Object.fromEntries(Object.entries(halaman).map(([p, f]) => [p, baca(f)]));
isiFile["/pos-promo.js"] = `// Dibuat oleh build.mjs dari src/promo.ts. Jangan diubah langsung.\nwindow.HkPromo = (() => {\n${promo.replace(/^export /gm, "")}\nreturn { ${nama.join(", ")} };\n})();\n`;

// Versi service worker = sidik isi semua file POS, supaya HP mengambil versi baru setiap ada perubahan.
const versi = createHash("sha256").update(Object.entries(isiFile).filter(([p]) => p.startsWith("/pos")).map(([, v]) => v).join("\n")).digest("hex").slice(0, 12);
for (const p of Object.keys(isiFile)) isiFile[p] = isiFile[p].replace("__VERSI__", versi);
writeFileSync(dir + "dist/halaman.js", `// Dibuat oleh build.mjs dari ui/. Jangan diubah langsung.\nexport const HALAMAN = ${JSON.stringify(isiFile)};\n`);
console.log("dist/ siap");
