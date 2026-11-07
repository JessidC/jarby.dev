// Builds the deployable site into _site/.
// Copies an explicit allowlist of public files (nothing else from the repo is published),
// minifies HTML, CSS and JS, and writes build-manifest.json with a SHA-256 per file
// so anyone can check that what is served matches this commit.
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { transform } from "esbuild";
import { minify as minifyHtml } from "html-minifier-terser";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const OUT = path.join(ROOT, "_site");
const PUBLIC = ["index.html", "404.html", "es", "bench", "assets", ".well-known", "CNAME", "robots.txt", "sitemap.xml", ".nojekyll"];

async function walk(p) {
  const st = await fs.stat(p);
  if (!st.isDirectory()) return [p];
  const out = [];
  for (const e of await fs.readdir(p)) out.push(...(await walk(path.join(p, e))));
  return out;
}

async function processFile(src, dst) {
  const ext = path.extname(src).toLowerCase();
  await fs.mkdir(path.dirname(dst), { recursive: true });
  if (ext === ".html") {
    const html = await fs.readFile(src, "utf8");
    const out = await minifyHtml(html, {
      collapseWhitespace: true,
      conservativeCollapse: true,
      removeComments: true,
      minifyCSS: true,
      decodeEntities: false,
      keepClosingSlash: false,
    });
    await fs.writeFile(dst, out);
  } else if (ext === ".js") {
    const r = await transform(await fs.readFile(src, "utf8"), { loader: "js", minify: true, legalComments: "none", target: "es2018" });
    await fs.writeFile(dst, r.code);
  } else if (ext === ".css") {
    const r = await transform(await fs.readFile(src, "utf8"), { loader: "css", minify: true, legalComments: "none" });
    await fs.writeFile(dst, r.code);
  } else {
    await fs.copyFile(src, dst);
  }
}

await fs.rm(OUT, { recursive: true, force: true });
const manifest = {};
for (const item of PUBLIC) {
  const abs = path.join(ROOT, item);
  try { await fs.access(abs); } catch { continue; }
  for (const f of await walk(abs)) {
    const rel = path.relative(ROOT, f).split(path.sep).join("/");
    const dst = path.join(OUT, rel);
    await processFile(f, dst);
    manifest[rel] = crypto.createHash("sha256").update(await fs.readFile(dst)).digest("hex");
  }
}

// Cache busting: GitHub Pages lets browsers keep CSS and JS for 10 minutes, so a new page
// could load with an old stylesheet. Each reference gets ?v=<content hash>, which changes
// whenever the file does.
const VERSIONED = ["assets/site.css", "assets/site.js", "assets/theme-init.js"];
for (const [rel] of Object.entries(manifest).filter(([r]) => r.endsWith(".html"))) {
  const file = path.join(OUT, rel);
  let html = await fs.readFile(file, "utf8");
  for (const asset of VERSIONED) {
    if (!manifest[asset]) continue;
    const v = manifest[asset].slice(0, 10);
    const name = asset.replace(/^assets\//, "");
    html = html.replace(new RegExp(`(assets/${name.replace(".", "\\.")})(?=["\\s>])`, "g"), `$1?v=${v}`);
  }
  await fs.writeFile(file, html);
  manifest[rel] = crypto.createHash("sha256").update(html).digest("hex");
}

let commit = process.env.GITHUB_SHA || "";
if (!commit) { try { commit = execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim(); } catch { commit = "unknown"; } }
await fs.writeFile(path.join(OUT, "build-manifest.json"), JSON.stringify({ commit, files: manifest }, null, 2));
console.log(`Built ${Object.keys(manifest).length} files into _site/ from ${commit.slice(0, 7)}`);
