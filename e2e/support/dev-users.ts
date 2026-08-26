/**
 * The single place the e2e suite knows the development credentials. They are the
 * throwaway users the backend seed documents (code.examples.net.quotes
 * docs/dev-credentials.md) — never production secrets — but specs should not carry
 * credential literals, so the password-less sign-in step reads them from here.
 */
export const DEV_USER_PASSWORDS: Record<string, string> = {
  jrb: 'supersecret',
  reader: 'readsecret',
};
