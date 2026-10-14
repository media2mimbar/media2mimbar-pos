// Menjalankan Worker di laptop dengan D1 tiruan. Data hilang saat dimatikan.
// Pakai: node build.mjs && node tests/server-lokal.mjs [port]
import { createServer } from "node:http";
import worker from "../dist/index.js";
import { d1Lokal } from "./d1-lokal.mjs";

export function jalankan(port, env = { DB: d1Lokal(), PEPPER: "pepper-lokal", SETUP_KODE: "SETUP-LOKAL" }) {
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const headers = new Headers({ ...req.headers, "cf-connecting-ip": req.socket.remoteAddress });
    const r = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers, body }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  });
  return new Promise((ok) => server.listen(port, () => ok({ server, env })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] ?? 8787);
  await jalankan(port);
  console.log(`http://localhost:${port}  (kode setup: SETUP-LOKAL)`);
}
