'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createAuth} = require('../lib/auth');
const {createProduct} = require('../lib/product');
const {createApiClient} = require('../lib/api');

// Mock API client factory
function makeApi(overrides = {}) {
  return {
    me: async () => ({authenticated: true, id: 'user-1'}),
    workspaces: async () => ({workspaces: [{slug: 'mine', path: '/ws/mine'}]}),
    createWorkspace: async ({body}) => ({slug: body.slug}),
    objectives: async () => ({objectives: [], problems: []}),
    createObjective: async () => ({}),
    ...overrides,
  };
}

// Mock IPC handlers factory
function createIpcHandlers({auth, product, api}) {
  return {
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
  };
}

test('IPC handlers for auth and product operations are created correctly', async () => {
  const auth = createAuth({
    url: 'https://project.supabase.co',
    key: 'anon-key',
    fetchFn: async () => ({ok: true, json: async () => ({
      access_token: 'at-1',
      refresh_token: 'rt-1',
      expires_in: 3600,
      user: {id: 'u-1', email: 'a@b.c'}
    })})
  });

  const product = createProduct({
    api: makeApi(),
    auth,
    selectWorkspace: async () => {}
  });

  const handlers = createIpcHandlers({auth, product, api: makeApi()});

  // Verify all handlers are present
  assert.ok(handlers['auth:status']);
  assert.ok(handlers['auth:sign-in']);
  assert.ok(handlers['auth:sign-out']);
  assert.ok(handlers['product:workspaces']);
  assert.ok(handlers['product:choose-workspace']);
  assert.ok(handlers['product:artifacts']);
  assert.ok(handlers['product:create-artifact']);
  assert.ok(handlers['product:band-levels']);
  assert.ok(handlers['product:band-for']);
  assert.ok(handlers['product:choose-band']);
  assert.ok(handlers['product:create-workspace']);
});

test('auth status handler works correctly', async () => {
  const auth = createAuth({url: 'http://invalid', key: ''});
  const handlers = createIpcHandlers({auth, product: createProduct({api: makeApi(), auth, selectWorkspace: async () => {}}), api: makeApi()});

  const status = await handlers['auth:status']();
  assert.equal(status.configured, false);
  assert.equal(status.user, null);
});

test('sign-in handler updates auth status', async () => {
  const auth = createAuth({
    url: 'https://project.supabase.co',
    key: 'anon-key',
    fetchFn: async () => ({ok: true, json: async () => ({
      access_token: 'at-1',
      refresh_token: 'rt-1',
      expires_in: 3600,
      user: {id: 'u-1', email: 'a@b.c'}
    })})
  });

  const handlers = createIpcHandlers({auth, product: createProduct({api: makeApi(), auth, selectWorkspace: async () => {}}), api: makeApi()});

  const result = await handlers['auth:sign-in'](null, {email: 'a@b.c', password: 'pw'});
  assert.equal(result.user.email, 'a@b.c');

  const status = await handlers['auth:status']();
  assert.equal(status.user.email, 'a@b.c');
});

test('sign-out handler clears auth', async () => {
  const auth = createAuth({
    url: 'https://project.supabase.co',
    key: 'anon-key',
    fetchFn: async () => ({ok: true, json: async () => ({
      access_token: 'at-1',
      refresh_token: 'rt-1',
      expires_in: 3600,
      user: {id: 'u-1', email: 'a@b.c'}
    })})
  });

  const handlers = createIpcHandlers({auth, product: createProduct({api: makeApi(), auth, selectWorkspace: async () => {}}), api: makeApi()});

  await handlers['auth:sign-in'](null, {email: 'a@b.c', password: 'pw'});
  let status = await handlers['auth:status']();
  assert.equal(status.user.email, 'a@b.c');

  handlers['auth:sign-out']();
  status = await handlers['auth:status']();
  assert.equal(status.user, null);
});

test('product handlers require authentication', async () => {
  const auth = createAuth({url: 'http://invalid', key: ''});
  const handlers = createIpcHandlers({auth, product: createProduct({api: makeApi(), auth, selectWorkspace: async () => {}}), api: makeApi()});

  await assert.rejects(handlers['product:workspaces'](), /Sign in/);
});

test('product handlers work after authentication', async () => {
  const auth = createAuth({
    url: 'https://project.supabase.co',
    key: 'anon-key',
    fetchFn: async () => ({ok: true, json: async () => ({
      access_token: 'at-1',
      refresh_token: 'rt-1',
      expires_in: 3600,
      user: {id: 'u-1', email: 'a@b.c'}
    })})
  });

  const product = createProduct({
    api: makeApi({me: async () => ({authenticated: true, id: 'u-1'})}),
    auth,
    selectWorkspace: async () => {}
  });
  const handlers = createIpcHandlers({auth, product, api: makeApi()});

  await handlers['auth:sign-in'](null, {email: 'a@b.c', password: 'pw'});
  const workspaces = await handlers['product:workspaces']();

  assert.ok(Array.isArray(workspaces));
  assert.equal(workspaces.length, 1);
  assert.equal(workspaces[0].slug, 'mine');
});

test('API client receives bearer token from auth', async () => {
  let capturedHeaders = null;

  const auth = createAuth({
    url: 'https://project.supabase.co',
    key: 'anon-key',
    fetchFn: async () => ({ok: true, json: async () => ({
      access_token: 'at-1',
      refresh_token: 'rt-1',
      expires_in: 3600,
      user: {id: 'u-1', email: 'a@b.c'}
    })})
  });

  const api = createApiClient(
    () => 'http://127.0.0.1:8008',
    {
      getToken: () => auth.token(),
      fetchFn: async (url, options) => {
        capturedHeaders = options.headers;
        return {
          ok: true,
          json: async () => ({id: 'u-1'})
        };
      }
    }
  );

  await auth.signIn({email: 'a@b.c', password: 'pw'});
  await api.me();

  assert.ok(capturedHeaders);
  assert.equal(capturedHeaders.Authorization, 'Bearer at-1');
});
