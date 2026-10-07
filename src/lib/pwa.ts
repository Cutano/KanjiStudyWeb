import { appUrl } from "./urls";

export async function prepareAppShell(): Promise<ServiceWorkerRegistration | null> {
  if (import.meta.env.DEV) return null;
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    throw new Error(
      "Offline installation requires HTTPS or localhost and a browser with service worker support.",
    );
  }
  const registration = await navigator.serviceWorker.register(appUrl("sw.js"), {
    scope: import.meta.env.BASE_URL,
  });
  if (registration.active) return registration;
  const worker = registration.installing;
  if (!worker)
    throw new Error(
      "The offline app could not be installed. Reload and try again.",
    );
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () =>
        finish(
          new Error(
            "Saving the offline app took too long. Check your connection and available storage, then retry.",
          ),
        ),
      60_000,
    );
    function finish(error?: Error) {
      clearTimeout(timeout);
      worker!.removeEventListener("statechange", changed);
      if (error) reject(error);
      else resolve();
    }
    function changed() {
      if (worker!.state === "activated") finish();
      else if (worker!.state === "redundant")
        finish(
          new Error(
            "The browser could not save the offline app. Check available storage and retry.",
          ),
        );
    }
    worker.addEventListener("statechange", changed);
    changed();
  });
  return registration;
}

export async function requestDurableStorage(): Promise<boolean> {
  return navigator.storage?.persist ? navigator.storage.persist() : false;
}
