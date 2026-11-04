import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const rawPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 3000;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const supabaseOrigin = new URL(
    env.VITE_SUPABASE_URL || 'https://odbbtgkxgiqlfhcepwuj.supabase.co'
  ).origin;
  const realtimeOrigin = supabaseOrigin.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
  const securityHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      `connect-src 'self' ${supabaseOrigin} ${realtimeOrigin}`,
    ].join('; '),
  };

  return {
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
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port,
    allowedHosts: ['.onrender.com', '.app.github.dev', 'localhost'],
    headers: securityHeaders,
  },
  preview: {
    host: '0.0.0.0',
    port,
    allowedHosts: ['.onrender.com', '.app.github.dev', 'localhost'],
    headers: securityHeaders,
  },
  };
});
