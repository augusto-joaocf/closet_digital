import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';
import { ConfigurationError } from '../utils/errors.js';

export function createDatabase(config) {
  let ssl;
  if (config.sslEnabled) {
    ssl = { rejectUnauthorized: true, verifyIdentity: true };
    if (config.sslCaPath) {
      try { ssl.ca = readFileSync(config.sslCaPath, 'utf8'); }
      catch { throw new ConfigurationError('DB_SSL_CA_PATH: não foi possível ler o certificado CA.'); }
    }
  }
  const pool = mysql.createPool({
    host: config.host, port: config.port, user: config.user, password: config.password, database: config.database,
    connectionLimit: config.connectionLimit, maxIdle: config.connectionLimit, idleTimeout: 60000,
    waitForConnections: true, queueLimit: 100, connectTimeout: config.connectTimeout,
    enableKeepAlive: true, charset: 'utf8mb4', timezone: 'Z', decimalNumbers: true,
    multipleStatements: false, ssl,
  });
  return {
    pool,
    async check() { await pool.execute('SELECT 1 AS healthy'); },
    async checkSchema() {
      await pool.execute('SELECT id, name, email, password_hash, avatar_url, created_at, updated_at FROM users LIMIT 0');
      await pool.execute('SELECT id, user_id, created_at, expires_at, revoked_at FROM auth_sessions LIMIT 0');
      await pool.execute('SELECT id, session_id, token_hash, created_at, expires_at, consumed_at, replaced_by_id FROM auth_refresh_tokens LIMIT 0');
    },
    async transaction(work) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit();
        return result;
      } catch (error) {
        try { await connection.rollback(); } catch { /* Preserve the original failure. */ }
        throw error;
      } finally { connection.release(); }
    },
    async close() { await pool.end(); },
  };
}
