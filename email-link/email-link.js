/* The same HTTPS email opens Android through verified App Links, or reaches
 * this bridge in a browser. No token is verified here or sent to a third party. */
(function () {
  'use strict';
  const routes = new Set([
    '/reset-password', '/email-change-confirmation', '/confirm-signup',
    '/account-confirmed', '/email-confirmation-expired',
    '/recovery-email-confirmation', '/recover-account', '/project-succession',
  ]);
  const parameters = new Set([
    'token_hash', 'type', 'recovery_token', 'account_recovery_token',
    'address_token', 'error', 'error_code', 'error_description',
  ]);
  let route = '/email-confirmation-expired';
  try {
    const entry = new URL(window.location.href);
    const fragment = entry.hash.substring(1);
    const parsed = new URL(fragment, 'https://email-link.invalid');
    const names = [...parsed.searchParams.keys()];
    const ownership = parsed.pathname === '/project-succession';
    const ownershipKeys = new Set(['offer', 'project', 'account']);
    const validOwnership = names.length <= 1 && names.every(key => ownershipKeys.has(key) && parsed.searchParams.getAll(key).length === 1 &&
      (key === 'account' ? parsed.searchParams.get(key) === 'true' : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.searchParams.get(key))));
    if (!entry.search && fragment.startsWith('/') &&
        parsed.origin === 'https://email-link.invalid' && !parsed.hash &&
        routes.has(parsed.pathname) &&
        (ownership ? validOwnership : names.every(key => parameters.has(key) && parsed.searchParams.getAll(key).length === 1))) {
      route = parsed.pathname + parsed.search;
    }
    const target = new URL('../', entry);
    target.hash = route;
    window.history.replaceState(null, '', entry.pathname);
    window.location.replace(target.href);
  } catch (_) {
    // No diagnostics: URLs may contain credentials.
  }
})();
