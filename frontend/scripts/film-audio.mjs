// Audio for the narrated films (Web, 15 Oct): the plan that retimes each scene to its narration, the mix (score ducked under the voice) and the captions text. Pure functions, no files read except by the caller.
import { createHash } from "node:crypto";

export const sha256 = (b) => createHash("sha256").update(b).digest("hex");

/** Scene durations from the narration: every scene lasts at least its original length, and at least lead + audio + tail. Rounded UP to 0.1 s. The stretch (>=1) slows the scene's own animation up to `cap`; beyond it the scene holds its last picture. */
export function planScenes(scenes, audioSeconds, { lead = 0.6, tail = 0.9, endTail = 1.6, cap = 1.5 } = {}) {
  let t = 0;
  return scenes.map((s) => {
    const a = audioSeconds[s.id];
    if (typeof a !== "number") throw new Error(`no narration audio for scene ${s.id}`);
    const need = lead + a + (s.id === "end" ? endTail : tail);
    const dur = Math.max(s.dur, Math.ceil(need * 10) / 10);
    const stretch = Math.min(cap, dur / s.dur);
    const out = { id: s.id, name: s.name, origDur: s.dur, dur, stretch: Math.round(stretch * 1000) / 1000, startS: t, voiceStartS: t + lead, audioS: a };
    t += dur; return out;
  });
}

/** The module that slows each stretched scene's own clock. It runs before the scenes are mounted (the player runs shared.js first) and wraps kit.scene. */
export function stretchModule(plan) {
  const map = Object.fromEntries(plan.filter((p) => p.stretch > 1.0001).map((p) => [p.id, p.stretch]));
  return `const STRETCH = ${JSON.stringify(map)};\nconst scene0 = kit.scene;\nkit.scene = function (id, def) {\n  const k = STRETCH[id];\n  if (k && def && typeof def.render === "function") { const r = def.render; def.render = function (t, kk) { return r.call(this, t / k, kk); }; }\n  return scene0.call(this, id, def);\n};\n`;
}

// ---- WAV
export function readWav(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") throw new Error("not a WAV file");
  let p = 12, fmt = null, data = null;
  while (p + 8 <= buf.length) {
    const id = buf.toString("ascii", p, p + 4), n = buf.readUInt32LE(p + 4), b = p + 8;
    if (id === "fmt ") fmt = { tag: buf.readUInt16LE(b), ch: buf.readUInt16LE(b + 2), rate: buf.readUInt32LE(b + 4), bits: buf.readUInt16LE(b + 14) };
    if (id === "data") { data = buf.subarray(b, Math.min(b + n, buf.length)); break; }
    p = b + n + (n & 1);
  }
  if (!fmt || !data) throw new Error("WAV without fmt or data");
  const bytes = fmt.bits / 8, frames = Math.floor(data.length / (bytes * fmt.ch));
  const chans = Array.from({ length: fmt.ch }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < fmt.ch; c++) {
    const o = (i * fmt.ch + c) * bytes;
    chans[c][i] = fmt.tag === 3 && fmt.bits === 32 ? data.readFloatLE(o) : fmt.bits === 16 ? data.readInt16LE(o) / 32768 : fmt.bits === 24 ? data.readIntLE(o, 3) / 8388608 : fmt.bits === 32 ? data.readInt32LE(o) / 2147483648 : NaN;
  }
  return { rate: fmt.rate, chans };
}
export function writeWav16Mono(x, rate) {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  return b;
}

/** 24 kHz -> 48 kHz: zero-stuff and a windowed-sinc low-pass (cut-off 11 kHz, 95 taps). */
export function upsample2(x) {
  const N = 95, h = new Float32Array(N), fc = 11000 / 48000, m = (N - 1) / 2; let sum = 0;
  for (let i = 0; i < N; i++) { const k = i - m, s = k === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * k) / (Math.PI * k); const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (N - 1)); h[i] = s * w; sum += h[i]; }
  for (let i = 0; i < N; i++) h[i] = (h[i] / sum) * 2;
  const y = new Float32Array(x.length * 2);
  for (let n = 0; n < y.length; n++) { let a = 0; for (let k = 0; k < N; k++) { const j = n - (k - m); if (j >= 0 && j < y.length && (j & 1) === 0) a += x[j >> 1] * h[k]; } y[n] = a; }
  return y;
}

