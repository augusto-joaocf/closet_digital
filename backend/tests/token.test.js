import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { readEnv } from '../src/config/env.js';
import { createTokenService } from '../src/services/tokenService.js';
import { testEnvironment } from './helpers/authFixture.js';

function tokenFixture() {
  const config = readEnv(testEnvironment);
  let now = new Date('2026-10-23T12:00:00.000Z');
  const clock = () => new Date(now);
  const tokens = createTokenService(config, clock);
  const userId = randomUUID();
  const sessionId = randomUUID();
  const claims = {
    sub: userId, sid: sessionId,
    iat: Math.floor(now.getTime() / 1000),
    exp: Math.floor(now.getTime() / 1000) + config.access.expiresIn,
    iss: config.access.issuer, aud: config.access.audience,
  };
  return { config, tokens, userId, sessionId, claims, advance: (seconds) => { now = new Date(now.getTime() + seconds * 1000); } };
}
function assertRejected(tokens, token) {
  assert.throws(() => tokens.verifyAccess(token), (error) => {
    assert.equal(error.status, 401);
    assert.equal(error.code, 'INVALID_ACCESS_TOKEN');
    assert.equal(error.message, 'Token de acesso inv\u00e1lido ou expirado.');
    return true;
  });
}

test('access JWT has bounded HS256 claims and verifies to UUID user/session identifiers', () => {
  const { config, tokens, userId, sessionId, claims } = tokenFixture();
  const encoded = tokens.issueAccess(userId, sessionId);
  const decoded = jwt.decode(encoded, { complete: true });
  assert.equal(decoded.header.alg, 'HS256');
  assert.deepEqual(decoded.payload, claims);
  assert.equal(decoded.payload.exp - decoded.payload.iat, config.access.expiresIn);
  assert.deepEqual(tokens.verifyAccess(encoded), { userId, sessionId });
  assert.equal(encoded.includes(config.access.secret), false);
});

test('access JWT expires exactly at configured lifetime', () => {
  const { config, tokens, userId, sessionId, advance } = tokenFixture();
  const encoded = tokens.issueAccess(userId, sessionId);
  advance(config.access.expiresIn - 1);
  assert.deepEqual(tokens.verifyAccess(encoded), { userId, sessionId });
  advance(1);
  assertRejected(tokens, encoded);
});

test('access verifier rejects untrusted signing algorithm, unsigned JWT and incorrect secret', () => {
  const { config, tokens, claims } = tokenFixture();
  assertRejected(tokens, jwt.sign(claims, config.access.secret, { algorithm: 'HS384' }));
  assertRejected(tokens, jwt.sign(claims, '', { algorithm: 'none' }));
  assertRejected(tokens, jwt.sign(claims, 'different-testing-signature-secret-923Ax', { algorithm: 'HS256' }));
  for (const malformed of ['', 'not-a-jwt', 'a.b.c', null, undefined]) assertRejected(tokens, malformed);
});

test('access verifier rejects incorrect issuer and audience', () => {
  const { config, tokens, claims } = tokenFixture();
  for (const patch of [{ iss: 'other-api' }, { aud: 'other-client' }]) {
    assertRejected(tokens, jwt.sign({ ...claims, ...patch }, config.access.secret, { algorithm: 'HS256' }));
  }
});

test('access verifier rejects invalid UUID claims and missing claims', () => {
  const { config, tokens, claims } = tokenFixture();
  for (const field of ['sub', 'sid']) {
    for (const invalid of ['not-a-uuid', '', '00000000-0000-1000-8000-000000000000']) {
      assertRejected(tokens, jwt.sign({ ...claims, [field]: invalid }, config.access.secret, { algorithm: 'HS256' }));
    }
    const missing = { ...claims };
    delete missing[field];
    assertRejected(tokens, jwt.sign(missing, config.access.secret, { algorithm: 'HS256' }));
  }
  const missingExpiry = { ...claims };
  delete missingExpiry.exp;
  assertRejected(tokens, jwt.sign(missingExpiry, config.access.secret, { algorithm: 'HS256' }));
  assertRejected(tokens, jwt.sign(claims, config.access.secret, { algorithm: 'HS256', noTimestamp: true }));
});

test('access verifier rejects future issued-at, noninteger timestamps and excessive lifetime', () => {
  const { config, tokens, claims } = tokenFixture();
  for (const patch of [
    { iat: claims.iat + 1, exp: claims.exp + 1 },
    { iat: claims.iat + 0.5 },
    { exp: claims.exp + 0.5 },
    { exp: claims.exp + 1 },
    { exp: claims.iat },
    { nbf: claims.iat + 1 },
  ]) {
    assertRejected(tokens, jwt.sign({ ...claims, ...patch }, config.access.secret, { algorithm: 'HS256' }));
  }
});

test('refresh tokens use random 256-bit base64url material and keyed hashes', () => {
  const { config, tokens } = tokenFixture();
  const generated = new Set(Array.from({ length: 20 }, () => tokens.newRefresh()));
  assert.equal(generated.size, 20);
  for (const value of generated) {
    assert.match(value, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(Buffer.from(value, 'base64url').length, 32);
    assert.equal(tokens.validRefresh(value), true);
    const hash = tokens.hashRefresh(value);
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.notEqual(hash, value);
    assert.equal(hash, tokens.hashRefresh(value));
    const alternate = createTokenService({ ...config, refresh: { ...config.refresh, secret: config.access.secret } });
    assert.notEqual(hash, alternate.hashRefresh(value));
  }
  for (const value of [undefined, null, {}, 123, '', 'a'.repeat(42), 'a'.repeat(44), 'a'.repeat(42) + '=', 'a'.repeat(42) + '+']) {
    assert.equal(tokens.validRefresh(value), false);
  }
});
