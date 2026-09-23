// PWA helpers: register the service worker and expose the install prompt so a button
// can trigger the native "Install app" flow on Windows/Android.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(canInstall: boolean) => void>();
const updateListeners = new Set<() => void>();
let updateReady = false;

function notify(canInstall: boolean) {
  listeners.forEach((fn) => fn(canInstall));
}

export function registerPwa() {
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator) {
    // A controller already present means this is a returning visit; a later
    // controllerchange then means a new deploy took over and the page is stale.
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || updateReady) return;
      updateReady = true;
      updateListeners.forEach((fn) => fn());
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check for a new deploy whenever the installed app comes back to the foreground.
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') registration.update().catch(() => {});
          });
        })
        .catch(() => {
          // Registration is best-effort; the app works fine without it.
        });
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify(false);
  });
}

export function canInstallApp() {
  return deferredPrompt !== null;
}

export function onInstallAvailabilityChange(fn: (canInstall: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify(false);
  return choice.outcome === 'accepted';
}

export function onUpdateReady(fn: () => void) {
  updateListeners.add(fn);
  if (updateReady) fn();
  return () => {
    updateListeners.delete(fn);
  };
}

// iOS Safari never fires beforeinstallprompt — installing is a manual
// "Share → Add to Home Screen", so the UI shows instructions instead.
export function isIosSafari() {
  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return isIos && !/crios|fxios|edgios/i.test(ua);
}

// True when the app is already running as an installed PWA (standalone window).
export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
