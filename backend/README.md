# Closet Digital — Backend, etapa 1

API de fundação e autenticação em JavaScript, Node.js 24 LTS, Express e MySQL, com ES Modules e SQL parametrizado por `mysql2/promise`. O frontend React permanece demonstrativo e não foi conectado nem alterado nesta etapa.

**Situação da verificação:** a execução contra MySQL real depende de configurar um servidor e fornecer credenciais válidas. A conclusão desta etapa foi solicitada com testes sem MySQL; a validação real fica pendente por ausência de configuração para executá-la agora. Não há resultado confirmado de conexão, handshake TLS ou testes de integração com MySQL neste ambiente. Testes com dependências substituídas não comprovam persistência, bloqueios ou transações no MySQL.

## Requisitos e instalação

- Node.js **24 LTS** e npm; a versão está indicada em `.nvmrc` e `package.json`.
- MySQL **8.0 ou superior**, com InnoDB e suporte a `utf8mb4`.
- Cliente MySQL para aplicar o schema. Postman, Insomnia ou Thunder Client podem testar a API.

Execute a partir de `backend/`:

```powershell
npm ci
Copy-Item .env.example .env
```

Edite `.env` com os dados reais do seu ambiente. Não versione esse arquivo e não copie credenciais de produção para testes.

Gere um segredo com o comando abaixo e execute-o novamente para gerar o segundo. Configure valores **diferentes**, aleatórios, com pelo menos 32 bytes em `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET`; não use as palavras ilustrativas de exemplos como segredos.

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

O primeiro segredo assina o JWT de acesso. O segundo é a chave HMAC dos hashes dos refresh tokens opacos; o refresh token **não é um JWT**. Alterar essas chaves invalida as credenciais associadas, portanto preserve-as em armazenamento de segredos do ambiente.

## Banco de dados

O banco esperado é `closet_digital`. Se ele já existe, utilize-o. Caso precise criá-lo, um administrador do MySQL pode executar:

