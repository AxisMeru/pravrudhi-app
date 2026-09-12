'use strict';
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const os = require('node:os');
// A Windows venv (uv's or the stdlib's) lays out its binaries in Scripts/ with a .exe suffix; a POSIX one
// uses bin/ with none -- the same asymmetry scripts/install-engine.sh already handles for the real installer.
// Offer both shapes for every release-layout candidate rather than assuming the OS: what matters is what the
// venv actually created on disk, and this repository already has one answer to that question.
function venvCandidates(venvDir, pathImpl) {
  return [pathImpl.join(venvDir, 'bin', 'pravrudhi'), pathImpl.join(venvDir, 'Scripts', 'pravrudhi.exe')];
}
async function defaultExecutableCheck(p, {platform = process.platform, access = fs.promises.access, stat = fs.promises.stat} = {}) {
  if (platform !== 'win32') {
    // On POSIX this bit is real and meaningful: a file without it (mode 0600, say) must not be treated as
    // the engine binary even though it exists.
    try { await access(p, fs.constants.X_OK); } catch { return false; }
  }
  // Windows has no POSIX execute-permission bit, so X_OK there checks little beyond existence and cannot be
  // trusted to gate on "executable" the way it does on POSIX -- a plain existence+regular-file check is what
  // actually determines whether this binary would run, and is all `access(X_OK)` would have told us anyway.
  try { return (await stat(p)).isFile(); } catch { return false; }
}
// `pathImpl` defaults to the real, OS-bound `path` module -- Node already picks path.win32's semantics for
// this function's own runtime on an actual Windows machine, which is the only place this ever really has to
// work. It is a parameter (rather than always `require('node:path')` directly) purely so a test on any OS can
// inject `path.win32` and exercise genuine Windows PATH-delimiter and separator behaviour -- a Windows drive
// letter's `:` collides with the POSIX PATH delimiter, so path.posix cannot stand in for it.
async function discoverEngine({env = process.env, home = os.homedir(), saved, executable = defaultExecutableCheck, pathImpl = path} = {}) {
  const pathDirs = (env.PATH || '').split(pathImpl.delimiter).filter(Boolean);
  const candidates = [
    env.PRAVRUDHI_BIN,
    ...pathDirs.flatMap(p => [pathImpl.join(p, 'pravrudhi'), pathImpl.join(p, 'pravrudhi.exe')]),
    ...venvCandidates(pathImpl.join(home, 'pravrudhi-release/.pravrudhi/releases/current/.venv'), pathImpl),
    pathImpl.join(home, '.local/bin/pravrudhi'), saved,
    ...venvCandidates(pathImpl.join(home, 'pravrudhi/.pravrudhi/releases/current/.venv'), pathImpl),
  ];
  for (const p of [...new Set(candidates.filter(Boolean))]) if (await executable(p)) return pathImpl.resolve(p);
  return null;
}
function freePort(createServer = net.createServer) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(err => err ? reject(err) : resolve(port)); });
  });
}
async function pollHealth(url, {fetchFn = fetch, timeout = 30000, interval = 250, signal, now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms))} = {}) {
  const deadline = now() + timeout;
  while (now() < deadline) {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, {once: true});
    let timer;
    try {
      const result = await Promise.race([
        (async () => { const response = await fetchFn(url, {signal: controller.signal}); return response.ok && await response.json(); })(),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Health request timed out')); }, Math.min(1000, deadline - now())); })
      ]);
      if (result?.ok === true) return result;
    } catch { signal?.throwIfAborted(); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    await sleep(Math.max(0, Math.min(interval, deadline - now())));
  }
  throw new Error('The engine did not become healthy within 30 seconds.');
}
function parseDoctor(output) {
  const value = JSON.parse(output);
  if (!Array.isArray(value.checks) || value.checks.some(c => typeof c.name !== 'string' || typeof c.ok !== 'boolean' || typeof c.detail !== 'string')) throw new Error('Invalid doctor output: expected named checks with ok and detail.');
  return value.checks;
}
function linkPolicy(url, origin) {
  try { const u = new URL(url); if (!['http:', 'https:'].includes(u.protocol)) return 'deny'; return u.origin === origin ? 'internal' : 'external'; } catch { return 'deny'; }
}
function readState(file) { try { const value = JSON.parse(fs.readFileSync(file, 'utf8')); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; } }
function writeState(file, value) { fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(`${file}.tmp`, JSON.stringify(value)); fs.renameSync(`${file}.tmp`, file); }
function validBounds(b) { return b && ['x','y','width','height'].every(k => Number.isFinite(b[k])) && b.width >= 640 && b.height >= 480; }
module.exports = {discoverEngine, defaultExecutableCheck, freePort, pollHealth, parseDoctor, linkPolicy, readState, writeState, validBounds};
