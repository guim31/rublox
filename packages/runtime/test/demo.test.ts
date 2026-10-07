import { generateProjectCode } from '@rublox/blocks'
import { createDemoProject } from '@rublox/catalog'
import { describe, expect, it } from 'vitest'
import { Engine, type LogEntry } from '../src/index.ts'
import { dataLoader, sleep } from './helpers.ts'

describe('demo app', () => {
  it.each(['fr', 'en'] as const)('runs every screen without an error (%s)', async (locale) => {
    const doc = createDemoProject({ locale, mode: 'junior', id: 'demo' })
    const code = generateProjectCode(doc)
    for (const [workspace, module] of Object.entries(code)) {
      expect(module.code, workspace).not.toMatch(
        /composant supprimé|deleted component|introuvable|not found/,
      )
    }
    const logs: LogEntry[] = []
    const engine = new Engine({
      doc,
      code,
      host: { log: (entry) => logs.push(entry) },
      loadModule: dataLoader,
      storage: null,
      locale,
    })
    await engine.start()
    for (const screenId of doc.screenOrder) {
      engine.openScreen(doc.screens[screenId]?.name ?? '')
      await sleep(20)
      expect(engine.getSnapshot().screen?.screenId).toBe(screenId)
    }
    // The stored variable counted this visit.
    engine.switchTo(doc.screenOrder[0] ?? '')
    await sleep(20)
    const home = doc.screens[doc.screenOrder[0] ?? '']
    expect(String(engine.getSnapshot().screen?.overrides.get('visits')?.text)).toMatch(/1$/)
    expect(home).toBeDefined()
    expect(logs.filter((entry) => entry.level !== 'log')).toEqual([])
    engine.dispose()
  })
})
