const CACHE = "refos-v19-1.2.0-admin-web-push";
const APP_SHELL = ["/", "/manifest.webmanifest", "/logo.svg", "/icon-180.png", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { body: event.data?.text() || "A volunteer requested a new join code." }; }
  event.waitUntil(self.registration.showNotification(payload.title || "Ref OS code request", {
    body: payload.body || "A volunteer requested a new join code.",
    icon: "/icon-192.png",
    badge: "/icon-180.png",
    tag: payload.tag || "refos-code-request",
    renotify: true,
    data: { url: payload.url || "/?open=code-requests" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/?open=code-requests", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("navigate" in client) await client.navigate(target);
      return client.focus();
    }
    return clients.openWindow(target);
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("refos-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((cache) => cache.put(req, res.clone())).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || (req.mode === "navigate" ? caches.match("/") : undefined)))
  );
});

// login-light
