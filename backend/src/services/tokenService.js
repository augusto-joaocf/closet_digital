import jwt from 'jsonwebtoken';
import { createHmac, randomBytes } from 'node:crypto';
import { isUuid } from '../utils/validation.js';
import { ApiError } from '../utils/errors.js';

export function createTokenService(config, clock = () => new Date()) {
  return {
    issueAccess(userId, sessionId) {
      return jwt.sign({ sid: sessionId, iat: Math.floor(clock().getTime() / 1000) }, config.access.secret, {
        algorithm: 'HS256', subject: userId, issuer: config.access.issuer, audience: config.access.audience,
        expiresIn: config.access.expiresIn,
      });
    },
    verifyAccess(token) {
      try {
        const payload = jwt.verify(token, config.access.secret, {
          algorithms: ['HS256'], issuer: config.access.issuer, audience: config.access.audience,
          clockTimestamp: Math.floor(clock().getTime() / 1000), maxAge: config.access.expiresIn,
        });
        if (!payload || typeof payload !== 'object' || !isUuid(payload.sub) || !isUuid(payload.sid)
          || !Number.isInteger(payload.exp) || !Number.isInteger(payload.iat)
          || payload.exp <= payload.iat || payload.exp - payload.iat > config.access.expiresIn
          || payload.iat > Math.floor(clock().getTime() / 1000)) throw new Error('Invalid claims');
        return { userId: payload.sub, sessionId: payload.sid };
      } catch { throw new ApiError(401, 'INVALID_ACCESS_TOKEN', 'Token de acesso inválido ou expirado.'); }
    },
    newRefresh() { return randomBytes(32).toString('base64url'); },
    validRefresh(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value); },
    hashRefresh(value) { return createHmac('sha256', config.refresh.secret).update(value).digest('hex'); },
  };
}
