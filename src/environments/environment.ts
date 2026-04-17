export const environment = {
  production: false,
  apiUrl: '/api/v1',
  oauth: {
    // Fill in your OAuth app credentials to enable social login.
    // Leave clientId empty to disable that provider (shows a helpful message).
    google: {
      clientId: '',  // GCP → APIs & Services → Credentials → Web OAuth 2.0 Client
    },
    microsoft: {
      clientId: '',   // Azure → App Registrations → Application (client) ID
      tenantId: 'common',  // 'common' = any MS account; replace with tenant GUID to restrict
    },
  },
};
