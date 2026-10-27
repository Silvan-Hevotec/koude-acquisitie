// Leadnex: meldingen op je telefoon.
//
// Supabase roept deze functie elke minuut aan (zie supabase/meldingen.sql). De functie stuurt:
//  - 's ochtends een overzicht van de acties van vandaag, op de tijd die je in de app instelt;
//  - bij een actie of eigen afspraak met een tijd een herinnering op het tijdstip zelf of zoveel minuten ervoor.
// Vanuit de app (Meer → Meldingen) wordt hij aangeroepen met {"status": true} om te zien of alles werkt,
// en met {"test": true} voor een testmelding op jouw telefoons.
// Daarnaast opent hij voor de app een korte Google-link ({"link": "https://share.google/..."}): bij delen vanuit
// Google komt vaak alleen zo'n link mee, en de app kan die zelf niet volgen. En met {"verrijk": {...}} zoekt hij
// bij een gedeeld bedrijf het adres, de telefoon, de website en het e-mailadres erbij.
// Tot slot geeft hij op een geheime link (…/leadnex-meldingen/agenda/<sleutel>.ics) je afspraken, taken en acties
// als agenda, zodat je die in Outlook kunt toevoegen (Agenda toevoegen → Abonneren vanaf het web).
//
// Instellen in Supabase: Edge Functions → nieuwe functie "leadnex-meldingen" met deze code,
// "Verify JWT" uit, en bij Edge Functions → Secrets het geheim VAPID_PRIVATE_KEY.
// De functie gebruikt geen externe bibliotheken: versleutelen en ondertekenen gaat met WebCrypto.

const APP_URL = 'https://silvan-hevotec.github.io/koude-acquisitie/';
const VAPID_PUBLIC = 'BDz5_askKTOerYW4HV6sHD4GET_pLPTGSah3yEDccDjpEZTWyK0-lRdvAnYPSresTw1bs1VKjXSdPqmMHwFmGM8';
const TZ = 'Europe/Amsterdam';
const STANDAARD = { ochtend: '08:00', herinnering: 15 };   // zelfde standaard als in de app
const OCHTEND_VENSTER = 30;     // minuten: mist de klok een paar rondes, dan komt het overzicht alsnog
const HERINNER_VENSTER = 10;    // minuten
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type Sub = { user_id: string; id: string; data: { endpoint: string; keys: { p256dh: string; auth: string }; verlopen?: string } };
type Lead = { user_id: string; id: string; bedrijf: string | null; actie: string | null; datum: string | null; tijd: string | null;
  herinnering: number | null; gearchiveerd: boolean | null; plaats: string | null; contact: string | null; telefoon: string | null; prioriteit: string | null };
type Agendapunt = { user_id: string; id: string; soort: string | null; titel: string | null; datum: string | null; tijd: string | null; eind: string | null;
  locatie: string | null; herinnering: number | null; klaar: boolean | null; bedrijfNaam: string | null };
type Bericht = { sleutel: string; title: string; body: string; tag: string; url: string; ttl: number };

/* ---------- hulpjes ---------- */
const te = new TextEncoder();
const b64enc = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64dec = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};
const bs = (u: Uint8Array) => u as unknown as BufferSource;   // voor WebCrypto, ook met strengere TypeScript-typen
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/* ---------- tijd in Nederland ---------- */
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
function nl(t: number) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return { datum: `${p.year}-${p.month}-${p.day}`, tijd: `${p.hour}:${p.minute}`, weekend: p.weekday === 'Sat' || p.weekday === 'Sun' };
}
const minuten = (hhmm: string) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5);
const plusDagen = (datum: string, n: number) => new Date(Date.UTC(+datum.slice(0, 4), +datum.slice(5, 7) - 1, +datum.slice(8, 10) + n)).toISOString().slice(0, 10);
// Tijdstip op de klok in Nederland → milliseconden sinds 1970 (houdt rekening met zomer- en wintertijd).
function tijdstip(datum: string, tijd: string) {
  const wand = Date.UTC(+datum.slice(0, 4), +datum.slice(5, 7) - 1, +datum.slice(8, 10), +tijd.slice(0, 2), +tijd.slice(3, 5));
  const verschil = (t: number) => { const p = nl(t); return Date.UTC(+p.datum.slice(0, 4), +p.datum.slice(5, 7) - 1, +p.datum.slice(8, 10), +p.tijd.slice(0, 2), +p.tijd.slice(3, 5)) - Math.floor(t / 60000) * 60000; };
  let t = wand - verschil(wand);
  const v2 = verschil(t);
  if (wand - v2 !== t) t = wand - v2;
  return t;
}
const kortDatum = (datum: string) => new Intl.DateTimeFormat('nl-NL', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(datum + 'T12:00:00Z'));

