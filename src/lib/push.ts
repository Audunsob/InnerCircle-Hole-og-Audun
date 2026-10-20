import { deletePush, isDemo, isViewAs, savePush } from './supabase';

/** Public half of the app's push key pair. The private half lives only on the server (VAPID_PRIVATE_KEY). */
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BISU8zfav-tY8wgWJcy5Tp8YHj2YiwoRJLasBsJuczzmjj568vMhCZd2g-ZMIsEY6I4U4Cx7pRSl0XJ-OVLcxCI';

/** matchIds: matches this device wants to hear about when photos are posted, whatever `posts` says. */
export type PushPrefs = { posts: boolean; matches: boolean; results: boolean; matchIds?: string[] };

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Opened from the home screen icon, not in the browser. */
export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || !!(navigator as { standalone?: boolean }).standalone);

/** Which home screen guide fits this device. iPads that say they are a Mac count as iPhone. */
export const phoneKind = (): 'ios' | 'android' | null => {
  if (typeof window === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return null;
};

/** iPhone/iPad only allow push when the app has been added to the home screen. */
export const needsHomeScreen = () => phoneKind() === 'ios' && !isStandalone();

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let installEvent: InstallEvent | null = null;
if (typeof window !== 'undefined')
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep Chrome's own install offer for the button in the guide.
    e.preventDefault();
    installEvent = e as InstallEvent;
  });

/** Chrome on Android can add the app with one tap when it has offered to. */
export const canInstall = () => !!installEvent;

export async function installApp() {
  const e = installEvent;
  if (!e) return false;
  installEvent = null;
  await e.prompt();
  return (await e.userChoice).outcome === 'accepted';
}

const keyBytes = (base64: string) => {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export async function registerWorker() {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  } catch {
    return null;
  }
}

export type EnableResult = 'ok' | 'denied' | 'unsupported' | 'homescreen' | 'error';

/** Asks for permission, subscribes this device and stores it for the team. */
export async function enablePush(teamId: string, prefs: PushPrefs): Promise<EnableResult> {
  // Viewing the app as someone else: leave this device's own notifications alone.
  if (isViewAs()) return isDemo() ? 'ok' : 'error';
  if (needsHomeScreen()) return 'homescreen';
  if (!pushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  try {
    const reg = (await registerWorker()) || (await navigator.serviceWorker.ready);
    const sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
    await savePush(teamId, sub.toJSON(), prefs);
    return 'ok';
  } catch {
    return 'error';
  }
}

/** Updates which kinds of notifications this device wants. */
export async function updatePushPrefs(teamId: string, prefs: PushPrefs) {
  if (isViewAs()) return;
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await savePush(teamId, sub.toJSON(), prefs);
}

export async function disablePush() {
  if (isViewAs()) return;
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await deletePush(sub.endpoint).catch(() => {});
      await sub.unsubscribe();
    }
  } catch {}
}
