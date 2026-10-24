import { validateEmptyBody } from '../utils/validation.js';

export function createAuthController(authService, config, clock = () => new Date()) {
  const cookieOptions = { httpOnly: true, secure: config.cookie.secure, sameSite: config.cookie.sameSite, path: config.cookie.path };
  const clear = (res) => res.clearCookie(config.cookie.name, cookieOptions);
  const respond = (res, result, status = 200) => {
    res.cookie(config.cookie.name, result.refreshToken, {
      ...cookieOptions,
      maxAge: Math.max(0, result.refreshExpiresAt.getTime() - clock().getTime()),
      expires: result.refreshExpiresAt,
    });
    res.status(status).json({ data: result.data });
  };
  return {
    register: async (req, res) => respond(res, await authService.register(req.body), 201),
    login: async (req, res) => respond(res, await authService.login(req.body)),
    refresh: async (req, res) => {
      validateEmptyBody(req.body);
      try { respond(res, await authService.refresh(req.cookies[config.cookie.name])); }
      catch (error) { if (error.status === 401) clear(res); throw error; }
    },
    logout: async (req, res) => {
      validateEmptyBody(req.body);
      await authService.logout(req.cookies[config.cookie.name]);
      clear(res);
      res.json({ data: { message: 'Sessão encerrada.' } });
    },
    me: async (req, res) => res.json({ data: req.auth.user }),
  };
}
