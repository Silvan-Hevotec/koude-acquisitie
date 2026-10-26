# Leadnex

Installeerbare web-app (PWA) voor acquisitie: bedrijven, acties, contactmomenten, mailteksten en import uit Excel.
Zonder verdere instellingen bewaart de app alles op het apparaat zelf (geen account nodig). Maak af en toe een back-up via de knop onderaan.
Wil je later dat telefoon en computer dezelfde lijst delen, koppel dan een Supabase-database (zie hieronder); de app vraagt dan om in te loggen.

## Wat de app doet

- Bedrijven met contactpersoon, telefoon, e-mail, adres, branche en website; acties met datum, tijd en prioriteit.
- **Bedrijfsscherm**: tik op een bedrijf en je krijgt een eigen scherm met grote knoppen (Bellen, WhatsApp, Mail, Route), de volgende stap en de tabbladen Overzicht, Verslagen, Gegevens en Historie. De terugknop van je telefoon sluit het weer.
- **Eén zoekbalk**: zoek op naam, plaats of contactpersoon, of typ een vraag. Branche, soort relatie en In de buurt zitten achter de knop Filters.
- Vijf tabbladen: **Vandaag**, **Bedrijven**, **Kaart**, **Nieuw** en **Meer** (op de telefoon onderin, op de computer bovenin).
- **Vandaag**: wat er vandaag (of eerder) moet gebeuren, met elke ochtend om 08:05 een melding.
- **Belsessie**: de lijst een voor een afbellen. Na elk gesprek staat "Hoe ging het?" open, ook als je vanuit de lijst belt.
- **Vaste opvolgstappen** na geen gehoor: de volgende werkdag, na twee werkdagen, na drie keer een mail (daarna vanzelf nabellen), na vijf keer voorstel om te archiveren.
- **Kaart**: al je bedrijven in beeld, met een teller (hoeveel op de kaart, hoeveel zonder adres of met een adres dat niet gevonden is). Kies 2, 5, 10 of 25 km om te zien wat bij jou in de buurt is, met route langs de dichtstbijzijnde. Felle spelden: geel = vandaag te doen, oranje = met actie, paars = zonder actie, rode stip = hoge prioriteit. Adressen worden één keer opgezocht bij de Locatieserver van PDOK (Kadaster) en bij het bedrijf bewaard; de kaart komt ook van PDOK.
- **Mailen**: per bedrijf of aan iedereen in de lijst (filter op branche of actie), in BCC in mails van hooguit 50 adressen, met mailteksten.
- **WhatsApp** per bedrijf (06- en Belgische 04-nummers), met een begroeting en de voornaam alvast ingevuld.
- **Werken zonder bereik**: wijzigingen blijven op de telefoon in een wachtrij en gaan vanzelf online zodra er weer verbinding is.
- **Status** per bedrijf: lead, potentiële klant of klant, met een filter bij Bedrijven. Bij "Interesse" wordt een lead vanzelf potentiële klant.
- **Klantverslagen** onder elk bedrijf: inspreken (spraakherkenning van Chrome) of typen. De app poetst de gesproken tekst op en vult de besproken machines, interesse, afspraken en opvolgtaak alvast in; je past aan waar nodig. Een verslag telt als contactmoment.
- **Slimme datums**: de app herkent "na de bouwvak" (adviesdata per regio), "volgende week dinsdag om 10 uur", "over twee weken", "half november", "na de kerst", "in Q1" enzovoort en stelt de opvolgtaak voor, op een werkdag en niet op een feestdag. Bij een afspraak met tijd kun je een herinnering kiezen (15 minuten tot een dag vooraf) die mee gaat naar je agenda.
- **Voorbereiding** bovenaan elk geopend bedrijf: laatste contact, besproken machines, afspraken, interesse en wat je bij het volgende gesprek kunt vragen.
- **Dubbele bedrijven** worden herkend (zelfde naam, telefoon, e-mail of website, of bijna dezelfde naam in dezelfde plaats) en zijn in Meer samen te voegen zonder iets kwijt te raken.
- **In de buurt**: filter bij Bedrijven op afstand van je huidige plek (afstand instelbaar in Meer).
- **Vraag het Leadnex** (in de zoekbalk bij Bedrijven): vragen over je eigen klanten, zoals "Welke bedrijven wilden een elektrische heftruck?", "Wie wilde ik dit kwartaal terugbellen?" of "Welke potentiële klanten wachten op een offerte?". De app begrijpt periodes, acties en status en zoekt in je verslagen en notities.
- Alles werkt in de app zelf: geen AI-dienst, geen extra account en geen kosten.
- **Weergave**: licht, donker of zoals je telefoon (Meer → Voorkeuren).
- **Delen naar de app** vanuit Google Maps, de Google-app of Chrome (naam, adres en telefoon worden zo nodig aangevuld via PDOK of OpenStreetMap), **visitekaartje scannen**, **in telefooncontacten** zetten, import uit Excel, export naar CSV, back-up.

