import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Validação imediata de sessão antes de montar qualquer elemento visual no DOM
if (typeof window !== 'undefined') {
  const isAuth =
    sessionStorage.getItem('bitx_admin_session') === 'active' ||
    sessionStorage.getItem('bitx_admin_auth') === 'true';

  const isPublic =
    window.location.hash === '#site' ||
    window.location.hash === '#carteira' ||
    window.location.search.includes('view=site') ||
    window.location.search.includes('view=carteira');

  if (!isAuth && !isPublic && !window.location.pathname.endsWith('login.html')) {
    window.location.replace('login.html');
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

