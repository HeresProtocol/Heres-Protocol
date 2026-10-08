// Retired. Earlier versions of the site registered a caching service worker; this replacement
// exists only so browsers that still have it installed pick up this update, clear every cache
// it created, unregister it, and reload open tabs from the network (the current site).
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
    await self.registration.unregister()
    const windows = await self.clients.matchAll({ type: 'window' })
    windows.forEach((client) => client.navigate(client.url))
  })())
})
