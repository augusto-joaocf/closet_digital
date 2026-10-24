import { ApiError } from '../utils/errors.js';

const databaseCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'PROTOCOL_CONNECTION_LOST', 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR', 'ER_CON_COUNT_ERROR', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']);
export function createErrorMiddleware(logger = console) {
  return (error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Não foi possível concluir a solicitação.';
    let fields;
    if (error instanceof ApiError) ({ status, code, message, fields } = error);
    else if (error.type === 'entity.parse.failed') { status = 400; code = 'INVALID_JSON'; message = 'JSON inválido.'; }
    else if (error.type === 'entity.too.large') { status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'O corpo da requisição excede 16 KB.'; }
    else if (error.type === 'encoding.unsupported' || error.type === 'charset.unsupported') { status = 415; code = 'UNSUPPORTED_ENCODING'; message = 'Codificação da requisição não suportada.'; }
    else if (databaseCodes.has(error.code)) { status = 503; code = 'DATABASE_UNAVAILABLE'; message = 'Serviço temporariamente indisponível. Tente novamente.'; }
    // Deliberately omit error.message, stack, SQL, request body, URLs, cookies and headers.
    if (status >= 500) logger.error(JSON.stringify({ event: 'request_failed', requestId: req.requestId, code, ...(databaseCodes.has(error.code) ? { databaseCode: error.code } : {}) }));
    res.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) } });
  };
}
