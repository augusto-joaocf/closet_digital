import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { createAuthFixture, refreshCookie, registration } from './helpers/authFixture.js';

// HTTP/service tests with explicitly test-only repository doubles, independent of
// MySQL. SQL persistence, locking and races belong to the integration suite.
const loginBody = { email: 'joao@example.com', password: registration.password };
const post = (body = {}, extra = {}) => ({ method: 'POST', body, ...extra });
function errorIs(response, status, code) {
  assert.equal(response.status, status, response.text);
  assert.equal(response.body.error.code, code);
  assert.equal(response.headers.get('cache-control'), 'no-store');
}
function assertPublicUser(user) {
  assert.deepEqual(Object.keys(user).sort(), ['avatar_url', 'email', 'id', 'name']);
  assert.equal(user.name, 'Jo\u00e3o Silva');
  assert.equal(user.email, 'joao@example.com');
  assert.equal(user.avatar_url, null);
}

test('register: 201, normalized public user, real bcrypt hash and hashed refresh storage', async (t) => {
  const fixture = await createAuthFixture(t);
  const response = await fixture.register();
  assert.equal(response.status, 201, response.text);
  assertPublicUser(response.body.data.user);
  assert.equal(response.body.data.tokenType, 'Bearer');
  assert.equal(response.body.data.expiresIn, fixture.config.access.expiresIn);
  assert.equal(typeof response.body.data.accessToken, 'string');
  const stored = fixture.rows.users.get(response.body.data.user.id);
  assert.match(stored.password_hash, /^\$2[aby]\$04\$/);
  assert.notEqual(stored.password_hash, registration.password);
  assert.equal(await bcrypt.compare(registration.password, stored.password_hash), true);
  assert.equal(await bcrypt.compare('Senha-errada-123!', stored.password_hash), false);
  const rawRefresh = refreshCookie(response).split('=')[1];
  assert.equal(fixture.tokens.validRefresh(rawRefresh), true);
  assert.equal(fixture.rows.tokens.has(fixture.tokens.hashRefresh(rawRefresh)), true);
  assert.equal(fixture.rows.tokens.has(rawRefresh), false);
  assert.equal(response.text.includes(rawRefresh), false);
  assert.equal(response.text.includes(stored.password_hash), false);
  assert.equal(response.text.includes(registration.password), false);
});

test('register rejects invalid fields, confirmation, unknown fields and bcrypt byte overflow', async (t) => {
  const fixture = await createAuthFixture(t);
  const invalid = [
    [{ ...registration, name: '' }, 'name'],
    [{ ...registration, name: 'a'.repeat(101) }, 'name'],
    [{ ...registration, name: 'Jo\u0000ao' }, 'name'],
    [{ ...registration, email: 'invalid' }, 'email'],
    [{ ...registration, password: 'short', confirmPassword: 'short' }, 'password'],
    [{ ...registration, password: '\u{1f600}'.repeat(19), confirmPassword: '\u{1f600}'.repeat(19) }, 'password'],
    [{ ...registration, password: '12345678\u0000', confirmPassword: '12345678\u0000' }, 'password'],
    [{ ...registration, confirmPassword: 'different' }, 'confirmPassword'],
    [{ name: 'Joao', email: registration.email, password: registration.password }, 'confirmPassword'],
    [{ ...registration, role: 'admin' }, 'form'],
    [[], 'form'],
  ];
  for (const [body, field] of invalid) {
    const response = await fixture.register(body);
    errorIs(response, 422, 'VALIDATION_ERROR');
    assert.equal(typeof response.body.error.fields[field], 'string');
  }
  assert.equal(fixture.rows.users.size, 0);
  assert.equal(fixture.rows.sessions.size, 0);
});

