const CACHE = "refos-v20-1.2.0-highlander-quadrant-correction";

const APP_SHELL = [
  "/models/refos_tiny_detector.onnx",
  "/",
  "/manifest.webmanifest",
  "/logo.svg",
  "/icon-180.png",
  "/icon-192.png",
  "/icon-512.png",
  "/game-manual-search.json",
];

const GAME_MANUAL_PAGES = [
  "/game-manual-pages/page-001.jpg",
  "/game-manual-pages/page-002.jpg",
  "/game-manual-pages/page-003.jpg",
  "/game-manual-pages/page-004.jpg",
  "/game-manual-pages/page-005.jpg",
  "/game-manual-pages/page-006.jpg",
  "/game-manual-pages/page-007.jpg",
  "/game-manual-pages/page-008.jpg",
  "/game-manual-pages/page-009.jpg",
  "/game-manual-pages/page-010.jpg",
  "/game-manual-pages/page-011.jpg",
  "/game-manual-pages/page-012.jpg",
  "/game-manual-pages/page-013.jpg",
  "/game-manual-pages/page-014.jpg",
  "/game-manual-pages/page-015.jpg",
  "/game-manual-pages/page-016.jpg",
  "/game-manual-pages/page-017.jpg",
  "/game-manual-pages/page-018.jpg",
  "/game-manual-pages/page-019.jpg",
  "/game-manual-pages/page-020.jpg",
  "/game-manual-pages/page-021.jpg",
  "/game-manual-pages/page-022.jpg",
  "/game-manual-pages/page-023.jpg",
  "/game-manual-pages/page-024.jpg",
  "/game-manual-pages/page-025.jpg",
  "/game-manual-pages/page-026.jpg",
  "/game-manual-pages/page-027.jpg",
  "/game-manual-pages/page-028.jpg",
  "/game-manual-pages/page-029.jpg",
  "/game-manual-pages/page-030.jpg",
  "/game-manual-pages/page-031.jpg",
  "/game-manual-pages/page-032.jpg",
  "/game-manual-pages/page-033.jpg",
  "/game-manual-pages/page-034.jpg",
  "/game-manual-pages/page-035.jpg",
  "/game-manual-pages/page-036.jpg",
  "/game-manual-pages/page-037.jpg",
  "/game-manual-pages/page-038.jpg",
  "/game-manual-pages/page-039.jpg",
  "/game-manual-pages/page-040.jpg",
  "/game-manual-pages/page-041.jpg",
  "/game-manual-pages/page-042.jpg",
  "/game-manual-pages/page-043.jpg",
  "/game-manual-pages/page-044.jpg",
  "/game-manual-pages/page-045.jpg",
  "/game-manual-pages/page-046.jpg",
  "/game-manual-pages/page-047.jpg",
  "/game-manual-pages/page-048.jpg",
  "/game-manual-pages/page-049.jpg",
  "/game-manual-pages/page-050.jpg",
  "/game-manual-pages/page-051.jpg",
  "/game-manual-pages/page-052.jpg",
  "/game-manual-pages/page-053.jpg",
  "/game-manual-pages/page-054.jpg",
  "/game-manual-pages/page-055.jpg",
  "/game-manual-pages/page-056.jpg",
  "/game-manual-pages/page-057.jpg",
  "/game-manual-pages/page-058.jpg",
  "/game-manual-pages/page-059.jpg",
  "/game-manual-pages/page-060.jpg",
  "/game-manual-pages/page-061.jpg",
  "/game-manual-pages/page-062.jpg",
  "/game-manual-pages/page-063.jpg",
  "/game-manual-pages/page-064.jpg",
  "/game-manual-pages/page-065.jpg",
  "/game-manual-pages/page-066.jpg",
  "/game-manual-pages/page-067.jpg",
  "/game-manual-pages/page-068.jpg",
  "/game-manual-pages/page-069.jpg",
  "/game-manual-pages/page-070.jpg",
  "/game-manual-pages/page-071.jpg",
  "/game-manual-pages/page-072.jpg",
  "/game-manual-pages/page-073.jpg",
  "/game-manual-pages/page-074.jpg",
  "/game-manual-pages/page-075.jpg",
  "/game-manual-pages/page-076.jpg",
  "/game-manual-pages/page-077.jpg",
  "/game-manual-pages/page-078.jpg",
  "/game-manual-pages/page-079.jpg",
  "/game-manual-pages/page-080.jpg",
  "/game-manual-pages/page-081.jpg",
  "/game-manual-pages/page-082.jpg",
  "/game-manual-pages/page-083.jpg",
  "/game-manual-pages/page-084.jpg",
  "/game-manual-pages/page-085.jpg",
  "/game-manual-pages/page-086.jpg",
  "/game-manual-pages/page-087.jpg",
  "/game-manual-pages/page-088.jpg",
  "/game-manual-pages/page-089.jpg",
  "/game-manual-pages/page-090.jpg",
  "/game-manual-pages/page-091.jpg",
  "/game-manual-pages/page-092.jpg",
  "/game-manual-pages/page-093.jpg",
  "/game-manual-pages/page-094.jpg",
  "/game-manual-pages/page-095.jpg",
  "/game-manual-pages/page-096.jpg",
  "/game-manual-pages/page-097.jpg",
  "/game-manual-pages/page-098.jpg",
  "/game-manual-pages/page-099.jpg",
  "/game-manual-pages/page-100.jpg",
  "/game-manual-pages/page-101.jpg",
  "/game-manual-pages/page-102.jpg",
  "/game-manual-pages/page-103.jpg",
  "/game-manual-pages/page-104.jpg",
  "/game-manual-pages/page-105.jpg",
  "/game-manual-pages/page-106.jpg",
  "/game-manual-pages/page-107.jpg",
  "/game-manual-pages/page-108.jpg",
  "/game-manual-pages/page-109.jpg",
  "/game-manual-pages/page-110.jpg",
  "/game-manual-pages/page-111.jpg",
  "/game-manual-pages/page-112.jpg",
  "/game-manual-pages/page-113.jpg",
  "/game-manual-pages/page-114.jpg",
  "/game-manual-pages/page-115.jpg",
  "/game-manual-pages/page-116.jpg",
  "/game-manual-pages/page-117.jpg",
  "/game-manual-pages/page-118.jpg",
  "/game-manual-pages/page-119.jpg",
  "/game-manual-pages/page-120.jpg",
  "/game-manual-pages/page-121.jpg",
  "/game-manual-pages/page-122.jpg",
  "/game-manual-pages/page-123.jpg",
  "/game-manual-pages/page-124.jpg",
  "/game-manual-pages/page-125.jpg",
  "/game-manual-pages/page-126.jpg",
  "/game-manual-pages/page-127.jpg",
  "/game-manual-pages/page-128.jpg",
  "/game-manual-pages/page-129.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(APP_SHELL);
      // Cache the entire manual up front so any page is available offline.
      // Cache in small batches to reduce memory pressure on mobile browsers.
      const batchSize = 12;
      for (let i = 0; i < GAME_MANUAL_PAGES.length; i += batchSize) {
        await cache.addAll(GAME_MANUAL_PAGES.slice(i, i + batchSize));
      }
    })()
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Manual pages are cache-first so the viewer works identically online and offline.
  if (url.pathname.startsWith("/game-manual-pages/") || url.pathname === "/game-manual-search.json") {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res.ok) caches.open(CACHE).then((cache) => cache.put(req, res.clone())).catch(() => {});
        return res;
      }))
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