/* ---------- database ---------- */
function geheimeSleutel(): string {
  const k = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (k) return k;
  try { const o = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'); if (o.default) return o.default; const v = Object.values(o)[0]; if (v) return String(v); } catch { /* geen lijst */ }
  return Deno.env.get('SUPABASE_SECRET_KEY') || '';
}
async function db(pad: string, init: RequestInit = {}) {
  const key = geheimeSleutel();
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', ...(init.headers as Record<string, string> || {}) };
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/${pad}`, { ...init, headers });
  if (!res.ok) throw new Error(`database ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
const inLijst = (ids: string[]) => `in.(${ids.map(encodeURIComponent).join(',')})`;
// Telefoons met meldingen aan. Een verlopen koppeling blijft staan met 'verlopen', zodat de app op die telefoon
// bij het openen ziet dat hij een nieuwe moet maken.
async function abonnementen(userId?: string): Promise<Sub[]> {
  const rows: Sub[] = await db(`docs?collection=eq.push${userId ? `&user_id=eq.${encodeURIComponent(userId)}` : ''}&select=user_id,id,data`);
  return rows.filter(s => s.data && s.data.endpoint && s.data.keys && !s.data.verlopen);
}
async function instellingen(users: string[]) {
  const rows: { user_id: string; data: Record<string, unknown> }[] = await db(`docs?collection=eq.instellingen&id=eq.meldingen&user_id=${inLijst(users)}&select=user_id,data`);
  return (uid: string) => {
    const d = rows.find(r => r.user_id === uid)?.data || {};
    const ochtend = typeof d.ochtend === 'string' && (d.ochtend === '' || /^\d\d:\d\d$/.test(d.ochtend)) ? d.ochtend : STANDAARD.ochtend;
    const herinnering = Number.isInteger(d.herinnering) ? d.herinnering as number : STANDAARD.herinnering;
    return { ochtend, herinnering };
  };
}
// Eén keer versturen: de sleutel wordt vastgelegd; bestond hij al, dan is de melding al weg.
async function claim(sleutel: string, userId: string) {
  const rows = await db('meldlog?on_conflict=sleutel', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify([{ sleutel, user_id: userId }]) });
  return Array.isArray(rows) && rows.length > 0;
}
const vrijgeven = (sleutel: string) => db(`meldlog?sleutel=eq.${encodeURIComponent(sleutel)}`, { method: 'DELETE' });

/* ---------- web push (RFC 8291 en 8292) ---------- */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const key = await crypto.subtle.importKey('raw', bs(ikm), 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: bs(salt), info: bs(info) }, key, len * 8));
}
async function versleutel(uaPublic: Uint8Array, authSecret: Uint8Array, tekst: Uint8Array) {
  const ua = await crypto.subtle.importKey('raw', bs(uaPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const eigen = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const eigenPublic = new Uint8Array(await crypto.subtle.exportKey('raw', eigen.publicKey));
  const gedeeld = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: ua }, eigen.privateKey, 256));
  const ikm = await hkdf(authSecret, gedeeld, concat(te.encode('WebPush: info\0'), uaPublic, eigenPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const geheim = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(tekst, new Uint8Array([2]))));
  const kop = new Uint8Array(21);
  kop.set(salt, 0);
  new DataView(kop.buffer).setUint32(16, 4096);
  kop[20] = eigenPublic.length;
  return concat(kop, eigenPublic, geheim);
}
async function vapidToken(aud: string) {
  const pub = b64dec(VAPID_PUBLIC);
  const jwk = { kty: 'EC', crv: 'P-256', x: b64enc(pub.slice(1, 33)), y: b64enc(pub.slice(33, 65)), d: (Deno.env.get('VAPID_PRIVATE_KEY') || '').trim() };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const kop = b64enc(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const inhoud = b64enc(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: APP_URL })));
  const handtekening = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(`${kop}.${inhoud}`)));
  return `${kop}.${inhoud}.${b64enc(handtekening)}`;
}
async function push(sub: Sub, b: Bericht) {
  const { endpoint, keys } = sub.data;
  const body = await versleutel(b64dec(keys.p256dh), b64dec(keys.auth), te.encode(JSON.stringify({ type: 'melding', title: b.title, body: b.body, tag: b.tag, url: b.url })));
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { TTL: String(b.ttl), Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: `vapid t=${await vapidToken(new URL(endpoint).origin)}, k=${VAPID_PUBLIC}` },
    body,
  });
  await res.body?.cancel();
  return res.status;
}
// Naar alle telefoons van een gebruiker; verlopen koppelingen worden gemarkeerd.
async function verstuur(subs: Sub[], b: Bericht) {
  const r = { verstuurd: 0, verlopen: 0, fouten: [] as string[] };
  for (const s of subs) {
    let status = 0;
    try { status = await push(s, b); } catch (e) { r.fouten.push(String((e as Error).message || e)); continue; }
    if (status >= 200 && status < 300) r.verstuurd++;
    else if (status === 404 || status === 410) {
      r.verlopen++;
      await db(`docs?collection=eq.push&user_id=eq.${encodeURIComponent(s.user_id)}&id=eq.${encodeURIComponent(s.id)}`, { method: 'PATCH', body: JSON.stringify({ data: { ...s.data, verlopen: new Date().toISOString() } }) }).catch(() => {});
    } else r.fouten.push(`pushdienst ${status}`);
  }
  return r;
}

