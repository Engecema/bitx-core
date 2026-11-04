import React from 'react';
import ReactDOM from 'react-dom/client';
import SecureLogin from './SecureLogin';

const rootElement = document.getElementById('login-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <SecureLogin />
    </React.StrictMode>
  );
}