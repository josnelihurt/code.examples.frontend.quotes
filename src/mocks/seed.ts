import type { QuoteResponse } from '../api/client';

/**
 * The catalog and accounts the backend seed ships (code.examples.net.quotes: QuotesSeed.cs and
 * the local development users). The mocked API starts from exactly this state so
 * unit tests, Storybook and the mocked e2e suite all page through the same eight
 * quotes at five per page that the full-stack suite asserts on.
 *
 * The development passwords are scaffolding credentials from the backend seed,
 * documented there (docs/dev-credentials.md); they appear in this repository only
 * inside the mock layer and the suites that use it.
 */
export interface MockUser {
  username: string;
  password: string;
  /** Stable fake bearer token; the mocked API authenticates by exact match. */
  accessToken: string;
  scopes: readonly string[];
}

export const seededUsers: readonly MockUser[] = [
  {
    username: 'jrb',
    password: 'supersecret',
    accessToken: 'mock-maintainer-token',
    scopes: ['quotes:read', 'quotes:write'],
  },
  {
    username: 'reader',
    password: 'readsecret',
    accessToken: 'mock-reader-token',
    scopes: ['quotes:read'],
  },
];

/** Same ids and ordering as the backend's HasData seed: ids 1–8, stable sort. */
export const seededQuotes: readonly QuoteResponse[] = [
  { id: '1', text: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' },
  { id: '2', text: "Code is like humor. When you have to explain it, it's bad.", author: 'Cory House' },
  { id: '3', text: 'First, solve the problem. Then, write the code.', author: 'John Johnson' },
  { id: '4', text: 'Experience is the name everyone gives to their mistakes.', author: 'Oscar Wilde' },
  { id: '5', text: 'The only way to go fast is to go well.', author: 'Robert C. Martin' },
  { id: '6', text: 'Make it work, make it right, make it fast.', author: 'Kent Beck' },
  { id: '7', text: 'Programs must be written for people to read.', author: 'Harold Abelson' },
  { id: '8', text: 'Talk is cheap. Show me the code.', author: 'Linus Torvalds' },
];
