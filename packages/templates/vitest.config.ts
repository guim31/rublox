import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Templates are loaded into Blockly, which needs a DOM.
    environment: 'jsdom',
  },
})
