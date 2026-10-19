// Koppeling met je Supabase-database (Project Settings → API).
// De anon public key mag openbaar zijn: je gegevens zijn afgeschermd met inloggen en Row Level Security.
// Koppeling met Outlook (Microsoft 365): toepassings-ID en map-ID van de app-registratie in Microsoft Entra.
// Ook die mogen openbaar zijn: aanmelden kan alleen met je eigen Microsoft-account.
window.KA_CONFIG = {
  supabaseUrl: '',
  supabaseKey: '',
  outlookClientId: '',
  outlookTenant: ''
};
