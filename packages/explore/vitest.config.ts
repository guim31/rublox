import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Levels are loaded in Blockly and run in the engine, which need a DOM.
    environment: 'jsdom',
    testTimeout: 60_000,
  },
})
