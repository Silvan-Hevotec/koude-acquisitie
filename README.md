# Koude Acquisitie

Installeerbare web-app (PWA) voor koude acquisitie: bedrijven, acties, contactmomenten, mailteksten en import uit Excel.
Zonder verdere instellingen bewaart de app alles op het apparaat zelf (geen account nodig). Maak af en toe een back-up via de knop onderaan.
Wil je later dat telefoon en computer dezelfde lijst delen, koppel dan een Supabase-database (zie hieronder); de app vraagt dan om in te loggen.

## Wat de app doet

- Bedrijven met contactpersoon, telefoon, e-mail, adres, branche en website; acties met datum, tijd en prioriteit.
- **Vandaag**: wat er vandaag (of eerder) moet gebeuren, met elke ochtend om 08:05 een melding.
- **Belsessie**: de lijst een voor een afbellen. Na elk gesprek staat "Hoe ging het?" open, ook als je vanuit de lijst belt.
- **Vaste opvolgstappen** na geen gehoor: de volgende werkdag, na twee werkdagen, na drie keer een mail (daarna vanzelf nabellen), na vijf keer voorstel om te archiveren.
- **Kaart**: bedrijven bij jou in de buurt (2, 5, 10 of 25 km), met route langs de dichtstbijzijnde. Adressen worden één keer opgezocht bij de Locatieserver van PDOK (Kadaster) en bij het bedrijf bewaard; de kaart komt ook van PDOK.
- **Mailen**: per bedrijf of aan iedereen in de lijst (filter op branche of actie), in BCC in mails van hooguit 50 adressen, met mailteksten.
- **Delen naar de app** vanuit Google Maps of Chrome, **visitekaartje scannen**, **in telefooncontacten** zetten, import uit Excel, export naar CSV, back-up.

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
2. Naam: `Koude Acquisitie`. Accounttype: **Alleen één tenant** (je eigen organisatie).
3. Omleidings-URI: platform **Toepassing met één pagina (SPA)**, adres `https://<gebruikersnaam>.github.io/<repository>/` (precies het adres van de app, met `/` aan het eind).
4. **API-machtigingen** → **Een machtiging toevoegen** → **Microsoft Graph** → **Gedelegeerde machtigingen**: `Mail.ReadWrite`, `Mail.Send`, `Calendars.ReadWrite`, `offline_access` (en `User.Read`, staat er al). Klik op **Beheerderstoestemming verlenen**.
5. Zet de **Toepassings-ID (client-ID)** en **Map-ID (tenant-ID)** van de pagina **Overzicht** in `config.js` (`outlookClientId`, `outlookTenant`), of vul ze in de app in onderaan bij **Outlook → Koppelen**.

Aanmelden gebeurt bij Microsoft zelf (code met PKCE, geen wachtwoord in de app). Microsoft laat een app als deze maximaal 24 uur aangemeld; daarna meldt de app zich meestal vanzelf opnieuw aan. Lukt dat niet, dan vraagt hij je even op Aanmelden te tikken.

## Op de telefoon installeren
Open het adres in **Chrome**, log in en tik op **App installeren** (of menu ⋮ → **App installeren**).
De app verschijnt tussen je apps, opent zonder adresbalk, en bellen en mailen openen direct je telefoon- en mail-app.

## Gegevens overzetten uit de Claude-app
Log in en kies onderaan **Back-up terugzetten**. Kies het bestand `koude-acquisitie-overzetten.json`.