```sql
CREATE DATABASE IF NOT EXISTS closet_digital
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

A partir de `backend/`, aplique o arquivo selecionando explicitamente o banco no cliente:

```powershell
mysql -h localhost -P 3306 -u seu_usuario -p --database=closet_digital --execute="source database/schema.sql"
```

Ajuste host, porta e usuário aos dados fornecidos pelo seu MySQL; `-p` solicita a senha sem gravá-la no comando. O cliente MySQL não carrega `.env` automaticamente. O uso de `--execute` evita a sintaxe de redirecionamento de entrada `<`, indisponível no PowerShell.

`database/schema.sql` não contém `USE`, `CREATE DATABASE`, `DROP` ou `TRUNCATE`. Ele cria somente as tabelas desta etapa com `CREATE TABLE IF NOT EXISTS`:

| Tabela | Conteúdo |
| --- | --- |
| `users` | UUID, nome, e-mail único normalizado, hash bcrypt, avatar opcional e datas automáticas. |
| `auth_sessions` | Família de sessão por login/dispositivo, expiração absoluta e revogação. |
| `auth_refresh_tokens` | Hashes HMAC-SHA-256 dos tokens, consumo e vínculo com o sucessor para detectar reutilização. |

Os identificadores são strings UUID v4. Nome e e-mail são obrigatórios; `avatar_url` inicia como `NULL`. E-mails são normalizados com `trim()` e letras minúsculas antes de consultas e gravações. Senhas e refresh tokens em texto puro não são gravados no banco.

`CREATE TABLE IF NOT EXISTS` não migra estruturas de tabelas existentes. Se houver tabelas antigas com os mesmos nomes, compare seu schema antes de usar o serviço. Não há tabelas de peças, conjuntos ou favoritos.

Para execução normal, prefira um usuário limitado ao banco da aplicação com permissões `SELECT`, `INSERT` e `UPDATE`; a criação das tabelas pode ser feita por uma credencial administrativa separada. Não use `root` em produção.

## Configuração

`.env.example` lista as variáveis suportadas. Configurações obrigatórias são validadas antes de iniciar o servidor.

| Variável | Uso e valor de referência |
| --- | --- |
| `NODE_ENV` | `development`, `test` ou `production`. |
| `HOST`, `PORT` | Interface e porta HTTP; `127.0.0.1` e `3001` localmente. Para exposição por um serviço hospedado, configure a interface necessária. |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexão real; banco padrão de exemplo `closet_digital`. Senha é obrigatória em produção. |
| `DB_CONNECTION_LIMIT`, `DB_CONNECT_TIMEOUT_MS` | Tamanho do pool e prazo de conexão; `10` e `10000` no exemplo. |
| `DB_SSL` | `true` quando o provedor exige TLS. |
| `DB_SSL_CA_PATH` | Caminho do certificado CA PEM fornecido pelo provedor, quando necessário. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Segredos diferentes e aleatórios, de pelo menos 32 bytes cada. |
| `JWT_ACCESS_EXPIRES_IN` | `5m`; permitido de 30 segundos a 15 minutos, com unidade explícita (`s`, `m`, `h`, `d`). |
| `JWT_REFRESH_EXPIRES_IN` | `7d`; expiração absoluta da família, permitida de 60 segundos a 30 dias. |
| `JWT_ISSUER`, `JWT_AUDIENCE` | Identificadores esperados e verificados no JWT. |
| `BCRYPT_ROUNDS` | `12` por padrão; de 12 a 15 fora de testes. Testes podem usar 4. |
| `FRONTEND_URL` | Origem exata do frontend, como `http://localhost:5173`; deve constar em `CORS_ORIGIN`. |
| `CORS_ORIGIN` | Lista de origens exatas separadas por vírgula, sem caminho, barra final ou `*`. |
| `COOKIE_NAME` | `closet_refresh`; nome simples do cookie de refresh. |
| `COOKIE_SECURE`, `COOKIE_SAME_SITE` | `false` e `lax` localmente; produção exige `Secure`. `none` também exige `Secure`. |
| `TRUST_PROXY` | `false` ou lista explícita de IPs/CIDRs dos proxies confiáveis; aceita `loopback` para um proxy local controlado. Não use `true` nem número de saltos. |
| `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX` | Janela de 900000 ms e limite compartilhado de 20 tentativas de cadastro/login por IP no exemplo. |
| `API_RATE_LIMIT_MAX` | Limite geral de 300 requisições por IP na mesma janela no exemplo. |

O pool usa `utf8mb4`, datas em UTC, fila limitada e consultas parametrizadas. TLS mantém a verificação de certificado e de identidade do host ativas (`rejectUnauthorized: true` e `verifyIdentity: true`); não há opção para desativá-las. Configure a CA correta em vez de contornar a verificação.

## Inicialização e scripts

```powershell
npm run db:check
npm run dev
```

`db:check` verifica a conexão e as tabelas de autenticação. O servidor também verifica esses requisitos antes de aceitar requisições e encerra a inicialização se houver falha. Corrija host, credenciais, permissões, certificado ou schema conforme a mensagem sanitizada.

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Servidor com reinício automático pelo `node --watch`. |
| `npm start` | Servidor sem observação de arquivos. |
| `npm test` | Testes independentes do banco, com doubles nas dependências de persistência. |
| `npm run test:integration` | Suíte opt-in contra MySQL real separado; exige a configuração descrita adiante. |
| `npm run db:check` | Verificação do banco configurado no `.env`, sem escrever dados de aplicação. |

A URL local padrão é `http://localhost:3001`. Para verificar prontidão, consulte `GET /api/health`: o retorno saudável é `{"data":{"status":"ok","database":"up"}}`. Essa rota consulta o MySQL; indisponibilidade do banco produz erro, e não uma indicação fictícia de saúde.

## Contratos HTTP

