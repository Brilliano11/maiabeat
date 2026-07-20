"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      const cleanupDevWorker = async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((key) => key.startsWith("maiabeat-"))
              .map((key) => caches.delete(key)),
          );
        }

        if (navigator.serviceWorker.controller && !sessionStorage.getItem("maiabeat-sw-reset")) {
          sessionStorage.setItem("maiabeat-sw-reset", "1");
          window.location.reload();
        }
      };

      cleanupDevWorker().catch(() => undefined);
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  return null;
}
