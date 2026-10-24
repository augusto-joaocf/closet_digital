import dotenv from 'dotenv';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';
import { ConfigurationError } from '../utils/errors.js';

function fail(name, rule) { throw new ConfigurationError(name + ': ' + rule); }
function integer(source, name, fallback, min, max) {
  const value = source[name] ?? String(fallback);
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) fail(name, 'informe um inteiro entre ' + min + ' e ' + max + '.');
  return Number(value);
}
function boolean(source, name, fallback) {
  const value = source[name] ?? String(fallback);
  if (!['true', 'false'].includes(value)) fail(name, 'use true ou false.');
  return value === 'true';
}
function secret(source, name) {
  const value = source[name];
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') < 32 || new Set(value).size < 8
    || /change.?me|your.?secret|troque|substitua|exemplo|example|placeholder/i.test(value)) fail(name, 'configure um segredo aleatório de pelo menos 32 bytes, sem placeholders.');
  return value;
}
function duration(source, name, fallback, min, max) {
  const text = source[name] ?? fallback;
  const match = /^(\d+)(s|m|h|d)$/.exec(text);
  if (!match) fail(name, 'use uma duração explícita, como 5m ou 7d.');
  const seconds = Number(match[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 })[match[2]];
  if (!Number.isSafeInteger(seconds) || seconds < min || seconds > max) fail(name, 'duração fora dos limites permitidos.');
  return seconds;
}
function origin(value, name, production) {
  let url;
  try { url = new URL(value); } catch { fail(name, 'informe uma origem HTTP(S) válida.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value || url.username || url.password
    || value === 'null' || value.includes('*')) fail(name, 'use somente a origem exata, sem caminho, barra final ou wildcard.');
  if (production && url.protocol !== 'https:') fail(name, 'HTTPS é obrigatório em produção.');
  return url.origin;
}
function proxies(text) {
  if (!text || text === 'false') return false;
  const items = text.split(',').map((item) => item.trim());
  if (!items.length || items.some((item) => {
    if (item === 'loopback') return false;
    const [address, mask, extra] = item.split('/');
    const version = isIP(address);
    return extra !== undefined || !version || (mask !== undefined && (!/^\d+$/.test(mask) || Number(mask) > (version === 4 ? 32 : 128)));
  })) fail('TRUST_PROXY', 'use false, loopback ou uma lista explícita de IPs/CIDRs confiáveis.');
  return items;
}

export function readEnv(source = process.env) {
  const nodeEnv = source.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) fail('NODE_ENV', 'use development, test ou production.');
  const production = nodeEnv === 'production';
  const accessSecret = secret(source, 'JWT_ACCESS_SECRET');
  const refreshSecret = secret(source, 'JWT_REFRESH_SECRET');
  if (accessSecret === refreshSecret) fail('JWT_REFRESH_SECRET', 'deve ser diferente de JWT_ACCESS_SECRET.');
  for (const name of ['DB_HOST', 'DB_USER', 'DB_NAME']) {
    if (typeof source[name] !== 'string' || !source[name].trim()) fail(name, 'configuração obrigatória.');
  }
  if (!/^[a-zA-Z0-9_]+$/.test(source.DB_NAME)) fail('DB_NAME', 'use somente letras, números e sublinhado.');
  const cookieSecure = boolean(source, 'COOKIE_SECURE', production);
  const sameSite = source.COOKIE_SAME_SITE || 'lax';
  if (!['strict', 'lax', 'none'].includes(sameSite)) fail('COOKIE_SAME_SITE', 'use strict, lax ou none.');
  if ((production || sameSite === 'none') && !cookieSecure) fail('COOKIE_SECURE', 'Secure é obrigatório em produção e com SameSite=None.');
  if (production && !source.DB_PASSWORD) fail('DB_PASSWORD', 'senha obrigatória em produção.');
  const frontendUrl = origin(source.FRONTEND_URL || 'http://localhost:5173', 'FRONTEND_URL', production);
  const allowedOrigins = [...new Set((source.CORS_ORIGIN || frontendUrl).split(',').map((item) => origin(item.trim(), 'CORS_ORIGIN', production)))];
  if (!allowedOrigins.includes(frontendUrl)) fail('CORS_ORIGIN', 'inclua a origem definida em FRONTEND_URL.');
  const cookieName = source.COOKIE_NAME || 'closet_refresh';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(cookieName) || cookieName.startsWith('__Host-') || cookieName.startsWith('__Secure-')) fail('COOKIE_NAME', 'nome simples inválido; prefixos reservados não são aceitos com este Path.');
  const issuer = source.JWT_ISSUER || 'closet-digital-api';
  const audience = source.JWT_AUDIENCE || 'closet-digital-client';
  if (issuer.length > 200 || audience.length > 200 || !issuer.trim() || !audience.trim()) fail('JWT_ISSUER/JWT_AUDIENCE', 'identificadores inválidos.');
  return {
    nodeEnv,
    production,
    host: source.HOST || '127.0.0.1',
    port: integer(source, 'PORT', 3001, 1, 65535),
    trustProxy: proxies(source.TRUST_PROXY),
    allowedOrigins,
    frontendUrl,
    jsonLimit: '16kb',
    bcryptRounds: integer(source, 'BCRYPT_ROUNDS', 12, nodeEnv === 'test' ? 4 : 12, 15),
    access: { secret: accessSecret, expiresIn: duration(source, 'JWT_ACCESS_EXPIRES_IN', '5m', 30, 900), issuer, audience },
    refresh: { secret: refreshSecret, expiresIn: duration(source, 'JWT_REFRESH_EXPIRES_IN', '7d', 60, 30 * 86400) },
    cookie: { name: cookieName, secure: cookieSecure, sameSite, path: '/api/auth' },
    rateLimit: {
      windowMs: integer(source, 'AUTH_RATE_LIMIT_WINDOW_MS', 900000, 1000, 86400000),
      max: integer(source, 'AUTH_RATE_LIMIT_MAX', 20, 1, 1000),
      apiMax: integer(source, 'API_RATE_LIMIT_MAX', 300, 1, 100000),
    },
    db: {
      host: source.DB_HOST,
      port: integer(source, 'DB_PORT', 3306, 1, 65535),
      user: source.DB_USER,
      password: source.DB_PASSWORD || '',
      database: source.DB_NAME,
      connectionLimit: integer(source, 'DB_CONNECTION_LIMIT', 10, 1, 100),
      connectTimeout: integer(source, 'DB_CONNECT_TIMEOUT_MS', 10000, 1000, 60000),
      sslEnabled: boolean(source, 'DB_SSL', false),
      sslCaPath: source.DB_SSL_CA_PATH || '',
    },
  };
}

export function loadEnv() {
  dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
  return readEnv();
}