test('register duplicate canonical email and SQL duplicate error become 409', async (t) => {
  const fixture = await createAuthFixture(t);
  assert.equal((await fixture.register()).status, 201);
  errorIs(await fixture.register({ ...registration, email: 'joao@example.com' }), 409, 'EMAIL_IN_USE');
  assert.equal(fixture.rows.users.size, 1);
  fixture.users.insert = async () => { throw Object.assign(new Error('private SQL duplicate details'), { code: 'ER_DUP_ENTRY' }); };
  const raceOutcome = await fixture.register({ ...registration, email: 'another@example.com' });
  errorIs(raceOutcome, 409, 'EMAIL_IN_USE');
  assert.equal(raceOutcome.text.includes('SQL'), false);
});

test('login accepts the password and uses the same public shape', async (t) => {
  const fixture = await createAuthFixture(t);
  await fixture.register();
  const response = await fixture.request('/api/auth/login', post({ ...loginBody, email: ' JOAO@EXAMPLE.COM ' }));
  assert.equal(response.status, 200, response.text);
  assertPublicUser(response.body.data.user);
  assert.ok(refreshCookie(response));
  assert.equal(fixture.rows.sessions.size, 2);
});

test('login wrong password and unknown account return identical generic errors', async (t) => {
  const fixture = await createAuthFixture(t);
  await fixture.register();
  const wrong = await fixture.request('/api/auth/login', post({ ...loginBody, password: 'Wrong-password-123' }));
  const unknown = await fixture.request('/api/auth/login', post({ ...loginBody, email: 'unknown@example.com' }));
  errorIs(wrong, 401, 'INVALID_CREDENTIALS');
  errorIs(unknown, 401, 'INVALID_CREDENTIALS');
  assert.deepEqual(wrong.body, unknown.body);
  assert.equal(wrong.headers.has('set-cookie'), false);
  assert.equal(fixture.rows.sessions.size, 1);
});

test('me accepts Bearer access tokens and exposes only the authenticated public user', async (t) => {
  const fixture = await createAuthFixture(t);
  const registered = await fixture.register();
  const response = await fixture.request('/api/users/me', { headers: { Authorization: `Bearer ${registered.body.data.accessToken}` } });
  assert.equal(response.status, 200, response.text);
  assertPublicUser(response.body.data);
  assert.equal(response.headers.has('x-powered-by'), false);
  assert.ok(response.headers.get('x-request-id'));
  assert.ok(response.headers.get('x-content-type-options'));
});

test('me rejects missing, malformed, wrong-signature and expired access tokens', async (t) => {
  const fixture = await createAuthFixture(t);
  const registered = await fixture.register();
  errorIs(await fixture.request('/api/users/me'), 401, 'AUTH_REQUIRED');
  for (const header of ['Basic abc', 'Bearer a b', 'Bearer not.a.jwt', `Bearer ${'a'.repeat(4097)}`]) {
    errorIs(await fixture.request('/api/users/me', { headers: { Authorization: header } }), 401, 'INVALID_ACCESS_TOKEN');
  }
  const token = registered.body.data.accessToken;
  const parts = token.split('.');
  parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
  errorIs(await fixture.request('/api/users/me', { headers: { Authorization: `Bearer ${parts.join('.')}` } }), 401, 'INVALID_ACCESS_TOKEN');
  fixture.advance(fixture.config.access.expiresIn * 1000);
  errorIs(await fixture.request('/api/users/me', { headers: { Authorization: `Bearer ${token}` } }), 401, 'INVALID_ACCESS_TOKEN');
});

test('refresh rotates the HttpOnly cookie without exposing refresh tokens in JSON', async (t) => {
  const fixture = await createAuthFixture(t);
  const registered = await fixture.register();
  const oldCookie = refreshCookie(registered);
  const oldHash = fixture.tokens.hashRefresh(oldCookie.split('=')[1]);
  const response = await fixture.request('/api/auth/refresh', post({}, { headers: { Cookie: oldCookie } }));
  assert.equal(response.status, 200, response.text);
  assertPublicUser(response.body.data.user);
  const nextCookie = refreshCookie(response);
  assert.notEqual(nextCookie, oldCookie);
  assert.equal(response.text.includes(nextCookie.split('=')[1]), false);
  assert.ok(fixture.rows.tokens.get(oldHash).consumed_at);
  assert.equal(fixture.rows.tokens.size, 2);
  assert.equal(fixture.rows.sessions.size, 1);
  assert.equal((await fixture.request('/api/users/me', { headers: { Authorization: `Bearer ${response.body.data.accessToken}` } })).status, 200);
});

