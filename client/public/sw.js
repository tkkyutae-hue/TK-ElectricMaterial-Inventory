const CACHE_NAME = "voltstock-v1";
const STATIC_CACHE = "voltstock-static-v1";
const API_CACHE = "voltstock-api-v1";

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstWithFallback(request, API_CACHE));
    return;
  }

  if (
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html")
  ) {
    event.respondWith(networkFirstWithFallback(request, STATIC_CACHE));
    return;
  }

  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf)$/)
  ) {
    event.respondWith(cacheFirstWithNetworkFallback(request, STATIC_CACHE));
    return;
  }
});

async function networkFirstWithFallback(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      return caches.match("/");
    }
    return new Response("Offline", { status: 503 });
  }
}

async function cacheFirstWithNetworkFallback(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}
