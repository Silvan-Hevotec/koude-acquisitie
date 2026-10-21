// Leadnex AI: Supabase Edge Function voor de slimme functies van de app.
// - verslag:        maakt van een (ingesproken) klantverslag een nette notitie met opvolgtaak
// - voorbereiding:  korte gespreksvoorbereiding voor één bedrijf
// - vraag:          beantwoordt een vraag over je eigen klantdocumentatie
// De Anthropic API-sleutel staat als geheim in Supabase (ANTHROPIC_API_KEY) en komt nooit in de app.
// Alleen ingelogde gebruikers kunnen de functie aanroepen; bij een vraag leest de functie alleen
// de bedrijven van de gebruiker zelf (dezelfde afscherming als in de app).
import Anthropic from "npm:@anthropic-ai/sdk@0.132.1";
import { betaJSONSchemaOutputFormat } from "npm:@anthropic-ai/sdk@0.132.1/helpers/beta/json-schema";

const MODEL = "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const APP_ORIGIN = Deno.env.get("LEADNEX_ORIGIN") ?? "https://silvan-hevotec.github.io";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
const CORPUS_CHARS = 400_000;   // ongeveer 100.000 tokens klantdocumentatie per vraag

const client = new Anthropic();   // leest ANTHROPIC_API_KEY

class AiError extends Error {
  constructor(public code: string, message: string, public status = 502) { super(message); }
}

const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": origin === APP_ORIGIN || LOCAL.test(origin) ? origin : APP_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const reply = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

// Wie roept aan? Supabase controleert het inlogtoken; zo werkt het met elke soort sleutel van het project.
type User = { id: string; auth: string; apikey: string };
async function currentUser(req: Request): Promise<User | null> {
  const auth = req.headers.get("authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!SUPABASE_URL || !/^Bearer\s+\S+/i.test(auth)) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u && typeof u.id === "string" ? { id: u.id, auth, apikey } : null;
}

const str = (v: unknown, max = 2000) => typeof v === "string" ? v.slice(0, max) : "";
const list = (v: unknown, n = 20, max = 300) => Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, n).map((x) => x.slice(0, max)) : [];
const DAGEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
function today(v: unknown): string {
  const s = str(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : new Date().toISOString().slice(0, 10);
}
const dayName = (iso: string) => DAGEN[new Date(iso + "T12:00:00Z").getUTCDay()];

async function ask(opts: { system: string; content: Anthropic.Beta.BetaContentBlockParam[]; schema: Record<string, unknown>; effort: "low" | "medium" }) {
  const msg = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: opts.effort, format: betaJSONSchemaOutputFormat(opts.schema as { type: "object" }) },
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
  });
  if (msg.stop_reason === "refusal") throw new AiError("geweigerd", "Leadnex kon dit verzoek niet verwerken. Pas de tekst aan en probeer het opnieuw.");
  if (msg.stop_reason === "max_tokens" || !msg.parsed_output) throw new AiError("fout", "Het antwoord kwam niet volledig door. Probeer het opnieuw.");
  console.log(JSON.stringify({ model: msg.model, usage: { in: msg.usage.input_tokens, out: msg.usage.output_tokens, cacheRead: msg.usage.cache_read_input_tokens, cacheWrite: msg.usage.cache_creation_input_tokens } }));
  return msg.parsed_output as Record<string, unknown>;
}

