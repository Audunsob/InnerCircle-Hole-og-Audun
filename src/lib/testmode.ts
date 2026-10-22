// The test mode at /moderator/test runs the whole app against a made-up database on this device
// (see sandbox.ts). It keeps its own copy of the app's local state, so the real app on the same
// browser is left alone.

export const TEST_PATH = '/moderator/test';

/** True on the test mode's page. Decided from the address, so it is known before the store loads. */
export const onTestPage = () => typeof window !== 'undefined' && window.location.pathname.startsWith(TEST_PATH);
