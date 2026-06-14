import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        simulation3d: resolve(__dirname, 'simulation-3d.html'),
        ai: resolve(__dirname, 'ai.html'),
        indiaMap: resolve(__dirname, 'india-map.html'),
        predict: resolve(__dirname, 'predict.html'),
        simulator: resolve(__dirname, 'simulator.html'),
        twin: resolve(__dirname, 'twin.html'),
      }
    }
  }
})