/* Life OS service worker — web push + light caching (no stale PWA shell) */

// Bump this string on any SW logic change to drop old caches client-side.
const CACHE = "lifeos-v4";
const PRECACHE = ["/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/** Next.js content-hashed assets — safe to SWR; new deploy = new URLs. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) void cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || network || Response.error();
}

/** Prefer network so refreshes (especially PWA standalone) pick up new HTML/JS/CSS. */
async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
}

function isRscFetch(request, url) {
  if (url.searchParams.has("_rsc")) return true;
  const h = request.headers;
  return (
    h.get("RSC") === "1" ||
    h.get("Next-Router-Prefetch") === "1" ||
    (h.get("Accept") || "").includes("text/x-component")
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // APIs — never cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // App Router flight / RSC — must be fresh
  if (isRscFetch(request, url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Full document loads (PWA pull-to-refresh, open from icon)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "reload" }).catch(() => networkFirst(request))
    );
    return;
  }

  // Hashed build output
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Other same-origin (fonts, images, chunks without /static/?): network-first
  event.respondWith(networkFirst(request));
});

self.addEventListener("push", (event) => {
  let data = { title: "Life OS", body: "Time to move." };
  try {
    if (event.data) data = event.data.json();
  } catch {
    /* noop */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: data.url || "/",
      tag: data.tag,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const c of clients) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