/* ---------- wat er in de meldingen staat ---------- */
const rang = (l: Lead) => l.prioriteit === 'hoog' ? 0 : l.prioriteit === 'laag' ? 2 : 1;
// Overzicht van de dag: eigen afspraken (op tijd), taken en de acties bij bedrijven.
function ochtendBericht(uid: string, leads: Lead[], agenda: Agendapunt[], vandaag: string, weekend: boolean): Bericht | null {
  const due = leads.filter(l => l.datum! <= vandaag)
    .sort((a, b) => rang(a) - rang(b) || a.datum!.localeCompare(b.datum!) || (a.tijd || '99').localeCompare(b.tijd || '99') || (a.plaats || '').localeCompare(b.plaats || ''));
  const afspraken = agenda.filter(a => a.soort === 'afspraak' && a.datum === vandaag).sort((a, b) => (a.tijd || '99').localeCompare(b.tijd || '99'));
  const taken = agenda.filter(a => a.soort === 'taak' && a.klaar !== true && a.datum! <= vandaag);
  const vandaagZelf = due.filter(l => l.datum === vandaag);
  // In het weekend alleen als er die dag echt iets staat.
  const lijst = weekend ? vandaagZelf : due, takenNu = weekend ? taken.filter(a => a.datum === vandaag) : taken;
  if (!lijst.length && !afspraken.length && !takenNu.length) return null;
  const laat = lijst.filter(l => l.datum! < vandaag).length;
  const regels = [
    ...afspraken.map(a => `${a.tijd ? a.tijd + ' ' : ''}${a.titel || 'Afspraak'}${a.locatie ? ` (${a.locatie})` : a.bedrijfNaam ? ` (${a.bedrijfNaam})` : ''}`),
    ...takenNu.map(a => `Taak: ${a.titel || 'taak'}${a.datum! < vandaag ? ' – te laat' : ''}`),
    ...lijst.map(l => `${l.tijd && l.datum === vandaag ? l.tijd + ' ' : ''}${l.actie} · ${l.bedrijf}${l.plaats ? ` (${l.plaats})` : ''}${l.datum! < vandaag ? ' – te laat' : ''}${l.prioriteit === 'hoog' ? ' – hoog' : ''}`),
  ];
  const tonen = regels.slice(0, 7);
  if (regels.length > 7) tonen.push(`en nog ${regels.length - 7}`);
  const tel = (n: number, een: string, meer: string) => n ? `${n} ${n === 1 ? een : meer}` : '';
  const kop = [tel(lijst.length, 'actie', 'acties') + (laat ? ` (${laat} te laat)` : ''), tel(afspraken.length, 'afspraak', 'afspraken'), tel(takenNu.length, 'taak', 'taken')].filter(x => x.trim());
  return { sleutel: `ochtend|${uid}|${vandaag}`, title: `Vandaag: ${kop.join(', ')}`, body: tonen.join('\n'), tag: 'dagtaken', url: './#vandaag', ttl: 4 * 3600 };
}
function afspraakBericht(uid: string, a: Agendapunt, vooraf: number, vandaag: string): Bericht {
  const wanneer = a.datum === vandaag ? `om ${a.tijd}` : a.datum === plusDagen(vandaag, 1) ? `morgen om ${a.tijd}` : `${kortDatum(a.datum!)} om ${a.tijd}`;
  const titel = a.titel || 'Afspraak';
  const nu = vooraf === 0 ? `Gepland om ${a.tijd}${a.eind ? `–${a.eind}` : ''}.` : vooraf < 60 ? `Over ${vooraf} minuten.` : vooraf === 60 ? 'Over een uur.' : '';
  return { sleutel: `agenda|${uid}|${a.id}|${a.datum}T${a.tijd}|${vooraf}`, title: vooraf === 0 ? `Nu: ${titel}` : `${titel} ${wanneer}`,
    body: [nu, [a.locatie, a.bedrijfNaam].filter(Boolean).join(' · ')].filter(Boolean).join('\n'), tag: `agenda-${a.id}`, url: `./#agenda=${encodeURIComponent(a.id)}`, ttl: 1800 };
}
function herinnerBericht(uid: string, l: Lead, vooraf: number, vandaag: string): Bericht {
  const wanneer = l.datum === vandaag ? `om ${l.tijd}` : l.datum === plusDagen(vandaag, 1) ? `morgen om ${l.tijd}` : `${kortDatum(l.datum!)} om ${l.tijd}`;
  const kop = vooraf === 0 ? `Nu: ${l.actie} ${l.bedrijf}` : `${l.actie} ${l.bedrijf} ${wanneer}`;
  const details = [l.contact, l.telefoon, l.plaats].filter(Boolean).join(' · ');
  const nu = vooraf === 0 ? `Gepland om ${l.tijd}.` : vooraf < 60 ? `Over ${vooraf} minuten.` : vooraf === 60 ? 'Over een uur.' : '';
  return { sleutel: `herinner|${uid}|${l.id}|${l.datum}T${l.tijd}|${vooraf}`, title: kop, body: [nu, details].filter(Boolean).join('\n'), tag: `actie-${l.id}`, url: `./#bedrijf=${encodeURIComponent(l.id)}`, ttl: 1800 };
}

