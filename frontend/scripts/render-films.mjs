// Renders the motion films to video, LOCALLY (#255). Usage:
//   node scripts/render-films.mjs <export-folder> [--film client|technical] [--workers 4] [--force]
//   node scripts/render-films.mjs <export-folder> --film client --stills 27.5,34.5 --stills-out <dir> [--film-dir <folder>] [--assets-dir <folder>]   (a few stills only, for looking; nothing is encoded or written under public/)
// <export-folder> is a dated export laid out as: player/{index.html,app.js,app.css}, <film>/film/{meta,script}.json, <film>/modules/*.json, <film>/assets/*.json.
// The player is third-party code and is NEVER committed: it is copied into frontend/.film-tools/ (gitignored), one token is changed so its headless entry works over http, and it is
// run in a local Chromium that is allowed no network. Only these go under public/films/<film>/ (and into git): film.mp4 (H.264), poster.png, captions.vtt and manifest.json (source hashes, sizes,
// durations, the film's scene text; no paths). A WebM (VP8) is also made, but only into .film-tools/out/<film>/ and never committed (Interim lead, 15 Oct: public history is permanent). Audio is never rendered. Encoding uses GStreamer (openh264enc, vp8enc), which must be installed.
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = resolve(HERE, "..");
const TOOLS = join(FRONTEND, ".film-tools");
const OUT_ROOT = join(FRONTEND, "public", "films");
const FILMS = ["client", "technical"];
const FPS = 30;
const SCALE = 2 / 3; // 1920x1080 stage -> 1280x720
const SIZE_CAP = 10 * 1000 * 1000; // bytes per video file
const GATE = 'location.protocol==="file:"&&location.hash.startsWith("#tools")';
const GATE_OPEN = 'location.hash.startsWith("#tools")';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const src = args[0] && !args[0].startsWith("--") ? resolve(args[0]) : null;
const only = opt("--film", null);
const workers = Number(opt("--workers", 4));
const stop = (m) => { console.error("render-films: " + m); process.exit(1); };
if (!src) stop("usage: node scripts/render-films.mjs <export-folder> [--film client|technical] [--workers 4] [--force]");
if (only && !FILMS.includes(only)) stop(`--film must be one of ${FILMS.join(", ")}`);
for (const f of ["player/index.html", "player/app.js", "player/app.css"]) if (!existsSync(join(src, f))) stop(`the export folder lacks ${f}`);
const sha = (b) => createHash("sha256").update(b).digest("hex");

// --- the local player: copy, change ONE token, and say so; fail if the token is not found exactly once (a changed player must be looked at, not slipped in)
const appjs = readFileSync(join(src, "player/app.js"), "utf8");
const hits = appjs.split(GATE).length - 1;
if (hits !== 1) stop(`the player's file-only gate was found ${hits} times, expected exactly 1: the player changed; look at it before rendering`);
mkdirSync(join(TOOLS, "player/artifact-type"), { recursive: true });
copyFileSync(join(src, "player/index.html"), join(TOOLS, "player/index.html"));
copyFileSync(join(src, "player/app.css"), join(TOOLS, "player/artifact-type/app.css"));
const patched = appjs.replace(GATE, GATE_OPEN);
writeFileSync(join(TOOLS, "player/artifact-type/app.js"), patched);
const playerSha = { original: sha(appjs), patched: sha(patched) };

// --- GStreamer must have the encoders
for (const el of ["openh264enc", "vp8enc", "mp4mux", "webmmux", "pngdec", "multifilesrc"]) {
  try { execFileSync("gst-inspect-1.0", [el], { stdio: "ignore" }); } catch { stop(`GStreamer element ${el} is not available`); }
}

// --- film documents -> one load() payload
function loadFilm(name) {
  const dir = opt("--film-dir", null) ? resolve(opt("--film-dir", null)) : join(src, name);
  const meta = JSON.parse(readFileSync(join(dir, "film/meta.json"), "utf8"));
  const script = JSON.parse(readFileSync(join(dir, "film/script.json"), "utf8")).code;
  const KIND = { ".css": "css", ".html": "html", ".js": "js", ".json": "json", ".txt": "text" };
  const modules = readdirSync(join(dir, "modules")).sort().map((fn) => {
    const d = JSON.parse(readFileSync(join(dir, "modules", fn), "utf8"));
    const n = fn.replace(/\.json$/, "");
    return { name: n, kind: d.kind ?? KIND[extname(n)], text: d.text };
  });
  // asset records hold blob references only; the bytes come from public/films/<film>/assets/<name> when the images have been captured (Studio), else the film renders without them
  const assets = []; const missing = [];
  const MIME = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };
  if (existsSync(join(dir, "assets"))) for (const fn of readdirSync(join(dir, "assets")).sort()) {
    const n = fn.replace(/\.json$/, "");
    const p = join(opt("--assets-dir", null) ? resolve(opt("--assets-dir", null)) : join(OUT_ROOT, name, "assets"), n);
    if (existsSync(p)) assets.push({ name: n, mime: MIME[extname(n).toLowerCase()], base64: readFileSync(p).toString("base64") }); else missing.push(n);
  }
  const scenes = JSON.parse(modules.find((m) => m.name === "scenes.json").text).scenes;
  return { files: { title: meta.title, script, modules, assets }, scenes, missing, title: meta.title };
}

