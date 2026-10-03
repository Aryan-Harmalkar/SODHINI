import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // expose on LAN so you can test the camera from a phone
    proxy: { '/api': 'http://localhost:3001' },
  },
});