/* ---------- verslag: ingesproken tekst → nette notitie + opvolgtaak ---------- */
const VERSLAG_SYSTEM = `Je werkt in Leadnex, de acquisitie-app van een verkoper die bedrijven belt en bezoekt over machines (bijvoorbeeld heftrucks en ander intern transport). Je krijgt een klantverslag dat meestal is ingesproken: spreektaal, weinig leestekens, soms herhalingen of verkeerd verstane woorden.

Maak er een nette, zakelijke vastlegging van, in het Nederlands:
- notitie: de kern van het gesprek in korte zinnen of opsommingstekens ("- "), hooguit ongeveer 120 woorden. Verzin niets en laat weg wat niets toevoegt. Herstel duidelijke spraakherkenningsfouten (bijvoorbeeld "hef truck" wordt "heftruck").
- machines: de besproken machines of producten als korte namen met de genoemde specificaties (bijvoorbeeld "elektrische heftruck 2,5 t"). Leeg als er geen genoemd zijn.
- interesse: hoog, middel, laag, geen, of onbekend als het niet blijkt.
- afspraken: wat er concreet is afgesproken (wie doet wat en wanneer). Leeg als er niets is afgesproken.
- vragen: nul tot vier vragen of punten die de verkoper bij het volgende contact moet stellen of nagaan.
- vervolg: de volgende actie voor de verkoper.
  - actie: kort, bij voorkeur een van de bestaande acties uit de lijst (zoals Bellen, Bezoek, Offerte sturen, Mailen).
  - datum: JJJJ-MM-DD, een werkdag (maandag tot en met vrijdag, geen feestdag), niet vóór vandaag. "Na de bouwvak" is de eerste werkdag na de bouwvak van de opgegeven regio. "Volgende week" zonder dag is maandag van volgende week. Bij een concrete afspraak neem je de genoemde dag. Passen de meegegeven datumhints, gebruik die dan. Zegt de klant zelf terug te bellen, plan dan een controlemoment kort na het genoemde moment.
  - tijd: HH:MM alleen als er een tijd genoemd is, anders leeg.
  - reden: één korte zin waarom deze actie op deze datum.
  - nodig is false als er echt geen vervolg is (bijvoorbeeld bij geen interesse); laat dan actie, datum en tijd leeg.
- status: prospect als er serieuze interesse is en het bedrijf nu een lead is; klant als duidelijk is dat ze klant zijn geworden (order geplaatst, contract getekend); anders ongewijzigd.`;

const VERSLAG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["notitie", "machines", "interesse", "afspraken", "vragen", "vervolg", "status"],
  properties: {
    notitie: { type: "string" },
    machines: { type: "array", items: { type: "string" } },
    interesse: { type: "string", enum: ["hoog", "middel", "laag", "geen", "onbekend"] },
    afspraken: { type: "string" },
    vragen: { type: "array", items: { type: "string" } },
    vervolg: {
      type: "object",
      additionalProperties: false,
      required: ["nodig", "actie", "datum", "tijd", "reden"],
      properties: {
        nodig: { type: "boolean" },
        actie: { type: "string" },
        datum: { type: "string", description: "JJJJ-MM-DD of leeg" },
        tijd: { type: "string", description: "HH:MM of leeg" },
        reden: { type: "string" },
      },
    },
    status: { type: "string", enum: ["lead", "prospect", "klant", "ongewijzigd"] },
  },
};

function verslag(body: Record<string, unknown>) {
  const tekst = str(body.tekst, 12000).trim();
  if (!tekst) throw new AiError("invoer", "Er is geen tekst om te verwerken.", 400);
  const vandaag = today(body.vandaag);
  const context = {
    vandaag: `${vandaag} (${dayName(vandaag)})`,
    bouwvakRegio: str(body.regio, 10),
    bouwvak: body.bouwvak ?? null,
    datumhints: Array.isArray(body.hints) ? body.hints.slice(0, 5) : [],
    bestaandeActies: list(body.acties, 40, 40),
    bedrijf: body.bedrijf ?? null,
    verslag: { soort: str(body.soort, 20), datum: str(body.datum, 10), tekst },
  };
  return ask({ system: VERSLAG_SYSTEM, schema: VERSLAG_SCHEMA, effort: "low", content: [{ type: "text", text: JSON.stringify(context, null, 1) }] });
}

/* ---------- voorbereiding: wat moet je weten vóór het volgende gesprek ---------- */
const PREP_SYSTEM = `Je werkt in Leadnex, de acquisitie-app van een verkoper die bedrijven belt en bezoekt over machines (bijvoorbeeld heftrucks en ander intern transport). Je krijgt alles wat over één bedrijf is vastgelegd: gegevens, notitie, contactmomenten en klantverslagen (nieuwste eerst).

Schrijf in het Nederlands een korte voorbereiding op het volgende telefoongesprek of bezoek:
- samenvatting: twee of drie zinnen: wat voor bedrijf het is, waar het contact staat en wat er speelt.
- laatsteContact: één zin: wanneer, hoe en met welke uitkomst.
- machines: de besproken machines of producten, kort.
- afspraken: eerdere afspraken en toezeggingen, met datum als die bekend is.
- interesse: een kort zinsdeel, bijvoorbeeld "Hoog: wil de oude heftruck voor de zomer vervangen".
- vragen: drie tot vijf concrete vragen of punten voor het volgende gesprek, afgeleid uit wat nog openstaat.
Gebruik alleen wat er is vastgelegd en verzin niets. Ontbreekt iets, laat het veld dan leeg.`;

