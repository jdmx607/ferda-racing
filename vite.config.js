import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  build: {
    outDir: 'dist',
    sourcemap: false,
    // Raise warning threshold — 173 kB gzipped is fine for a PWA with 4 users
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          // React runtime — never changes, long-term cache
          'vendor-react': ['react', 'react-dom'],
          // Firebase — large but rarely changes
          'vendor-firebase': ['firebase/app', 'firebase/firestore'],
          // Race-weekend screens (Lineups, Mulligans, Results)
          'tab-race': [
            './src/components/LineupsTab',
            './src/components/MulligansTab',
            './src/components/ResultsTab',
          ],
          // Story/analysis screens (Feed, Stats, History)
          // Engine modules (stats/history/narrative) are shared — Vite deduplicates them automatically
          'tab-story': [
            './src/components/FeedTab',
            './src/components/StatsTab',
            './src/components/HistoryTab',
          ],
          // Reference / settings screens
          'tab-info': [
            './src/components/PlayoffsTab',
            './src/components/ProjectionsTab',
            './src/components/ScheduleTab',
            './src/components/RulesTab',
            './src/components/SettingsTab',
            './src/components/CommissionerTab',
          ],
        },
      },
    },
  },

  server: {
    port: 5173,
  },

  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
