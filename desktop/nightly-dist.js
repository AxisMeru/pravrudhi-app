'use strict';
// The desktop half of the nightly (deploy/e2e-nightly's Studio-side wrapper runs this, on this box, on the
// pravrudhi-e2e-nightly.timer schedule): fetch the latest *released* Linux AppImage, verify it against the
// release's own checksums, install the engine version that release was built against, and drive a real
// sign-in / default-workspace / one-run scenario against it — proving the shell a real person actually
// installs, not this checkout's own build.
//
// The claim this makes, precisely, because it is easy to overstate: real account, real Supabase-validated
// auth, a released shell — but a fresh local engine root, never the hosted product engine's own data. The
// desktop cannot reach the hosted engine at all (lib/connection.js's loopbackOrigin refuses any non-loopback
// origin, by design — the product is a shell over the user's own hardware, not a client for a remote one); the
// web nightly (pravrudhi-app/e2e/live.spec.ts) is what proves the hosted engine.
const {spawn, spawnSync, execFileSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const {createSmokeReporter} = require('./lib/smoke');
const {terminateGroup} = require('./lib/lifecycle');

const REPO = 'AxisMeru/pravrudhi-app';
const ENGINE_REPO = 'AxisMeru/pravrudhi';
const GITHUB_API = 'https://api.github.com';
const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pravrudhi-desktop-nightly-'));
const reportDir = process.env.PRAVRUDHI_NIGHTLY_REPORT_DIR
  || path.join(os.homedir(), '.local/share/pravrudhi-hosted/e2e');

function authHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.PRAVRUDHI_GITHUB_TOKEN_AXISMERU || '';
  return token ? {Authorization: `Bearer ${token}`} : {};
}

async function githubJSON(url) {
  const res = await fetch(url, {headers: {Accept: 'application/vnd.github+json', ...authHeaders()}});
  if (!res.ok) throw new Error(`GitHub API ${url} answered ${res.status}`);
  return res.json();
}

