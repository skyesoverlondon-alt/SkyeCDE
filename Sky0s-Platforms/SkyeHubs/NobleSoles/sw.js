const CACHE = "noble-soul-intake-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./request.html",
  "./client.html",
  "./caregiver.html",
  "./portal.html",
  "./README_SETUP.html",
  "./styles.css",
  "./app.js",
  "./hub-api.js",
  "./admin.js",
  "./request.js",
  "./client.js",
  "./caregiver.js",
  "./portal.js",
  "./manifest.webmanifest",
  "./assets/logo.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (e)=>{
  e.waitUntil((async ()=>{
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e)=>{
  e.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k===CACHE?null:caches.delete(k))));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (e)=>{
  const req = e.request;
  if(req.method !== "GET") return;
  e.respondWith((async ()=>{
    const cached = await caches.match(req);
    if(cached) return cached;
    try{
      const fresh = await fetch(req);
      const c = await caches.open(CACHE);
      c.put(req, fresh.clone());
      return fresh;
    }catch{
      // fallback to index for navigations
      if(req.mode === "navigate"){
        return caches.match("./index.html");
      }
      throw new Error("offline");
    }
  })());
});
