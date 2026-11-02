import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rawPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 3000;

// Cabeçalhos HTTP de segurança para aplicação descentralizada / Web3 local
// Nota: Em ambiente de desenvolvimento e preview embutido (iFrame do AI Studio),
// não usamos X-Frame-Options: DENY para permitir a exibição no console/container.
const securityHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      '@noble/hashes/sha2.js',
      '@noble/hashes/legacy.js',
      '@scure/base',
      '@scure/bip32',
      '@scure/bip39',
      '@scure/bip39/wordlists/english',
      '@supabase/supabase-js',
    ],
  },
  server: {
    host: '0.0.0.0',
    port,
    allowedHosts: true,
    headers: securityHeaders,
  },
  preview: {
    host: '0.0.0.0',
    port,
    allowedHosts: true,
    headers: securityHeaders,
  },
});
