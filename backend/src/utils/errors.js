export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (fields) this.fields = fields;
  }
}

export class ConfigurationError extends Error {
  constructor(message) { super(message); this.name = 'ConfigurationError'; }
}

export const invalidSession = () => new ApiError(401, 'INVALID_SESSION', 'Sessão inválida ou expirada. Entre novamente.');
export const invalidCredentials = () => new ApiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
