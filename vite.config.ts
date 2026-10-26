import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rawPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 3000;

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
  },
  preview: {
    host: '0.0.0.0',
    port,
    allowedHosts: true,
  },
});
