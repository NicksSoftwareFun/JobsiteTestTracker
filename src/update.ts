// Keep every user on the latest deployed version.
//
// The service worker (vite-plugin-pwa, autoUpdate) serves the cached app for
// offline use and installs new versions in the background, but the page that's
// already running keeps the old code until it's reloaded — and an iPad
// home-screen app can stay suspended for days without reloading.
//
// This watcher checks for updates on launch, whenever the app returns to the
// foreground, and every 30 minutes. When a new version has taken over, the page
// reloads at the next *safe* moment: on the Home screen with no dialog or save
// in progress, so nobody loses typing or gets interrupted mid-save.

let pending = false;
let isSafe: () => boolean = () => true;

/** Tell the watcher when it's safe to reload (e.g. only on the Home screen). */
export function setUpdateGuard(fn: () => boolean): void {
  isSafe = fn;
}

/** Apply a downloaded update now if it's safe; otherwise it stays pending. */
export function applyPendingUpdate(): void {
  if (!pending || !isSafe()) return;
  // Any open dialog/overlay (save, share, restore, page picker…) means busy.
  if (document.querySelector('.modal-backdrop, .working-overlay')) return;
  pending = false;
  window.location.reload();
}

export function startUpdateWatcher(): void {
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;

  // The very first install also "takes control" of the page; that isn't an
  // update, so only count control changes after the page was already controlled.
  let controlled = !!sw.controller;
  sw.addEventListener('controllerchange', () => {
    if (!controlled) {
      controlled = true;
      return;
    }
    pending = true;
    applyPendingUpdate();
  });

  void sw.ready.then((reg) => {
    const check = () => {
      if (navigator.onLine) reg.update().catch(() => {});
      applyPendingUpdate();
    };
    check();
    window.setInterval(check, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
      else applyPendingUpdate(); // backgrounded on Home: refresh unseen
    });
  });
}