test('refresh replay revokes its family and denies successor refresh and access', async (t) => {
  const fixture = await createAuthFixture(t);
  const registered = await fixture.register();
  const oldCookie = refreshCookie(registered);
  const rotated = await fixture.request('/api/auth/refresh', post({}, { headers: { Cookie: oldCookie } }));
  assert.equal(rotated.status, 200, rotated.text);
  const replay = await fixture.request('/api/auth/refresh', post({}, { headers: { Cookie: oldCookie } }));
  errorIs(replay, 401, 'INVALID_SESSION');
  assert.match(replay.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  errorIs(await fixture.request('/api/auth/refresh', post({}, { headers: { Cookie: refreshCookie(rotated) } })), 401, 'INVALID_SESSION');
  errorIs(await fixture.request('/api/users/me', { headers: { Authorization: `Bearer ${rotated.body.data.accessToken}` } }), 401, 'INVALID_SESSION');
  assert.ok([...fixture.rows.sessions.values()][0].revoked_at);
});

test('logout clears the cookie, revokes refresh and access, and is idempotent', async (t) => {
  const fixture = await createAuthFixture(t);
  const registered = await fixture.register();
  const cookie = refreshCookie(registered);
  const loggedOut = await fixture.request('/api/auth/logout', post({}, { headers: { Cookie: cookie } }));
  assert.equal(loggedOut.status, 200, loggedOut.text);
  assert.match(loggedOut.headers.get('set-cookie'), /^closet_refresh=;/);
  assert.match(loggedOut.headers.get('set-cookie'), /Path=\/api\/auth/);
  assert.match(loggedOut.headers.get('set-cookie'), /HttpOnly/);
  assert.match(loggedOut.headers.get('set-cookie'), /SameSite=Lax/);
  errorIs(await fixture.request('/api/auth/refresh', post({}, { headers: { Cookie: cookie } })), 401, 'INVALID_SESSION');
  errorIs(await fixture.request('/api/users/me', { headers: { Authorization: `Bearer ${registered.body.data.accessToken}` } }), 401, 'INVALID_SESSION');
  assert.equal((await fixture.request('/api/auth/logout', post({}, { headers: { Cookie: cookie } }))).status, 200);
  assert.equal((await fixture.request('/api/auth/logout', post())).status, 200);
});

test('missing, malformed and expired refresh cookies fail closed and clear cookies', async (t) => {
  const fixture = await createAuthFixture(t);
  for (const cookie of [undefined, 'closet_refresh=invalid', `closet_refresh=${'a'.repeat(43)}`]) {
    const response = await fixture.request('/api/auth/refresh', post({}, { headers: cookie ? { Cookie: cookie } : {} }));
    errorIs(response, 401, 'INVALID_SESSION');
    assert.match(response.headers.get('set-cookie'), /^closet_refresh=;/);
  }
  const registered = await fixture.register();
  const session = [...fixture.rows.sessions.values()][0];
  fixture.advance(fixture.config.refresh.expiresIn * 1000);
  const currentAccess = fixture.tokens.issueAccess(session.user_id, session.id);
  errorIs(await fixture.request('/api/auth/refresh', post({}, { headers: { Cookie: refreshCookie(registered) } })), 401, 'INVALID_SESSION');
  errorIs(await fixture.request('/api/users/me', { headers: { Authorization: `Bearer ${currentAccess}` } }), 401, 'INVALID_SESSION');
});

test('refresh and logout reject extra JSON fields without mutating the session', async (t) => {
  const fixture = await createAuthFixture(t);
  const registered = await fixture.register();
  for (const endpoint of ['refresh', 'logout']) {
    errorIs(await fixture.request(`/api/auth/${endpoint}`, post({ unexpected: true }, { headers: { Cookie: refreshCookie(registered) } })), 422, 'VALIDATION_ERROR');
  }
  assert.equal([...fixture.rows.sessions.values()][0].revoked_at, null);
  assert.equal([...fixture.rows.tokens.values()][0].consumed_at, null);
});

test('cookie options match configured name, path, expiry, HttpOnly and SameSite', async (t) => {
  const fixture = await createAuthFixture(t, { env: { COOKIE_NAME: 'test_refresh', COOKIE_SECURE: 'true', COOKIE_SAME_SITE: 'none' } });
  const response = await fixture.register();
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /^test_refresh=[A-Za-z0-9_-]{43};/);
  assert.match(cookie, /Max-Age=604800/);
  assert.match(cookie, /Path=\/api\/auth/);
  assert.match(cookie, /Expires=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=None/);
  assert.doesNotMatch(cookie, /Domain=/);
  const logout = await fixture.request('/api/auth/logout', post({}, { headers: { Cookie: refreshCookie(response) } }));
  assert.match(logout.headers.get('set-cookie'), /Secure/);
  assert.match(logout.headers.get('set-cookie'), /SameSite=None/);
});

