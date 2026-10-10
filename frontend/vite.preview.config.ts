import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from "path";
export default defineConfig({
  root: __dirname,
  plugins: [vue()],
  resolve: { alias: {
    "@": path.resolve(__dirname, "src"),
    "@bindings": path.resolve(__dirname, "bindings/SmashGlass/services/"),
    "bindings": path.resolve(__dirname, "bindings"),
    "@wailsio/runtime": path.resolve(__dirname, "preview/wails-stub.ts"),
  } },
  css: { preprocessorOptions: { scss: { api: 'modern', additionalData: `@use "sass:color"; @use "@/styles/scss/flare" as *;` } } },
  esbuild: { target: 'esnext' }, build: { target: 'esnext' },
  server: { port: 8767, host: '127.0.0.1' },
})
