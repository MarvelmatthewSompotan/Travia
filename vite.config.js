import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    env: {
      VITE_MOCK_MODE: 'false',
      VITE_SEARCHAPI_KEY: 'test-key',
      VITE_LLM_PROVIDER: 'ollama',
      VITE_GEMINI_API_KEY: 'test-gemini-key',
    },
  },
})
