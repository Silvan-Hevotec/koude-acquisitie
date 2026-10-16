# Koude Acquisitie

Installeerbare web-app (PWA) voor koude acquisitie: bedrijven, acties, contactmomenten, mailteksten en import uit Excel.
Zonder verdere instellingen bewaart de app alles op het apparaat zelf (geen account nodig). Maak af en toe een back-up via de knop onderaan.
Wil je later dat telefoon en computer dezelfde lijst delen, koppel dan een Supabase-database (zie hieronder); de app vraagt dan om in te loggen.

## Bestanden

| Bestand | Wat het doet |
|---|---|
| `index.html` | De app |
| `config.js` | Koppeling met Supabase (Project URL en publishable/anon key) |
| `supabase.sql` | Maakt de tabel en de beveiliging aan in Supabase |
| `manifest.webmanifest`, `sw.js`, `icons/` | Maken de app installeerbaar op Android |
| `vendor/` | Supabase-bibliotheek 2.117.2 en SheetJS 0.18.5 (Excel-import) |

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

## Op de telefoon installeren
Open het adres in **Chrome**, log in en tik op **App installeren** (of menu ⋮ → **App installeren**).
De app verschijnt tussen je apps, opent zonder adresbalk, en bellen en mailen openen direct je telefoon- en mail-app.

## Gegevens overzetten uit de Claude-app
Log in en kies onderaan **Back-up terugzetten**. Kies het bestand `koude-acquisitie-overzetten.json`.
