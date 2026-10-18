import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Templates are loaded into Blockly, and games run in the engine: both need a DOM.
    environment: 'jsdom',
    testTimeout: 120_000,
  },
})
