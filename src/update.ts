// Keep every user on the latest deployed version.
//
// The service worker (vite-plugin-pwa, autoUpdate) serves the cached app for
// offline use and installs new versions in the background, but the page that's
// already running keeps the old code until it's reloaded — and an iPad
// home-screen app can stay suspended for days without reloading.
//
// This watcher checks for updates on launch, whenever the app returns to the
// foreground, and every 30 minutes, two ways:
//  1. the service worker taking over with a new version (the normal path), and
//  2. comparing this build's stamp with version.json on the server, which also
//     catches a new release when the service worker hasn't picked it up (e.g.
//     blocked on a managed browser, or an update that stalled).
// It reloads by itself at the next *safe* moment (Home screen, no dialog or
// save in progress). Until then, the "New version available" banner lets the
// user refresh on their own terms.

let swReady = false; // a new service worker has taken over this page
let serverNewer = false; // version.json names a different build than this one
let isSafe: () => boolean = () => true;
let registration: ServiceWorkerRegistration | null = null;
const listeners = new Set<(available: boolean) => void>();
const beforeReload = new Set<() => void | Promise<void>>();

const available = () => swReady || serverNewer;
const notify = () => listeners.forEach((fn) => fn(available()));

/** Tell the watcher when it's safe to reload by itself (e.g. only on Home). */
export function setUpdateGuard(fn: () => boolean): void {
  isSafe = fn;
}

/** Subscribe to "a new version is available"; returns an unsubscribe function. */
export function onUpdateAvailable(fn: (available: boolean) => void): () => void {
  listeners.add(fn);
  fn(available());
  return () => listeners.delete(fn);
}

/** Run before an update reload (e.g. flush an open report's unsaved edits). */
export function onBeforeUpdateReload(fn: () => void | Promise<void>): () => void {
  beforeReload.add(fn);
  return () => beforeReload.delete(fn);
}

/** Apply a downloaded update now if it's safe; otherwise it stays pending. */
export function applyPendingUpdate(): void {
  if (!swReady || !isSafe()) return;
  // Any open dialog/overlay (save, share, restore, page picker…) means busy.
  if (document.querySelector('.modal-backdrop, .working-overlay')) return;
  swReady = false;
  window.location.reload();
}

/** The banner's Refresh button: save open work, make sure the new version is
 *  installed, then reload onto it. */
export async function refreshToLatest(): Promise<void> {
  for (const fn of beforeReload) {
    try {
      await fn();
    } catch {
      /* never block the update on a failed hook */
    }
  }
  if (!swReady && registration && navigator.serviceWorker.controller) {
    // Only the server check has seen the new version: ask the service worker
    // to fetch it and wait (briefly) for it to take over before reloading, so
    // the reload doesn't come straight back from the old cached copy.
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      navigator.serviceWorker.addEventListener('controllerchange', done, { once: true });
      registration!.update().catch(() => {});
      window.setTimeout(done, 8000);
    });
  }
  window.location.reload();
}

async function checkServerVersion(): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return;
    const { build } = (await res.json()) as { build?: string };
    // Different build on the server than the one running → newer release.
    if (build && build !== __BUILD_TIME__ && !serverNewer) {
      serverNewer = true;
      notify();
    }
  } catch {
    /* offline or not deployed yet — try again next time */
  }
}

export function startUpdateWatcher(): void {
  const check = () => {
    if (!navigator.onLine) return;
    void checkServerVersion();
    registration?.update().catch(() => {});
    applyPendingUpdate();
  };

  if ('serviceWorker' in navigator) {
    const sw = navigator.serviceWorker;
    // The very first install also "takes control" of the page; that isn't an
    // update, so only count control changes after the page was already controlled.
    let controlled = !!sw.controller;
    sw.addEventListener('controllerchange', () => {
      if (!controlled) {
        controlled = true;
        return;
      }
      swReady = true;
      notify();
      applyPendingUpdate();
    });
    void sw.ready.then((reg) => {
      registration = reg;
      reg.update().catch(() => {});
    });
  }

  check();
  window.setInterval(check, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
    else applyPendingUpdate(); // backgrounded on Home: refresh unseen
  });
}
