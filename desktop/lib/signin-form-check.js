'use strict';
// What /signin actually renders, checked by every packaged smoke (not just the nightly's driven sign-in):
// signin_state records whether the desktop main process's own auth module (desktop/lib/auth.js, backed by
// desktop/editions/product.json) was configured — a real but separate claim from whether the *frontend
// bundle* the window shows was built with NEXT_PUBLIC_SUPABASE_URL/ANON_KEY baked in at `npm run build` time.
// The two disagreed once already (release.yml built the frontend with neither set, v0.1.2): signin_state said
// 'configured', but /signin always rendered "Sign-in is not configured for this installation" regardless,
// because that page gates on the frontend's own build-time env var, not on anything edition.json carries.
// signin_state alone could never have caught that; only looking at the actual rendered DOM can.
function signinFormCheckScript() {
  return `(async () => {
    const NOT_CONFIGURED = 'Sign-in is not configured for this installation';
    await new Promise((resolve) => {
      const deadline = Date.now() + 15000;
      (function poll() {
        if (document.getElementById('email') || document.body.textContent.includes(NOT_CONFIGURED) || Date.now() >= deadline) return resolve();
        setTimeout(poll, 300);
      })();
    });
    return {
      form_present: !!document.getElementById('email'),
      not_configured_shown: document.body.textContent.includes(NOT_CONFIGURED),
    };
  })()`;
}
module.exports = {signinFormCheckScript};
