import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createAuthController } from '../controllers/authController.js';
import { createMutationProtection } from '../middlewares/securityMiddleware.js';

export function createAuthRoutes({ config, authService, clock }) {
  const router = Router();
  const controller = createAuthController(authService, config, clock);
  const protect = createMutationProtection(config);
  const limited = (max) => rateLimit({
    windowMs: config.rateLimit.windowMs, limit: max,
    standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Aguarde antes de tentar novamente.' } }),
  });
  const credentialsLimiter = limited(config.rateLimit.max);
  const sessionLimiter = limited(Math.max(config.rateLimit.max, 60));
  router.post('/register', protect, credentialsLimiter, controller.register);
  router.post('/login', protect, credentialsLimiter, controller.login);
  router.post('/refresh', protect, sessionLimiter, controller.refresh);
  router.post('/logout', protect, sessionLimiter, controller.logout);
  return router;
}
