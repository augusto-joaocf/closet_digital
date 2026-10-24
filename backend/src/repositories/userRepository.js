export function createUserRepository(database) {
  return {
    async findByEmail(email, executor = database.pool) {
      const [rows] = await executor.execute('SELECT id, name, email, password_hash, avatar_url FROM users WHERE email = ? LIMIT 1', [email]);
      return rows[0] || null;
    },
    async insert(user, executor) {
      await executor.execute('INSERT INTO users (id, name, email, password_hash, avatar_url) VALUES (?, ?, ?, ?, NULL)', [user.id, user.name, user.email, user.password_hash]);
      return { ...user, avatar_url: null };
    },
  };
}