const require = createRequire(join(FRONTEND, "package.json"));
const { chromium } = require("playwright-core");

function serve() {
  const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
  const s = http.createServer((q, r) => {
    const p = join(TOOLS, "player", decodeURIComponent(q.url.split("?")[0]).replace(/^\/+/, "").replace(/\.\./g, ""));
    if (!existsSync(p) || !statSync(p).isFile()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { "content-type": MIME[extname(p)] ?? "application/octet-stream" }); r.end(readFileSync(p));
  }).listen(0, "127.0.0.1");
  return new Promise((res) => s.on("listening", () => res({ s, base: `http://127.0.0.1:${s.address().port}` })));
}

async function openPage(browser, base, files) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route("**/*", (r) => (r.request().url().startsWith(base) || /^(data|blob):/.test(r.request().url()) ? r.continue() : r.abort()));
  const page = await ctx.newPage();
  await page.goto(`${base}/index.html#tools`);
  await page.waitForFunction(() => typeof window.__animation === "object", null, { timeout: 30000 });
  const res = await page.evaluate((f) => window.__animation.load(f), files);
  if (res.error) stop("the film did not load: " + String(res.error.message ?? res.error).slice(0, 200));
  return { page, meta: res.meta };
}

const vttTime = (t) => { const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t - h * 3600 - m * 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`; };
function captions(scenes) {
  let t = 0; const cues = ["WEBVTT", ""];
  scenes.forEach((s, i) => { cues.push(String(i + 1), `${vttTime(t)} --> ${vttTime(t + s.dur)}`, `${s.name}. ${s.desc}`.replace(/\s+/g, " ").trim(), ""); t += s.dur; });
  return cues.join("\n");
}

function gst(argv) {
  return new Promise((res, rej) => {
    const p = spawn("gst-launch-1.0", ["-q", ...argv], { stdio: ["ignore", "ignore", "pipe"] });
    let err = ""; p.stderr.on("data", (d) => (err += d)); p.on("exit", (c) => (c === 0 ? res() : rej(new Error("gst-launch failed: " + err.slice(0, 300)))));
  });
}
const src_ = (dir) => ["multifilesrc", `location=${dir}/f%06d.png`, "index=0", `caps=image/png,framerate=${FPS}/1`, "!", "pngdec", "!", "videoconvert", "!", "video/x-raw,format=I420"];
const encoders = {
  mp4: (dir, out, bps) => [...src_(dir), "!", "openh264enc", `bitrate=${bps}`, "rate-control=1", `gop-size=${FPS * 2}`, "complexity=2", "!", "h264parse", "!", "mp4mux", "faststart=true", "!", "filesink", `location=${out}`],
  webm: (dir, out, bps) => [...src_(dir), "!", "vp8enc", `target-bitrate=${bps}`, "end-usage=vbr", `keyframe-max-dist=${FPS * 2}`, "cpu-used=2", "!", "webmmux", "!", "filesink", `location=${out}`],
};

async function stills(name, browser, base) {
  const out = opt("--stills-out", null); if (!out) stop("--stills needs --stills-out <dir>");
  const { files, missing } = loadFilm(name);
  if (missing.length) console.log(`  (no image bytes for ${missing.join(", ")})`);
  const { page } = await openPage(browser, base, files);
  mkdirSync(resolve(out), { recursive: true });
  for (const t of opt("--stills", "").split(",").map(Number)) {
    const url = await page.evaluate(([tt, sc]) => window.__animation.frame(tt, { scale: sc }), [t, SCALE]);
    const f = join(resolve(out), `t_${t.toFixed(2)}.png`); writeFileSync(f, Buffer.from(url.split(",")[1], "base64")); console.log("  " + f.split("/").pop());
  }
  for (const l of await page.evaluate(() => window.__animation.consoleLog())) if (l.level === "error") console.log("  runner error: " + String(l.text).slice(0, 160));
}

async function renderFilm(name, browser, base) {
  const { files, scenes, missing, title } = loadFilm(name);
  const filmSha = sha(JSON.stringify({ files, scenes }));
  const outDir = join(OUT_ROOT, name);
  const manPath = join(outDir, "manifest.json");
  if (!flag("--force") && existsSync(manPath)) {
    const old = JSON.parse(readFileSync(manPath, "utf8"));
    if (old.sources?.filmSha256 === filmSha && old.sources?.playerSha256 === playerSha.original && old.files?.every((f) => existsSync(join(outDir, f.name)))) { console.log(`${name}: unchanged (source ${filmSha.slice(0, 12)}), nothing to do`); return; }
  }
  mkdirSync(outDir, { recursive: true });
  const first = await openPage(browser, base, files);
  const { width, height, duration } = first.meta;
  if (width !== 1920 || height !== 1080) stop(`${name}: the stage is ${width}x${height}, this script renders a 1920x1080 stage to 720p`);
  const total = Math.round(duration * FPS);
  // frames go next to the tools (gitignored, on the disk), not into /tmp: a long film is ~1 GB of PNGs
  mkdirSync(join(TOOLS, "frames"), { recursive: true });
  const tmp = mkdtempSync(join(TOOLS, "frames", `${name}-`));
  console.log(`${name}: ${duration} s, ${total} frames at ${FPS} fps, ${workers} workers`);
  const pages = [first];
  for (let k = 1; k < workers; k++) pages.push(await openPage(browser, base, files));
  let done = 0; const t0 = Date.now();
  await Promise.all(pages.map(async ({ page }, k) => {
    for (let i = k; i < total; i += workers) {
      const url = await page.evaluate(([t, sc]) => window.__animation.frame(t, { scale: sc }), [i / FPS, SCALE]);
      writeFileSync(join(tmp, `f${String(i).padStart(6, "0")}.png`), Buffer.from(url.split(",")[1], "base64"));
      if (++done % 1000 === 0) console.log(`  ${done}/${total} frames, ${Math.round((Date.now() - t0) / 1000)} s`);
    }
  }));
  const posterT = Number(opt("--poster-at", Math.min(3, duration / 4)));
  const posterUrl = await first.page.evaluate(([t, sc]) => window.__animation.frame(t, { scale: sc }), [posterT, SCALE]);
  writeFileSync(join(outDir, "poster.png"), Buffer.from(posterUrl.split(",")[1], "base64"));
  for (const { page } of pages) await page.context().close();

  const outFiles = [];
  mkdirSync(join(TOOLS, "out", name), { recursive: true });
  for (const [ext, enc] of Object.entries(encoders)) {
    // measured: VP8 lands at ~0.45 of the target-bitrate file size (a 600 kbit/s target gave 7.2 MB for 251 s), H.264 at ~0.9; the loop below lowers the target if a file is over the cap
    let bps = Math.floor(((SIZE_CAP * 0.9 * 8) / duration) * (ext === "webm" ? 2 : 1)), size = Infinity; const target = ext === "webm" ? join(TOOLS, "out", name, "film.webm") : join(outDir, `film.${ext}`);
    for (let attempt = 0; attempt < 3 && size > SIZE_CAP; attempt++) {
      await gst(enc(tmp, target, bps)); size = statSync(target).size;
      console.log(`  ${ext}: ${(size / 1e6).toFixed(2)} MB at ${Math.round(bps / 1000)} kbit/s`);
      if (size > SIZE_CAP) bps = Math.floor(bps * 0.75);
    }
    if (size > SIZE_CAP) stop(`${name}: film.${ext} is ${size} bytes, over the ${SIZE_CAP} cap even at ${bps} bit/s: tell the lead before anything else moves`);
  }
  writeFileSync(join(outDir, "captions.vtt"), captions(scenes));
  if (flag("--keep-frames")) console.log(`  frames kept in ${tmp.slice(FRONTEND.length + 1)}`); else rmSync(tmp, { recursive: true, force: true });
  for (const n of ["film.mp4", "poster.png", "captions.vtt"]) { const b = readFileSync(join(outDir, n)); outFiles.push({ name: n, bytes: b.length, sha256: sha(b) }); }
  writeFileSync(manPath, JSON.stringify({
    title, durationS: duration, width: 1280, height: 720, fps: FPS, audio: false,
    sources: { filmSha256: filmSha, playerSha256: playerSha.original, playerPatchedSha256: playerSha.patched, gateTokenReplaced: 1 },
    encoders: { mp4: "H.264 (openh264enc, GStreamer)" },
    // the film's own scene text with start and end times: the captions and the page's transcript both come from this
    scenes: (() => { let t = 0; return scenes.map((sc) => { const o = { name: sc.name, text: sc.desc, startS: t, endS: t + sc.dur }; t += sc.dur; return o; }); })(),
    missingAssets: missing, files: outFiles,
  }, null, 2) + "\n");
  console.log(`${name}: done`, outFiles.map((f) => `${f.name} ${(f.bytes / 1e6).toFixed(2)} MB`).join(", "), "(WebM kept local, not committed)");
}

const { s, base } = await serve();
const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--force-color-profile=srgb", "--disable-lcd-text"] });
try { if (opt("--stills", null)) { if (!only) stop("--stills needs --film"); await stills(only, browser, base); } else for (const f of only ? [only] : FILMS) await renderFilm(f, browser, base); } finally { await browser.close(); s.close(); }
