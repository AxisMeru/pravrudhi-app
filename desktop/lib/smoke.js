'use strict';
const {writeState} = require('./core');
// `edition` is recorded rather than asserted here, so the packaged smoke can check that a Studio build
// actually ran as Studio — the one thing that distinguishes the two installs and the one thing a build
// can silently get wrong. Two earlier attempts did exactly that.
// `signinState` is likewise recorded rather than asserted: whether a packaged build ever actually received
// real Supabase configuration is exactly the thing the edition itself got silently wrong twice (lib/edition.js).
// A build with no sign-in surface at all (Studio) has nothing to say here, so an absent value is
// 'not-applicable' rather than a false 'unconfigured'.
function createSmokeReporter(file, {write = writeState, edition = null, signinState = null} = {}) {
  const report = {launched:false,engine_found:false,engine_url:null,page_title:null,health_ok:false,edition,signin_state:signinState ?? 'not-applicable',errors:[]};
  const save = () => { write(file,report); return report.errors.length ? 1 : 0; };
  return {
    launched: () => { report.launched = true; },
    engine: origin => { report.engine_found = true; report.engine_url = origin; },
    // The nightly's own fields (signed_in, workspace, run_id, run_events, run_status), added only when the
    // driven scenario actually runs — an ordinary packaged-smoke run that never calls this keeps the exact
    // report shape it always had, so it stays a plain merge rather than reserved keys on every report.
    nightly: patch => { Object.assign(report, patch); },
    // What /signin actually rendered, checked whenever signin_state is 'configured' — a genuinely separate
    // claim from signin_state itself (that's the desktop main process's own auth module; this is the DOM the
    // window shows), and the two disagreed once already: a release shipped with signin_state 'configured' but
    // a frontend bundle built with no Supabase env vars at all, so /signin always showed "not configured"
    // regardless. Added only when the check actually runs, same reasoning as `nightly` above.
    signinForm: result => { report.signin_form = result; },
    async finish({getTitle,health}) {
      try {
        report.page_title = await getTitle();
        report.health_ok = (await health())?.ok === true;
        if (!report.launched) throw new Error('Main window did not finish loading.');
        if (!report.engine_found || !report.engine_url) throw new Error('No engine found.');
        if (!report.page_title) throw new Error('Engine page has no title.');
        if (!report.health_ok) throw new Error('Engine health was not ok.');
      } catch (error) { report.errors.push(error.message); }
      return save();
    },
    async fail(error) { report.errors.push(error.message || String(error)); return save(); }
  };
}
module.exports = {createSmokeReporter};
