'use strict';
// The Windows twin of smoke-dist.js, at the same bar: launch the packaged build, find a real engine, get a
// healthy response, the right edition, real Supabase configuration reaching both the desktop shell and the
// frontend bundle it serves (see lib/smoke-assert.js — same shared assertion both scripts hold builds to).
//
// electron-builder's Windows `zip` target is the portable equivalent of the Linux AppImage: an unpacked
// directory zipped as-is, runnable directly with no installer step (unlike the `nsis` target, which needs a
// silent install this environment has no reason to perform). Windows 10/Server 2019+ ships a bundled bsdtar
// at %SystemRoot%\System32\tar.exe that understands .zip, so nothing extra needs installing on the runner —
// but a bare `tar` on PATH is not reliable: on a GitHub Windows runner, Git for Windows puts its own GNU tar
// ahead of System32 on PATH, and GNU tar parses a `D:\a\...` extraction path as a `host:path` remote spec
// ("tar: Cannot connect to D: resolve failed") instead of extracting locally. Invoke System32's tar.exe by
// absolute path so this can't happen again, and verify at runtime that it really is bsdtar rather than
// silently accepting whatever binary answers to that path.
const {spawn, execFileSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {createSmokeReporter} = require('./lib/smoke');
const {terminateGroup} = require('./lib/lifecycle');
const {assertSmokeReport} = require('./lib/smoke-assert');

const wanted = (process.argv[2] || 'product').trim().toLowerCase();
const distDir = path.join(__dirname, 'dist', wanted);
const zipName = fs.existsSync(distDir) ? fs.readdirSync(distDir).find(f => f.endsWith('.zip')) : null;
const smokeDir = path.join(__dirname, '.smoke-dist-windows');
const extractDir = path.join(smokeDir, 'extracted');
const reportFile = path.join(smokeDir, '.smoke/report.json');

const failure = async error => {
  console.error(`Packaged desktop smoke (Windows) failed: ${error.message}`);
  await createSmokeReporter(reportFile).fail(error);
  process.exitCode = 1;
};

// %SystemRoot% is always set on Windows; System32\tar.exe is the bundled bsdtar this script depends on.
const systemTar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');

function assertBsdtar(tarPath) {
  let versionOutput;
  try {
    versionOutput = execFileSync(tarPath, ['--version'], {encoding: 'utf8'});
  } catch (error) {
    throw new Error(`Could not run ${tarPath} --version: ${error.message}`);
  }
  if (!/bsdtar/i.test(versionOutput)) {
    throw new Error(
      `${tarPath} did not report itself as bsdtar (got: ${versionOutput.trim().split('\n')[0]}). ` +
      'This script depends on Windows\' bundled bsdtar to extract a .zip; a GNU tar here would silently ' +
      'misparse the extraction path as a remote host spec instead of failing obviously, so refusing rather ' +
      'than guessing.'
    );
  }
}

// Depth-first search for the packaged .exe rather than assuming a fixed layout: electron-builder's zip target
// has shipped both a flat directory and a single top-level folder across versions, and asserting the exact
// shape here would be one more thing to keep in sync with a build tool this repository does not control.
function findExe(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findExe(full);
      if (found) return found;
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.exe') && !/uninstall/i.test(entry.name)) {
      return full;
    }
  }
  return null;
}

async function main() {
  if (!zipName) throw new Error(`No .zip found in dist/${wanted}/. Run \`npm run dist:win\` first.`);
  fs.rmSync(smokeDir, {recursive: true, force: true});
  fs.mkdirSync(extractDir, {recursive: true});
  assertBsdtar(systemTar);
  execFileSync(systemTar, ['-xf', path.join(distDir, zipName), '-C', extractDir], {stdio: 'inherit'});
  const exePath = findExe(extractDir);
  if (!exePath) throw new Error(`No .exe found after extracting ${zipName}.`);
  fs.mkdirSync(path.dirname(reportFile), {recursive: true});

  const env = {...process.env, ELECTRON_ENABLE_LOGGING: '1', PRAVRUDHI_DESKTOP_SMOKE: '1', PRAVRUDHI_DESKTOP_SMOKE_DIR: smokeDir};
  // No sandbox/Xvfb concerns here (Windows has neither the Linux SUID sandbox nor a missing display server),
  // but a CI runner's GPU drivers are not something to depend on either way.
  const args = ['--disable-gpu'];
  const child = spawn(exePath, args, {env, cwd: smokeDir, stdio: 'inherit', detached: false});
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; terminateGroup(child, {grace: 5000}).catch(error => console.error(error)); }, 120000);
  const forward = () => terminateGroup(child, {grace: 5000}).catch(error => console.error(error));
  process.once('SIGINT', forward); process.once('SIGTERM', forward);
  await new Promise(resolve => {
    child.once('error', async error => { clearTimeout(timer); await failure(error); resolve(); });
    child.once('close', async (code, signal) => {
      clearTimeout(timer); process.removeListener('SIGINT', forward); process.removeListener('SIGTERM', forward);
      try {
        const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
        assertSmokeReport(report, {wanted, timedOut, code, signal});
        console.log(`Packaged ${wanted} app (Windows) loaded ${report.engine_url}: ${report.page_title}`);
        process.exitCode = 0;
      } catch (error) {
        if (fs.existsSync(reportFile)) { console.error(`Packaged desktop smoke (Windows) failed: ${error.message}`); process.exitCode = 1; }
        else await failure(new Error(timedOut ? 'Launch timed out before reporting.' : `Packaged app exited ${signal || code}: ${error.message}`));
      }
      resolve();
    });
  });
}
main().catch(failure);
