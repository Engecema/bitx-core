import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Forçar limpeza via JavaScript no primeiro milissegundo do carregamento
if (typeof window !== 'undefined') {
  window.onload = () => {
    document.querySelectorAll('input').forEach((i) => {
      (i as HTMLInputElement).value = '';
    });
  };

  // Executa imediatamente no primeiro milissegundo
  setTimeout(() => {
    document.querySelectorAll('input').forEach((i) => {
      (i as HTMLInputElement).value = '';
    });
  }, 1);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
