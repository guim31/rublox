import { describe, expect, it } from 'vitest'
import { isPlayerMessage, isStudioMessage } from '../src/bridge.ts'

describe('messages of the preview (SPEC § 0.10)', () => {
  it('accepts what the player sends', () => {
    for (const message of [
      { type: 'rx:ready' },
      { type: 'rx:log', entry: { level: 'warn', message: 'hi', time: 1, blockId: 'b' } },
      { type: 'rx:state', running: true, screenId: null },
      { type: 'rx:select', screenId: 's', componentId: 'c' },
      {
        type: 'rx:event',
        event: {
          screenId: 's',
          componentId: 'c',
          componentType: 'Button',
          componentName: 'Bouton1',
          event: 'click',
        },
      },
      { type: 'rx:step', step: { blockId: null, workspace: null, paused: false } },
      { type: 'rx:ai', id: 3, request: { prompt: 'Bonjour' } },
    ]) {
      expect(isPlayerMessage(message), message.type).toBe(true)
    }
  })

  it('refuses a message whose fields are not what the studio reads', () => {
    for (const message of [
      // An unknown level would leave the console without an icon, and break the editor.
      { type: 'rx:log', entry: { level: 'x', message: 'hi', time: 1 } },
      { type: 'rx:log', entry: { level: 'log', message: { toString: 1 }, time: 1 } },
      { type: 'rx:log' },
      { type: 'rx:state', running: 'yes', screenId: null },
      { type: 'rx:select', screenId: 's' },
      { type: 'rx:event', event: { screenId: 's' } },
      { type: 'rx:step', step: null },
      { type: 'rx:ai', id: 'one', request: { prompt: 'x' } },
      { type: 'rx:ai', id: 1, request: { prompt: 'x', image: 'data' } },
      { type: 'rx:load' },
      null,
      'rx:ready',
    ]) {
      expect(isPlayerMessage(message), JSON.stringify(message)).toBe(false)
    }
  })

  it('tells the studio messages apart', () => {
    expect(isStudioMessage({ type: 'rx:stop' })).toBe(true)
    expect(isStudioMessage({ type: 'rx:ready' })).toBe(false)
  })
})
