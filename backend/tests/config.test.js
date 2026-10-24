import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readEnv } from '../src/config/env.js';
import { validateAuth } from '../src/utils/validation.js';

const base = () => ({
  NODE_ENV: 'test', DB_HOST: 'localhost', DB_USER: 'test_user', DB_NAME: 'closet_digital_test',
  JWT_ACCESS_SECRET: randomBytes(48).toString('hex'), JWT_REFRESH_SECRET: randomBytes(48).toString('hex'),
});
test('configuração exige segredos fortes e separados, banco e durações explícitas', () => {
  const source = base();
  const config = readEnv(source);
  assert.equal(config.access.expiresIn, 300);
  assert.equal(config.refresh.expiresIn, 604800);
  assert.throws(() => readEnv({ ...source, JWT_ACCESS_SECRET: '' }), /JWT_ACCESS_SECRET/);
  assert.throws(() => readEnv({ ...source, JWT_ACCESS_SECRET: 'x'.repeat(64) }), /JWT_ACCESS_SECRET/);
  assert.throws(() => readEnv({ ...source, JWT_REFRESH_SECRET: source.JWT_ACCESS_SECRET }), /diferente/);
  assert.throws(() => readEnv({ ...source, DB_USER: '' }), /DB_USER/);
  assert.throws(() => readEnv({ ...source, DB_NAME: 'db; DROP DATABASE' }), /DB_NAME/);
  assert.throws(() => readEnv({ ...source, JWT_ACCESS_EXPIRES_IN: '300' }), /duração/);
  assert.throws(() => readEnv({ ...source, JWT_ACCESS_EXPIRES_IN: '1d' }), /limites/);
  assert.throws(() => readEnv({ ...source, JWT_REFRESH_EXPIRES_IN: '365d' }), /limites/);
  assert.throws(() => readEnv({ ...source, PORT: '0' }), /PORT/);
});
test('CORS/cookies/proxy rejeitam configurações inseguras', () => {
  const source = base();
  assert.throws(() => readEnv({ ...source, CORS_ORIGIN: '*' }), /CORS_ORIGIN/);
  assert.throws(() => readEnv({ ...source, CORS_ORIGIN: 'null' }), /CORS_ORIGIN/);
  assert.throws(() => readEnv({ ...source, CORS_ORIGIN: 'http:\/\/localhost:5173/' }), /CORS_ORIGIN/);
  assert.throws(() => readEnv({ ...source, COOKIE_SAME_SITE: 'none', COOKIE_SECURE: 'false' }), /COOKIE_SECURE/);
  assert.throws(() => readEnv({ ...source, TRUST_PROXY: 'true' }), /TRUST_PROXY/);
  assert.throws(() => readEnv({ ...source, TRUST_PROXY: '1' }), /TRUST_PROXY/);
  assert.throws(() => readEnv({ ...source, TRUST_PROXY: '10.0.0.0/99' }), /TRUST_PROXY/);
  assert.deepEqual(readEnv({ ...source, TRUST_PROXY: 'loopback,10.0.0.0/24,::1' }).trustProxy, ['loopback', '10.0.0.0/24', '::1']);
  const production = { ...source, NODE_ENV: 'production', DB_PASSWORD: 'unit-test-only', FRONTEND_URL: 'https:\/\/app.example.com', CORS_ORIGIN: 'https:\/\/app.example.com' };
  assert.equal(readEnv(production).cookie.secure, true);
  assert.throws(() => readEnv({ ...production, COOKIE_SECURE: 'false' }), /COOKIE_SECURE/);
  assert.throws(() => readEnv({ ...production, DB_PASSWORD: '' }), /DB_PASSWORD/);
  assert.throws(() => readEnv({ ...production, BCRYPT_ROUNDS: '4' }), /BCRYPT_ROUNDS/);
});
test('validação normaliza e-mail e nome; senha mantém espaços e rejeita truncamento UTF-8', () => {
  const valid = { name: '  João  ', email: '  JoAo@EXEMPLO.COM ', password: ' senha123 ', confirmPassword: ' senha123 ' };
  assert.deepEqual(validateAuth(valid, true), { name: 'João', email: 'joao@exemplo.com', password: ' senha123 ' });
  assert.throws(() => validateAuth({ ...valid, confirmPassword: '' }, true), (e) => Boolean(e.fields.confirmPassword));
  assert.throws(() => validateAuth({ ...valid, password: '😀'.repeat(19), confirmPassword: '😀'.repeat(19) }, true), (e) => Boolean(e.fields.password));
  assert.throws(() => validateAuth({ ...valid, password: 'abc12345\u0000', confirmPassword: 'abc12345\u0000' }, true), (e) => Boolean(e.fields.password));
  assert.throws(() => validateAuth({ ...valid, password_hash: 'injected' }, true), (e) => Boolean(e.fields.form));
  assert.throws(() => validateAuth({ ...valid, name: 'a'.repeat(101) }, true), (e) => Boolean(e.fields.name));
});
