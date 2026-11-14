import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run dev` serves the UI with hot reload and forwards the API to `npm start` on $API (default :3000).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': process.env.API || 'http://localhost:3000' } },
});
