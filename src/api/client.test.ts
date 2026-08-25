import { beforeEach, describe, expect, it } from 'vitest';
import { http } from 'msw';
import { server } from '../mocks/server';
import {
  ApiError,
  DEFAULT_API_VERSION,
  clearSession,
  createQuote,
  getApiVersion,
  getRandomQuote,
  getSession,
  listQuotes,
  login,
  saveSession,
  setApiVersion,
  type LoginResponse,
  type QuotePageResponse,
} from './client';

const loginResponse: LoginResponse = {
  accessToken: 'issued-token',
  correlationId: 'corr-1',
  expiresIn: 3600,
  username: 'jrb',
};

/** What a recording handler observed on the wire: the client's actual request. */
interface SeenRequest {
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

// Installs a one-off MSW handler that records the request it served and replies
// with the given fixture. MSW is the fetch backend under test, so what the handler
// sees is exactly what the client sent — the wire-level assertions the old
// fetch-mock provided, against the same interception the mocked platform uses.
function record(method: 'get' | 'post', path: string, reply: () => Response): SeenRequest[] {
  const seen: SeenRequest[] = [];
  server.use(
    http[method](path, async ({ request }) => {
      const url = new URL(request.url);
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        body = undefined;
      }
      seen.push({
        path: url.pathname + url.search,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body,
      });
      return reply();
    }),
  );
  return seen;
}

const recordLogin = (reply: () => Response) => record('post', '/api/v1/auth/login', reply);
const recordRandom = (reply: () => Response) => record('get', '/api/v1/quotes/random', reply);
const recordList = (reply: () => Response) => record('get', '/api/v1/quotes', reply);
const recordCreate = (reply: () => Response) => record('post', '/api/v1/quotes', reply);

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('session storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('starts empty', () => {
    expect(getSession()).toEqual({ accessToken: null, correlationId: null, username: null });
  });

  it('round-trips a login response', () => {
    saveSession(loginResponse);

    expect(getSession()).toEqual({
      accessToken: 'issued-token',
      correlationId: 'corr-1',
      username: 'jrb',
    });
  });

  it('clears every key', () => {
    saveSession(loginResponse);

    clearSession();

    expect(getSession()).toEqual({ accessToken: null, correlationId: null, username: null });
  });
});

describe('login', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('posts credentials and stores the session', async () => {
    const seen = recordLogin(() => json(loginResponse));

    const result = await login('jrb', 'supersecret');

    expect(result).toEqual(loginResponse);
    expect(getSession().accessToken).toBe('issued-token');

    expect(seen[0].path).toBe('/api/v1/auth/login');
    expect(seen[0].method).toBe('POST');
    expect(seen[0].body).toEqual({ username: 'jrb', password: 'supersecret' });
  });

  it('sends a 32 character hex correlation id', async () => {
    const seen = recordLogin(() => json(loginResponse));

    await login('jrb', 'supersecret');

    expect(seen[0].headers['x-correlation-id']).toMatch(/^[0-9a-f]{32}$/);
  });

  it('falls back to getRandomValues when randomUUID is unavailable', async () => {
    const original = crypto.randomUUID;
    // @ts-expect-error intentional: exercise the getRandomValues branch
    crypto.randomUUID = undefined;

    try {
      const seen = recordLogin(() => json(loginResponse));
      await login('jrb', 'supersecret');

      expect(seen[0].headers['x-correlation-id']).toMatch(/^[0-9a-f]{32}$/);
    } finally {
      crypto.randomUUID = original;
    }
  });

  it('signs the seeded maintainer in through the mock platform', async () => {
    const result = await login('jrb', 'supersecret');

    expect(result.username).toBe('jrb');
    expect(result.accessToken).toBe('mock-maintainer-token');
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  it('rejects unknown credentials with the problem envelope', async () => {
    await expect(login('jrb', 'wrong-password')).rejects.toThrow('Invalid credentials. (401)');
    expect(getSession().accessToken).toBeNull();
  });

  it('surfaces the ProblemDetails title from the server error', async () => {
    recordLogin(() => json({ title: 'Unauthorized', errorCode: 'auth.invalid_credentials' }, 401));

    await expect(login('jrb', 'wrong')).rejects.toThrow('Unauthorized (401)');
    expect(getSession().accessToken).toBeNull();
  });

  it('falls back to a generic message when the error body is not json', async () => {
    recordLogin(() => new Response('boom', { status: 500 }));

    await expect(login('jrb', 'supersecret')).rejects.toThrow('Invalid credentials');
  });
});

describe('getRandomQuote', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('throws when there is no session', async () => {
    await expect(getRandomQuote()).rejects.toThrow('Not authenticated');
  });

  it('sends the bearer token and the stored correlation id', async () => {
    saveSession(loginResponse);
    const seen = recordRandom(() => json({ id: '1', text: 'hello', author: 'someone' }));

    const quote = await getRandomQuote();

    expect(quote).toEqual({ id: '1', text: 'hello', author: 'someone' });

    expect(seen[0].path).toBe('/api/v1/quotes/random');
    expect(seen[0].headers.authorization).toBe('Bearer issued-token');
    expect(seen[0].headers['x-correlation-id']).toBe('corr-1');
  });

  it('serves a seeded quote through the mock platform', async () => {
    await login('jrb', 'supersecret');

    const quote = await getRandomQuote();

    expect(quote.id).toMatch(/^[1-8]$/);
    expect(quote.text).toBeTruthy();
    expect(quote.author).toBeTruthy();
  });

  it('reports the status code when the request fails', async () => {
    saveSession(loginResponse);
    recordRandom(() => new Response('', { status: 503 }));

    await expect(getRandomQuote()).rejects.toThrow('Quote request failed (503)');
  });
});