| Método | Rota | Autenticação/resultado |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Cria usuário e sessão; retorna `201`, usuário público e access token. |
| `POST` | `/api/auth/login` | Valida credenciais; retorna `200`, usuário público e access token. |
| `POST` | `/api/auth/refresh` | Recebe refresh pelo cookie e o rotaciona; retorna `200` e novo access token. |
| `POST` | `/api/auth/logout` | Revoga a família identificada pelo cookie, remove o cookie e retorna `200`. |
| `GET` | `/api/users/me` | Exige `Authorization: Bearer ...` e sessão ativa; retorna o usuário público. |
| `GET` | `/api/health` | Verifica o servidor e a disponibilidade do banco. |

**Todos os POST em `/api/auth` exigem `Content-Type: application/json` e `X-CSRF-Protection: 1`, inclusive login, cadastro, refresh e logout.** Refresh e logout aceitam um objeto vazio `{}`; não aceitam um refresh token no corpo. Campos não reconhecidos no cadastro e login são rejeitados. O limite global de JSON é 16 KB.

O cabeçalho customizado obrigatório força preflight CORS no navegador e também é exigido de clientes sem `Origin`, como ferramentas de API e clientes nativos. A presença de `Origin` exige correspondência exata com uma origem permitida; `Origin: null` é rejeitado. Na ausência de `Origin`, um `Referer` presente deve ser uma URL válida cuja origem esteja permitida. Sem ambos, o cabeçalho customizado e o JSON continuam obrigatórios. Não desative essa proteção para facilitar testes.

Mantenha o cookie jar do Postman/Insomnia/Thunder Client ativado para o host da API. Cadastro, login e refresh enviam o novo cookie em `Set-Cookie`; refresh e logout precisam devolver o cookie atual. No navegador, utilize `credentials: 'include'` nas chamadas que recebem ou enviam esse cookie. O cookie é `HttpOnly`, restrito a `Path=/api/auth`, sem `Domain`, e não deve ser lido por JavaScript.

### Cadastro

```http
POST /api/auth/register HTTP/1.1
Host: localhost:3001
Content-Type: application/json
X-CSRF-Protection: 1
Origin: http://localhost:5173

{
  "name": "João",
  "email": "joao@exemplo.com",
  "password": "MinhaSenhaLonga123!",
  "confirmPassword": "MinhaSenhaLonga123!"
}
```

Validação: nome de 1 a 100 caracteres após trim e normalização NFC, sem caracteres de controle; e-mail válido de até 254 caracteres; senha de pelo menos 8 caracteres e no máximo **72 bytes UTF-8**, sem caractere nulo; confirmação obrigatória e igual. O limite em bytes impede truncamento silencioso pelo bcrypt: caracteres acentuados e emojis podem ocupar mais de um byte. Senhas não são aparadas nem convertidas para minúsculas.

Resposta `201` ilustrativa:

```json
{
  "data": {
    "user": {
      "id": "2e8c08e5-8d31-4d58-9c1f-37e75db2702d",
      "name": "João",
      "email": "joao@exemplo.com",
      "avatar_url": null
    },
    "accessToken": "JWT_DE_ACESSO_RETORNADO_PELA_API",
    "tokenType": "Bearer",
    "expiresIn": 300
  }
}
```

`expiresIn` é expresso em segundos e acompanha a configuração. O refresh opaco chega exclusivamente no cookie `Set-Cookie`, sem aparecer no JSON. Nenhuma resposta pública contém `password_hash`.

### Login

```http
POST /api/auth/login HTTP/1.1
Host: localhost:3001
Content-Type: application/json
X-CSRF-Protection: 1
Origin: http://localhost:5173

{
  "email": "joao@exemplo.com",
  "password": "MinhaSenhaLonga123!"
}
```

