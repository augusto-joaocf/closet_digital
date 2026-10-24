import { ApiError } from '../utils/errors.js';

export function createMutationProtection(config) {
  return (req, res, next) => {
    // A mandatory custom header forces browser requests through CORS preflight.
    // Missing Origin is not a bypass: this independent AJAX CSRF defense remains required.
    if (req.get('X-CSRF-Protection') !== '1') throw new ApiError(403, 'CSRF_REQUIRED', 'Inclua o cabeçalho X-CSRF-Protection: 1.');
    const origin = req.get('Origin');
    const referer = req.get('Referer');
    if (origin !== undefined) {
      if (!config.allowedOrigins.includes(origin)) throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Origem não autorizada.');
    } else if (referer !== undefined) {
      let source;
      try { source = new URL(referer).origin; } catch { throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Origem não autorizada.'); }
      if (!config.allowedOrigins.includes(source)) throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Origem não autorizada.');
    }
    if (!req.is('application/json')) throw new ApiError(415, 'JSON_REQUIRED', 'Utilize Content-Type: application/json.');
    if (config.production && !req.secure) throw new ApiError(403, 'HTTPS_REQUIRED', 'HTTPS é obrigatório.');
    next();
  };
}
