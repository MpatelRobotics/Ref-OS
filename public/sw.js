const CACHE = "refos-v9-1.2.0-highlander-offline-manual";

const GAME_MANUAL = "/override-game-manual-v2.0.pdf";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/logo.svg",
  "/icon-180.png",
  "/icon-192.png",
  "/icon-512.png",
  GAME_MANUAL,
];

self.addEventListener("install", (event) => {
  // Cache the app shell and the complete Game Manual so the PDF can be
  // opened even when the event device has no internet connection.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("refos-") && key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function serveCachedRange(request, cachedResponse) {
  const range = request.headers.get("range");
  if (!range) return cachedResponse;

  const match = /^bytes=(\d+)-(\d*)$/i.exec(range);
  if (!match) return cachedResponse;

  const fullBuffer = await cachedResponse.arrayBuffer();
  const size = fullBuffer.byteLength;
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  const end = Math.min(requestedEnd, size - 1);

  if (start >= size || start > end) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }

  const chunk = fullBuffer.slice(start, end + 1);
  const headers = new Headers(cachedResponse.headers);
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(chunk.byteLength));
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Type", "application/pdf");

  return new Response(chunk, {
    status: 206,
    statusText: "Partial Content",
    headers,
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // The browser PDF viewer may request byte ranges. Always use the full
  // cached Game Manual as the source when offline, including Range requests.
  if (url.pathname === GAME_MANUAL) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        let cached = await cache.match(GAME_MANUAL);

        if (!cached) {
          try {
            const fresh = await fetch(GAME_MANUAL);
            if (fresh.ok) {
              await cache.put(GAME_MANUAL, fresh.clone());
              cached = fresh;
            }
          } catch {}
        }

        if (!cached) {
          return new Response("Game Manual is not available offline yet.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        }

        return serveCachedRange(req, cached);
      })
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          caches.open(CACHE)
            .then((cache) => cache.put(req, res.clone()))
            .catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(
          (cached) =>
            cached ||
            (req.mode === "navigate" ? caches.match("/") : undefined)
        )
      )
  );
});
