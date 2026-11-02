import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Validação imediata de sessão antes de montar qualquer elemento visual no DOM
if (typeof window !== 'undefined') {
  const isAuth =
    sessionStorage.getItem('bitx_admin_session') === 'active' ||
    sessionStorage.getItem('bitx_admin_auth') === 'true';

  if (!isAuth && !window.location.pathname.endsWith('login.html')) {
    try {
      sessionStorage.clear();
      localStorage.clear();
    } catch (_) {}
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

