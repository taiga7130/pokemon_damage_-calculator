import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 計算エンジン（src/）とデータ（data/）をそのまま import して使う SPA。
// Cloudflare Pages はプロジェクトドメインのルート配信なので base は '/'。
// （サブパス配信にする場合のみ base を '/サブパス/' に変更する）
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: { outDir: 'dist' },
  server: { host: true, port: 5173 },
});
