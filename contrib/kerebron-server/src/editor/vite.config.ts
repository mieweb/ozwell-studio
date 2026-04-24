import { defineConfig } from 'vite';

export default defineConfig({
  base: '',
  appType: 'mpa',
  plugins: [],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  clearScreen: false,
});
