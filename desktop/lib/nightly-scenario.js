'use strict';
// The nightly's driven scenario, run inside the loaded page itself (executeJavaScript) rather than through IPC:
// this is the real Next.js frontend the engine serves (main.js navigates here the same way for every attached
// engine, packaged or not), so this drives the exact DOM a real signed-in user's browser would. Everything
// after sign-in reuses the page's own session (read from localStorage the same way frontend/src/lib/auth.ts
// stores it) to call the engine directly, rather than reimplementing clicks through /start's multi-step wizard —
// what this proves is that a real account, a real Supabase-validated session and a real run request all work
// end to end from inside a released, packaged shell, not that the wizard's UI is click-tested (the web
// nightly's live.spec.ts already exercises the page rendering itself).
//
// A separate, requireable module rather than an inline string in main.js so its escaping can be tested
// directly (desktop/test/integration.test.js) instead of parsed back out of main.js's own source.
function nightlyScenarioScript({email, password, workspaceSlug}) {
  return `(async () => {
    function setNativeValue(el, value) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', {bubbles: true}));
    }
    async function waitFor(check, {timeout = 20000, interval = 300} = {}) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const value = await check();
        if (value) return value;
        await new Promise(r => setTimeout(r, interval));
      }
      throw new Error('Timed out waiting for: ' + check);
    }
    const result = {signed_in: false, workspace_bootstrapped: false, run_id: null, run_events: null, run_status: null};

    const emailInput = await waitFor(() => document.getElementById('email'));
    const passwordInput = document.getElementById('password');
    const submit = Array.from(document.querySelectorAll('button[type="submit"]')).find(b => b.textContent.trim() === 'Sign in');
    if (!submit) throw new Error('Sign-in button not found — /signin did not render the expected form.');
    setNativeValue(emailInput, ${JSON.stringify(email)});
    setNativeValue(passwordInput, ${JSON.stringify(password)});
    submit.click();
    await waitFor(() => document.body.textContent.includes(${JSON.stringify(email)}));
    result.signed_in = true;

    const session = JSON.parse(localStorage.getItem('pravrudhi-auth-session'));
    const token = session.accessToken;
    const authed = (path, init = {}) => fetch(path, {...init, headers: {...(init.headers || {}), authorization: 'Bearer ' + token}});
    const slug = ${JSON.stringify(workspaceSlug)};

    await waitFor(async () => {
      const res = await authed('/api/workspaces');
      if (!res.ok) return false;
      const body = await res.json();
      return body.workspaces.some(w => w.slug === slug);
    });
    result.workspace_bootstrapped = true;

    // A local engine (this scenario's engine — the hosted one has PRAVRUDHI_DISABLE_LOCAL_GUARD=1, this does
    // not) refuses any state-changing call without its own local token (LocalGuard, api/localguard.py), a
    // second, separate protection from the bearer token above. frontend/src/lib/api.ts's postJSON already
    // fetches and attaches this for every write the real page makes; this scenario drives the engine directly
    // rather than through that module, so it fetches the same token the same way.
    const localTokenRes = await authed('/api/app-token');
    if (!localTokenRes.ok) throw new Error('Fetching the local engine token failed: HTTP ' + localTokenRes.status);
    const localToken = (await localTokenRes.json()).token;
    const authedWrite = (path, init = {}) => authed(path, {...init, headers: {...(init.headers || {}), 'x-pravrudhi-token': localToken}});

    const startRes = await authedWrite('/api/runs?workspace=' + slug, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({target: 'model', budget_gpu_h: 0.02}),
    });
    if (!startRes.ok) throw new Error('Starting a run failed: HTTP ' + startRes.status);
    const started = await startRes.json();
    result.run_id = started.id;

    const detail = await waitFor(async () => {
      const res = await authed('/api/runs/' + started.id + '?workspace=' + slug);
      if (!res.ok) return false;
      const body = await res.json();
      return (body.events > 0 || body.status !== 'running') ? body : false;
    });
    result.run_events = detail.events;
    result.run_status = detail.status;
    if (detail.status === 'running') {
      await authedWrite('/api/runs/' + started.id + '/stop?workspace=' + slug, {method: 'POST'});
    }
    return result;
  })()`;
}
module.exports = {nightlyScenarioScript};
