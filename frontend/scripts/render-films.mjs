// Renders the motion films to video, LOCALLY (#255). Usage:
//   node scripts/render-films.mjs <export-folder> [--film client|technical] [--workers 4] [--force]
//   node scripts/render-films.mjs <export-folder> --film client --stills 27.5,34.5 --stills-out <dir> [--film-dir <folder>] [--assets-dir <folder>]   (a few stills only, for looking; nothing is encoded or written under public/)
// <export-folder> is a dated export laid out as: player/{index.html,app.js,app.css}, <film>/film/{meta,script}.json, <film>/modules/*.json, <film>/assets/*.json.
// The player is third-party code and is NEVER committed: it is copied into frontend/.film-tools/ (gitignored), one token is changed so its headless entry works over http, and it is
// run in a local Chromium that is allowed no network. Only these go under public/films/<film>/ (and into git): film.mp4 (H.264), poster.png, captions.vtt and manifest.json (source hashes, sizes,
// durations, the film's scene text; no paths). A WebM (VP8) is also made, but only into .film-tools/out/<film>/ and never committed (Interim lead, 15 Oct: public history is permanent).
// NARRATED (Web, 15 Oct): with --narration <dir> --narration-json <narration.json> the film is retimed to its narration (each scene lasts its audio plus a lead and a tail; scenes whose audio is longer than the
// original are stretched up to 1.5x, then hold), the film's own score is rendered offline by the player and ducked under the voice, and film.mp4 carries AAC audio (mono, 56 kbit/s); captions.vtt is the narration's
// own "text". <dir> holds the per-scene WAVs and the timings_*.json written by the narration render. The WebM is skipped. Encoding uses GStreamer (openh264enc, avenc_aac, mp4mux), which must be installed.
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { captionCues, mixFilm, planScenes, readWav, sha256, stretchModule, upsample2, writeWav16Mono } from "./film-audio.mjs";

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
const narrDir = opt("--narration", null) ? resolve(opt("--narration", null)) : null;
const narrJson = opt("--narration-json", null) ? resolve(opt("--narration-json", null)) : null;
if (!!narrDir !== !!narrJson) { console.error("render-films: --narration and --narration-json go together"); process.exit(1); }
const AUDIO_BPS = 56000;
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
// the player refuses a film over 300 s (several checks of the same number); the narrated technical film is longer than that (its narration alone is ~320 s), so for a NARRATED render the number is raised to 420 in the local copy.
// Each token is counted exactly like the gate token: found once or the player changed and must be looked at. The film's own files are never touched.
const LIMITS = [["TH0=24,Ri0=300,", "TH0=24,Ri0=420,"], ["MOST = 24, LONGEST_S = 300,", "MOST = 24, LONGEST_S = 420,"], ["isFinite(d) && d > 0 && d <= 300", "isFinite(d) && d > 0 && d <= 420"], ["if(!(Y>0&&Y<=300))return null", "if(!(Y>0&&Y<=420))return null"]];
let patched = appjs.replace(GATE, GATE_OPEN);
if (narrDir) for (const [from, to] of LIMITS) {
  const n = appjs.split(from).length - 1;
  if (n !== 1) stop(`the player's 300 s limit token "${from}" was found ${n} times, expected exactly 1: the player changed; look at it before rendering`);
  patched = patched.replace(from, to);
}
writeFileSync(join(TOOLS, "player/artifact-type/app.js"), patched);

const playerSha = { original: sha(appjs), patched: sha(patched) };