Resposta `200` com o mesmo formato `data.user`, `data.accessToken`, `data.tokenType` e `data.expiresIn` do cadastro. Cada login cria uma família de sessão. Credenciais incorretas produzem `401 INVALID_CREDENTIALS`, com a mensagem genérica `E-mail ou senha incorretos.`. A comparação bcrypt também é executada quando o e-mail não existe.

### Usuário autenticado

Use o **access token** retornado pelo cadastro, login ou refresh:

```http
GET /api/users/me HTTP/1.1
Host: localhost:3001
Authorization: Bearer JWT_DE_ACESSO_RETORNADO_PELA_API
```

Resposta `200`:

```json
{
  "data": {
    "id": "2e8c08e5-8d31-4d58-9c1f-37e75db2702d",
    "name": "João",
    "email": "joao@exemplo.com",
    "avatar_url": null
  }
}
```

O cookie de refresh sozinho não autoriza `/api/users/me`.

### Renovação

O cookie abaixo representa o valor gerenciado automaticamente pelo cookie jar; não use literalmente o marcador no teste.

```http
POST /api/auth/refresh HTTP/1.1
Host: localhost:3001
Content-Type: application/json
X-CSRF-Protection: 1
Origin: http://localhost:5173
Cookie: closet_refresh=VALOR_ATUAL_DO_COOKIE_JAR

{}
```

Resposta `200` com o mesmo JSON autenticado do login e um **novo** cookie. O cookie anterior passa a ser consumido. Em caso de `401`, o cookie é removido e o cliente deve solicitar novo login.

### Logout

```http
POST /api/auth/logout HTTP/1.1
Host: localhost:3001
Content-Type: application/json
X-CSRF-Protection: 1
Origin: http://localhost:5173
Cookie: closet_refresh=VALOR_ATUAL_DO_COOKIE_JAR

{}
```

Resposta `200`:

```json
{ "data": { "message": "Sessão encerrada." } }
```

A família correspondente é revogada e o cookie é removido. Chamadas sem cookie ou com valor desconhecido também encerram o estado local de cookie sem revelar informações sobre sessões. O cliente deve descartar seu access token em memória. Logout afeta a família identificada, não todas as sessões de todos os dispositivos.

