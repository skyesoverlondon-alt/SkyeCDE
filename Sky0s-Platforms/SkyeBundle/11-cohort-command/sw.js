const CACHE = 'app-cache-v2';
const ASSETS = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest', './assets/logo.png'];

self.addEventListener('install', event => event.waitUntil(
	caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
));

self.addEventListener('activate', event => event.waitUntil(
	caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())
));

self.addEventListener('fetch', event => {
	if (event.request.method !== 'GET') return;
	event.respondWith(
		caches.open(CACHE).then(cache => cache.match(event.request).then(hit => {
			if (hit) return hit;
			return fetch(event.request).then(response => {
				const sameOrigin = new URL(event.request.url).origin === self.location.origin;
				if (sameOrigin && response.ok) cache.put(event.request, response.clone());
				return response;
			});
		}))
	);
});