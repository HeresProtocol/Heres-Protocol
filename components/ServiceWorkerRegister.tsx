'use client';

import { useEffect } from 'react';

/**
 * The site no longer uses a service worker. Remove any worker and cache left behind by earlier
 * versions so returning visitors never see stale pages or assets from the old frontend.
 */
export function ServiceWorkerRegister() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations()
                .then((registrations) => registrations.forEach((registration) => registration.unregister()))
                .catch(() => {});
        }
        if ('caches' in window) {
            caches.keys()
                .then((keys) => keys.forEach((key) => caches.delete(key)))
                .catch(() => {});
        }
    }, []);

    return null;
}
