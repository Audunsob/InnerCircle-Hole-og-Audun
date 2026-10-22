// The test mode on the moderator page (/moderator?test) runs the whole app against a made-up database on this device
// (see sandbox.ts). It keeps its own copy of the app's local state, so the real app on the same
// browser is left alone.

export const TEST_URL = '/moderator?test';

/** True while the moderator page shows the test mode. Decided from the address, so it is known before the store loads. */
export const onTestPage = () =>
  typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/moderator' && new URLSearchParams(window.location.search).has('test');

/**
 * Switches between the test mode and the real moderator page with a full page load, never a client-side
 * navigation: the app's store and the database calls must start over on the right side.
 */
export const switchTestMode = (on: boolean) => window.location.assign(on ? TEST_URL : '/moderator');
