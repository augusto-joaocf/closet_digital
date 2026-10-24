import { pathToFileURL } from 'node:url';
import { loadEnv } from './config/env.js';
import { createDatabase } from './config/database.js';
import { createUserRepository } from './repositories/userRepository.js';
import { createSessionRepository } from './repositories/sessionRepository.js';
import { createPasswordService } from './services/passwordService.js';
import { createTokenService } from './services/tokenService.js';
import { createAuthService } from './services/authService.js';
import { createApp } from './app.js';
import { ConfigurationError } from './utils/errors.js';

export async function startServer() {
  const config = loadEnv();
  const database = createDatabase(config.db);
  let server;
  try {
    await database.check();
    await database.checkSchema();
    const passwords = await createPasswordService(config.bcryptRounds);
    const authService = createAuthService({
      database, passwords, config,
      users: createUserRepository(database),
      sessions: createSessionRepository(database),
      tokens: createTokenService(config),
    });
    const app = createApp({ config, authService, database });
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(config.port, config.host, () => resolve(listener));
      listener.once('error', reject);
    });
    console.log('Closet Digital API escutando na porta ' + config.port + '.');
    let closing = false;
    const shutdown = async () => {
      if (closing) return;
      closing = true;
      const timeout = setTimeout(() => { server.closeAllConnections(); process.exitCode = 1; }, 10000);
      timeout.unref();
      await new Promise((resolve) => server.close(resolve));
      await database.close();
      clearTimeout(timeout);
    };
    process.once('SIGINT', () => { shutdown().catch(() => { process.exitCode = 1; }); });
    process.once('SIGTERM', () => { shutdown().catch(() => { process.exitCode = 1; }); });
    return { app, server, database, shutdown };
  } catch (error) {
    await database.close().catch(() => {});
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    if (error instanceof ConfigurationError) console.error('Configuração inválida: ' + error.message);
    else console.error('Não foi possível iniciar a API. Verifique conexão, permissões, TLS e schema do MySQL. Código: ' + (/^[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'STARTUP_FAILED'));
    process.exitCode = 1;
  });
}
