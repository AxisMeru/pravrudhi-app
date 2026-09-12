'use strict';
// The pass/fail bar every packaged smoke holds a build to, shared across platforms (smoke-dist.js for Linux,
// smoke-dist-windows.js for Windows) so a new check only needs adding here once to gate every platform,
// rather than each script keeping its own copy of the same condition to drift out of step.
function assertSmokeReport(report, {wanted, timedOut, code, signal}) {
  if (timedOut || code !== 0 || report.launched !== true || report.engine_found !== true || report.health_ok !== true || !report.engine_url || !report.page_title || !Array.isArray(report.errors) || report.errors.length) {
    throw new Error(timedOut ? 'Launch timed out.' : report.errors?.join('; ') || `Packaged app exited ${signal || code} without a successful report.`);
  }
  // The edition is what makes these two builds different installs rather than two copies of one. It has
  // been got wrong twice by build configuration that looked correct, so the packaged app is made to say
  // which it is and this refuses a build that came back as the other one.
  if (report.edition !== wanted) {
    throw new Error(`Built the ${wanted} edition but the packaged app ran as ${report.edition ?? 'nothing'}.`);
  }
  // A packaged product build with nowhere to say it received real Supabase configuration is exactly
  // the 2026-09-12 w3 finding: the installer builds, launches, finds an engine — and only ever shows
  // "not configured". Refusing this here turns that into a build failure instead of something a real
  // user discovers first.
  if (wanted === 'product' && report.signin_state !== 'configured') {
    throw new Error(`Product build's signin_state was '${report.signin_state}', not 'configured' — desktop/edition.json (or SUPABASE_URL/SUPABASE_ANON_KEY) did not reach the packaged app.`);
  }
  // signin_state is the desktop main process's own auth module, not the frontend bundle the window actually
  // shows — the two disagreed once already (a release built the frontend with no NEXT_PUBLIC_SUPABASE_URL/
  // ANON_KEY at all, so /signin always rendered "not configured" regardless of what signin_state said).
  // signin_state alone could not have caught that; this looks at what /signin actually rendered.
  if (wanted === 'product' && report.signin_state === 'configured') {
    const form = report.signin_form;
    if (!form || form.form_present !== true || form.not_configured_shown) {
      throw new Error(`/signin did not render its sign-in form even though signin_state was 'configured': ${JSON.stringify(form)}`);
    }
  }
}
module.exports = {assertSmokeReport};