/**
 * Mix: the narration (mono, placed at each scene's voice start) over the score (folded to mono). The score sits at `scoreDb` and is ducked a further `duckDb` while the voice speaks
 * (attack 0.12 s, release 0.7 s); the voice is levelled to `voiceRmsDb` over its speech. A soft ceiling keeps the peak under 0.97.
 */
export function mixFilm({ score, narration, rate = 48000, scoreDb = -7, duckDb = -11, voiceRmsDb = -19, totalS }) {
  const n = Math.round(totalS * rate), voice = new Float32Array(n);
  for (const { startS, x } of narration) voice.set(x.subarray(0, Math.max(0, Math.min(x.length, n - Math.round(startS * rate)))), Math.round(startS * rate));
  // voice level over active 20 ms windows
  const W = Math.round(rate * 0.02), act = new Uint8Array(Math.ceil(n / W)); let e = 0, c = 0;
  for (let w = 0; w < act.length; w++) { let s = 0; const a = w * W, b = Math.min(n, a + W); for (let i = a; i < b; i++) s += voice[i] * voice[i]; const r = Math.sqrt(s / (b - a)); if (r > 0.004) { act[w] = 1; e += s; c += b - a; } }
  const speechRms = c ? Math.sqrt(e / c) : 0, vg = speechRms ? 10 ** (voiceRmsDb / 20) / speechRms : 1;
  // duck curve (hold the duck across short pauses: 0.25 s)
  const hold = 13, tgt = new Float32Array(act.length); for (let w = 0; w < act.length; w++) { let on = 0; for (let k = Math.max(0, w - hold); k <= w; k++) if (act[k]) { on = 1; break; } tgt[w] = on; }
  const aA = 1 - Math.exp(-1 / (0.12 * rate)), aR = 1 - Math.exp(-1 / (0.7 * rate)), sg = 10 ** (scoreDb / 20), dg = 10 ** (duckDb / 20);
  const out = new Float32Array(n); let g = 1;
  for (let i = 0; i < n; i++) {
    const want = tgt[Math.min(tgt.length - 1, (i / W) | 0)] ? dg : 1;
    g += (want - g) * (want < g ? aA : aR);
    const sc = score.chans.length > 1 ? (score.chans[0][i] + score.chans[1][i]) / 2 : score.chans[0][i];
    out[i] = (i < score.chans[0].length ? sc : 0) * sg * g + voice[i] * vg;
  }
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const lim = peak > 0.97 ? 0.97 / peak : 1; if (lim < 1) for (let i = 0; i < n; i++) out[i] *= lim;
  return { mix: out, report: { rate, scoreDb, duckDb, voiceRmsDb, voiceGain: Math.round(vg * 1000) / 1000, speechRmsDb: speechRms ? Math.round(20 * Math.log10(speechRms) * 10) / 10 : null, peakBeforeLimit: Math.round(peak * 1000) / 1000, limiterGain: Math.round(lim * 1000) / 1000 } };
}

// ---- captions: the narration's own "text", cut at sentence ends into cues of at most ~170 characters, timed across the scene's speech in proportion to length
export function captionCues(text, startS, endS) {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+(?:["”’)]*)|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  const cues = []; let cur = "";
  for (const s of sentences) { if (cur && (cur + " " + s).length > 170) { cues.push(cur); cur = s; } else cur = cur ? cur + " " + s : s; }
  if (cur) cues.push(cur);
  const total = cues.reduce((a, c) => a + c.length, 0); let t = startS;
  return cues.map((c) => { const d = ((endS - startS) * c.length) / total; const o = { text: c, from: t, to: t + d }; t += d; return o; });
}
