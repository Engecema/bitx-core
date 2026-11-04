import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('bitx_desktop_secure_vault_mirror_v1');
    localStorage.removeItem('bitx_ge_admin_operators_v3');
    localStorage.removeItem('bitx_users');
    indexedDB.deleteDatabase('bitx_desktop_secure_vault_db');
  } catch {}
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