test('all auth mutations require custom CSRF header even without Origin', async (t) => {
  const fixture = await createAuthFixture(t);
  for (const endpoint of ['register', 'login', 'refresh', 'logout']) {
    for (const headers of [{}, { 'X-CSRF-Protection': '0' }, { 'X-CSRF-Protection': 'true' }]) {
      errorIs(await fixture.request(`/api/auth/${endpoint}`, post({}, { csrf: false, headers })), 403, 'CSRF_REQUIRED');
    }
  }
  assert.equal((await fixture.register()).status, 201);
});

test('auth mutations require application/json, including refresh and logout', async (t) => {
  const fixture = await createAuthFixture(t);
  for (const endpoint of ['register', 'login', 'refresh', 'logout']) {
    errorIs(await fixture.request(`/api/auth/${endpoint}`, { method: 'POST', json: false, rawBody: '{}' }), 415, 'JSON_REQUIRED');
  }
  assert.equal(fixture.rows.users.size, 0);
});

test('explicit untrusted or null Origin is rejected despite CSRF header and a trusted Referer', async (t) => {
  const fixture = await createAuthFixture(t);
  for (const origin of ['https://attacker.test', 'null', 'http://localhost:5173.attacker.test']) {
    const response = await fixture.register(registration, { headers: { Origin: origin, Referer: 'http://localhost:5173/register' } });
    errorIs(response, 403, 'ORIGIN_NOT_ALLOWED');
    assert.equal(response.headers.has('access-control-allow-origin'), false);
  }
  assert.equal(fixture.rows.users.size, 0);
});

test('Referer fallback rejects untrusted or malformed values and accepts trusted requests', async (t) => {
  const fixture = await createAuthFixture(t);
  for (const referer of ['https://attacker.test/path', 'not a URL', 'null']) {
    errorIs(await fixture.register(registration, { headers: { Referer: referer } }), 403, 'ORIGIN_NOT_ALLOWED');
  }
  assert.equal((await fixture.register(registration, { headers: { Referer: 'http://localhost:5173/register' } })).status, 201);
});

test('CORS allows only configured Origin and preflight includes credential/custom header support', async (t) => {
  const fixture = await createAuthFixture(t);
  const response = await fixture.register(registration, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(response.status, 201, response.text);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  assert.match(response.headers.get('vary'), /Origin/);
  const preflight = await fixture.request('/api/auth/login', {
    method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-csrf-protection' },
  });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers'), /X-CSRF-Protection/i);
  assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);
  assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  const disallowed = await fixture.request('/api/health', { headers: { Origin: 'https://attacker.test' } });
  errorIs(disallowed, 403, 'ORIGIN_NOT_ALLOWED');
  const absent = await fixture.request('/api/health');
  assert.equal(absent.headers.has('access-control-allow-origin'), false);
});