const PREP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["samenvatting", "laatsteContact", "machines", "afspraken", "interesse", "vragen"],
  properties: {
    samenvatting: { type: "string" },
    laatsteContact: { type: "string" },
    machines: { type: "array", items: { type: "string" } },
    afspraken: { type: "array", items: { type: "string" } },
    interesse: { type: "string" },
    vragen: { type: "array", items: { type: "string" } },
  },
};

function voorbereiding(body: Record<string, unknown>) {
  const lead = body.bedrijf;
  const text = JSON.stringify({ vandaag: today(body.vandaag), bedrijf: lead }, null, 1);
  if (!lead || text.length > 200_000) throw new AiError("invoer", "Er is te weinig of te veel informatie om samen te vatten.", 400);
  return ask({ system: PREP_SYSTEM, schema: PREP_SCHEMA, effort: "low", content: [{ type: "text", text }] });
}

/* ---------- vraag over de eigen klantdocumentatie ---------- */
const VRAAG_SYSTEM = `Je werkt in Leadnex, de acquisitie-app van een verkoper die bedrijven belt en bezoekt over machines (bijvoorbeeld heftrucks en ander intern transport). Je krijgt de klantdocumentatie van deze verkoper: per bedrijf de gegevens, status (lead, prospect = potentiële klant, klant), de geplande actie met datum, de notitie, contactmomenten en klantverslagen.

Beantwoord de vraag van de verkoper alleen op basis van deze documentatie, in het Nederlands, kort en concreet. Opsommingen mogen.
- Noem bedrijven bij naam en geef per bedrijf waarom het erbij hoort (bijvoorbeeld de datum en wat er gezegd is).
- Reken tijdsaanduidingen zoals "dit kwartaal" of "volgende week" uit vanaf de datum van vandaag die bij de vraag staat.
- bedrijven: de id's van de bedrijven waar het antwoord over gaat, met per bedrijf een korte reden, het meest relevante eerst, hooguit 25.
- Staat het antwoord niet in de documentatie, zeg dat dan eerlijk en laat bedrijven leeg.
- Staat bij de documentatie dat die is ingekort, dan ontbreken de oudste of minst gebruikte bedrijven; meld dat als het voor de vraag uitmaakt.`;

const VRAAG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["antwoord", "bedrijven"],
  properties: {
    antwoord: { type: "string" },
    bedrijven: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["id", "reden"], properties: { id: { type: "string" }, reden: { type: "string" } } },
    },
  },
};

type Doc = Record<string, unknown>;
function compactLead(id: string, d: Doc) {
  const out: Record<string, unknown> = { id, bedrijf: str(d.bedrijf, 120) };
  for (const k of ["contact", "plaats", "branche", "actie", "datum", "tijd"]) if (str(d[k])) out[k] = str(d[k], 120);
  out.status = ["prospect", "klant"].includes(str(d.status)) ? d.status : "lead";
  if (d.gearchiveerd === true) out.gearchiveerd = true;
  if (str(d.notitie)) out.notitie = str(d.notitie, 1500);
  const log = Array.isArray(d.log) ? d.log as Doc[] : [];
  if (log.length) out.contactmomenten = log.slice(0, 15).map((x) => [str(x.d, 10), str(x.a, 40), str(x.u, 40), str(x.t, 200)].filter(Boolean).join(" · "));
  const vs = Array.isArray(d.verslagen) ? d.verslagen as Doc[] : [];
  if (vs.length) {
    out.verslagen = vs.slice(0, 20).map((v) => {
      const x: Record<string, unknown> = { datum: str(v.datum, 10), soort: str(v.soort, 20), tekst: str(v.tekst, 3000) };
      if (list(v.machines).length) x.machines = list(v.machines);
      if (str(v.interesse)) x.interesse = str(v.interesse, 20);
      if (str(v.afspraken)) x.afspraken = str(v.afspraken, 1000);
      if (list(v.vragen).length) x.vragen = list(v.vragen);
      return x;
    });
  }
  return out;
}
const lastActivity = (d: Doc) => {
  const vs = Array.isArray(d.verslagen) ? d.verslagen as Doc[] : [], log = Array.isArray(d.log) ? d.log as Doc[] : [];
  return [str(vs[0]?.datum, 10), str(log[0]?.d, 10), str(d.gewijzigd, 10)].sort().pop() ?? "";
};

