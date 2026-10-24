import { loadEnv } from '../src/config/env.js';
import { createDatabase } from '../src/config/database.js';
import { ConfigurationError } from '../src/utils/errors.js';

let database;
try {
  const config = loadEnv();
  database = createDatabase(config.db);
  await database.check();
  await database.checkSchema();
  console.log('Conexão MySQL e tabelas de autenticação verificadas.');
} catch (error) {
  if (error instanceof ConfigurationError) console.error('Configuração inválida: ' + error.message);
  else console.error('Falha ao verificar MySQL. Confira host, credenciais, TLS e schema. Código: ' + (/^[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'DATABASE_CHECK_FAILED'));
  process.exitCode = 1;
} finally { if (database) await database.close().catch(() => {}); }
