import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

// Exercise the actual request handler, replacing only Supabase's network client.
export async function runTests() {
  const source = await readFile(new URL('../supabase/functions/trip-api/index.ts', import.meta.url), 'utf8');
  const js = stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm, ''));
  const original = { trip_id: 'trip-1', eyebrow: 'Antes', title: 'Título', subtitle: 'Subtítulo',
    photo_credit: 'Crédito', background_url: 'storage://trip-backgrounds/trip-1/old.png',
    updated_at: '2026-09-08T12:00:00+00:00', start_at: '2026-01-01T00:00:00Z',
    default_arrival_at: '2027-01-10T05:00:00Z', default_timezone: 'America/New_York' };
  async function request(options = {}) {
    let handler;
    const writes = [], uploads = [], removed = [];
    const settings = { ...original };
    const profile = { user_id: 'user-1', system_access_enabled: options.enabled !== false,
      is_system_owner: options.owner || false, must_change_password: options.mustChange || false };
    const client = {
      auth: { getUser: async () => ({ data: { user: options.invalidUser ? null : { id: 'user-1' } } }) },
      rpc: async () => ({ data: options.sessionActive !== false }),
      storage: { from: () => ({
        upload: async (path) => { uploads.push(path); return {}; },
        remove: async (paths) => { removed.push(...paths); return {}; },
        createSignedUrl: async () => ({ data: { signedUrl: 'https://example.com/signed' } }),
      }) },
      from(table) {
        const filters = []; let patch;
        const query = {
          select() { return query; },
          eq(key, value) { filters.push([key, value]); return query; },
          order() { return query; },
          update(value) { patch = value; return query; },
          maybeSingle() { return query; },
          then(resolve, reject) {
            try {
              let data;
              if (table === 'profiles') data = profile;
              if (table === 'trips') data = options.missingTrip ? null : { id: 'trip-1', slug: 'orlando-2027' };
              if (table === 'trip_members') data = options.noMembership ? null : { role_id: 2 };
              if (table === 'permissions') data = ['trip.view', 'trip.edit', 'members.manage'].map(code => ({ code }));
              if (table === 'role_permissions') data = (options.permissions || ['trip.view', 'trip.edit']).map(code => ({ permissions: { code } }));
              if (table === 'trip_settings') {
                data = options.missingSettings ? null : { ...settings };
                if (patch) {
                  assert.deepEqual(filters, [['trip_id', 'trip-1'], ['updated_at', original.updated_at]]);
                  if (options.updateError) return resolve({ error: new Error('DB unavailable') });
                  if (options.conflict) data = null;
                  else { writes.push(patch); Object.assign(settings, patch); }
                }
              }
              return resolve({ data });
            } catch (error) { return reject(error); }
          },
        };
        return query;
      },
    };
    vm.runInNewContext(js, {
      createClient: () => client, Deno: { env: { get: key => key === 'SUPABASE_URL' ? 'https://example.com' : '{"default":"test"}' }, serve: fn => { handler = fn; } },
      Request, Response, atob, Uint8Array, crypto: { randomUUID: () => 'new-image' }, console: { warn() {}, error() {} },
    });
    const claims = Buffer.from(JSON.stringify({ session_id: 'session-1', sub: options.wrongSubject ? 'other-user' : 'user-1' })).toString('base64url');
    const body = { action: 'trip-settings-update', slug: 'orlando-2027', eyebrow: '', title: ' Nuevo título ',
      subtitle: '', photoCredit: '', updatedAt: original.updated_at, ...options.body };
    const response = await handler(new Request('https://example.com/functions/v1/trip-api', {
      method: 'POST', headers: options.noAuth ? {} : { Authorization: `Bearer test.${claims}.signature` }, body: JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json(), writes, uploads, removed, settings };
  }
  let count = 0;
  async function check(options, expected) { const result = await request(options); assert.equal(result.status, expected, JSON.stringify(result.body)); count++; return result; }
  for (const options of [{}, { owner: true, noMembership: true }, { permissions: ['trip.view', 'trip.edit', 'members.manage'] }]) {
    const result = await check(options, 200);
    assert.equal(result.settings.title, 'Nuevo título');
    for (const key of ['start_at', 'default_arrival_at', 'default_timezone', 'background_url']) assert.equal(result.settings[key], original[key]);
    assert.notEqual(result.settings.updated_at, original.updated_at);
  }
  for (const options of [{ noAuth: true }, { invalidUser: true }, { sessionActive: false }, { wrongSubject: true }]) {
    assert.equal((await check(options, 401)).writes.length, 0);
  }
  for (const options of [{ enabled: false }, { permissions: ['trip.view'] }, { noMembership: true }, { mustChange: true }]) {
    assert.equal((await check(options, 403)).writes.length, 0);
  }
  for (const body of [{ title: '  ' }, { title: 'x'.repeat(201) }, { eyebrow: 123 }, { subtitle: 'x'.repeat(501) }, { photoCredit: 'x'.repeat(301) },
    { removeBackground: 'true' }, { backgroundImage: { contentType: 'image/png', contentBase64: 'bm90IGEgcG5n' } },
    { backgroundImage: { contentType: 'image/svg+xml', contentBase64: 'PHN2Zz4=' } },
    { backgroundImage: { contentType: 'image/png', contentBase64: 'a'.repeat(Math.ceil(4 * 1024 * 1024 * 4 / 3) + 9) } }]) {
    assert.equal((await check({ body }, 400)).writes.length, 0);
  }
  await check({ missingTrip: true }, 404);
  await check({ missingSettings: true }, 404);
  await check({ body: { updatedAt: 'stale' } }, 409);
  const image = { contentType: 'image/png', contentBase64: 'iVBORw0KGgo=' };
  const replaced = await check({ body: { backgroundImage: image } }, 200);
  assert.equal(replaced.settings.background_url, 'storage://trip-backgrounds/trip-1/new-image.png');
  assert.deepEqual(replaced.removed, ['trip-1/old.png']);
  const cleared = await check({ body: { removeBackground: true } }, 200);
  assert.equal(cleared.settings.background_url, null);
  assert.deepEqual(cleared.removed, ['trip-1/old.png']);
  await check({ body: { removeBackground: true, backgroundImage: image } }, 400);
  for (const [options, status] of [[{ conflict: true }, 409], [{ updateError: true }, 500]]) {
    const failed = await check({ ...options, body: { backgroundImage: image } }, status);
    assert.deepEqual(failed.removed, ['trip-1/new-image.png']);
    assert.equal(failed.settings.background_url, original.background_url);
  }
  const detail = await check({ body: { action: 'trip-detail' } }, 200);
  assert.equal(detail.body.settings.updatedAt, original.updated_at);
  assert.equal(detail.body.settings.backgroundUrl, 'https://example.com/signed');
  const injection = await check({ body: { defaultArrivalAt: '2099-01-01', default_timezone: 'UTC', startAt: '2090-01-01', background_url: 'https://evil.invalid' } }, 200);
  assert.equal(injection.settings.default_arrival_at, original.default_arrival_at);
  assert.equal(injection.settings.default_timezone, original.default_timezone);
  assert.equal(injection.settings.background_url, original.background_url);
  return `${count} API cases passed`;
}
