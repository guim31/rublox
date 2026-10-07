import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The block types of the content are checked against Blockly, which needs a DOM.
    environment: 'jsdom',
  },
})
