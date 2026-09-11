'use strict';
// IPC handlers for auth and product operations. These are exposed through preload.js to the renderer.
const {createAuth} = require('./auth');
const {createProduct} = require('./product');
const {createApiClient} = require('./api');

function createIpcHandlers({getOrigin, selectWorkspace, supabaseUrl, supabaseAnonKey, auth: givenAuth = null}) {
  // main.js owns the auth module when it also drives the browser (OAuth + PKCE) sign-in and persists the
  // refresh token; a caller without that hands nothing and gets a session-only one.
  const auth = givenAuth || createAuth({url: supabaseUrl, key: supabaseAnonKey});

  // Create an API client that uses auth tokens for bearer authentication
  const api = createApiClient(getOrigin, {
    getToken: () => auth.token()
  });

  const product = createProduct({
    api,
    auth,
    selectWorkspace
  });

  return Object.freeze({
    'auth:status': async () => auth.status(),
    'auth:sign-in': async (_event, {email, password}) => auth.signIn({email, password}),
    'auth:sign-out': async () => auth.signOut(),
    'product:workspaces': async () => product.workspaces(),
    'product:choose-workspace': async (_event, slug) => product.choose(slug),
    'product:artifacts': async () => product.artifacts(),
    'product:create-artifact': async (_event, input) => product.create(input),
    'product:band-levels': async () => product.bandLevels(),
    'product:band-for': async (_event, artifactId) => product.bandFor(artifactId),
    'product:choose-band': async (_event, artifactId, levelId) => product.chooseBand(artifactId, levelId),
    'product:create-workspace': async (_event, slug) => product.createWorkspace(slug),
  });
}

module.exports = {createIpcHandlers};
