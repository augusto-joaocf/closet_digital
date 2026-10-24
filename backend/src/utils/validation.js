import isEmail from 'validator/lib/isEmail.js';
import { ApiError } from './errors.js';

export function normalizeEmail(value) { return value.trim().toLowerCase(); }
export function isUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
export function validateAuth(body, register = false) {
  const fields = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(422, 'VALIDATION_ERROR', 'Dados inválidos.', { form: 'Envie um objeto JSON.' });
  const allowed = register ? ['name', 'email', 'password', 'confirmPassword'] : ['email', 'password'];
  if (Object.keys(body).some((key) => !allowed.includes(key))) fields.form = 'Existem campos não reconhecidos.';
  const name = typeof body.name === 'string' ? body.name.trim().normalize('NFC') : '';
  if (register && (Array.from(name).length < 1 || Array.from(name).length > 100 || /[\u0000-\u001f\u007f]/.test(name))) fields.name = 'Informe um nome de 1 a 100 caracteres.';
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  if (email.length > 254 || !isEmail(email, { allow_utf8_local_part: false, require_tld: true })) fields.email = 'Informe um e-mail válido de até 254 caracteres.';
  const password = body.password;
  if (typeof password !== 'string' || Array.from(password).length < 8 || Buffer.byteLength(password, 'utf8') > 72 || password.includes('\u0000')) fields.password = 'Use de 8 caracteres a 72 bytes UTF-8, sem caractere nulo.';
  if (register && (typeof body.confirmPassword !== 'string' || !body.confirmPassword || body.confirmPassword !== password)) fields.confirmPassword = 'As senhas devem ser preenchidas e coincidir.';
  if (Object.keys(fields).length) throw new ApiError(422, 'VALIDATION_ERROR', 'Dados inválidos.', fields);
  return { ...(register ? { name } : {}), email, password };
}
export function validateEmptyBody(body) {
  if (body !== undefined && (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length)) throw new ApiError(422, 'VALIDATION_ERROR', 'Esta operação espera um objeto JSON vazio.');
}
