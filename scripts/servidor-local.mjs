import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve, relative, extname, sep} from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.PORT || 4173);
const mime = {".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml"};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const path = resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    const rel = relative(root, path);
    if (rel.startsWith("..") || rel.split(sep).some((part) => part.startsWith("."))) {
      res.writeHead(403).end("Forbidden"); return;
    }
    const body = await readFile(path);
    res.writeHead(200, {"Content-Type": `${mime[extname(path)] || "application/octet-stream"}; charset=utf-8`, "Cache-Control": "no-store"});
    res.end(body);
  } catch { res.writeHead(404).end("Not found"); }
});
server.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
server.listen(port, "127.0.0.1", () => console.log(`A1000Car local: http://localhost:${port}`));