test('production mutations require HTTPS before accepting credentials', async (t) => {
  const fixture = await createAuthFixture(t, { configPatch: { production: true } });
  errorIs(await fixture.register(), 403, 'HTTPS_REQUIRED');
  assert.equal(fixture.rows.users.size, 0);
});

test('credential limiter is shared between register/login and returns 429 with Retry-After', async (t) => {
  const fixture = await createAuthFixture(t, { env: { AUTH_RATE_LIMIT_MAX: '2' } });
  assert.equal((await fixture.register()).status, 201);
  errorIs(await fixture.request('/api/auth/login', post({ ...loginBody, password: 'incorrect-password' })), 401, 'INVALID_CREDENTIALS');
  const limited = await fixture.request('/api/auth/login', post(loginBody));
  errorIs(limited, 429, 'RATE_LIMITED');
  assert.ok(limited.headers.get('retry-after'));
  assert.ok(limited.headers.get('ratelimit'));
  assert.equal(limited.headers.has('x-ratelimit-limit'), false);
});

test('global API limiter returns 429 for reads too', async (t) => {
  const fixture = await createAuthFixture(t, { env: { API_RATE_LIMIT_MAX: '2' } });
  assert.equal((await fixture.request('/api/health')).status, 200);
  assert.equal((await fixture.request('/api/health')).status, 200);
  errorIs(await fixture.request('/api/health'), 429, 'RATE_LIMITED');
});

test('malformed JSON, oversized payload and missing routes return normalized errors', async (t) => {
  const fixture = await createAuthFixture(t);
  const malformed = await fixture.request('/api/auth/register', { method: 'POST', rawBody: '{"password":"private-sentinel",' });
  errorIs(malformed, 400, 'INVALID_JSON');
  assert.equal(malformed.text.includes('private-sentinel'), false);
  errorIs(await fixture.request('/api/auth/register', post({ value: 'x'.repeat(17 * 1024) })), 413, 'PAYLOAD_TOO_LARGE');
  errorIs(await fixture.request('/api/missing'), 404, 'NOT_FOUND');
  assert.equal(fixture.logs.length, 0);
});

test('database outage returns 503 without private error details in response or logs', async (t) => {
  const fixture = await createAuthFixture(t);
  fixture.database.failure = Object.assign(new Error('private mysql://root:password@host SELECT password_hash FROM users'), { code: 'ECONNREFUSED', sql: 'SELECT private' });
  const response = await fixture.request('/api/health');
  errorIs(response, 503, 'DATABASE_UNAVAILABLE');
  assert.equal(fixture.logs.length, 1);
  const log = JSON.parse(fixture.logs[0]);
  assert.deepEqual(Object.keys(log).sort(), ['code', 'databaseCode', 'event', 'requestId']);
  assert.equal(log.databaseCode, 'ECONNREFUSED');
  assert.equal(log.requestId, response.headers.get('x-request-id'));
  for (const text of [response.text, ...fixture.logs]) assert.doesNotMatch(text, /password|mysql:|SELECT|stack|private/i);
});

test('unexpected repository failure returns 500 with sanitized logs and no demo fallback', async (t) => {
  const fixture = await createAuthFixture(t);
  fixture.users.findByEmail = async () => { throw new Error('private secret database failure'); };
  const response = await fixture.register();
  errorIs(response, 500, 'INTERNAL_ERROR');
  assert.equal(fixture.rows.users.size, 0);
  assert.equal(fixture.rows.sessions.size, 0);
  assert.equal(response.headers.has('set-cookie'), false);
  assert.equal(fixture.logs.length, 1);
  for (const text of [response.text, ...fixture.logs]) assert.doesNotMatch(text, /private|secret|password|stack/i);
});
