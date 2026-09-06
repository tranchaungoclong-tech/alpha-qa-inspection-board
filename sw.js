const CACHE = "qa-board-v31b";
const PRECACHE = ["./", "./index.html", "./manifest.json", "./icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.includes("google.com") || url.hostname.includes("googleapis.com") || url.hostname.includes("gstatic.com")) {
    return;
  }
  if (url.pathname.endsWith("sheet-config.js") || url.pathname.endsWith("/subscribe") || url.pathname.endsWith("/vapidPublicKey") || url.pathname.endsWith("/health") || url.pathname.endsWith("/test")) {
    event.respondWith(fetch(req));
    return;
  }
  event.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
  );
});

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {
    data = { title: "QA Board", body: event.data ? event.data.text() : "Tomorrow inspect" };
  }
  const title = data.title || "QA Board — tomorrow";
  const body = data.body || "Open the board for tomorrow’s jobs.";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { date: data.date || "", pic: data.pic || "" },
      icon: "./icon.svg",
      badge: "./icon.svg"
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const date = event.notification.data && event.notification.data.date;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      const payload = { type: "alert-jump", date: date || "" };
      if (list.length) {
        list[0].postMessage(payload);
        return list[0].focus();
      }
      const target = date ? `./index.html#alert=${date}` : "./index.html";
      return self.clients.openWindow(target);
    })
  );
});
