import { PUBLIC_API_URL } from '$env/static/public';

/**
 * The one place that knows how to talk HTTP.
 *
 * Every other service is built on top of this, which is why "add a retry",
 * "send a correlation id", or "log every 401" is a change in one file rather
 * than in thirty `fetch` calls.
 *
 * @import { HttpClient, RequestOptions } from '$lib/types.js'
 */

/** Thrown for any non-2xx response. Carries the status so callers can branch. */
export class ApiError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {string[]} [details]
   */
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

// What the user is told, per status. A lookup, not an if-ladder: a new status
// is a new line, and the default covers everything unmapped.
/** @type {Record<number, string>} */
const MESSAGES = {
  400: 'Dados inválidos.',
  401: 'Sessão expirada. Entre novamente.',
  403: 'Você não tem permissão para isso.',
  404: 'Não encontrado.',
  409: 'Já existe um registro com esses dados.',
  422: 'Não foi possível processar o pedido.',
  429: 'Muitas tentativas. Aguarde um momento.',
  500: 'Erro no servidor. Tente novamente.',
  503: 'Serviço indisponível no momento.',
};

/**
 * @param {number} status
 * @param {{ message?: string } | null} body
 * @returns {string}
 */
const messageFor = (status, body) => body?.message || MESSAGES[status] || 'Erro inesperado.';

/**
 * @param {Response} response
 * @returns {Promise<any>}
 */
const parseBody = async response => {
  if (response.status === 204) return null;

  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

/**
 * @param {Object} options
 * @param {() => string|null} options.getToken            reads the current access token
 * @param {() => void} [options.onUnauthorized]           called on any 401
 * @param {typeof fetch} [options.fetchImpl]              injected in tests
 * @returns {HttpClient}
 */
export const ApiClient = ({ getToken, onUnauthorized, fetchImpl = fetch }) => {
  /**
   * @param {string} path
   * @param {RequestOptions} [options]
   * @returns {Promise<any>}
   */
  const request = async (path, { method = 'GET', body, signal } = {}) => {
    const token = getToken();

    const response = await fetchImpl(`${PUBLIC_API_URL}${path}`, {
      method,
      signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const payload = await parseBody(response);

    if (response.status === 401) onUnauthorized?.();

    if (!response.ok) {
      throw new ApiError(response.status, messageFor(response.status, payload), payload?.details);
    }

    return payload;
  };

  return {
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
    remove: (path, options) => request(path, { ...options, method: 'DELETE' }),
  };
};

export const API_MESSAGES = MESSAGES;