describe('api version selection', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('defaults to the minimal api version', () => {
    expect(getApiVersion()).toBe(DEFAULT_API_VERSION);
    expect(DEFAULT_API_VERSION).toBe('v1');
  });

  it('round-trips the chosen version', () => {
    setApiVersion('v0');

    expect(getApiVersion()).toBe('v0');
  });

  it('falls back to the default when the stored value is not a known version', () => {
    sessionStorage.setItem('apiVersion', 'v99');

    expect(getApiVersion()).toBe(DEFAULT_API_VERSION);
  });

  it('keeps the chosen version across sign out', () => {
    saveSession(loginResponse);
    setApiVersion('v0');

    clearSession();

    expect(getApiVersion()).toBe('v0');
  });

  it.each(['v0', 'v1'] as const)('requests %s when asked for it explicitly', async (version) => {
    saveSession(loginResponse);
    const seen = record('get', `/api/${version}/quotes/random`, () =>
      json({ id: '1', text: 'hello', author: 'someone' }),
    );

    await getRandomQuote(version);

    expect(seen[0].path).toBe(`/api/${version}/quotes/random`);
  });

  it('uses the stored version when none is passed', async () => {
    saveSession(loginResponse);
    setApiVersion('v0');
    const seen = record('get', '/api/v0/quotes/random', () =>
      json({ id: '1', text: 'hello', author: 'someone' }),
    );

    await getRandomQuote();

    expect(seen[0].path).toBe('/api/v0/quotes/random');
  });
});

