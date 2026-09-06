const CACHE = "qa-board-v30";
const PRECACHE = ["./", "./index.html", "./sheet-config.js", "./manifest.json", "./icon.svg"];

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
