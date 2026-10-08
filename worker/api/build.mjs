// Build tanpa dependensi npm: halaman HTML di ui/ ditanam ke src/halaman.ts, lalu tsc menulis dist/.
import { execSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const dir = new URL(".", import.meta.url).pathname;
const halaman = { "/": "dashboard.html", "/pos": "pos.html" };
const isi = Object.entries(halaman).map(([p, f]) => `  ${JSON.stringify(p)}: ${JSON.stringify(readFileSync(dir + "ui/" + f, "utf8"))},`);
writeFileSync(dir + "src/halaman.ts", `// Dibuat oleh build.mjs dari ui/. Jangan diubah langsung.\nexport const HALAMAN = {\n${isi.join("\n")}\n};\n`);
rmSync(dir + "dist", { recursive: true, force: true });
try {
  execSync("tsc -p " + dir, { stdio: "inherit" });
} catch {
  process.exit(1);
}
console.log("dist/ siap");
