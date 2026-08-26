import type { components } from './schema';

const TOKEN_KEY = 'accessToken';
const CORRELATION_KEY = 'correlationId';
const USERNAME_KEY = 'username';
const API_VERSION_KEY = 'apiVersion';

/**
 * The quote API is served four times over the same use cases: v0 by MVC controllers,
 * v1 by minimal APIs, v2 by the proto contract behind a wire-identical adapter, and
 * v3 by stock gRPC-JSON transcoding. The success bodies are identical on all four, so
 * the choice is only about which transport to exercise; the drift lives in v3's
 * errors (the gRPC status envelope, not a problem document) and in its create
 * (200 with the created quote, no Location).
 */
export type ApiVersion = 'v0' | 'v1' | 'v2' | 'v3';

export const API_VERSIONS: readonly ApiVersion[] = ['v0', 'v1', 'v2', 'v3'];

export const DEFAULT_API_VERSION: ApiVersion = 'v1';

function isApiVersion(value: string | null): value is ApiVersion {
  return value !== null && (API_VERSIONS as readonly string[]).includes(value);
}

export function getApiVersion(): ApiVersion {
  const stored = sessionStorage.getItem(API_VERSION_KEY);
  return isApiVersion(stored) ? stored : DEFAULT_API_VERSION;
}

export function setApiVersion(version: ApiVersion) {
  sessionStorage.setItem(API_VERSION_KEY, version);
}

export interface LoginResponse {
  accessToken: string;
  correlationId: string;
  expiresIn: number;
  username: string;
}

// Contract types come from the frozen OpenAPI document (pnpm run gen:api) so the client
// cannot drift from the ratified API. The paging numbers are widened to `number | string`
// by the generator; the contract is numeric, so they are narrowed back here.
type QuoteSchemas = components['schemas'];

export type QuoteResponse = QuoteSchemas['QuoteResponseDto'];

export type CreateQuoteRequest = QuoteSchemas['CreateQuoteRequestDto'];

export interface QuotePageResponse {
  items: QuoteResponse[];
  // v3's transcoding omits proto default values (the zeros), so paging numbers may
  // simply be absent — the fields are optional and consumers default them.
  page?: number;
  pageSize?: number;
  totalItems?: number;
  totalPages?: number;
}

export interface ListQuotesQuery {
  page?: number;
  pageSize?: number;
}

/** The failed API call, with whatever the RFC 9457 problem document could explain. */
export class ApiError extends Error {
  readonly status: number;
  readonly errorCode?: string;

  constructor(status: number, message: string, errorCode?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

interface ProblemShape {
  title?: string | null;
  detail?: string | null;
  errorCode?: string;
  // HttpValidationProblemDetails carries the human explanations keyed by error code.
  errors?: Record<string, string[]>;
}

// v3's transcoding answers failures with the gRPC status envelope instead of a problem
// document: {"code": <int>, "message": "..."} as plain JSON, the message carrying the
// human-readable reason.
interface GrpcStatusShape {
  code?: unknown;
  message?: unknown;
}

/**
 * Picks the most helpful line out of the error body: the validation description when
 * the API rejected input rule by rule, otherwise the problem document's detail, title
 * or error code — and, when the body is no problem document at all, the message of
 * the gRPC status envelope v3 answers with.
 */
async function toApiError(response: Response, fallbackReason: string): Promise<ApiError> {
  const body = await response.json().catch(() => null) as (ProblemShape & GrpcStatusShape) | null;

  const firstValidation = body?.errors
    ? Object.values(body.errors)[0]?.[0]
    : undefined;
  const grpcMessage =
    body && typeof body.message === 'string' && typeof body.code === 'number' && body.message !== ''
      ? body.message
      : undefined;
  const reason =
    firstValidation ?? body?.detail ?? body?.title ?? body?.errorCode ?? grpcMessage ?? fallbackReason;

  return new ApiError(response.status, `${reason} (${response.status})`, body?.errorCode);
}

function createCorrelationId(): string {
  // randomUUID is only exposed in secure contexts, so fall back to raw random bytes.
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function getSession() {
  return {
    accessToken: sessionStorage.getItem(TOKEN_KEY),
    correlationId: sessionStorage.getItem(CORRELATION_KEY),
    username: sessionStorage.getItem(USERNAME_KEY),
  };
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(CORRELATION_KEY);
  sessionStorage.removeItem(USERNAME_KEY);
  // The chosen version is a debugging preference, not credentials; it survives sign-out.
}

export function saveSession(login: LoginResponse) {
  sessionStorage.setItem(TOKEN_KEY, login.accessToken);
  sessionStorage.setItem(CORRELATION_KEY, login.correlationId);
  sessionStorage.setItem(USERNAME_KEY, login.username);
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const correlationId = createCorrelationId();
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-Id': correlationId,
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw await toApiError(response, 'Invalid credentials');
  }

  const data = (await response.json()) as LoginResponse;
  saveSession(data);
  return data;
}

async function authedFetch(path: string, init: RequestInit, fallbackReason: string): Promise<Response> {
  const { accessToken, correlationId } = getSession();
  if (!accessToken || !correlationId) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(path, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
      'X-Correlation-Id': correlationId,
    },
  });

  if (!response.ok) {
    throw await toApiError(response, fallbackReason);
  }

  return response;
}

export async function getRandomQuote(version: ApiVersion = getApiVersion()): Promise<QuoteResponse> {
  const response = await authedFetch(`/api/${version}/quotes/random`, {}, 'Quote request failed');
  return (await response.json()) as QuoteResponse;
}

export async function listQuotes(
  query: ListQuotesQuery = {},
  version: ApiVersion = getApiVersion(),
): Promise<QuotePageResponse> {
  const params = new URLSearchParams();
  if (query.page !== undefined) {
    params.set('page', String(query.page));
  }
  if (query.pageSize !== undefined) {
    params.set('pageSize', String(query.pageSize));
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : '';

  const response = await authedFetch(`/api/${version}/quotes${suffix}`, {}, 'Failed to load quotes');
  return (await response.json()) as QuotePageResponse;
}

export async function createQuote(
  request: CreateQuoteRequest,
  version: ApiVersion = getApiVersion(),
): Promise<QuoteResponse> {
  const response = await authedFetch(
    `/api/${version}/quotes`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
    'Failed to publish quote',
  );
  return (await response.json()) as QuoteResponse;
}
