// Service worker: maakt de app installeerbaar, laat hem openen zonder bereik
// en toont de ochtendmelding met de acties van vandaag.
const CACHE = 'koude-acquisitie-v10';
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
        // Niet bewaren: het adres waarmee Microsoft na het aanmelden terugstuurt (met eenmalige code).
        if (res.ok && !(req.mode === 'navigate' && new URL(req.url).search)) { const copy = res.clone(); caches.open(CACHE).then(cache => cache.put(req, copy)); }
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
  const rank = x => x.prioriteit === 'hoog' ? 0 : x.prioriteit === 'laag' ? 2 : 1;
  const due = (items || []).filter(x => x && x.datum && x.datum <= today)
    .sort((a, b) => rank(a) - rank(b) || a.datum.localeCompare(b.datum) || (a.tijd || '99').localeCompare(b.tijd || '99') || String(a.plaats || '').localeCompare(String(b.plaats || '')));
  if (!due.length) return null;
  const n = due.length;
  const late = due.filter(x => x.datum < today).length;
  const lines = due.slice(0, 6).map(x => `${x.tijd && x.datum === today ? x.tijd + ' ' : ''}${x.actie} · ${x.bedrijf}${x.plaats ? ' (' + x.plaats + ')' : ''}${x.datum < today ? ' – te laat' : ''}${x.prioriteit === 'hoog' ? ' – hoog' : ''}`);
  if (n > 6) lines.push(`en nog ${n - 6}`);
  return { title: `Vandaag: ${n} ${n === 1 ? 'actie' : 'acties'}${late ? `, ${late} te laat` : ''}`, body: lines.join('\n') };
}

// Op vrijdag een herinnering als de laatste back-up een week of ouder is (alleen als de gegevens op de telefoon staan).
function backupReminder(agenda) {
  if (!agenda || !agenda.lokaal || new Date().getDay() !== 5 || !(agenda.items || []).length) return '';
  const last = Date.parse(agenda.laatsteBackup || '');
  const days = isNaN(last) ? null : Math.floor((Date.now() - last) / 86400000);
  if (days !== null && days < 6) return '';
  return days === null ? 'Maak vandaag even een back-up: je hebt er nog geen.' : `Maak vandaag even een back-up: de laatste is ${days} dagen oud.`;
}

self.addEventListener('push', event => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch { msg = {}; }
  event.waitUntil((async () => {
    const agenda = await readAgenda();
    const m = buildMessage(agenda && agenda.items, todayISO());
    const tip = backupReminder(agenda);
    const opts = { icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', tag: 'dagtaken', renotify: true, data: { url: './#vandaag' } };
    if (m) return self.registration.showNotification(m.title, { ...opts, body: tip ? m.body + '\n' + tip : m.body });
    if (tip) return self.registration.showNotification('Back-up maken', { ...opts, body: tip + ' Open de app en tik onderaan op Back-up maken.' });
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
