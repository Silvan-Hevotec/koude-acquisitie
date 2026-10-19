// Koppeling met je Supabase-database (Project Settings → API).
// De anon public key mag openbaar zijn: je gegevens zijn afgeschermd met inloggen en Row Level Security.
// Koppeling met Outlook (Microsoft 365): toepassings-ID en map-ID van de app-registratie in Microsoft Entra.
// Ook die mogen openbaar zijn: aanmelden kan alleen met je eigen Microsoft-account.
window.KA_CONFIG = {
  supabaseUrl: '',
  supabaseKey: '',
  outlookClientId: 'e777094c-a5b8-4a06-ad5a-d71785416740',
  outlookTenant: 'afc2fa94-adb8-4b72-a3ba-f7d1e9c5b606'
};
