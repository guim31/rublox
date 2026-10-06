import { describe, expect, it } from 'vitest'
import { Engine } from '../src/index.ts'
import { dataLoader, project } from './helpers.ts'

/** A `localStorage` stand-in. */
function fakeStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  }
}

const counter = {
  app: {
    code: 'export default async function ({ stored }) { stored.visits = stored.visits + 1 }\n',
    lineMap: [],
  },
}

describe('stored variables', () => {
  it('are kept per app, across restarts', async () => {
    const store = fakeStorage()
    const run = async (appId: string) => {
      const { doc } = project()
      doc.variables.stored.push({ id: 's1', name: 'visits', initial: 0 })
      const engine = new Engine({
        doc,
        code: counter,
        host: { log: () => {} },
        loadModule: dataLoader,
        appId,
        storage: store,
      })
      await engine.start()
      engine.dispose()
    }
    await run('dice')
    await run('dice')
    await run('quiz')
    expect(store.getItem('rublox:dice:stored')).toBe('{"visits":2}')
    expect(store.getItem('rublox:quiz:stored')).toBe('{"visits":1}')
  })
})
