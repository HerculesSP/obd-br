// Funciona offline: serve do cache e atualiza em segundo plano (stale-while-revalidate).
const CACHE = 'obd-br';
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request);
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit ?? net;
  }));
});
