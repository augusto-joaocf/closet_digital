// All session mutations serialize on the family row. Do not replace locking reads
// with an earlier snapshot: InnoDB REPEATABLE READ can otherwise admit a stale token.
export function createSessionRepository(database) {
  const insertToken = (executor, token, session) => executor.execute(
    'INSERT INTO auth_refresh_tokens (id, session_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    [token.id, session.id, token.hash, session.expires_at],
  );
  return {
    async insert(session, token, executor) {
      await executor.execute('INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?, ?, ?)', [session.id, session.user_id, session.expires_at]);
      await insertToken(executor, token, session);
    },
    async activeUser(sessionId, userId, now) {
      const [rows] = await database.pool.execute(
        'SELECT u.id, u.name, u.email, u.avatar_url FROM users u INNER JOIN auth_sessions s ON s.user_id = u.id WHERE s.id = ? AND s.user_id = ? AND s.revoked_at IS NULL AND s.expires_at > ? LIMIT 1',
        [sessionId, userId, now],
      );
      return rows[0] || null;
    },
    async rotate(hash, successor, now) {
      return database.transaction(async (connection) => {
        const [lookup] = await connection.execute('SELECT session_id FROM auth_refresh_tokens WHERE token_hash = ? LIMIT 1', [hash]);
        if (!lookup[0]) return { kind: 'invalid' };
        const [sessions] = await connection.execute('SELECT id, user_id, expires_at, revoked_at FROM auth_sessions WHERE id = ? FOR UPDATE', [lookup[0].session_id]);
        const session = sessions[0];
        if (!session || session.revoked_at || session.expires_at.getTime() <= now.getTime()) return { kind: 'invalid' };
        const [tokens] = await connection.execute('SELECT id, expires_at, consumed_at FROM auth_refresh_tokens WHERE token_hash = ? AND session_id = ? FOR UPDATE', [hash, session.id]);
        const token = tokens[0];
        if (!token) return { kind: 'invalid' };
        if (token.consumed_at) {
          await connection.execute('UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', [now, session.id]);
          // Return instead of throwing so transaction() COMMITs revocation before the 401.
          return { kind: 'reused' };
        }
        if (token.expires_at.getTime() <= now.getTime()) return { kind: 'invalid' };
        await insertToken(connection, successor, session);
        const [updated] = await connection.execute('UPDATE auth_refresh_tokens SET consumed_at = ?, replaced_by_id = ? WHERE id = ? AND consumed_at IS NULL', [now, successor.id, token.id]);
        if (updated.affectedRows !== 1) throw new Error('Refresh rotation invariant failed');
        const [users] = await connection.execute('SELECT id, name, email, avatar_url FROM users WHERE id = ? LIMIT 1', [session.user_id]);
        if (!users[0]) throw new Error('Session owner missing');
        return { kind: 'rotated', session, user: users[0] };
      });
    },
    async revokeByHash(hash, now) {
      return database.transaction(async (connection) => {
        const [tokens] = await connection.execute('SELECT session_id FROM auth_refresh_tokens WHERE token_hash = ? LIMIT 1', [hash]);
        if (!tokens[0]) return;
        const [sessions] = await connection.execute('SELECT id FROM auth_sessions WHERE id = ? FOR UPDATE', [tokens[0].session_id]);
        if (sessions[0]) await connection.execute('UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', [now, sessions[0].id]);
      });
    },
  };
}
