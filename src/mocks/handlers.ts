import { http, HttpResponse } from 'msw';
import { API_VERSIONS, type QuoteResponse } from '../api/client';
import { seededQuotes, seededUsers, type MockUser } from './seed';

/**
 * The mocked quotes platform: one handler set covering the auth API and all four quote
 * transports (v0, v1 and v2 serve the same catalog and envelopes, mirroring the
 * backend's parity; v3 serves it with the transcoding drift — gRPC status errors and
 * 200 on create). Domain rules reproduce the behaviors the suites assert on — invalid
 * credentials, the twelve-character text rule, the near-duplicate fingerprint guard
 * and the read-only account's missing write scope — with RFC 9457 problem bodies
 * shaped like the API's envelope (title/detail/errorCode, validation errors keyed by
 * error code).
 *
 * `createHandlers()` closes over a fresh catalog, so every consumer (test file,
 * Storybook story, browser session) starts from the seeded eight quotes and any
 * quotes it publishes are visible to its later requests — and to nobody else.
 */

function problem(status: number, body: Record<string, unknown>): Response {
  return HttpResponse.json(body, {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

// v3's drift from the problem envelope: stock gRPC-JSON transcoding answers failures
// with the gRPC status shape — {"code": <int>, "message": "..."} as plain JSON.
const GRPC_CODES: Record<number, number> = {
  400: 3, // INVALID_ARGUMENT
  401: 16, // UNAUTHENTICATED
  403: 7, // PERMISSION_DENIED
  404: 5, // NOT_FOUND
  409: 6, // ALREADY_EXISTS
};

/** The line the UI should show: the first validation reason, else the detail, else the title. */
function problemReason(body: Record<string, unknown>): string {
  const errors = body.errors as Record<string, string[]> | undefined;
  const validation = errors ? Object.values(errors)[0]?.[0] : undefined;
  return validation ?? (body.detail as string | undefined) ?? (body.title as string | undefined) ?? 'Request failed.';
}

/** Answers a failure the way the transport in `version` answers it. */
type Fail = (status: number, body: Record<string, unknown>) => Response;

function failWith(version: string | readonly string[] | undefined): Fail {
  return version === 'v3'
    ? (status, body) =>
        HttpResponse.json(
          { code: GRPC_CODES[status] ?? 13, message: problemReason(body) }, // 13 = INTERNAL
          { status, headers: { 'Content-Type': 'application/json' } },
        )
    : problem;
}

function findByToken(authorization: string | null): MockUser | undefined {
  if (!authorization?.startsWith('Bearer ')) {
    return undefined;
  }
  const token = authorization.slice('Bearer '.length);
  return seededUsers.find((user) => user.accessToken === token);
}

/** The near-duplicate guard: punctuation breaks words, case never makes a quote new. */
function fingerprint(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Path params as MSW supplies them: a version segment is what these handlers key on. */
type VersionParams = Record<string, string | readonly string[] | undefined>;

function requireVersion(params: VersionParams): boolean {
  return typeof params.version === 'string' && (API_VERSIONS as readonly string[]).includes(params.version);
}

const MIN_TEXT_LENGTH = 12;
// The contract's paging: twenty quotes per page unless asked otherwise, one
// hundred at most.
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function createHandlers() {
  const catalog: QuoteResponse[] = [...seededQuotes];
  let nextId = catalog.length + 1;

  // 401 without a token (the contract's auth.token_missing), 403 with a token
  // that lacks the scope — the two halves of the authorization story the
  // publishing journeys assert on. The 403 body mirrors the API's example:
  // title and detail, no errorCode.
  function authorize(fail: Fail, request: Request, scope: string): Response | null {
    const user = findByToken(request.headers.get('Authorization'));
    if (!user) {
      return fail(401, {
        title: 'Unauthorized',
        detail: 'A valid bearer token is required.',
        errorCode: 'auth.token_missing',
      });
    }
    if (!user.scopes.includes(scope)) {
      return fail(403, {
        title: 'Forbidden',
        detail: 'The access token is missing the required scope (quotes:read or quotes:write).',
      });
    }
    return null;
  }

  return [
    http.post('/api/v1/auth/login', async ({ request }) => {
      const credentials = (await request.json()) as { username?: string; password?: string };
      const user = seededUsers.find(
        (candidate) =>
          candidate.username === credentials.username && candidate.password === credentials.password,
      );
      if (!user) {
        return problem(401, {
          title: 'Unauthorized',
          detail: 'Invalid credentials.',
          errorCode: 'auth.invalid_credentials',
        });
      }

      const correlationId = request.headers.get('X-Correlation-Id') ?? crypto.randomUUID();
      return HttpResponse.json({
        accessToken: user.accessToken,
        correlationId,
        expiresIn: 3600,
        username: user.username,
      });
    }),

    http.get('/api/:version/quotes', ({ params, request }) => {
      const fail = failWith(params.version);
      if (!requireVersion(params)) {
        return fail(404, { title: 'Not Found', errorCode: 'quote.not_found' });
      }
      const denied = authorize(fail, request, 'quotes:read');
      if (denied) {
        return denied;
      }

      const url = new URL(request.url);
      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE));
      if (
        !Number.isInteger(page) || page < 1 ||
        !Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE
      ) {
        return fail(400, {
          title: 'One or more validation errors occurred.',
          errors: {
            'quote.invalid_page_request': [
              page < 1 ? 'Page must be at least 1.' : `Page size must be between 1 and ${MAX_PAGE_SIZE}.`,
            ],
          },
          errorCode: 'quote.invalid_page_request',
        });
      }

      const totalItems = catalog.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const items = catalog.slice((page - 1) * pageSize, page * pageSize);
      return HttpResponse.json({ items, page, pageSize, totalItems, totalPages });
    }),

    http.get('/api/:version/quotes/random', ({ params, request }) => {
      const fail = failWith(params.version);
      if (!requireVersion(params)) {
        return fail(404, { title: 'Not Found', errorCode: 'quote.not_found' });
      }
      const denied = authorize(fail, request, 'quotes:read');
      if (denied) {
        return denied;
      }

      const quote = catalog[Math.floor(Math.random() * catalog.length)];
      if (!quote) {
        return fail(404, {
          title: 'Not Found',
          detail: 'Quote not found.',
          errorCode: 'quote.not_found',
        });
      }
      return HttpResponse.json(quote);
    }),

    http.post('/api/:version/quotes', async ({ params, request }) => {
      const fail = failWith(params.version);
      if (!requireVersion(params)) {
        return fail(404, { title: 'Not Found', errorCode: 'quote.not_found' });
      }
      const denied = authorize(fail, request, 'quotes:write');
      if (denied) {
        return denied;
      }

      const body = (await request.json()) as { text?: unknown; author?: unknown };
      const text = typeof body.text === 'string' ? body.text : '';
      const author = typeof body.author === 'string' ? body.author : '';
      if (text.trim().length < MIN_TEXT_LENGTH) {
        return fail(400, {
          title: 'One or more validation errors occurred.',
          errors: {
            'quote.text_too_short': [`The quote text must be at least ${MIN_TEXT_LENGTH} characters long.`],
          },
          errorCode: 'quote.text_too_short',
        });
      }
      if (catalog.some((quote) => fingerprint(quote.text) === fingerprint(text))) {
        return fail(409, {
          title: 'Conflict',
          detail: 'A near-identical quote already exists in the catalog.',
          errorCode: 'quote.duplicate_fingerprint',
        });
      }

      const created: QuoteResponse = { id: String(nextId++), text, author };
      catalog.push(created);
      // v3's transcoding returns the created quote with 200 — no 201, no Location.
      return HttpResponse.json(created, { status: params.version === 'v3' ? 200 : 201 });
    }),
  ];
}

/** A ready-to-use set over a fresh seeded catalog. */
export const handlers = createHandlers();