/* ---------- elke minuut ---------- */
async function ronde(nu: number) {
  await db('meldlog?on_conflict=sleutel', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ sleutel: 'hartslag', verstuurd: new Date(nu).toISOString() }]) });
  const subs = await abonnementen();
  if (!subs.length) return { telefoons: 0, verstuurd: 0 };
  const users = [...new Set(subs.map(s => s.user_id))];
  const cfgVan = await instellingen(users);
  const { datum: vandaag, tijd, weekend } = nl(nu);
  const morgen = plusDagen(vandaag, 1);
  const velden = 'user_id,id,bedrijf:data->>bedrijf,actie:data->>actie,datum:data->>datum,tijd:data->>tijd,herinnering:data->herinnering,gearchiveerd:data->gearchiveerd,plaats:data->>plaats,contact:data->>contact,telefoon:data->>telefoon,prioriteit:data->>prioriteit';
  const leads: Lead[] = await db(`docs?collection=eq.leads&user_id=${inLijst(users)}&data->>datum=lte.${morgen}&data->>datum=gte.2000-01-01&select=${velden}`);
  const agVelden = 'user_id,id,soort:data->>soort,titel:data->>titel,datum:data->>datum,tijd:data->>tijd,eind:data->>eind,locatie:data->>locatie,herinnering:data->herinnering,klaar:data->klaar,bedrijfNaam:data->>bedrijfNaam';
  const agenda: Agendapunt[] = await db(`docs?collection=eq.agenda&user_id=${inLijst(users)}&data->>datum=lte.${morgen}&data->>datum=gte.2000-01-01&select=${agVelden}`).catch(() => []);
  const totaal = { telefoons: subs.length, verstuurd: 0, verlopen: 0, fouten: [] as string[] };
  for (const uid of users) {
    const cfg = cfgVan(uid);
    const mijn = leads.filter(l => l.user_id === uid && l.actie && l.bedrijf && /^\d{4}-\d\d-\d\d$/.test(l.datum || '') && l.gearchiveerd !== true);
    const berichten: Bericht[] = [];
    if (cfg.ochtend && minuten(tijd) >= minuten(cfg.ochtend) && minuten(tijd) < minuten(cfg.ochtend) + OCHTEND_VENSTER) {
      const b = ochtendBericht(uid, mijn, agenda.filter(a => a.user_id === uid), vandaag, weekend);
      if (b) berichten.push(b);
    }
    for (const l of mijn) {
      if (!/^\d\d:\d\d$/.test(l.tijd || '')) continue;
      const h = Number.isInteger(l.herinnering) ? l.herinnering! : cfg.herinnering;
      if (h <= 0) continue;   // 0 = geen herinnering
      const vooraf = h === 1 ? 0 : h;   // 1 = op het tijdstip zelf
      const om = tijdstip(l.datum!, l.tijd!) - vooraf * 60000;
      if (om <= nu && om > nu - HERINNER_VENSTER * 60000) berichten.push(herinnerBericht(uid, l, vooraf, vandaag));
    }
    // Eigen afspraken met een tijd
    for (const a of agenda) {
      if (a.user_id !== uid || a.soort !== 'afspraak' || !/^\d{4}-\d\d-\d\d$/.test(a.datum || '') || !/^\d\d:\d\d$/.test(a.tijd || '')) continue;
      const h = Number.isInteger(a.herinnering) ? a.herinnering! : cfg.herinnering;
      if (h <= 0) continue;
      const vooraf = h === 1 ? 0 : h;
      const om = tijdstip(a.datum!, a.tijd!) - vooraf * 60000;
      if (om <= nu && om > nu - HERINNER_VENSTER * 60000) berichten.push(afspraakBericht(uid, a, vooraf, vandaag));
    }
    const mijnSubs = subs.filter(s => s.user_id === uid);
    for (const b of berichten) {
      if (!await claim(b.sleutel, uid)) continue;
      const r = await verstuur(mijnSubs, b);
      totaal.verstuurd += r.verstuurd; totaal.verlopen += r.verlopen; totaal.fouten.push(...r.fouten);
      if (!r.verstuurd && r.fouten.length) await vrijgeven(b.sleutel).catch(() => {});   // pushdienst even niet bereikbaar: volgende minuut opnieuw
    }
  }
  if (tijd.endsWith(':00')) await db(`meldlog?verstuurd=lt.${new Date(nu - 3 * 86400000).toISOString()}`, { method: 'DELETE' }).catch(() => {});
  return totaal;
}

/* ---------- korte Google-link openen (delen naar de app) ---------- */
const KORTE_LINK = /^https:\/\/(share\.google|maps\.app\.goo\.gl|goo\.gl|g\.co|search\.app)\//i;
const BROWSER = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
// Volgt de doorverwijzingen tot een Google-zoek- of kaartadres (met de naam en soms de plek erin). Ook de
// toestemmingspagina van Google (continue=...) en een pagina die pas in de browser doorstuurt.
async function linkOpenen(start: string) {
  let url = start;
  for (let i = 0; i < 8; i++) {
    const u = new URL(url);
    if (/^consent\.google\./.test(u.hostname) && u.searchParams.get('continue')) { url = u.searchParams.get('continue')!; continue; }
    if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && (/^\/maps\//.test(u.pathname) || (u.pathname === '/maps' && u.search) || (u.pathname === '/search' && (u.searchParams.get('q') || u.searchParams.get('kgmid'))))) return url;
    const res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': BROWSER, 'Accept-Language': 'nl-NL,nl;q=0.9', Accept: 'text/html,application/xhtml+xml' } });
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) { await res.body?.cancel(); url = new URL(loc, url).href; continue; }
    if (!res.ok) { await res.body?.cancel(); break; }
    const html = (await res.text()).slice(0, 500000)
      .replace(/\\x3d/gi, '=').replace(/\\x26/gi, '&').replace(/\\u003d/gi, '=').replace(/\\u0026/gi, '&').replace(/\\\//g, '/').replace(/&amp;/g, '&');
    const m = html.match(/https:\/\/www\.google\.[a-z.]+\/(?:search|maps)[^"'<>\s\\]+/) || html.match(/["'=](\/(?:search|maps)(?:\/|\?)[^"'<>\s\\]+)/);
    if (!m) break;
    url = new URL(m[1] || m[0], url).href;
  }
  return url === start ? '' : url;
}


