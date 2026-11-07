// Security and QA gate for the built site. Exits 1 if any check fails, so CI does not deploy.
// Usage: node scripts/check.mjs [dir]   (default: _site)
import { promises as fs } from "node:fs";
import path from "node:path";

const DIR = path.resolve(process.argv[2] || "_site");
const ALLOWED_ORIGINS = ["https://github.com", "https://www.linkedin.com", "https://tocaturno.com", "https://jarby.dev", "https://jessidc.github.io"];
const STRICT_CSP = "default-src 'none'";
const failures = [];
const fail = (file, msg) => failures.push(`${file}: ${msg}`);

async function walk(p) {
  const out = [];
  for (const e of await fs.readdir(p, { withFileTypes: true })) {
    const full = path.join(p, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }

const files = await walk(DIR);
const htmls = files.filter((f) => f.endsWith(".html"));

for (const file of htmls) {
  const rel = path.relative(DIR, file).split(path.sep).join("/");
  const html = await fs.readFile(file, "utf8");
  const isBench = rel.startsWith("bench/");

  // 1. Every page declares a CSP that denies by default.
  const csp = html.match(/http-equiv="?Content-Security-Policy"?\s+content="([^"]+)"/i);
  if (!csp) fail(rel, "missing Content-Security-Policy meta");
  else if (!csp[1].includes(STRICT_CSP)) fail(rel, "CSP does not start from default-src 'none'");
  else if (!isBench && /unsafe-inline|unsafe-eval/.test(csp[1])) fail(rel, "CSP allows unsafe-inline or unsafe-eval");

  // 2. No inline script, no event handler attributes, no javascript: URLs.
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\bsrc=/.test(m[1])) fail(rel, "inline <script> block");
  }
  if (/\son[a-z]+\s*=/i.test(html)) fail(rel, "inline event handler attribute");
  if (/javascript:/i.test(html)) fail(rel, "javascript: URL");

  // 3. No inline style attributes on the main pages (the generated bench report is the one exception).
  if (!isBench && /\sstyle=/i.test(html)) fail(rel, "inline style attribute");

  // 4. Nothing loaded from third parties; links only to known origins; no plain http.
  for (const m of html.matchAll(/<(script|link|img|source|iframe)\b[^>]*\b(?:src|href)="?(https?:)?\/\/[^"\s>]*/gi)) {
    if (!/rel="?(alternate|canonical)/i.test(m[0])) fail(rel, `third-party resource: ${m[0].slice(0, 80)}`);
  }
  for (const m of html.matchAll(/\bhref="?(https?:\/\/[^"\s>]+)/gi)) {
    const url = m[1];
    if (url.startsWith("http://")) fail(rel, `plain http link: ${url}`);
    else if (!ALLOWED_ORIGINS.some((o) => url.startsWith(o))) fail(rel, `link to unexpected origin: ${url}`);
  }

  // 5. Every local reference resolves to a file in the build.
  for (const m of html.matchAll(/\b(?:src|href)="?([^"\s>]+)/gi)) {
    let ref = m[1];
    if (/^(https?:|mailto:|#|data:)/.test(ref)) continue;
    ref = ref.split("#")[0].split("?")[0];
    if (!ref) continue;
    let target = ref.startsWith("/") ? path.join(DIR, ref) : path.join(path.dirname(file), ref);
    if (ref.endsWith("/")) target = path.join(target, "index.html");
    if (!(await exists(target))) fail(rel, `broken local reference: ${m[1]}`);
  }

  // 6. No phone numbers on public pages (contact is by email only).
  if (/\+57|312\s?721/.test(html)) fail(rel, "phone number on a public page");

  // 7. House style on the main pages: no em or en dashes.
  if (!isBench && /[–—]/.test(html)) fail(rel, "em or en dash in the text");
}

// 8. security.txt exists and has not expired.
const sec = path.join(DIR, ".well-known", "security.txt");
if (!(await exists(sec))) fail(".well-known/security.txt", "missing");
else {
  const exp = (await fs.readFile(sec, "utf8")).match(/^Expires:\s*(.+)$/m);
  if (!exp || new Date(exp[1]) < new Date()) fail(".well-known/security.txt", "missing or past Expires");
}

// 9. Only expected file types are published.
const okExt = new Set([".html", ".css", ".js", ".svg", ".webp", ".png", ".woff2", ".pdf", ".txt", ".xml", ".json", ""]);
for (const f of files) {
  if (!okExt.has(path.extname(f).toLowerCase())) fail(path.relative(DIR, f), "unexpected file type in the build");
}

if (failures.length) {
  console.error(`FAILED ${failures.length} check(s):\n- ` + failures.join("\n- "));
  process.exit(1);
}
console.log(`OK: ${htmls.length} pages, ${files.length} files checked`);
