// Service worker: maakt de app installeerbaar, laat hem openen zonder bereik
// en toont de ochtendmelding met de acties van vandaag.
const CACHE = 'koude-acquisitie-v2';
const DATA_CACHE = 'koude-acq-data';   // hierin zet de app de actielijst voor de ochtendmelding
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './vendor/supabase.js', './icons/icon-192.png', './icons/icon-512.png', './icons/badge-96.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== DATA_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return; // database en lettertypes: altijd via internet
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(cache => cache.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
  );
});

/* ---------- ochtendmelding ---------- */
const pad = n => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

async function readAgenda() {
  try {
    const res = await (await caches.open(DATA_CACHE)).match(new URL('agenda.json', self.registration.scope).href);
    return res ? await res.json() : null;
  } catch { return null; }
}

// Zelfde opbouw als de testmelding in de app.
function buildMessage(items, today) {
  const due = (items || []).filter(x => x && x.datum && x.datum <= today)
    .sort((a, b) => a.datum.localeCompare(b.datum) || String(a.plaats || '').localeCompare(String(b.plaats || '')));
  if (!due.length) return null;
  const n = due.length;
  const late = due.filter(x => x.datum < today).length;
  const lines = due.slice(0, 6).map(x => `${x.actie} · ${x.bedrijf}${x.plaats ? ' (' + x.plaats + ')' : ''}${x.datum < today ? ' – te laat' : ''}`);
  if (n > 6) lines.push(`en nog ${n - 6}`);
  return { title: `Vandaag: ${n} ${n === 1 ? 'actie' : 'acties'}${late ? `, ${late} te laat` : ''}`, body: lines.join('\n') };
}

self.addEventListener('push', event => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch { msg = {}; }
  event.waitUntil((async () => {
    const agenda = await readAgenda();
    const m = buildMessage(agenda && agenda.items, todayISO());
    const opts = { icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', tag: 'dagtaken', renotify: true, data: { url: './#vandaag' } };
    if (m) return self.registration.showNotification(m.title, { ...opts, body: m.body });
    if (msg.test) return self.registration.showNotification('Koude Acquisitie', { ...opts, body: 'Meldingen werken. Er staan vandaag geen acties op je lijst.' });
    // Geen acties vandaag: geen melding.
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './#vandaag', self.registration.scope).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) {
        try { await w.navigate(url); } catch {}
        return w.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
