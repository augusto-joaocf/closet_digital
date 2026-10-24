import { ApiError } from '../utils/errors.js';

export function createAuthMiddleware(authService) {
  return async (req, res, next) => {
    const header = req.get('Authorization');
    if (!header) throw new ApiError(401, 'AUTH_REQUIRED', 'Autenticação necessária.');
    const match = /^Bearer ([^\s]+)$/i.exec(header);
    if (!match || match[1].length > 4096) throw new ApiError(401, 'INVALID_ACCESS_TOKEN', 'Token de acesso inválido ou expirado.');
    req.auth = { user: await authService.authenticate(match[1]) };
    next();
  };
}
