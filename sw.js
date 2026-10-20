// Service worker — mały program działający w tle telefonu. Zapamiętuje pliki aplikacji,
// żeby dziennik otwierał się także bez internetu (np. na siłowni bez zasięgu).
// Po zmianie listy plików lub sposobu działania podbij WERSJA — telefon pobierze nową wersję.
const WERSJA = 'dziennik-v1';
const PLIKI = ['./', 'manifest.json', 'ikony/apple-touch-icon.png', 'ikony/ikona-192.png', 'ikony/ikona-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js'];

// Instalacja: od razu zapisujemy w pamięci wszystko, czego aplikacja potrzebuje do startu
self.addEventListener('install', e => {
  e.waitUntil(caches.open(WERSJA).then(c => c.addAll(PLIKI)).then(() => self.skipWaiting()));
});
// Aktywacja: kasujemy stare wersje pamięci
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(klucze => Promise.all(klucze.filter(k => k !== WERSJA).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.hostname.endsWith('supabase.co')) return;        // dane z bazy — zawsze prosto z internetu

  // Sama strona: najpierw internet (żeby zmiany docierały od razu), a gdy nie ma zasięgu
  // albo odpowiedź nie przyjdzie w 3 sekundy — wersja zapamiętana
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const zPamieci = () => caches.match('./', { cacheName: WERSJA });
      try {
        const odp = await Promise.race([fetch(req), new Promise((_, nie) => setTimeout(nie, 3000))]);
        if (odp.ok) { const c = await caches.open(WERSJA); await c.put('./', odp.clone()); }
        return odp;
      } catch { return (await zPamieci()) || Response.error(); }
    })());
    return;
  }

  // Reszta (ikony, biblioteka Supabase, czcionki): najpierw pamięć, potem internet — i zapamiętujemy
  e.respondWith(caches.match(req).then(zap => zap || fetch(req).then(odp => {
    if (odp.ok || odp.type === 'opaque') { const kopia = odp.clone(); caches.open(WERSJA).then(c => c.put(req, kopia)); }
    return odp;
  })));
});
