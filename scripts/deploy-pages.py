#!/usr/bin/env python3
"""Deploy folder statis ke Cloudflare Pages lewat API, tanpa wrangler.

Pakai: python3 scripts/deploy-pages.py <nama-project> <folder>
Butuh CLOUDFLARE_ACCOUNT_ID dan CLOUDFLARE_API_TOKEN di environment.

Semua file dibungkus ke dalam satu `_worker.js` (Pages advanced mode), jadi
tidak perlu token unggah aset. Cocok untuk demo kecil (batas ukuran skrip
Worker gratis 3 MB setelah dikompres). `/nama` melayani `nama.html`.
"""
import base64, json, mimetypes, os, sys, urllib.request, uuid

API = "https://api.cloudflare.com/client/v4"
ACCOUNT = os.environ["CLOUDFLARE_ACCOUNT_ID"]
TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")


def req(method, url, token, body=None, ctype="application/json"):
    data = body if isinstance(body, (bytes, type(None))) else json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", f"Bearer {token}")
    if data is not None:
        r.add_header("Content-Type", ctype)
    with urllib.request.urlopen(r) as res:
        out = json.loads(res.read())
    if not out.get("success", True):
        sys.exit(f"Gagal {method} {url}: {out.get('errors')}")
    return out["result"] if "result" in out else out


def main(project, folder):
    files = {}
    for root, _, names in os.walk(folder):
        for n in names:
            path = os.path.join(root, n)
            rel = "/" + os.path.relpath(path, folder).replace(os.sep, "/")
            ctype = mimetypes.guess_type(n)[0] or "application/octet-stream"
            if ctype.startswith("text/"):
                ctype += "; charset=utf-8"
            files[rel] = (base64.b64encode(open(path, "rb").read()).decode(), ctype)

    worker = WORKER.replace("__FILES__", json.dumps(files))
    boundary = uuid.uuid4().hex
    def part(name, value, extra=""):
        return f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"{extra}\r\n\r\n{value}\r\n"
    body = (part("manifest", "{}") + part("branch", "main")
            + part("_worker.js", worker, "; filename=\"_worker.js\"\r\nContent-Type: application/javascript")
            + f"--{boundary}--\r\n").encode()
    dep = req("POST", f"{API}/accounts/{ACCOUNT}/pages/projects/{project}/deployments", TOKEN,
              body, f"multipart/form-data; boundary={boundary}")
    print(f"{len(files)} file, skrip {len(worker) // 1024} KB")
    print("Deployment:", dep["url"])


WORKER = """
const FILES = __FILES__;
const cache = {};
function bytes(p) {
  if (!cache[p]) cache[p] = Uint8Array.from(atob(FILES[p][0]), c => c.charCodeAt(0));
  return cache[p];
}
export default {
  fetch(request) {
    let p = new URL(request.url).pathname;
    if (p.endsWith("/")) p += "index.html";
    if (!FILES[p] && FILES[p + ".html"]) p += ".html";
    if (!FILES[p]) return new Response("Tidak ditemukan", { status: 404 });
    return new Response(bytes(p), {
      headers: { "content-type": FILES[p][1], "cache-control": "no-cache" },
    });
  },
};
"""


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
