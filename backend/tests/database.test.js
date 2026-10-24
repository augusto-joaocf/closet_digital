// Repository/transaction tests use test doubles only. MySQL locking is verified separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../src/config/database.js';
import { createUserRepository } from '../src/repositories/userRepository.js';
import { createSessionRepository } from '../src/repositories/sessionRepository.js';

const dbConfig = { host: 'db.example.com', port: 3306, user: 'unit', password: '', database: 'closet_test', connectionLimit: 2, connectTimeout: 1000 };
test('TLS verifica certificado e identidade do hostname; conexão proíbe múltiplos statements', async () => {
  const database = createDatabase({ ...dbConfig, sslEnabled: true });
  try {
    const config = database.pool.pool.config.connectionConfig;
    assert.equal(config.ssl.rejectUnauthorized, true);
    assert.equal(config.ssl.verifyIdentity, true);
    assert.equal(config.multipleStatements, false);
  } finally { await database.close(); }
  assert.throws(() => createDatabase({ ...dbConfig, sslEnabled: true, sslCaPath: './arquivo-ca-inexistente.pem' }), /DB_SSL_CA_PATH/);
});
test('transação faz commit ou rollback e libera conexão inclusive em falha', async () => {
  const database = createDatabase(dbConfig);
  const events = [];
  const connection = { beginTransaction: async () => events.push('begin'), commit: async () => events.push('commit'), rollback: async () => events.push('rollback'), release: () => events.push('release') };
  database.pool.getConnection = async () => connection;
  try {
    assert.equal(await database.transaction(async () => 'ok'), 'ok');
    assert.deepEqual(events, ['begin', 'commit', 'release']);
    events.length = 0;
    await assert.rejects(database.transaction(async () => { throw Error('controlled-test-failure'); }), /controlled-test-failure/);
    assert.deepEqual(events, ['begin', 'rollback', 'release']);
  } finally { await database.close(); }
});
test('repositório envia e-mail como parâmetro, sem concatenar SQL', async () => {
  let captured;
  const users = createUserRepository({ pool: { execute: async (sql, params) => { captured = { sql, params }; return [[]]; } } });
  const email = "' OR 1=1 --";
  assert.equal(await users.findByEmail(email), null);
  assert.deepEqual(captured.params, [email]);
  assert.equal(captured.sql.includes(email), false);
  assert.match(captured.sql, /email = \?/);
});
test('detecção de replay retorna após commit da revogação, sem rollback', async () => {
  const events = [];
  const session = { id: 'family', user_id: 'user', expires_at: new Date(Date.now() + 60000), revoked_at: null };
  const connection = { execute: async (sql) => {
    if (sql.startsWith('SELECT session_id')) return [[{ session_id: session.id }]];
    if (sql.startsWith('SELECT id, user_id')) { assert.match(sql, /FOR UPDATE$/); events.push('lock-family'); return [[session]]; }
    if (sql.startsWith('SELECT id, expires_at')) { assert.match(sql, /FOR UPDATE$/); events.push('lock-token'); return [[{ id: 'used', expires_at: session.expires_at, consumed_at: new Date() }]]; }
    if (sql.startsWith('UPDATE auth_sessions')) { events.push('revoke'); return [{ affectedRows: 1 }]; }
    throw Error('Unexpected query');
  } };
  const database = { transaction: async (work) => { try { const result = await work(connection); events.push('commit'); return result; } catch (e) { events.push('rollback'); throw e; } } };
  const outcome = await createSessionRepository(database).rotate('hash', { id: 'next', hash: 'next-hash' }, new Date());
  assert.deepEqual(outcome, { kind: 'reused' });
  assert.deepEqual(events, ['lock-family', 'lock-token', 'revoke', 'commit']);
});