async function vraag(body: Record<string, unknown>, user: User) {
  const vraagTekst = str(body.vraag, 600).trim();
  if (!vraagTekst) throw new AiError("invoer", "Typ eerst een vraag.", 400);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/docs?select=id,data&collection=eq.leads&limit=5000`, {
    headers: { Authorization: user.auth, apikey: user.apikey },
  });
  if (!r.ok) throw new AiError("fout", "Je klantdocumentatie kon niet worden gelezen.");
  const rows = (await r.json()) as { id: string; data: Doc }[];
  if (!rows.length) return { result: { antwoord: "Er staan nog geen bedrijven in je lijst.", bedrijven: [] }, afgekapt: false, aantal: 0 };

  // Meest recente activiteit eerst tot het maximum; daarna op id gesorteerd, zodat dezelfde lijst
  // dezelfde tekst oplevert en Anthropic hem kan hergebruiken bij een volgende vraag (prompt caching).
  const lines = rows.map((x) => ({ id: x.id, act: lastActivity(x.data ?? {}), json: JSON.stringify(compactLead(x.id, x.data ?? {})) }))
    .sort((a, b) => b.act.localeCompare(a.act) || (a.id < b.id ? -1 : 1));
  const kept: typeof lines = [];
  let size = 0;
  for (const l of lines) { if (size + l.json.length > CORPUS_CHARS) break; kept.push(l); size += l.json.length + 1; }
  const afgekapt = kept.length < lines.length;
  kept.sort((a, b) => (a.id < b.id ? -1 : 1));
  const corpus = `Klantdocumentatie (${kept.length} bedrijven${afgekapt ? `, ingekort: ${lines.length - kept.length} oudere bedrijven weggelaten` : ""}), één bedrijf per regel:\n` +
    kept.map((l) => l.json).join("\n");
  const vandaag = today(body.vandaag);
  const result = await ask({
    system: VRAAG_SYSTEM, schema: VRAAG_SCHEMA, effort: "medium",
    content: [
      { type: "text", text: corpus, cache_control: { type: "ephemeral" } },
      { type: "text", text: `Vandaag: ${vandaag} (${dayName(vandaag)})\nVraag: ${vraagTekst}` },
    ],
  });
  const ids = new Set(kept.map((l) => l.id));
  const bedrijven = Array.isArray(result.bedrijven) ? (result.bedrijven as Doc[]).filter((b) => ids.has(str(b.id, 64))).slice(0, 25) : [];
  return { result: { antwoord: str(result.antwoord, 6000), bedrijven }, afgekapt, aantal: kept.length };
}

function failure(req: Request, e: unknown) {
  if (e instanceof AiError) return reply(req, e.status, { error: e.code, message: e.message });
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return reply(req, 503, { error: "geen-sleutel", message: "De Anthropic API-sleutel in Supabase klopt niet of is ingetrokken." });
  }
  if (e instanceof Anthropic.RateLimitError) return reply(req, 429, { error: "druk", message: "Even te veel verzoeken tegelijk. Probeer het over een minuut opnieuw." });
  if (e instanceof Anthropic.BadRequestError) {
    console.error("anthropic 400", e.message);
    return reply(req, 502, { error: "fout", message: "Anthropic weigerde het verzoek. Controleer in de Anthropic Console of er tegoed is." });
  }
  if (e instanceof Anthropic.APIError) { console.error("anthropic", e.status, e.message); return reply(req, 502, { error: "fout", message: "De AI-dienst is even niet bereikbaar. Probeer het later opnieuw." }); }
  console.error(e);
  return reply(req, 500, { error: "fout", message: "Er ging iets mis. Probeer het opnieuw." });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return reply(req, 405, { error: "methode" });
  const user = await currentUser(req).catch(() => null);
  if (!user) return reply(req, 401, { error: "niet-ingelogd", message: "Log opnieuw in in Leadnex." });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.task !== "string") return reply(req, 400, { error: "invoer" });
  if (!Deno.env.get("ANTHROPIC_API_KEY")) {
    return reply(req, 503, { error: "geen-sleutel", message: "In Supabase ontbreekt het geheim ANTHROPIC_API_KEY." });
  }
  try {
    if (body.task === "ping") return reply(req, 200, { ok: true, model: MODEL });
    if (body.task === "verslag") return reply(req, 200, { ok: true, result: await verslag(body) });
    if (body.task === "voorbereiding") return reply(req, 200, { ok: true, result: await voorbereiding(body) });
    if (body.task === "vraag") return reply(req, 200, { ok: true, ...(await vraag(body, user)) });
    return reply(req, 400, { error: "taak" });
  } catch (e) {
    return failure(req, e);
  }
});
