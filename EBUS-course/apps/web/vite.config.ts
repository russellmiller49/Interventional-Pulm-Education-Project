import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const repoRoot = resolve(__dirname, '../..');

function normalizeViteBase(raw: string | undefined): string {
  let base = raw?.trim() || '/';
  if (base !== '/' && !base.startsWith('/')) {
    base = `/${base}`;
  }
  if (base !== '/' && !base.endsWith('/')) {
    base = `${base}/`;
  }
  return base;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');

  return {
    base: normalizeViteBase(env.VITE_BASE_URL),
    css: { postcss: { plugins: [] } },
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [react()],
    worker: {
      format: 'es',
    },
    optimizeDeps: {
      exclude: ['itk-wasm', '@itk-wasm/image-io', '@thewtex/zstddec'],
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@bronchoscopy-core': resolve(__dirname, '../../../src/lib/bronchoscopy-core'),
      },
    },
    server: {
      fs: {
        allow: [resolve(repoRoot, "..")],
      },
    },
    test: {
      environment: 'node',
      pool: 'forks',
    },
  };
});
