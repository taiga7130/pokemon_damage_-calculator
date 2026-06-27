import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 計算エンジン（src/）とデータ（data/）をそのまま import して使う SPA。
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
});