/* ---------- gegevens aanvullen bij een gedeeld bedrijf ---------- */
// Zoekt adres, telefoon, website en e-mail: eerst op de Google Maps-pagina van het bedrijf, dan op de eigen website
// (ook de contactpagina). Is de website onbekend, dan zoekt hij die op via DuckDuckGo. Alles met korte tijdslimieten.
type Gevonden = { adres?: string; postcode?: string; plaats?: string; telefoon?: string; website?: string; email?: string; branche?: string; bronnen: string[] };
const GOOGLE_KOEKJES = 'CONSENT=YES+cb.20250101-00-p0.nl+FX+000; SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg';
const GEEN_BEDRIJFSSITE = /(^|\.)(google|gstatic|googleusercontent|googleapis|youtube|facebook|fb|instagram|linkedin|twitter|x|tiktok|pinterest|wikipedia|tripadvisor|yelp|foursquare|telefoonboek|detelefoongids|goudengids|openingstijden|openingstijden-nu|cylex|cylex-nederland|oozo|drimble|kvk|bedrijvenregister|bedrijfsgegevens|indebuurt|indeed|werkzoeken|nationalevacaturebank|booking|thuisbezorgd|waze|apple|bing|duckduckgo|yahoo|marktplaats|trustpilot|kiyoh|klantenvertellen|companyinfo|graydon|allebedrijvenin|bedrijfstelefoonnummer|infobel|hotfrog|yelu|tuugo|nl\.kompass|europages|zoominfo|dnb|opencorporates|wanderlog|restaurantguru|thefork|iens|funda|jaap)\.[a-z.]+$/i;
const haal = async (url: string, extra: Record<string, string> = {}) => {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(5000), headers: { 'User-Agent': BROWSER, 'Accept-Language': 'nl-NL,nl;q=0.9', Accept: 'text/html,application/xhtml+xml', ...extra } });
  if (!res.ok) { await res.body?.cancel(); return ''; }
  return (await res.text()).slice(0, 1500000);
};
const ontsnap = (t: string) => t.replace(/\\u003d/gi, '=').replace(/\\u0026/gi, '&').replace(/\\x3d/gi, '=').replace(/\\x26/gi, '&').replace(/\\u0027/gi, "'").replace(/\\\//g, '/')
  .replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;|&#160;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const tekstVan = (html: string) => ontsnap(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h\d|address|span)>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ');
// Nederlands of Belgisch telefoonnummer, zoals het er staat.
function telefoonUit(t: string) {
  const re = /(?:\+|00)3[12][\s.\-]?(?:\(0\)[\s.\-]?)?[1-9](?:[\s.\-]?\d){7,8}|\b0[1-9](?:[\s.\-]?\d){8}\b/g;
  for (const m of t.match(re) || []) {
    const d = m.replace(/\(0\)/, '').replace(/\D/g, '').replace(/^00/, '');
    if (/^0\d{9}$/.test(d) || /^31\d{9}$/.test(d) || /^32\d{8,9}$/.test(d)) return m.replace(/\s+/g, ' ').trim();
  }
  return '';
}
const POSTCODE_ADRES = /([A-ZÀ-ſ][\p{L}'.\-]+(?:\s[\p{L}'.\-]+){0,4}\s\d{1,5}(?:\s?[a-zA-Z](?![\p{L}]))?(?:[\s\-]+\d{1,4})?)\s*[,\n]?\s*(\d{4}\s?[A-Z]{2})\s*,?\s+([A-ZÀ-ſ'][\p{L}'\-]+(?:[ \t][\p{L}'\-]+){0,3})/gu;
// Plaatsnaam: het eerste woord, plus wat erbij hoort ('Den Haag', 'Alphen aan den Rijn', 'Sint Anthonis').
function plaatsVan(t: string) {
  const w = t.split(/\s+/), uit = [w[0]];
  const verbind = /^(aan|den|de|op|bij|in|ter|te|a\/d)$/;
  for (let i = 1; i < w.length; i++) {
    if (verbind.test(w[i]) && w[i + 1]) { uit.push(w[i]); continue; }
    if (verbind.test(uit[uit.length - 1]) || (i === 1 && /^(Den|De|Het|Sint|St\.?|Nieuw|Oud|Groot|Klein|West|Oost|Noord|Zuid|Ter|Ten)$/.test(w[0]))) { uit.push(w[i]); continue; }
    break;
  }
  return uit.join(' ');
}
function adresUit(t: string) {
  for (const m of t.matchAll(POSTCODE_ADRES)) {
    if (/^(postbus|antwoordnummer|kvk|btw|iban)\b/i.test(m[1])) continue;
    return { adres: m[1].replace(/\s+/g, ' ').trim(), postcode: m[2].replace(/^(\d{4})\s?([A-Z]{2})$/, '$1 $2'), plaats: plaatsVan(m[3].trim()) };
  }
  return null;
}
const emailUit = (t: string) => (t.match(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi) || []).find(e => !/(example|sentry|wixpress|domain|email|jouw|your|naam)\.|\.(png|jpg|gif|webp)$/i.test(e)) || '';
function aanvullen(g: Gevonden, x: Partial<Gevonden>, bron: string) {
  let iets = false;
  for (const k of ['adres', 'postcode', 'plaats', 'telefoon', 'website', 'email', 'branche'] as const) if (!g[k] && x[k]) { g[k] = x[k]; iets = true; }
  if (iets && !g.bronnen.includes(bron)) g.bronnen.push(bron);
}
// schema.org-gegevens (LocalBusiness/Organization) die veel websites meegeven
function jsonLd(html: string): Partial<Gevonden> {
  const out: Partial<Gevonden> = {};
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const stack: unknown[] = [data];
    while (stack.length) {
      const o = stack.pop();
      if (Array.isArray(o)) { stack.push(...o); continue; }
      if (!o || typeof o !== 'object') continue;
      const r = o as Record<string, unknown>;
      if (!out.telefoon && typeof r.telephone === 'string') out.telefoon = telefoonUit(r.telephone) || r.telephone.trim();
      if (!out.email && typeof r.email === 'string') out.email = r.email.replace(/^mailto:/i, '').trim();
      const a = r.address as Record<string, unknown> | undefined;
      if (!out.adres && a && typeof a === 'object' && typeof a.streetAddress === 'string') {
        out.adres = a.streetAddress.trim();
        if (typeof a.postalCode === 'string') out.postcode = a.postalCode.trim().replace(/^(\d{4})\s?([A-Za-z]{2})$/, (_, x, y) => `${x} ${y.toUpperCase()}`);
        if (typeof a.addressLocality === 'string') out.plaats = a.addressLocality.trim();
      }
      Object.values(r).forEach(v => { if (v && typeof v === 'object') stack.push(v); });
    }
  }
  return out;
}
function uitPagina(html: string): Partial<Gevonden> {
  const ld = jsonLd(html), t = tekstVan(html);
  const tel = (html.match(/href=["']tel:([^"']+)["']/i) || [])[1];
  const mail = (html.match(/href=["']mailto:([^"'?]+)/i) || [])[1];
  const a = adresUit(t);
  return {
    telefoon: ld.telefoon || (tel ? telefoonUit(decodeURIComponent(tel)) || decodeURIComponent(tel).trim() : '') || telefoonUit(t),
    email: ld.email || (mail ? decodeURIComponent(mail).trim() : '') || emailUit(t),
    adres: ld.adres || a?.adres, postcode: ld.adres ? ld.postcode : a?.postcode, plaats: ld.adres ? ld.plaats : a?.plaats,
  };
}
// Google Maps-pagina: titel "Naam · Adres", en in de pagina-gegevens telefoon en website.
async function uitGoogleMaps(url: string): Promise<Partial<Gevonden>> {
  const html = ontsnap(await haal(url, { Cookie: GOOGLE_KOEKJES }).catch(() => ''));
  if (!html) return {};
  const out: Partial<Gevonden> = {};
  const og = (html.match(/<meta[^>]+(?:property|itemprop)=["'](?:og:title|name)["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|itemprop)=["'](?:og:title|name)["']/i) || [])[1] || '';
  const a = adresUit(og.split(' · ').slice(1).join(', ')) || adresUit(og);
  if (a) Object.assign(out, a);
  // Soort bedrijf uit de beschrijving ("★★★★☆ · Autogarage"): het eerste stuk zonder cijfers en sterren.
  const besch = (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i) || [])[1] || '';
  const soort = besch.split(/\s*·\s*/).map(x => x.trim()).find(x => x && x.length <= 40 && !/[\d★☆]/.test(x));
  if (soort) out.branche = soort;
  const blok = html.slice(0, 1200000);
  out.telefoon = telefoonUit((blok.match(/"((?:\+|00)3[12][\d\s\-]{8,14}|0[1-9][\d\s\-]{8,12})"/) || [])[1] || '');
  const site = [...blok.matchAll(/\/url\?q=(https?:\/\/[^&"\\\s]+)/g)].map(m => { try { return decodeURIComponent(m[1]); } catch { return m[1]; } })
    .find(u => { try { return !GEEN_BEDRIJFSSITE.test(new URL(u).hostname); } catch { return false; } });
  if (site) out.website = site;
  if (!out.adres) { const b = adresUit(tekstVan(blok)); if (b) Object.assign(out, b); }
  return out;
}
const naamDelen = (naam: string) => naam.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !/^(bakkerij|garage|groothandel|bouwbedrijf|transport|installatie|techniek|holding|services|nederland|bedrijf)$/.test(w));
// Website van het bedrijf zoeken: het eerste resultaat dat geen gids of sociaal netwerk is en bij de naam past.
async function zoekWebsite(naam: string, plaats: string) {
  const html = await haal(`https://html.duckduckgo.com/html/?q=${encodeURIComponent([naam, plaats].filter(Boolean).join(' '))}&kl=nl-nl`).catch(() => '');
  const delen = naamDelen(naam);
  for (const m of html.matchAll(/href=["'][^"']*uddg=([^&"']+)/g)) {
    let u = '';
    try { u = decodeURIComponent(m[1]); } catch { continue; }
    let host = '';
    try { host = new URL(u).hostname.replace(/^www\./, ''); } catch { continue; }
    if (GEEN_BEDRIJFSSITE.test(host)) continue;
    const plat = host.replace(/[^a-z0-9]/g, '');
    if (!delen.length || delen.some(d => plat.includes(d))) return u;
  }
  return '';
}
async function verrijk(v: { naam?: string; plaats?: string; url?: string; website?: string }) {
  const g: Gevonden = { bronnen: [] };
  const naam = String(v.naam || '').slice(0, 120), plaats = String(v.plaats || '').slice(0, 60);
  if (v.website) g.website = /^https?:\/\//.test(v.website) ? v.website : 'https://' + v.website;
  let url = String(v.url || '');
  if (/^https:\/\/(www\.)?google\.[a-z.]+\/search/.test(url)) {
    const q = new URL(url).searchParams.get('q') || naam;
    url = q ? `https://www.google.com/maps/search/${encodeURIComponent(q)}?hl=nl` : '';
  } else if (!/^https:\/\/(www\.)?google\.[a-z.]+\/maps/.test(url)) url = naam ? `https://www.google.com/maps/search/${encodeURIComponent([naam, plaats].filter(Boolean).join(' '))}?hl=nl` : '';
  if (url) aanvullen(g, await uitGoogleMaps(url).catch(() => ({})), 'Google Maps');
  if (!g.website && naam) { const w = await zoekWebsite(naam, g.plaats || plaats).catch(() => ''); if (w) { g.website = w; g.bronnen.push('zoeken'); } }
  if (g.website && (!g.telefoon || !g.adres || !g.email)) {
    let basis = '';
    try { basis = new URL(g.website).origin; } catch { /* ongeldig */ }
    if (basis) {
      const thuis = await haal(g.website).catch(() => '');
      aanvullen(g, uitPagina(thuis), 'website');
      if (!g.telefoon || !g.adres || !g.email) {
        const link = (thuis.match(/href=["']((?!mailto:|tel:)[^"']*contact[^"']*)["']/i) || [])[1];
        const contact = link ? new URL(link, g.website).href : basis + '/contact';
        if (new URL(contact).origin === basis) aanvullen(g, uitPagina(await haal(contact).catch(() => '')), 'website');
      }
    }
  }
  if (g.website) { try { const u = new URL(g.website); g.website = u.hostname + (u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '')); } catch { /* laten */ } }
  return g;
}

/* ---------- vanuit de app: status of testmelding ---------- */
async function vanApp(req: Request, body: { test?: boolean; status?: boolean; link?: string; verrijk?: { naam?: string; plaats?: string; url?: string; website?: string } }) {
  if (!body.link && !body.verrijk && !(Deno.env.get('VAPID_PRIVATE_KEY') || '').trim()) return json({ ok: false, fout: 'geen-sleutel', uitleg: 'Het geheim VAPID_PRIVATE_KEY ontbreekt in Supabase (Edge Functions → Secrets).' });
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, { headers: { apikey: req.headers.get('apikey') || geheimeSleutel(), Authorization: req.headers.get('Authorization') || '' } });
  if (!res.ok) return json({ ok: false, fout: 'niet-ingelogd', uitleg: 'Log opnieuw in en probeer het nog eens.' }, 401);
  const user = await res.json();
  if (body.link) {
    if (!KORTE_LINK.test(body.link)) return json({ ok: false, fout: 'geen-korte-link' }, 400);
    const url = await linkOpenen(body.link).catch(() => '');
    return json(url ? { ok: true, url } : { ok: false, fout: 'link-niet-geopend' });
  }
  if (body.verrijk) return json({ ok: true, ...(await verrijk(body.verrijk)) });
  const subs = await abonnementen(user.id);
  const hartslag = ((await db('meldlog?sleutel=eq.hartslag&select=verstuurd')) || [])[0]?.verstuurd || null;
  if (body.status) return json({ ok: true, telefoons: subs.length, hartslag });
  if (!subs.length) return json({ ok: false, fout: 'geen-telefoon', uitleg: 'Er is nog geen telefoon gekoppeld. Zet de meldingen aan op je telefoon.' });
  const cfg = (await instellingen([user.id]))(user.id);
  const h = cfg.herinnering, wanneer = h <= 0 ? 'geen herinnering bij acties met een tijd' : h === 1 ? 'een herinnering op het tijdstip van een actie' : h === 1440 ? 'een herinnering een dag voor een actie met een tijd' : `een herinnering ${h} minuten voor een actie met een tijd`;
  const r = await verstuur(subs, { sleutel: '', title: 'Meldingen werken', body: `${cfg.ochtend ? `Om ${cfg.ochtend} krijg je het overzicht van de dag, en ` : 'Je krijgt '}${wanneer}.`, tag: 'test', url: './#vandaag', ttl: 600 });
  return json({ ok: r.verstuurd > 0, telefoons: subs.length, hartslag, ...r });
}

/* ---------- agenda voor Outlook ---------- */
// Outlook haalt deze link om de paar uur op. De sleutel maakt de app (Meer → Agenda in Outlook) en staat in
// instellingen/agendalink; met een nieuwe sleutel werkt de oude link niet meer. Notities en afgevinkte taken staan er niet in.
const AGENDA_PAD = /\/agenda\/([A-Za-z0-9_-]{24,64})\.ics$/;
const icsTekst = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// Regels van hooguit 75 bytes; het vervolg begint met een spatie.
function vouw(regel: string) {
  const delen: string[] = [];
  let huidig = '', bytes = 0;
  for (const teken of regel) {
    const n = te.encode(teken).length;
    if (bytes + n > 75) { delen.push(huidig); huidig = ' '; bytes = 1; }
    huidig += teken; bytes += n;
  }
  delen.push(huidig);
  return delen.join('\r\n');
}
const utc = (t: number) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const heleDag = (datum: string) => datum.replace(/-/g, '');
const geldigeTijd = (t: string | null) => !!t && /^\d\d:\d\d$/.test(t);
type Moment = { uid: string; datum: string; tijd?: string | null; eind?: number; titel: string; plek?: string; info?: string; url?: string; bezet?: boolean };
function vevent(m: Moment, stempel: string) {
  const regels = ['BEGIN:VEVENT', `UID:${m.uid}@leadnex`, `DTSTAMP:${stempel}`];
  if (geldigeTijd(m.tijd ?? null)) {
    const start = tijdstip(m.datum, m.tijd!);
    regels.push(`DTSTART:${utc(start)}`, `DTEND:${utc(start + (m.eind || 30) * 60000)}`);
  } else regels.push(`DTSTART;VALUE=DATE:${heleDag(m.datum)}`, `DTEND;VALUE=DATE:${heleDag(plusDagen(m.datum, 1))}`);
  regels.push(`SUMMARY:${icsTekst(m.titel)}`);
  if (m.plek) regels.push(`LOCATION:${icsTekst(m.plek)}`);
  if (m.info) regels.push(`DESCRIPTION:${icsTekst(m.info)}`);
  if (m.url) regels.push(`URL:${m.url}`);
  regels.push(`TRANSP:${m.bezet ? 'OPAQUE' : 'TRANSPARENT'}`, 'END:VEVENT');
  return regels.map(vouw).join('\r\n');
}
async function agendaFeed(sleutel: string, alleenKop: boolean) {
  const kop = { ...CORS, 'Cache-Control': 'no-cache' };
  const eigenaar: { user_id: string }[] = await db(`docs?collection=eq.instellingen&id=eq.agendalink&data->>sleutel=eq.${encodeURIComponent(sleutel)}&select=user_id`);
  if (!eigenaar.length) return new Response('Deze agendalink werkt niet meer. Maak in Leadnex een nieuwe bij Meer → Agenda in Outlook.', { status: 404, headers: { ...kop, 'Content-Type': 'text/plain; charset=utf-8' } });
  const uid = encodeURIComponent(eigenaar[0].user_id);
  const vandaag = nl(Date.now()).datum, van = plusDagen(vandaag, -60), tot = plusDagen(vandaag, 400);
  const bereik = `&data->>datum=gte.${van}&data->>datum=lte.${tot}`;
  const leads: (Lead & { adres: string | null })[] = await db(`docs?collection=eq.leads&user_id=eq.${uid}${bereik}&select=id,bedrijf:data->>bedrijf,actie:data->>actie,datum:data->>datum,tijd:data->>tijd,gearchiveerd:data->gearchiveerd,adres:data->>adres,plaats:data->>plaats,contact:data->>contact,telefoon:data->>telefoon`);
  const agenda: (Agendapunt & { tekst: string | null })[] = await db(`docs?collection=eq.agenda&user_id=eq.${uid}${bereik}&select=id,soort:data->>soort,titel:data->>titel,tekst:data->>tekst,datum:data->>datum,tijd:data->>tijd,eind:data->>eind,locatie:data->>locatie,klaar:data->klaar,bedrijfNaam:data->>bedrijfNaam`).catch(() => []);
  const stempel = utc(Date.now());
  const momenten: Moment[] = [];
  for (const l of leads) {
    if (!l.actie || !l.datum || l.gearchiveerd === true) continue;
    momenten.push({ uid: `bedrijf-${l.id}`, datum: l.datum, tijd: l.tijd, titel: `${l.actie} ${l.bedrijf || ''}`.trim(), plek: [l.adres, l.plaats].filter(Boolean).join(', '),
      info: [[l.contact, l.telefoon].filter(Boolean).join(' · '), `Openen in Leadnex: ${APP_URL}#bedrijf=${encodeURIComponent(l.id)}`].filter(Boolean).join('\n'),
      url: `${APP_URL}#bedrijf=${encodeURIComponent(l.id)}` });
  }
  for (const a of agenda) {
    if (!a.datum || a.soort === 'notitie' || (a.soort === 'taak' && a.klaar === true)) continue;
    const titel = a.soort === 'taak' ? `Taak: ${a.titel || ''}` : `${a.titel || 'Afspraak'}${a.bedrijfNaam ? ` – ${a.bedrijfNaam}` : ''}`;
    const duur = geldigeTijd(a.tijd) && geldigeTijd(a.eind) && minuten(a.eind!) > minuten(a.tijd!) ? minuten(a.eind!) - minuten(a.tijd!) : 60;
    momenten.push({ uid: `agenda-${a.id}`, datum: a.datum, tijd: a.tijd, eind: a.soort === 'afspraak' ? duur : 30, titel, plek: a.locatie || '',
      info: [(a.tekst || '').slice(0, 1000), `Openen in Leadnex: ${APP_URL}#agenda=${encodeURIComponent(a.id)}`].filter(Boolean).join('\n\n'),
      url: `${APP_URL}#agenda=${encodeURIComponent(a.id)}`, bezet: a.soort === 'afspraak' && geldigeTijd(a.tijd) });
  }
  const tekst = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Leadnex//Agenda//NL', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Leadnex', 'X-WR-TIMEZONE:Europe/Amsterdam', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
    ...momenten.map(m => vevent(m, stempel)), 'END:VCALENDAR'].join('\r\n') + '\r\n';
  return new Response(alleenKop ? null : tekst, { headers: { ...kop, 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="leadnex.ics"' } });
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const agendaPad = new URL(req.url).pathname.match(AGENDA_PAD);
    if (agendaPad) return await agendaFeed(agendaPad[1], req.method === 'HEAD');
    const body = await req.json().catch(() => ({}));
    if (body && (body.test || body.status || body.link || body.verrijk)) return await vanApp(req, body);
    return json(await ronde(Date.now()));
  } catch (e) {
    console.error(e);
    return json({ ok: false, fout: String((e as Error).message || e) }, 500);
  }
});
