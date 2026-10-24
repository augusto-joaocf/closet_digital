import { once } from 'node:events';
import { createApp } from '../../src/app.js';
import { readEnv } from '../../src/config/env.js';
import { createAuthService } from '../../src/services/authService.js';
import { createPasswordService } from '../../src/services/passwordService.js';
import { createTokenService } from '../../src/services/tokenService.js';

export const testEnvironment = {
  NODE_ENV: 'test',
  DB_HOST: 'unused-test-double',
  DB_USER: 'unused_test_user',
  DB_NAME: 'unused_test_database',
  JWT_ACCESS_SECRET: 'test-access-L4p8y3c0Qx7vT6k2Ns9dR1h5',
  JWT_REFRESH_SECRET: 'test-refresh-H7m2w8Z4f0n6P3r9V1x5Kq0s',
  BCRYPT_ROUNDS: '4',
  FRONTEND_URL: 'http://localhost:5173',
  CORS_ORIGIN: 'http://localhost:5173',
  COOKIE_SECURE: 'false',
  AUTH_RATE_LIMIT_MAX: '1000',
  API_RATE_LIMIT_MAX: '10000',
};

export const registration = {
  name: '  Jo\u00e3o Silva  ',
  email: '  JOAO@EXAMPLE.COM  ',
  password: 'Senha-forte-123!',
  confirmPassword: 'Senha-forte-123!',
};

// TEST-ONLY repository doubles. Production uses MySQL repositories, never these.
// These maps model sequential repository outcomes only. They do NOT validate SQL,
// transaction rollback, InnoDB locks, race behavior, migrations or durability.
export async function createAuthFixture(t, { env = {}, configPatch = {} } = {}) {
  const config = { ...readEnv({ ...testEnvironment, ...env }), ...configPatch };
  let now = new Date();
  const clock = () => new Date(now);
  const userRows = new Map();
  const sessionRows = new Map();
  const tokenRows = new Map();
  const logs = [];
  const database = {
    failure: null,
    async check() { if (this.failure) throw this.failure; },
    async transaction(work) { return work({ testOnlyDouble: true }); },
  };
  const users = {
    async findByEmail(email) { return [...userRows.values()].find((user) => user.email === email) || null; },
    async insert(user) {
      if (await this.findByEmail(user.email)) throw Object.assign(new Error('test duplicate'), { code: 'ER_DUP_ENTRY' });
      const stored = { ...user, avatar_url: null };
      userRows.set(stored.id, stored);
      return stored;
    },
  };
  const sessions = {
    async insert(session, token) {
      sessionRows.set(session.id, { ...session, revoked_at: null });
      tokenRows.set(token.hash, { ...token, session_id: session.id, expires_at: session.expires_at, consumed_at: null });
    },
    async activeUser(sessionId, userId, instant) {
      const session = sessionRows.get(sessionId);
      if (!session || session.user_id !== userId || session.revoked_at || session.expires_at <= instant) return null;
      return userRows.get(userId) || null;
    },
    async rotate(hash, successor, instant) {
      const token = tokenRows.get(hash);
      const session = token && sessionRows.get(token.session_id);
      if (!session || session.revoked_at || session.expires_at <= instant) return { kind: 'invalid' };
      if (token.consumed_at) {
        session.revoked_at = instant;
        return { kind: 'reused' };
      }
      if (token.expires_at <= instant) return { kind: 'invalid' };
      token.consumed_at = instant;
      token.replaced_by_id = successor.id;
      tokenRows.set(successor.hash, { ...successor, session_id: session.id, expires_at: session.expires_at, consumed_at: null });
      return { kind: 'rotated', session, user: userRows.get(session.user_id) };
    },
    async revokeByHash(hash, instant) {
      const token = tokenRows.get(hash);
      const session = token && sessionRows.get(token.session_id);
      if (session && !session.revoked_at) session.revoked_at = instant;
    },
  };
  const passwords = await createPasswordService(config.bcryptRounds);
  const tokens = createTokenService(config, clock);
  const authService = createAuthService({ database, users, sessions, passwords, tokens, config, clock });
  const app = createApp({ config, authService, database, clock, logger: { error: (entry) => logs.push(entry) } });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { method = 'GET', body, rawBody, headers = {}, csrf = method === 'POST', json = method === 'POST' } = {}) {
    const outgoing = { ...(csrf ? { 'X-CSRF-Protection': '1' } : {}), ...(json ? { 'Content-Type': 'application/json' } : {}), ...headers };
    const response = await fetch(baseUrl + path, {
      method, headers: outgoing,
      ...(rawBody !== undefined ? { body: rawBody } : body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, body: text ? JSON.parse(text) : null };
  }
  return {
    app, server, config, database, users, sessions, passwords, tokens, authService,
    repos: { users, sessions }, rows: { users: userRows, sessions: sessionRows, tokens: tokenRows }, logs,
    clock, advance: (milliseconds) => { now = new Date(now.getTime() + milliseconds); }, request,
    register: (body = registration, options = {}) => request('/api/auth/register', { method: 'POST', body, ...options }),
  };
}

export function refreshCookie(response) {
  return response.headers.get('set-cookie')?.split(';', 1)[0];
}