### Erros

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos.",
    "fields": {
      "email": "Informe um e-mail válido de até 254 caracteres."
    }
  }
}
```

`fields` é opcional. Não são retornados SQL, stack trace, segredos ou credenciais. O cabeçalho `X-Request-ID` ajuda a correlacionar falhas com logs sanitizados.

| HTTP | Exemplos de códigos |
| --- | --- |
| `400` | `INVALID_JSON` |
| `401` | `AUTH_REQUIRED`, `INVALID_CREDENTIALS`, `INVALID_ACCESS_TOKEN`, `INVALID_SESSION` |
| `403` | `CSRF_REQUIRED`, `ORIGIN_NOT_ALLOWED`, `HTTPS_REQUIRED` |
| `404` | `NOT_FOUND` |
| `409` | `EMAIL_IN_USE` |
| `413` | `PAYLOAD_TOO_LARGE` |
| `415` | `JSON_REQUIRED`, `UNSUPPORTED_ENCODING` |
| `422` | `VALIDATION_ERROR` |
| `429` | `RATE_LIMITED` |
| `500` | `INTERNAL_ERROR` |
| `503` | `DATABASE_UNAVAILABLE` |

## Autenticação e implantação futura

O access token é um JWT HS256, com duração padrão de **5 minutos**, contendo identificador do usuário (`sub`), família de sessão (`sid`) e claims temporais, emissor e público. Assinatura, algoritmo, expiração e claims são verificados. `/api/users/me` também consulta o banco para confirmar que a família permanece ativa: logout e reutilização detectada revogam imediatamente seu acesso, mesmo antes da expiração do JWT.

O refresh é aleatório, opaco e tem 32 bytes de entropia. O banco armazena somente seu hash HMAC. A família criada no login dura **7 dias absolutos** por padrão: uma rotação não amplia esse prazo. A rotação ocorre em transação com bloqueio da família e guarda hashes consumidos para detectar replay. Reutilizar um refresh consumido revoga a família inteira. Os registros ficam disponíveis para essa detecção; esta etapa não inclui um processo agendado de limpeza de sessões expiradas.

O cliente precisa coordenar uma única renovação em andamento (**single-flight**), inclusive entre abas que compartilham o cookie, evitando refresh concorrente e repetição automática. Se o servidor consumir um token e a resposta de rotação se perder antes de atualizar o cookie, tentar novamente com o token antigo provoca revogação: nesse caso, faça novo login. Não há janela de tolerância para replay.

Em desenvolvimento HTTP local, use `COOKIE_SECURE=false`, `COOKIE_SAME_SITE=lax` e origens locais exatas. Prefira o mesmo hostname para frontend e API; alternar entre `localhost` e `127.0.0.1` pode alterar o comportamento de cookies.

Em produção:

- Configure `NODE_ENV=production`, HTTPS no acesso público, `COOKIE_SECURE=true` e segredos por ambiente.
- Configure `CORS_ORIGIN` com cada origem HTTPS permitida, sem wildcard; inclua `FRONTEND_URL`. CORS com credenciais não é irrestrito.
- Para sites distintos que exigem cookies entre sites, use `COOKIE_SAME_SITE=none` com `Secure`. Políticas do navegador que bloqueiam cookies de terceiros ainda podem impedir a sessão; nesse cenário, uma API sob o mesmo site ou um proxy compatível evita essa dependência.
- Quando houver proxy reverso TLS, informe em `TRUST_PROXY` apenas os IPs/CIDRs efetivamente controlados, preserve `X-Forwarded-Proto` corretamente e impeça acesso público direto que contorne o proxy. A API exige requisição segura nos POST de autenticação em produção.
- Ative `DB_SSL=true` quando exigido pelo MySQL hospedado e forneça `DB_SSL_CA_PATH` se houver CA específica.

O limite de cadastro/login é compartilhado por IP. Refresh/logout usam outro limite por IP de pelo menos 60 requisições por janela, além do limite geral da API. Os contadores atuais ficam **em memória, por processo** e reiniciam com o servidor. Antes de operar com múltiplas instâncias, configure um armazenamento compartilhado e reavalie os limites. Não registre corpos de autenticação, tokens, cabeçalhos `Authorization` ou cookies na infraestrutura de logs.

## Testes

Os testes independentes do banco usam doubles apenas no código de teste; a API executada normalmente utiliza sempre MySQL. Eles permitem verificar validação, e-mail duplicado, bcrypt, login, JWT, autorização, rotação/revogação e contratos HTTP sem fingir conexão real. Execute:

```powershell
npm test
```

Para a integração real, crie um banco **separado**, por exemplo `closet_digital_test`, e um usuário MySQL com permissões restritas exclusivamente a ele. Nunca use `closet_digital`, outro banco de desenvolvimento ou produção. O nome de testes deve terminar em `_test`.

Um administrador pode criar o banco:

```sql
CREATE DATABASE IF NOT EXISTS closet_digital_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Aplique o mesmo schema selecionando esse banco explicitamente:

```powershell
mysql -h localhost -P 3306 -u seu_usuario_de_testes -p --database=closet_digital_test --execute="source database/schema.sql"
Copy-Item .env.test.example .env.test
```

Preencha `.env.test` com credenciais exclusivas de testes e dois segredos aleatórios diferentes. Os testes de integração não carregam `.env`. A habilitação exige `RUN_MYSQL_TESTS=1`, `NODE_ENV=test` e banco de nome terminado em `_test`. Mantenha `RUN_MYSQL_TESTS=0` até conferir essas condições; sem opt-in a suíte deve ser ignorada.

```powershell
npm run test:integration
```