async function download(url, dest) {
  const res = await fetch(url, {headers: authHeaders()});
  if (!res.ok) throw new Error(`Download ${url} answered ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// The engine version this release's shell expects, read from the exact tagged commit (not this checkout's own
// HEAD, which may have moved since the release was cut) via `git show`, so no network call beyond git's own
// fetch is needed for a value already reachable from history.
function engineVersionAtTag(tag) {
  const repoRoot = path.resolve(__dirname, '..');
  try {
    execFileSync('git', ['fetch', '--quiet', 'origin', `refs/tags/${tag}:refs/tags/${tag}`], {cwd: repoRoot, stdio: 'ignore'});
  } catch { /* the tag may already be present locally */ }
  return execFileSync('git', ['show', `${tag}:engine/ENGINE_VERSION`], {cwd: repoRoot}).toString().trim();
}

// Mirrors scripts/install-engine.sh's own wheel-install logic, parameterised by an explicit version rather
// than reading engine/ENGINE_VERSION from this checkout — the nightly installs whatever the *release* was
// pinned to, which is not necessarily what main carries today.
async function installEngine(version, venvDir) {
  const release = await githubJSON(`${GITHUB_API}/repos/${ENGINE_REPO}/releases/tags/v${version}`);
  const wheelUrl = pattern => (release.assets || []).map(a => a.browser_download_url).find(u => pattern.test(u));
  const kernelWheel = wheelUrl(/pravrudhi[_-]kernel[^/]*\.whl$/);
  const engineWheel = wheelUrl(new RegExp(`pravrudhi-${version.replace(/\./g, '\\.')}[^/]*\\.whl$`));
  if (!kernelWheel || !engineWheel) throw new Error(`Release v${version} of ${ENGINE_REPO} is missing a kernel or engine wheel.`);
  fs.mkdirSync(path.dirname(venvDir), {recursive: true});
  const hasUv = !spawnSync('uv', ['--version'], {stdio: 'ignore'}).error;
  execFileSync(hasUv ? 'uv' : 'python3', hasUv ? ['venv', venvDir] : ['-m', 'venv', venvDir], {stdio: 'inherit'});
  const install = wheel => hasUv
    ? execFileSync('uv', ['pip', 'install', '--python', path.join(venvDir, 'bin/python'), wheel], {stdio: 'inherit'})
    : execFileSync(path.join(venvDir, 'bin/python'), ['-m', 'pip', 'install', '--quiet', wheel], {stdio: 'inherit'});
  install(kernelWheel);
  install(engineWheel);
}

function launchPackaged(appImagePath, env, smokeDir) {
  fs.chmodSync(appImagePath, 0o755);
  const hasXvfb = !spawnSync('xvfb-run', ['--help'], {stdio: 'ignore'}).error;
  const args = ['--appimage-extract-and-run', '--no-sandbox', '--disable-dev-shm-usage'];
  const fullEnv = {...env};
  if (!hasXvfb) { fullEnv.ELECTRON_DISABLE_GPU = '1'; args.push('--headless', '--ozone-platform=headless', '--disable-gpu'); }
  return new Promise((resolve) => {
    const child = spawn(hasXvfb ? 'xvfb-run' : appImagePath, hasXvfb ? ['-a', appImagePath, ...args] : args,
      {env: fullEnv, cwd: smokeDir, stdio: 'inherit', detached: true});
    const timer = setTimeout(() => terminateGroup(child, {grace: 5000}).catch(() => {}), 180000);
    child.once('close', () => { clearTimeout(timer); resolve(); });
    child.once('error', () => { clearTimeout(timer); resolve(); });
  });
}

async function main() {
  console.log(`Scratch directory: ${scratchRoot}`);

  console.log('Looking up the latest release...');
  const release = await githubJSON(`${GITHUB_API}/repos/${REPO}/releases/latest`);
  const tag = release.tag_name;
  const appImageAsset = (release.assets || []).find(a => a.name.endsWith('.AppImage'));
  const checksumsAsset = (release.assets || []).find(a => a.name === 'SHA256SUMS');
  if (!appImageAsset) throw new Error(`Release ${tag} has no .AppImage asset.`);
  if (!checksumsAsset) throw new Error(`Release ${tag} has no SHA256SUMS asset.`);
  console.log(`Release ${tag}: ${appImageAsset.name}`);

  const appImagePath = path.join(scratchRoot, appImageAsset.name);
  const checksumsPath = path.join(scratchRoot, 'SHA256SUMS');
  await download(appImageAsset.browser_download_url, appImagePath);
  await download(checksumsAsset.browser_download_url, checksumsPath);

  const checksumLine = fs.readFileSync(checksumsPath, 'utf8').split('\n').find(l => l.trim().endsWith(appImageAsset.name));
  if (!checksumLine) throw new Error(`SHA256SUMS has no line for ${appImageAsset.name}.`);
  const expected = checksumLine.trim().split(/\s+/)[0];
  const actual = sha256(appImagePath);
  if (actual !== expected) throw new Error(`Checksum mismatch for ${appImageAsset.name}: expected ${expected}, got ${actual}.`);
  console.log(`Checksum verified: ${actual}`);

  const engineVersion = engineVersionAtTag(tag);
  console.log(`Release ${tag} is pinned to engine v${engineVersion}.`);
  const venvDir = path.join(scratchRoot, 'engine/.venv');
  await installEngine(engineVersion, venvDir);

  const workspaceRoot = path.join(scratchRoot, 'workspace');
  fs.mkdirSync(workspaceRoot, {recursive: true});
  execFileSync(path.join(venvDir, 'bin/pravrudhi'), ['init'], {cwd: workspaceRoot, stdio: 'inherit'});

  const smokeDir = path.join(scratchRoot, 'smoke');
  fs.mkdirSync(smokeDir, {recursive: true});
  const reportFile = path.join(smokeDir, '.smoke/report.json');

  const env = {
    ...process.env,
    PATH: `${path.join(venvDir, 'bin')}:${process.env.PATH}`,
    ELECTRON_ENABLE_LOGGING: '1',
    PRAVRUDHI_DESKTOP_SMOKE: '1',
    PRAVRUDHI_DESKTOP_NIGHTLY: '1',
    PRAVRUDHI_DESKTOP_SMOKE_DIR: smokeDir,
    PRAVRUDHI_WORKSPACE: workspaceRoot,
    PRAVRUDHI_AUTH: 'required',
    SUPABASE_URL: process.env.SUPABASE_URL,
  };
  if (!env.SUPABASE_URL) throw new Error('SUPABASE_URL must be set (see ~/.config/pravrudhi/supabase.env) — the engine cannot verify a real token without it.');
  if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) throw new Error('E2E_EMAIL and E2E_PASSWORD must both be set (see ~/.config/pravrudhi/e2e.env).');

  console.log('Launching the packaged shell...');
  await launchPackaged(appImagePath, env, smokeDir);

  if (!fs.existsSync(reportFile)) throw new Error('The packaged shell never wrote a report — it likely crashed before finishing.');
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.mkdirSync(reportDir, {recursive: true});
  const outPath = path.join(reportDir, `desktop-nightly-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify({
    claim: 'real account, real auth, released shell, fresh local root — not the hosted engine\'s data',
    ran_at: new Date().toISOString(),
    release_tag: tag,
    appimage: appImageAsset.name,
    appimage_sha256: actual,
    engine_version: engineVersion,
    report,
  }, null, 2));
  console.log(`Report written to ${outPath}`);

  const ok = report.errors.length === 0 && report.launched === true && report.engine_found === true
    && report.health_ok === true && report.edition === 'product' && report.signin_state === 'configured'
    && report.signed_in === true && report.workspace_bootstrapped === true && !!report.run_id
    && (report.run_events > 0 || report.run_status !== 'running');
  if (!ok) {
    console.error(`Desktop nightly failed: ${JSON.stringify(report)}`);
    process.exitCode = 1;
  } else {
    console.log(`Desktop nightly passed: signed in, workspace "default" bootstrapped, run ${report.run_id} reached ${report.run_events} event(s) (status: ${report.run_status}).`);
  }
}

main()
  .catch(error => { console.error(`Desktop nightly failed: ${error.message}`); process.exitCode = 1; })
  .finally(() => { try { fs.rmSync(scratchRoot, {recursive: true, force: true}); } catch { /* best effort */ } });