const catalogPage: QuotePageResponse = {
  items: [
    { id: '1', text: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' },
    { id: '2', text: 'Talk is cheap. Show me the code.', author: 'Linus Torvalds' },
  ],
  page: 1,
  pageSize: 5,
  totalItems: 8,
  totalPages: 2,
};

describe('listQuotes', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('throws when there is no session', async () => {
    await expect(listQuotes()).rejects.toThrow('Not authenticated');
  });

  it('omits the query string when no paging is requested', async () => {
    saveSession(loginResponse);
    const seen = recordList(() => json(catalogPage));

    await listQuotes();

    expect(seen[0].path).toBe('/api/v1/quotes');
  });

  it('serializes the requested page and page size', async () => {
    saveSession(loginResponse);
    const seen = recordList(() => json(catalogPage));

    await listQuotes({ page: 2, pageSize: 5 });

    expect(seen[0].path).toBe('/api/v1/quotes?page=2&pageSize=5');
  });

  it('requests the stored version when none is passed', async () => {
    saveSession(loginResponse);
    setApiVersion('v0');
    const seen = record('get', '/api/v0/quotes', () => json(catalogPage));

    await listQuotes({ page: 1 });

    expect(seen[0].path).toBe('/api/v0/quotes?page=1');
  });

  it('returns the parsed page response', async () => {
    saveSession(loginResponse);
    recordList(() => json(catalogPage));

    const page = await listQuotes({ page: 1, pageSize: 5 });

    expect(page).toEqual(catalogPage);
  });

  it('pages the seeded catalog at five per page through the mock platform', async () => {
    await login('jrb', 'supersecret');

    const first = await listQuotes({ page: 1, pageSize: 5 });
    const last = await listQuotes({ page: 2, pageSize: 5 });

    expect(first.totalItems).toBe(8);
    expect(first.totalPages).toBe(2);
    expect(first.items.map((quote) => quote.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(last.items.map((quote) => quote.id)).toEqual(['6', '7', '8']);
  });

  it('surfaces the validation description for a rejected page request', async () => {
    saveSession(loginResponse);
    recordList(() =>
      json(
        {
          title: 'One or more validation errors occurred.',
          errors: { 'quote.invalid_page_request': ['Page must be at least 1.'] },
          errorCode: 'quote.invalid_page_request',
        },
        400,
      ),
    );

    const failure = await listQuotes({ page: 0 }).catch((err: unknown) => err);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(400);
    expect((failure as ApiError).errorCode).toBe('quote.invalid_page_request');
    expect((failure as ApiError).message).toBe('Page must be at least 1. (400)');
  });
});

describe('createQuote', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('throws when there is no session', async () => {
    await expect(createQuote({ text: 'Some valid quote text.', author: 'Someone' })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('posts the quote with the bearer token and the stored correlation id', async () => {
    saveSession(loginResponse);
    const seen = recordCreate(() =>
      json({ id: '9', text: 'Some valid quote text.', author: 'E2E Suite' }, 201),
    );

    const quote = await createQuote({ text: 'Some valid quote text.', author: 'E2E Suite' });

    expect(quote).toEqual({ id: '9', text: 'Some valid quote text.', author: 'E2E Suite' });

    expect(seen[0].path).toBe('/api/v1/quotes');
    expect(seen[0].method).toBe('POST');
    expect(seen[0].body).toEqual({ text: 'Some valid quote text.', author: 'E2E Suite' });
    expect(seen[0].headers.authorization).toBe('Bearer issued-token');
    expect(seen[0].headers['x-correlation-id']).toBe('corr-1');
  });

  it('requests the stored version when none is passed', async () => {
    saveSession(loginResponse);
    setApiVersion('v0');
    const seen = record('post', '/api/v0/quotes', () =>
      json({ id: '9', text: 'Some valid quote text.', author: 'E2E Suite' }, 201),
    );

    await createQuote({ text: 'Some valid quote text.', author: 'E2E Suite' });

    expect(seen[0].path).toBe('/api/v0/quotes');
  });

  it('rejects the read-only account for the missing write scope', async () => {
    const session = await login('reader', 'readsecret');

    const failure = await createQuote({
      text: 'A reader is not allowed to publish quotes.',
      author: 'E2E Suite',
    }).catch((err: unknown) => err);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(403);
    // The API's 403 carries title and detail but no errorCode extension.
    expect((failure as ApiError).message).toContain('missing the required scope');
    expect(getSession().accessToken).toBe(session.accessToken);
  });

  it('surfaces the problem detail for a rule-breaking text', async () => {
    saveSession(loginResponse);
    recordCreate(() =>
      json(
        {
          title: 'One or more validation errors occurred.',
          errors: { 'quote.text_too_short': ['The quote text must be at least 12 characters long.'] },
          errorCode: 'quote.text_too_short',
        },
        400,
      ),
    );

    const failure = await createQuote({ text: 'short', author: 'E2E Suite' }).catch((err: unknown) => err);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(400);
    expect((failure as ApiError).errorCode).toBe('quote.text_too_short');
    expect((failure as ApiError).message).toBe(
      'The quote text must be at least 12 characters long. (400)',
    );
  });

  it('surfaces the detail of a near-duplicate conflict', async () => {
    saveSession(loginResponse);
    recordCreate(() =>
      json(
        {
          title: 'Conflict',
          detail: 'A near-identical quote already exists in the catalog.',
          errorCode: 'quote.duplicate_fingerprint',
        },
        409,
      ),
    );

    const failure = await createQuote({ text: 'Talk is cheap! Show me the code.', author: 'E2E Suite' }).catch(
      (err: unknown) => err,
    );

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(409);
    expect((failure as ApiError).errorCode).toBe('quote.duplicate_fingerprint');
    expect((failure as ApiError).message).toBe(
      'A near-identical quote already exists in the catalog. (409)',
    );
  });

  it('falls back to a generic message when the error body is not json', async () => {
    saveSession(loginResponse);
    recordCreate(() => new Response('', { status: 503 }));

    await expect(createQuote({ text: 'Some valid quote text.', author: 'E2E Suite' })).rejects.toThrow(
      'Failed to publish quote (503)',
    );
  });
});
