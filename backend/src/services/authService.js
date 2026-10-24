import { randomUUID } from 'node:crypto';
import { validateAuth } from '../utils/validation.js';
import { ApiError, invalidCredentials, invalidSession } from '../utils/errors.js';
import { publicUser } from '../utils/publicUser.js';

export function createAuthService({ database, users, sessions, passwords, tokens, config, clock = () => new Date(), uuid = randomUUID }) {
  function newSession(userId) {
    const refreshToken = tokens.newRefresh();
    const session = { id: uuid(), user_id: userId, expires_at: new Date(clock().getTime() + config.refresh.expiresIn * 1000) };
    const token = { id: uuid(), hash: tokens.hashRefresh(refreshToken) };
    return { session, token, refreshToken };
  }
  function authenticated(user, session, refreshToken) {
    return {
      data: { user: publicUser(user), accessToken: tokens.issueAccess(user.id, session.id), tokenType: 'Bearer', expiresIn: config.access.expiresIn },
      refreshToken,
      refreshExpiresAt: session.expires_at,
    };
  }
  const duplicateEmail = () => new ApiError(409, 'EMAIL_IN_USE', 'Este e-mail já está cadastrado.', { email: 'Este e-mail já está cadastrado.' });
  return {
    async register(body) {
      const values = validateAuth(body, true);
      if (await users.findByEmail(values.email)) throw duplicateEmail();
      const user = { id: uuid(), name: values.name, email: values.email, password_hash: await passwords.hash(values.password) };
      const fresh = newSession(user.id);
      try {
        return await database.transaction(async (connection) => {
          const created = await users.insert(user, connection);
          await sessions.insert(fresh.session, fresh.token, connection);
          return authenticated(created, fresh.session, fresh.refreshToken);
        });
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') throw duplicateEmail();
        throw error;
      }
    },
    async login(body) {
      const values = validateAuth(body);
      const user = await users.findByEmail(values.email);
      const matches = await passwords.compare(values.password, user?.password_hash);
      if (!user || !matches) throw invalidCredentials();
      const fresh = newSession(user.id);
      return database.transaction(async (connection) => {
        await sessions.insert(fresh.session, fresh.token, connection);
        return authenticated(user, fresh.session, fresh.refreshToken);
      });
    },
    async refresh(refreshToken) {
      if (!tokens.validRefresh(refreshToken)) throw invalidSession();
      const successor = tokens.newRefresh();
      const outcome = await sessions.rotate(tokens.hashRefresh(refreshToken), { id: uuid(), hash: tokens.hashRefresh(successor) }, clock());
      if (outcome.kind !== 'rotated') throw invalidSession();
      return authenticated(outcome.user, outcome.session, successor);
    },
    async logout(refreshToken) {
      if (tokens.validRefresh(refreshToken)) await sessions.revokeByHash(tokens.hashRefresh(refreshToken), clock());
    },
    async authenticate(accessToken) {
      const { userId, sessionId } = tokens.verifyAccess(accessToken);
      const user = await sessions.activeUser(sessionId, userId, clock());
      if (!user) throw invalidSession();
      return publicUser(user);
    },
  };
}
