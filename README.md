# Leadnex

Installeerbare web-app (PWA) voor acquisitie en het dagelijkse werk: bedrijven en klanten, acties, een planbord met afspraken, taken en notities, contactmomenten, mailteksten en import uit Excel.
Zonder verdere instellingen bewaart de app alles op het apparaat zelf (geen account nodig). Maak af en toe een back-up via de knop onderaan.
Wil je later dat telefoon en computer dezelfde lijst delen, koppel dan een Supabase-database (zie hieronder); de app vraagt dan om in te loggen.

## Wat de app doet

- Bedrijven met klantnummer, contactpersoon, telefoon, e-mail, adres, branche en website; acties met datum, tijd en prioriteit.
- **Bedrijfsscherm**: tik op een bedrijf en je krijgt een eigen scherm met grote knoppen (Bellen, WhatsApp, Mail, Route), de volgende stap en de tabbladen Overzicht, Verslagen, Gegevens en Historie. De terugknop van je telefoon sluit het weer.
- **Eén zoekbalk**: zoek op naam, plaats of contactpersoon, of typ een vraag. Branche, soort relatie en In de buurt zitten achter de knop Filters.
- Tabbladen: **Vandaag**, **Planbord**, **Bedrijven** (met Lijst/Kaart), **Nieuw** en **Meer** (op de telefoon onderin, op de computer bovenin, met Kaart als eigen tabblad).
- **Vandaag**: wat er vandaag (of eerder) moet gebeuren, met je eigen afspraken en taken bovenaan.
- **Planbord** in plaats van een losse agenda: per week de acties bij bedrijven en je eigen **afspraken** (met tijd, eindtijd, plek en melding), **taken** (af te vinken, ook zonder datum) en **notities** (doorzoekbaar, vast te pinnen). Alles kan aan een bedrijf gekoppeld worden en staat dan ook bij dat bedrijf onder Planning en notities.
- **Meldingen** op je telefoon: 's ochtends een overzicht van de acties, afspraken en taken van vandaag, en bij een actie of afspraak met een tijd een melding op het tijdstip of 5 minuten tot een dag ervoor (zie [Meldingen](#meldingen)). Tik op de melding en het bedrijf gaat open.
- **Belsessie**: de lijst een voor een afbellen. Na elk gesprek staat "Hoe ging het?" open, ook als je vanuit de lijst belt.
- **Vaste opvolgstappen** na geen gehoor: de volgende werkdag, na twee werkdagen, na drie keer een mail (daarna vanzelf nabellen), na vijf keer voorstel om te archiveren.
- **Kaart**: al je bedrijven in beeld, met een teller (hoeveel op de kaart, hoeveel zonder adres of met een adres dat niet gevonden is). Kies 2, 5, 10 of 25 km om te zien wat bij jou in de buurt is, met route langs de dichtstbijzijnde. Felle spelden: geel = vandaag te doen, oranje = met actie, paars = zonder actie, rode stip = hoge prioriteit. Adressen worden één keer opgezocht bij de Locatieserver van PDOK (Kadaster) en bij het bedrijf bewaard; de kaart komt ook van PDOK.
- **Mailen**: per bedrijf of aan iedereen in de lijst (filter op branche of actie), in BCC in mails van hooguit 50 adressen, met mailteksten.
- **Mailronde** (zonder Outlook-koppeling): per bedrijf een persoonlijke mail in je eigen mail-app, met aanhef en naam ingevuld. Na het versturen tik je op "Verstuurd, open de volgende": de mail komt in de contactmomenten en de volgende mail gaat meteen open.
- **Agenda in Outlook** (zonder koppeling of beheerder): Meer → Agenda in Outlook maakt een geheime agendalink. Voeg die in Outlook toe via Agenda toevoegen → Abonneren vanaf het web; je afspraken, open taken en acties staan dan in je Outlook-agenda (Outlook ververst om de paar uur). De link komt van de functie `leadnex-meldingen`.
- **WhatsApp** per bedrijf (06- en Belgische 04-nummers), met een begroeting en de voornaam alvast ingevuld.
- **Werken zonder bereik**: wijzigingen blijven op de telefoon in een wachtrij en gaan vanzelf online zodra er weer verbinding is.
- **Status** per bedrijf: lead, potentiële klant of klant, met een filter bij Bedrijven. Bij "Interesse" wordt een lead vanzelf potentiële klant.
- **Klantverslagen** onder elk bedrijf: inspreken (spraakherkenning van Chrome) of typen. De app poetst de gesproken tekst op en vult de besproken machines, interesse, afspraken en opvolgtaak alvast in; je past aan waar nodig. Een verslag telt als contactmoment.
- **Slimme datums**: de app herkent "na de bouwvak" (adviesdata per regio), "volgende week dinsdag om 10 uur", "over twee weken", "half november", "na de kerst", "in Q1" enzovoort en stelt de opvolgtaak voor, op een werkdag en niet op een feestdag. Bij een afspraak met tijd kies je wanneer je een melding krijgt (op het tijdstip, of 5 minuten tot een dag vooraf); die gaat ook mee naar je agenda.
- **Voorbereiding** bovenaan elk geopend bedrijf: laatste contact, besproken machines, afspraken, interesse en wat je bij het volgende gesprek kunt vragen.
- **Dubbele bedrijven** worden herkend (zelfde naam, telefoon, e-mail of website, of bijna dezelfde naam in dezelfde plaats) en zijn in Meer samen te voegen zonder iets kwijt te raken.
- **In de buurt**: filter bij Bedrijven op afstand van je huidige plek (afstand instelbaar in Meer).
- **Vraag het Leadnex** (in de zoekbalk bij Bedrijven): vragen over je eigen klanten, zoals "Welke bedrijven wilden een elektrische heftruck?", "Wie wilde ik dit kwartaal terugbellen?" of "Welke potentiële klanten wachten op een offerte?". De app begrijpt periodes, acties en status en zoekt in je verslagen en notities.
- Alles werkt in de app zelf: geen AI-dienst, geen extra account en geen kosten.
- **Weergave**: standaard licht, of donker of zoals je telefoon (Meer → Voorkeuren).
- **Delen naar de app** vanuit Google Maps, de Google-app of Chrome (naam, adres en telefoon worden zo nodig aangevuld via PDOK of OpenStreetMap; een korte Google-link zoals share.google wordt geopend door de functie `leadnex-meldingen` in Supabase, die ook adres, telefoon, website, e-mail en branche opzoekt via Google Maps en de website van het bedrijf), **visitekaartje scannen**, **in telefooncontacten** zetten, export naar CSV, back-up.
- **Klantenlijst importeren** (Meer → Importeren uit Excel): download het voorbeeldbestand (kolommen Klantnummer, Bedrijfsnaam, Contactpersoon, Telefoon, Mobiel, E-mail, Adres, Postcode, Plaats, Website, Branche, Soort relatie, Notitie), vul het in Excel in en lees het in; een eigen Excel met andere kolomnamen kan ook. Kies de soort relatie (met klantnummers standaard Klant) en of bedrijven die al in je lijst staan worden overgeslagen of aangevuld (lege velden invullen, soort relatie alleen omhoog; wat je al had blijft staan). Tot 5000 bedrijven; lange lijsten worden in delen getoond.
- **Labels** per bedrijf (bijv. "Linde-vloot", "Beurs 2026"): invullen bij Gegevens of Nieuw (tik op een voorstel), filteren via Filters → Label, zoeken, en meegeven bij het importeren.
- **Meerdere contactpersonen**: het hoofdcontact met functie, plus andere contactpersonen (naam, functie, telefoon, e-mail) met knoppen om te bellen, te appen of te mailen. Met "Maak hoofdcontact" wissel je wie de mailronde en de belsessie gebruiken.
- **Klanten die je lang niet sprak**: op Vandaag de klanten zonder contact en zonder geplande actie (na 3, 6 of 12 maanden, instelbaar in Meer → Voorkeuren), met "Vandaag bellen" of "Over een maand". Bij Bedrijven → Filters → Laatste contact.
- **Foto's en bestanden** bij een bedrijf (foto maken of bestand kiezen; foto's worden verkleind). Ze staan afgeschermd in Supabase Storage; zie [Opslag voor foto's en back-ups](#4-opslag-voor-fotos-en-back-ups).
- **Automatische back-up**: elke nacht om 3 uur een back-up in Supabase Storage, de nieuwste 30 blijven bewaard. In Meer terugzetten of downloaden, of meteen een maken.
- **Kansen** (eigen tabblad), in het gebied waar jouw klanten zitten. **Bedrijven die bij je passen**: de app zoekt zelf in OpenStreetMap (vanaf een server weigeren de openbare OpenStreetMap-servers dat vaak) naar bedrijven tot 12 km rond je klanten die waarschijnlijk een heftruck, reachtruck of reinigingsmachine gebruiken: bedrijven met een bedrijfshal, fabriek, magazijn of werkplaats, en bedrijven in jouw branches (op kenmerk of op naam). Ze staan op volgorde van hoe goed ze op je klanten lijken: zelfde branche als veel van je klanten, klanten in dezelfde branche in de buurt ("Net als je klanten …"), een bedrijfshal, afstand, telefoon en website. Nooit wat al in je lijst staat (naam, telefoon of website). Filter op branche en plaats; Bellen, Website, Kaart, Toevoegen (label Kans, actie Bellen) of Niet interessant. De app vraagt het gebied op in tegels van ongeveer 20 bij 20 km (drukste eerst, twee tegelijk) en wijkt bij een drukke of weigerende server uit naar een andere OpenStreetMap-server; geeft een tegel geen antwoord, dan probeert de app die later vanzelf opnieuw. Elke week vanzelf opnieuw bij het openen van Kansen (nieuwe bedrijven krijgen het label Nieuw), of meteen met Nu zoeken. Waar je klanten zitten: hun adres op de kaart, anders het midden van hun plaats (PDOK). **Nieuwbouw en vergunningen**: elke maandagochtend zoekt de functie in de officiële bekendmakingen van de gemeenten waar je klanten zitten naar nieuwbouw en uitbreiding van bedrijfspanden, loodsen, magazijnen en distributiecentra. Iedereen kiest zelf zijn branches, provincies, soort kansen en eigen zoekwoorden.
- **Relatie-overzicht uit Powerall importeren**: een overzicht met twee regels per relatie (nummer, bedrijf, adres, postcode, plaats, telefoon; daaronder contactpersoon, e-mail, website, mobiel) wordt herkend en samengevoegd. Bij importeren tellen alleen dezelfde naam of hetzelfde klantnummer als dubbel; bedrijven uit dezelfde groep met dezelfde website of hetzelfde telefoonnummer worden gewoon apart geïmporteerd. Importeren gaat in delen van 250, dus duizenden relaties in een paar seconden.
- **Snelkoppelingen**: houd het app-icoon ingedrukt voor Nieuwe afspraak, Notitie, Belsessie, Nieuw bedrijf of Taak.

## Bestanden

| Bestand | Wat het doet |
|---|---|
| `index.html` | De app |
| `config.js` | Koppeling met Supabase (Project URL en publishable/anon key) en Outlook (toepassings-ID en map-ID) |
| `supabase.sql` | Maakt de tabel en de beveiliging aan in Supabase |
| `supabase/functions/leadnex-meldingen/index.ts`, `supabase/meldingen.sql` | De meldingsdienst in Supabase (zie [Meldingen](#meldingen)); maakt ook de nachtelijke back-up, de agendalink en de wekelijkse nieuwbouw-kansen |
| `supabase/opslag.sql` | Opslag voor foto's, bestanden en back-ups (Supabase Storage) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Maken de app installeerbaar op Android |
| `vendor/` | Supabase-bibliotheek 2.117.2, SheetJS 0.18.5 (Excel-import), Tesseract.js 5.1.1 (visitekaartjes lezen) en Leaflet 1.9.4 (kaart) |

## Eenmalig instellen

### 1. Supabase (optioneel, voor één gedeelde lijst op telefoon en computer)
1. Maak een account op supabase.com en klik **New project**. Regio: **Central EU (Frankfurt)**.
2. Ga naar **SQL Editor → New query**, plak de inhoud van `supabase.sql` en klik **Run**.
3. Ga naar **Authentication → Users → Add user → Create new user**. Vul je e-mailadres en een wachtwoord in en zet **Auto Confirm User** aan.
4. Zet onder **Authentication → Sign In / Providers** de optie **Allow new users to sign up** uit.
5. Zet onder **Authentication → URL Configuration** de **Site URL** op het adres van de app.
6. Kopieer onder **Project Settings → API Keys** de **Project URL** en de **publishable key** (of de *anon public* key) naar `config.js`.

### 2. Online zetten (GitHub Pages)
Zet de bestanden in een openbare GitHub-repository en zet **Settings → Pages** aan op de branch `main`, map `/ (root)`.
De app staat dan op `https://<gebruikersnaam>.github.io/<repository>/`.

### 3. Outlook (optioneel, mailen en agenda via Microsoft 365)
Met een koppeling verstuurt de app mails vanuit je eigen mailbox (ook persoonlijk per bedrijf, in één keer) en zet hij afspraken direct in je Outlook-agenda. Zonder koppeling opent de app je mail-app (ook als mailronde, persoonlijk per bedrijf), downloadt hij een agenda-bestand (.ics) en kun je de agendalink gebruiken (Meer → Agenda in Outlook). De koppeling vraagt eenmalig toestemming van een Microsoft 365-beheerder; zonder die toestemming toont Microsoft "Beheerdersgoedkeuring vereist".

1. Ga naar [entra.microsoft.com](https://entra.microsoft.com) → **App-registraties** → **Nieuwe registratie**.
2. Naam: `Leadnex`. Accounttype: **Alleen één tenant** (je eigen organisatie).
3. Omleidings-URI: platform **Toepassing met één pagina (SPA)**, adres `https://<gebruikersnaam>.github.io/<repository>/` (precies het adres van de app, met `/` aan het eind).
4. **API-machtigingen** → **Een machtiging toevoegen** → **Microsoft Graph** → **Gedelegeerde machtigingen**: `Mail.ReadWrite`, `Mail.Send`, `Calendars.ReadWrite`, `offline_access` (en `User.Read`, staat er al). Klik op **Beheerderstoestemming verlenen**.
5. Zet de **Toepassings-ID (client-ID)** en **Map-ID (tenant-ID)** van de pagina **Overzicht** in `config.js` (`outlookClientId`, `outlookTenant`), of vul ze in de app in onderaan bij **Outlook → Koppelen**.

Aanmelden gebeurt bij Microsoft zelf (code met PKCE, geen wachtwoord in de app). Microsoft laat een app als deze maximaal 24 uur aangemeld; daarna meldt de app zich meestal vanzelf opnieuw aan. Lukt dat niet, dan vraagt hij je even op Aanmelden te tikken.

### 4. Opslag voor foto's en back-ups
Eenmalig, nadat stap 1 klaar is: **SQL Editor → New query**, plak de inhoud van [`supabase/opslag.sql`](supabase/opslag.sql) en klik **Run**. Dat maakt twee afgeschermde opslagplekken: `bestanden` (foto's en bestanden, hooguit 25 MB per stuk) en `backups` (de nachtelijke back-up, die de functie `leadnex-meldingen` maakt). Iedere gebruiker ziet alleen zijn eigen map. Het gratis Supabase-abonnement heeft 1 GB opslag.

## Meldingen

Leadnex stuurt 's ochtends een overzicht van de acties, afspraken en taken van vandaag (ook die zonder tijd), en bij elke actie of afspraak met een tijd een melding op het tijdstip zelf of zoveel minuten ervoor. De standaard kies je in de app bij **Meer → Meldingen**; per actie pas je hem aan bij **Gegevens → Melding**.

De meldingen komen van een kleine functie in je eigen Supabase-project, die elke minuut kijkt of er iets te melden is. Zo komen ze ook als de app dicht is. Eenmalig instellen, op de computer (ongeveer 5 minuten):

1. **Functie aanmaken**: in Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**. Naam: `leadnex-meldingen`. Vervang de voorbeeldcode door de inhoud van [`supabase/functions/leadnex-meldingen/index.ts`](supabase/functions/leadnex-meldingen/index.ts) en klik op **Deploy function**.
2. **JWT-controle uit**: open de functie → **Details** → zet **Verify JWT with legacy secret** (of **Enforce JWT Verification**) uit en klik op **Save changes**. De functie controleert zelf wie een testmelding vraagt.
3. **Sleutel**: **Edge Functions → Secrets** → bij **Add new secret** de naam `VAPID_PRIVATE_KEY` en als waarde de privésleutel voor meldingen (die staat bewust niet in deze repository) → **Save**.
4. **Elke minuut laten draaien**: **SQL Editor → New query**, plak de inhoud van [`supabase/meldingen.sql`](supabase/meldingen.sql) en klik op **Run**.
5. Op je telefoon: **Meer → Meldingen op deze telefoon → Aanzetten** en tik op **Toestaan**. Je krijgt meteen een testmelding, en onder de knop staat of de meldingsdienst werkt.

Kosten: geen. Elke minuut één aanroep is zo'n 45.000 per maand; het gratis Supabase-abonnement heeft er 500.000.

**Functie bijwerken** na een nieuwe versie van Leadnex (bijvoorbeeld voor de agendalink): Supabase → **Edge Functions** → `leadnex-meldingen` → tabblad **Code** → alles selecteren en vervangen door de nieuwste [`index.ts`](supabase/functions/leadnex-meldingen/index.ts) → **Deploy**. Geheimen en de SQL hoeven niet opnieuw.

## Op de telefoon installeren
Open het adres in **Chrome**, log in en tik op **App installeren** (of menu ⋮ → **App installeren**).
De app verschijnt tussen je apps, opent zonder adresbalk, en bellen en mailen openen direct je telefoon- en mail-app.

## Gegevens overzetten uit de Claude-app
Log in en kies onderaan **Back-up terugzetten**. Kies het bestand `koude-acquisitie-overzetten.json`.

## Auteursrecht
© 2026 Silvan H. Alle rechten voorbehouden. Gebruik, kopiëren of verspreiden van deze app of de code is niet toegestaan zonder schriftelijke toestemming; zie `LICENSE`.
De onderdelen in `vendor/` vallen onder hun eigen licenties: Supabase-bibliotheek (MIT), SheetJS (Apache-2.0), Tesseract.js (Apache-2.0), Leaflet (BSD-2-Clause) en de Lucide-pictogrammen (ISC); zie `vendor/THIRD_PARTY.md`.
