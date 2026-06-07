/* iPrime PWA service worker.
 *
 * Deliberately conservative so a new deploy never serves a stale app:
 *   - Content-hashed build assets (/_expo/, /assets/) are cache-first — their
 *     filenames change every build, so a cached copy is never out of date.
 *   - Navigations are network-first, falling back to the cached app shell only
 *     when the network is unavailable (offline launch).
 *   - Cross-origin requests (API, Google Maps, Cloudinary) are never touched.
 * The presence of a fetch handler is also what makes the app installable.
 */
const CACHE = "iprime-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add("/index.html"))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API / maps / cloudinary

  // Hashed static assets: cache-first.
  if (url.pathname.startsWith("/_expo/") || url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // Navigations: network-first, fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/index.html")));
  }
});

// --- Web Push ---
// The backend (webpush.service) sends a JSON payload { title, body, data }.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: "iPrime", body: event.data ? event.data.text() : "" };
  }
  const data = payload.data || {};
  const options = {
    body: payload.body || "",
    icon: "/icon.png",
    badge: "/icon.png",
    data,
    tag: data.notificationId || undefined,
  };
  event.waitUntil(self.registration.showNotification(payload.title || "iPrime", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = new URL(data.route || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          // Hand the route to the running app so it can deep-link in-SPA.
          client.postMessage({ type: "notification-click", data });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
