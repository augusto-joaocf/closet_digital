// OPT-IN ONLY. Uses a real, dedicated MySQL test database; never a runtime mock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { readEnv } from '../../src/config/env.js';
import { createDatabase } from '../../src/config/database.js';
import { createUserRepository } from '../../src/repositories/userRepository.js';
import { createSessionRepository } from '../../src/repositories/sessionRepository.js';
import { createPasswordService } from '../../src/services/passwordService.js';
import { createTokenService } from '../../src/services/tokenService.js';
import { createAuthService } from '../../src/services/authService.js';
import { createApp } from '../../src/app.js';

const source = { ...process.env };
dotenv.config({ path: fileURLToPath(new URL('../../.env.test', import.meta.url)), processEnv: source, quiet: true });
const enabled = source.RUN_MYSQL_TESTS === '1';
const reason = 'MySQL real não executado: configure .env.test e RUN_MYSQL_TESTS=1 em banco separado com nome terminado em _test.';

test('MySQL real — cadastro, autenticação, rotação, replay, concorrência e logout', { skip: enabled ? false : reason }, async (t) => {
  const config = readEnv({ ...source, NODE_ENV: 'test', BCRYPT_ROUNDS: source.BCRYPT_ROUNDS || '4' });
  // Refuse all ordinary development/production database names before opening any connection.
  assert.match(config.db.database, /^[A-Za-z0-9_]+_test$/, 'O banco de integração deve terminar em _test.');
  assert.notEqual(config.db.database, 'closet_digital');
  const database = createDatabase(config.db);
  let server;
  const ownedUsers = new Set();
  const logs = [];
  const run = randomUUID().replaceAll('-', '');
  let serial = 0;
  try {
    const [[selected]] = await database.pool.execute('SELECT DATABASE() AS selected_database');
    assert.equal(selected.selected_database, config.db.database, 'Banco selecionado difere da configuração segura de testes.');
    const schema = readFileSync(fileURLToPath(new URL('../../database/schema.sql', import.meta.url)), 'utf8');
    assert.doesNotMatch(schema.replace(/^--.*$/gm, ''), /\b(USE|DROP|TRUNCATE|CREATE\s+DATABASE)\b/i);
    for (const statement of schema.split(';').map((text) => text.trim()).filter(Boolean)) {
      if (statement.replace(/^--.*$/gm, '').trim()) await database.pool.query(statement);
    }
    await database.checkSchema();
    const [engines] = await database.pool.execute('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?, ?, ?)', [config.db.database, 'users', 'auth_sessions', 'auth_refresh_tokens']);
    assert.equal(engines.length, 3);
    assert.ok(engines.every((table) => table.ENGINE === 'InnoDB'));
    const tokens = createTokenService(config);
    const passwords = await createPasswordService(config.bcryptRounds);
    const users = createUserRepository(database);
    const sessions = createSessionRepository(database);
    const authService = createAuthService({ database, users, sessions, tokens, passwords, config });
    const app = createApp({ config, authService, database, logger: { error: (entry) => logs.push(entry) } });
    server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const base = 'http://127.0.0.1:' + server.address().port;
    async function request(path, { method = 'POST', body = {}, cookie, bearer } = {}) {
      const headers = { 'X-CSRF-Protection': '1', Origin: config.frontendUrl };
      if (method === 'POST') headers['Content-Type'] = 'application/json';
      if (cookie) headers.Cookie = cookie;
      if (bearer) headers.Authorization = 'Bearer ' + bearer;
      const response = await fetch(base + path, { method, headers, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
      const json = await response.json();
      return { status: response.status, body: json, cookie: response.headers.getSetCookie()[0]?.split(';')[0], headers: response.headers };
    }
    async function register() {
      const email = 'integration-' + run + '-' + (++serial) + '@example.com';
      const body = { name: 'Usuário de testes', email, password: 'Integration123!', confirmPassword: 'Integration123!' };
      const result = await request('/api/auth/register', { body });
      assert.equal(result.status, 201);
      ownedUsers.add(result.body.data.user.id);
      return { ...result, values: body };
    }

    await t.test('cadastro valida, normaliza e-mail, persiste hash bcrypt e não expõe dados sensíveis', async () => {
      const invalid = await request('/api/auth/register', { body: { name: '', email: 'inválido', password: '123', confirmPassword: '' } });
      assert.equal(invalid.status, 422);
      const account = await register();
      const [rows] = await database.pool.execute('SELECT password_hash, avatar_url FROM users WHERE id = ?', [account.body.data.user.id]);
      assert.notEqual(rows[0].password_hash, account.values.password);
      assert.equal(await passwords.compare(account.values.password, rows[0].password_hash), true);
      assert.equal(rows[0].avatar_url, null);
      assert.equal(JSON.stringify(account.body).includes('password'), false);
      const duplicate = await request('/api/auth/register', { body: { ...account.values, email: account.values.email.toUpperCase() } });
      assert.equal(duplicate.status, 409);
      const [stored] = await database.pool.execute('SELECT token_hash FROM auth_refresh_tokens WHERE session_id IN (SELECT id FROM auth_sessions WHERE user_id = ?)', [account.body.data.user.id]);
      const raw = decodeURIComponent(account.cookie.split('=')[1]);
      assert.equal(stored.length, 1);
      assert.equal(stored[0].token_hash, tokens.hashRefresh(raw));
      assert.notEqual(stored[0].token_hash, raw);
    });
    await t.test('login, Bearer autorizado, ausência/invalidez de token e credenciais incorretas', async () => {
      const account = await register();
      const login = await request('/api/auth/login', { body: { email: account.values.email, password: account.values.password } });
      assert.equal(login.status, 200);
      assert.equal((await request('/api/users/me', { method: 'GET', bearer: login.body.data.accessToken })).body.data.id, account.body.data.user.id);
      assert.equal((await request('/api/users/me', { method: 'GET' })).status, 401);
      assert.equal((await request('/api/users/me', { method: 'GET', bearer: 'invalid' })).status, 401);
      const wrong = await request('/api/auth/login', { body: { email: account.values.email, password: 'WrongPassword123' } });
      const missing = await request('/api/auth/login', { body: { email: 'missing-' + run + '@example.com', password: 'WrongPassword123' } });
      assert.equal(wrong.status, 401);
      assert.deepEqual(wrong.body, missing.body);
    });
    await t.test('rotação persiste consumo e replay revoga a família mesmo após devolver 401', async () => {
      const account = await register();
      const refreshed = await request('/api/auth/refresh', { cookie: account.cookie });
      assert.equal(refreshed.status, 200);
      assert.notEqual(refreshed.cookie, account.cookie);
      assert.equal((await request('/api/auth/refresh', { cookie: account.cookie })).status, 401);
      assert.equal((await request('/api/auth/refresh', { cookie: refreshed.cookie })).status, 401);
      assert.equal((await request('/api/users/me', { method: 'GET', bearer: refreshed.body.data.accessToken })).status, 401);
      const [rows] = await database.pool.execute('SELECT revoked_at FROM auth_sessions WHERE user_id = ?', [account.body.data.user.id]);
      assert.ok(rows[0].revoked_at);
    });
    await t.test('dois refresh simultâneos têm no máximo um sucessor e revogam a família por replay', async () => {
      const account = await register();
      const results = await Promise.all([request('/api/auth/refresh', { cookie: account.cookie }), request('/api/auth/refresh', { cookie: account.cookie })]);
      assert.deepEqual(results.map((result) => result.status).sort(), [200, 401]);
      const winner = results.find((result) => result.status === 200);
      assert.equal((await request('/api/users/me', { method: 'GET', bearer: winner.body.data.accessToken })).status, 401);
      const [[count]] = await database.pool.execute('SELECT COUNT(*) AS count FROM auth_refresh_tokens WHERE session_id IN (SELECT id FROM auth_sessions WHERE user_id = ?)', [account.body.data.user.id]);
      assert.equal(count.count, 2);
    });
    await t.test('logout revoga refresh e access token, inclusive com corrida de refresh', async () => {
      const account = await register();
      const results = await Promise.all([request('/api/auth/refresh', { cookie: account.cookie }), request('/api/auth/logout', { cookie: account.cookie })]);
      assert.equal(results[1].status, 200);
      assert.ok([200, 401].includes(results[0].status));
      assert.equal((await request('/api/users/me', { method: 'GET', bearer: account.body.data.accessToken })).status, 401);
      if (results[0].status === 200) assert.equal((await request('/api/auth/refresh', { cookie: results[0].cookie })).status, 401);
      assert.equal((await request('/api/auth/logout', { cookie: account.cookie })).status, 200);
    });
    await t.test('rollback em falha de rotação mantém o token anterior utilizável', async () => {
      const account = await register();
      const original = decodeURIComponent(account.cookie.split('=')[1]);
      const [[existing]] = await database.pool.execute('SELECT id FROM auth_refresh_tokens WHERE token_hash = ?', [tokens.hashRefresh(original)]);
      await assert.rejects(sessions.rotate(tokens.hashRefresh(original), { id: existing.id, hash: tokens.hashRefresh(tokens.newRefresh()) }, new Date()), (error) => error.code === 'ER_DUP_ENTRY');
      assert.equal((await request('/api/auth/refresh', { cookie: account.cookie })).status, 200);
    });
    await t.test('sessão vencida rejeita renovação e acesso', async () => {
      const account = await register();
      await database.pool.execute('UPDATE auth_sessions SET expires_at = ? WHERE user_id = ?', [new Date(Date.now() - 1000), account.body.data.user.id]);
      assert.equal((await request('/api/auth/refresh', { cookie: account.cookie })).status, 401);
      assert.equal((await request('/api/users/me', { method: 'GET', bearer: account.body.data.accessToken })).status, 401);
    });
    assert.deepEqual(logs, [], 'Falhas de autenticação esperadas não devem produzir logs sensíveis ou erros internos.');
  } finally {
    if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
    // Delete only the exact UUIDs created by this run, in the dedicated *_test database.
    for (const id of ownedUsers) await database.pool.execute('DELETE FROM users WHERE id = ?', [id]);
    await database.close();
  }
});