## Bestanden

| Bestand | Wat het doet |
|---|---|
| `index.html` | De app |
| `config.js` | Koppeling met Supabase (Project URL en publishable/anon key) en Outlook (toepassings-ID en map-ID) |
| `supabase.sql` | Maakt de tabel en de beveiliging aan in Supabase |
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
Met een koppeling verstuurt de app mails vanuit je eigen mailbox (ook persoonlijk per bedrijf, in één keer) en zet hij afspraken direct in je Outlook-agenda. Zonder koppeling opent de app je mail-app en downloadt hij een agenda-bestand (.ics).

1. Ga naar [entra.microsoft.com](https://entra.microsoft.com) → **App-registraties** → **Nieuwe registratie**.
2. Naam: `Leadnex`. Accounttype: **Alleen één tenant** (je eigen organisatie).
3. Omleidings-URI: platform **Toepassing met één pagina (SPA)**, adres `https://<gebruikersnaam>.github.io/<repository>/` (precies het adres van de app, met `/` aan het eind).
4. **API-machtigingen** → **Een machtiging toevoegen** → **Microsoft Graph** → **Gedelegeerde machtigingen**: `Mail.ReadWrite`, `Mail.Send`, `Calendars.ReadWrite`, `offline_access` (en `User.Read`, staat er al). Klik op **Beheerderstoestemming verlenen**.
5. Zet de **Toepassings-ID (client-ID)** en **Map-ID (tenant-ID)** van de pagina **Overzicht** in `config.js` (`outlookClientId`, `outlookTenant`), of vul ze in de app in onderaan bij **Outlook → Koppelen**.

Aanmelden gebeurt bij Microsoft zelf (code met PKCE, geen wachtwoord in de app). Microsoft laat een app als deze maximaal 24 uur aangemeld; daarna meldt de app zich meestal vanzelf opnieuw aan. Lukt dat niet, dan vraagt hij je even op Aanmelden te tikken.

## Op de telefoon installeren
Open het adres in **Chrome**, log in en tik op **App installeren** (of menu ⋮ → **App installeren**).
De app verschijnt tussen je apps, opent zonder adresbalk, en bellen en mailen openen direct je telefoon- en mail-app.

## Gegevens overzetten uit de Claude-app
Log in en kies onderaan **Back-up terugzetten**. Kies het bestand `koude-acquisitie-overzetten.json`.

## Auteursrecht
© 2026 Silvan H. Alle rechten voorbehouden. Gebruik, kopiëren of verspreiden van deze app of de code is niet toegestaan zonder schriftelijke toestemming; zie `LICENSE`.
De onderdelen in `vendor/` vallen onder hun eigen licenties: Supabase-bibliotheek (MIT), SheetJS (Apache-2.0), Tesseract.js (Apache-2.0), Leaflet (BSD-2-Clause) en de Lucide-pictogrammen (ISC); zie `vendor/THIRD_PARTY.md`.