A suíte não usa `DROP` nem `TRUNCATE`; dados criados pelos testes devem ser identificados e removidos de forma pontual. Uma execução sem opt-in não demonstra integração funcionando. Se faltarem MySQL, credenciais ou schema, registre a integração como pendente e execute apenas os testes independentes. A verificação real ainda está pendente neste ambiente; este README não declara resultados de execução.

## Integração futura com o frontend

Os arquivos analisados foram `frontend/src/services/authService.js`, `demoStore.js`, `frontend/src/context/ClosetContext.jsx`, `frontend/src/pages/auth/AuthPages.jsx`, `frontend/src/data/mockUser.js`, validação e tratamento de formulários. **Nenhum deles precisa ser alterado nesta etapa.**

| Operação atual | Ligação futura |
| --- | --- |
| `authService.register(values)` | `POST /api/auth/register`, com os mesmos campos `name`, `email`, `password`, `confirmPassword`. Atualizar usuário e sessão antes de navegar para `/home`. |
| `authService.login(values)` | `POST /api/auth/login`, com `email` e `password`. Substituir o usuário demonstrativo pelo usuário real inteiro. |
| `authService.logout()` | `POST /api/auth/logout` e descarte do access token/estado autenticado. |
| Restauração ao abrir/atualizar | `POST /api/auth/refresh`, seguido de uso de `data.user` ou consulta a `GET /api/users/me`. |
| Leitura do usuário | `GET /api/users/me`, com access token no cabeçalho Bearer. |

O frontend ainda não tem cliente HTTP nem configuração de URL da API. Na etapa de integração, pode-se criar `VITE_API_URL=http://localhost:3001/api` no ambiente do Vite e um adaptador de serviços. A configuração do Vite é pública: nunca coloque segredos JWT ou de banco em variáveis `VITE_*`.

O adaptador deverá:

1. Manter access token somente em memória, usar `credentials: 'include'` e os dois cabeçalhos obrigatórios em todos os POST de autenticação. O refresh permanece exclusivamente no cookie `HttpOnly`.
2. Converter `user.avatar_url ?? ''` para o campo atual `user.avatar`; preservar o `id` string retornado pelo backend.
3. Converter `error.fields` da API em `Error.fields`, e `error.message` em `Error.message`, formatos já consumidos por `useFormAction`.
4. Iniciar a autenticação em estado de carregamento e concluir a tentativa de restauração antes de redirecionar rotas privadas. O marcador `session` do `sessionStorage` demonstrativo não comprova sessão real.
5. Coordenar refresh em uma única operação, limitar repetição de requisições e limpar a sessão ao receber erro definitivo de autenticação.
6. Não usar o usuário fictício nem os metadados do `localStorage` como identidade ou autorização. Não copiar automaticamente peças e conjuntos demonstrativos para a conta real.

As mensagens visuais que indicam modo demonstrativo serão avaliadas somente quando a integração for autorizada; a aparência e as funcionalidades atuais continuam preservadas.

## Organização e escopo

`src/config` valida ambiente e prepara o pool; `repositories` contém SQL; `services` contém autenticação, tokens e senhas; `controllers` traduz HTTP e cookies; `middlewares` centraliza autorização, proteção de mutações e erros; `routes` registra endpoints. `src/app.js` monta o Express sem abrir a porta e `src/server.js` conecta as dependências e inicia o serviço. `database/schema.sql` descreve as tabelas e `scripts/check-database.js` verifica a instalação do banco.

Esta entrega não implementa CRUD de peças, conjuntos, favoritos, álbuns, uploads, Cloudinary, edição de perfil, alteração ou recuperação de senha, SMTP/Nodemailer, integração React ou deploy. Os métodos demonstrativos `updateProfile`, `changePassword`, `startRecovery`, `resendCode`, `verifyCode` e `resetPassword` não correspondem a endpoints reais desta etapa.

Os próximos passos são fornecer a configuração real, aplicar o schema, verificar `db:check`, executar a integração em banco separado e revisar os resultados. Novos módulos e a conexão com React devem seguir etapas próprias.