// --- GStreamer must have the encoders
for (const el of ["openh264enc", "vp8enc", "mp4mux", "webmmux", "pngdec", "multifilesrc", ...(narrDir ? ["avenc_aac", "aacparse", "wavparse", "audioconvert"] : [])]) {
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
  // video + AAC audio from the mixed WAV, one pipeline (faststart MP4)
  mp4a: (dir, out, bps, wav) => [...src_(dir), "!", "openh264enc", `bitrate=${bps}`, "rate-control=1", `gop-size=${FPS * 2}`, "complexity=2", "!", "h264parse", "!", "mp4mux", "name=m", "faststart=true", "!", "filesink", `location=${out}`,
    "filesrc", `location=${wav}`, "!", "wavparse", "!", "audioconvert", "!", "audio/x-raw,channels=1", "!", "avenc_aac", `bitrate=${AUDIO_BPS}`, "!", "aacparse", "!", "m."],
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

/** Reads the narration renders, checks them against the narration source, retimes the scenes and adds the stretch module. Mutates files.modules; returns what the render and the manifest need. */
function prepareNarration(files, scenes) {
  const tf = readdirSync(narrDir).filter((f) => /^timings_.*\.json$/.test(f));
  if (tf.length !== 1) stop(`${narrDir} must hold exactly one timings_*.json, found ${tf.length}`);
  const timings = JSON.parse(readFileSync(join(narrDir, tf[0]), "utf8"));
  const narrBytes = readFileSync(narrJson), narration = JSON.parse(narrBytes.toString("utf8"));
  if (timings.src_sha256 !== sha256(narrBytes)) stop("the narration renders were made from a different narration.json than the one given (sha256 differs)");
  const ids = scenes.map((x) => x.id), nids = narration.map((x) => x.id);
  if (JSON.stringify(ids) !== JSON.stringify(nids)) stop(`the film's scenes (${ids.join(",")}) and the narration's (${nids.join(",")}) differ`);
  const audioSeconds = {}, wavs = {};
  for (const id of ids) {
    const t = timings.scenes[id]; const b = readFileSync(join(narrDir, t.file));
    if (sha256(b) !== t.sha256) stop(`${t.file} does not match its recorded sha256`);
    const w = readWav(b); if (w.rate !== 24000 || w.chans.length !== 1) stop(`${t.file}: expected 24 kHz mono`);
    wavs[id] = w.chans[0]; audioSeconds[id] = w.chans[0].length / 24000;
  }
  const plan = planScenes(scenes, audioSeconds);
  const sm = files.modules.find((m) => m.name === "scenes.json"); const sj = JSON.parse(sm.text);
  for (const sc of sj.scenes) sc.dur = plan.find((p) => p.id === sc.id).dur;
  sm.text = JSON.stringify(sj, null, 2);
  files.modules.push({ name: "shared.js", kind: "js", text: stretchModule(plan) });
  files.modules.sort((a, b) => (a.name < b.name ? -1 : 1));
  return { plan, wavs, narration, timings, narrSha: sha256(narrBytes), timingsSha: sha256(readFileSync(join(narrDir, tf[0]))) };
}

async function renderFilm(name, browser, base) {
  let { files, scenes, missing, title } = loadFilm(name);
  const narr = narrDir ? prepareNarration(files, scenes) : null;
  if (narr) scenes = scenes.map((sc) => ({ ...sc, dur: narr.plan.find((p) => p.id === sc.id).dur }));
  const filmSha = sha(JSON.stringify({ files, scenes, narr: narr ? { n: narr.narrSha, t: narr.timingsSha } : null }));
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
  let mixPath = null, mixReport = null;
  if (narr) {
    console.log(`  rendering the score offline ...`);
    const ar = await first.page.evaluate(async () => { const r = await window.__animation.renderAudio({ title: "score" }); return { wav: r.wav, bytes: r.wavBytes, seconds: r.seconds, lufs: r.lufs }; });
    const parts = []; for (let off = 0; off < ar.bytes; off += 3 * 1024 * 1024) parts.push(Buffer.from(await first.page.evaluate(([h, o, l]) => window.__animation.read(h, o, l), [ar.wav, off, 3 * 1024 * 1024]), "base64"));
    await first.page.evaluate((h) => window.__animation.free(h), ar.wav);
    const score = readWav(Buffer.concat(parts));
    const narrTrack = narr.plan.map((p) => ({ startS: p.voiceStartS, x: upsample2(narr.wavs[p.id]) }));
    const { mix, report } = mixFilm({ score, narration: narrTrack, totalS: duration });
    mixReport = { ...report, scoreSeconds: ar.seconds, scoreLufs: Math.round(ar.lufs * 100) / 100 };
    mixPath = join(TOOLS, "out", name, "mix.wav"); mkdirSync(dirname(mixPath), { recursive: true }); writeFileSync(mixPath, writeWav16Mono(mix, 48000));
    console.log(`  mix: ${JSON.stringify(mixReport)}`);
  }
  for (const { page } of pages) await page.context().close();

  const outFiles = [];
  mkdirSync(join(TOOLS, "out", name), { recursive: true });
  for (const [ext, enc] of Object.entries(narr ? { mp4: null } : encoders)) {
    // measured: VP8 lands at ~0.45 of the target-bitrate file size (a 600 kbit/s target gave 7.2 MB for 251 s), H.264 at ~0.9; the loop below lowers the target if a file is over the cap
    const audioBytes = narr ? (AUDIO_BPS * duration) / 8 : 0;
    let bps = narr ? Math.floor((((SIZE_CAP * 0.95 - audioBytes) * 8) / duration) / 0.9) : Math.floor(((SIZE_CAP * 0.9 * 8) / duration) * (ext === "webm" ? 2 : 1)), size = Infinity; const target = ext === "webm" ? join(TOOLS, "out", name, "film.webm") : join(outDir, `film.${ext}`);
    for (let attempt = 0; attempt < (narr ? 4 : 3) && size > SIZE_CAP; attempt++) {
      await gst(narr ? encoders.mp4a(tmp, target, bps, mixPath) : enc(tmp, target, bps)); size = statSync(target).size;
      console.log(`  ${ext}: ${(size / 1e6).toFixed(2)} MB at ${Math.round(bps / 1000)} kbit/s${narr ? ` (+ AAC ${AUDIO_BPS / 1000} kbit/s)` : ""}`);
      // narrated: scale the video bit rate by what the first pass actually produced, aiming at 96% of the cap
      if (size > SIZE_CAP) bps = narr ? Math.floor(bps * ((SIZE_CAP * 0.96 - audioBytes) / Math.max(1, size - audioBytes))) : Math.floor(bps * 0.75);
    }
    if (size > SIZE_CAP) stop(`${name}: film.${ext} is ${size} bytes, over the ${SIZE_CAP} cap even at ${bps} bit/s: tell the lead before anything else moves`);
  }
  if (narr) {
    const cues = ["WEBVTT", ""]; let k = 0;
    for (const p of narr.plan) for (const c of captionCues(narr.narration.find((x) => x.id === p.id).text, p.voiceStartS, p.voiceStartS + p.audioS)) cues.push(String(++k), `${vttTime(c.from)} --> ${vttTime(c.to)}`, c.text, "");
    writeFileSync(join(outDir, "captions.vtt"), cues.join("\n"));
  } else writeFileSync(join(outDir, "captions.vtt"), captions(scenes));
  if (flag("--keep-frames")) console.log(`  frames kept in ${tmp.slice(FRONTEND.length + 1)}`); else rmSync(tmp, { recursive: true, force: true });
  for (const n of ["film.mp4", "poster.png", "captions.vtt"]) { const b = readFileSync(join(outDir, n)); outFiles.push({ name: n, bytes: b.length, sha256: sha(b) }); }
  writeFileSync(manPath, JSON.stringify({
    title, durationS: duration, width: 1280, height: 720, fps: FPS, audio: !!narr,
    ...(narr ? { narration: {
      voice: `${narr.timings.voice} (Kokoro-82M f3ff3571, lang ${narr.timings.lang}), a synthetic voice`, narrationJsonSha256: narr.narrSha, timingsSha256: narr.timingsSha,
      scenes: narr.plan.map((p) => ({ id: p.id, audioS: Math.round(p.audioS * 100) / 100, durS: p.dur, origDurS: p.origDur, stretch: p.stretch, wavSha256: narr.timings.scenes[p.id].sha256 })),
      mix: mixReport, audioCodec: `AAC mono ${AUDIO_BPS / 1000} kbit/s (avenc_aac, GStreamer)`,
    } } : {}),
    sources: { filmSha256: filmSha, playerSha256: playerSha.original, playerPatchedSha256: playerSha.patched, gateTokenReplaced: 1, ...(narrDir ? { durationLimitTokensReplaced: LIMITS.length, durationLimitS: "300 to 420 (local copy only)" } : {}) },
    encoders: { mp4: narr ? "H.264 (openh264enc) + AAC (avenc_aac), GStreamer" : "H.264 (openh264enc, GStreamer)" },
    // the film's own scene text with start and end times: the captions and the page's transcript both come from this
    scenes: (() => { let t = 0; return scenes.map((sc) => { const o = { name: sc.name, text: sc.desc, startS: t, endS: t + sc.dur }; t += sc.dur; return o; }); })(),
    missingAssets: missing, files: outFiles,
  }, null, 2) + "\n");
  console.log(`${name}: done`, outFiles.map((f) => `${f.name} ${(f.bytes / 1e6).toFixed(2)} MB`).join(", "), "(WebM kept local, not committed)");
}

const { s, base } = await serve();
const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--force-color-profile=srgb", "--disable-lcd-text"] });
try { if (opt("--stills", null)) { if (!only) stop("--stills needs --film"); await stills(only, browser, base); } else for (const f of only ? [only] : FILMS) await renderFilm(f, browser, base); } finally { await browser.close(); s.close(); }
