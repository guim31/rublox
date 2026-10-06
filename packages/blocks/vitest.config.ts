import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Some Blockly fields (the colour picker) need a DOM even in a headless workspace.
    environment: 'jsdom',
  },
})
