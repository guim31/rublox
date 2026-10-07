import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  contextFromDoc,
  generateProjectCode,
  headlessWorkspace,
  projectVariables,
  setupBlocks,
} from '@rublox/blocks'
import { getComponentDef } from '@rublox/catalog'
import {
  allBlocks,
  type Condition,
  EXPLORE_BADGES,
  EXPLORE_LEVELS,
  evaluate,
  findBlock,
} from '@rublox/learn'
import {
  APP_WORKSPACE,
  LOCALES,
  type Locale,
  type ProjectDoc,
  projectDocSchema,
} from '@rublox/schema'
import type * as Blockly from 'blockly/core'
import { describe, expect, it } from 'vitest'
import { CONTENT_DIR, generate } from '../authoring/generate.ts'
import {
  EXPLORE_APPS,
  type ExploreLevel,
  levelOf,
  levelProject,
  localLevel,
  newInLevel,
} from '../src/index.ts'

const docs = new Map<string, ProjectDoc>()
function project(level: ExploreLevel, locale: Locale): ProjectDoc {
  const key = `${level.app}/${level.level}/${locale}`
  let doc = docs.get(key)
  if (!doc) {
    doc = levelProject(level, { locale })
    docs.set(key, doc)
  }
  return doc
}

const blockIds = (doc: ProjectDoc) => new Set(allBlocks(doc).map(({ block }) => block.id as string))

const state = (doc: ProjectDoc) => ({
  doc,
  tab: 'blocks' as const,
  workspace: doc.screenOrder[0] ?? '',
  selectedType: null,
  events: [],
  previewScreen: null,
  slowMotion: false,
})

/** The ids a check refers to, so that a typo in a level fails here. */
function referencedIds(condition: Condition): string[] {
  switch (condition.kind) {
    case 'blockField':
      return [condition.id]
    case 'stepped':
      return condition.id ? [condition.id] : []
    case 'block':
      return condition.within ? [condition.within] : []
    case 'all':
    case 'any':
      return condition.of.flatMap(referencedIds)
    case 'not':
      return referencedIds(condition.of)
    default:
      return []
  }
}

describe('content/explore', () => {
  it('is up to date with authoring/ (pnpm --filter @rublox/explore content)', () => {
    const files = generate()
    for (const [path, content] of files) {
      // Biome formats the files: compare what they say, not their layout.
      expect(JSON.parse(readFileSync(join(CONTENT_DIR, path), 'utf8')), path).toEqual(
        JSON.parse(content),
      )
    }
    const onDisk = readdirSync(CONTENT_DIR, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name).slice(CONTENT_DIR.length + 1))
    expect(onDisk.sort()).toEqual([...files.keys()].sort())
  })

  it('has four apps of four levels, each with a badge', () => {
    expect(EXPLORE_APPS.map((app) => app.id)).toEqual(Object.keys(EXPLORE_BADGES))
    for (const app of EXPLORE_APPS) {
      expect(app.levels.map((level) => level.level)).toEqual(
        Array.from({ length: EXPLORE_LEVELS }, (_, index) => index + 1),
      )
      for (const locale of LOCALES) {
        expect(app.texts[locale].title.length).toBeGreaterThan(0)
        expect(app.texts[locale].summary.length).toBeGreaterThan(0)
      }
    }
  })
})

for (const app of EXPLORE_APPS) {
  describe(app.id, () => {
    for (const level of app.levels) {
      for (const locale of LOCALES) {
        it(`level ${level.level} builds in ${locale}, Blockly loads it, code is generated`, () => {
          const doc = project(level, locale)
          expect(projectDocSchema.safeParse(doc).success).toBe(true)
          expect(doc.meta.origin).toEqual({ kind: 'explore', app: app.id, level: level.level })
          expect(levelOf(doc)).toBe(level)
          setupBlocks(locale)
          for (const key of [APP_WORKSPACE, ...doc.screenOrder]) {
            const stacks = doc.blocks[key] ?? {}
            const workspace = headlessWorkspace(
              stacks,
              contextFromDoc(doc, key),
              projectVariables(doc),
            )
            try {
              expect(workspace.getTopBlocks(false)).toHaveLength(Object.keys(stacks).length)
              for (const block of workspace.getAllBlocks(false)) {
                // Ids survive Blockly: the tour and "what's new" find their blocks.
                expect(findBlock(doc, block.id), block.id).toBeDefined()
                for (const input of block.inputList) {
                  for (const field of input.fieldRow) {
                    if (field.name && 'getOptions' in field) {
                      const values = (field as Blockly.FieldDropdown)
                        .getOptions(false)
                        .map((option) => option[1])
                      expect(values, `${block.id}.${field.name}`).toContain(field.getValue())
                    }
                  }
                }
              }
            } finally {
              workspace.dispose()
            }
          }
          const code = generateProjectCode(doc)
          for (const module of Object.values(code)) expect(module.code).not.toContain('undefined(')
        })

        it(`level ${level.level} has its tour and its challenges in ${locale}`, () => {
          const doc = project(level, locale)
          const texts = level.texts[locale]
          expect(texts.title && texts.summary && texts.done).toBeTruthy()
          const { tour, challenges } = localLevel(level, locale)
          expect(tour.length).toBeGreaterThanOrEqual(5)
          expect(tour.length).toBeLessThanOrEqual(10)
          expect(tour.some((step) => step.check?.kind === 'slowMotion')).toBe(true)
          for (const step of tour) {
            expect(texts.steps[step.id]?.text, step.id).toBeTruthy()
            if (step.target?.startsWith('block:'))
              expect(findBlock(doc, step.target.slice(6)), step.target).toBeDefined()
            for (const id of step.check ? referencedIds(step.check) : [])
              expect(findBlock(doc, id), id).toBeDefined()
          }
          expect(challenges.length).toBeGreaterThanOrEqual(2)
          expect(challenges.length).toBeLessThanOrEqual(3)
          for (const challenge of challenges) {
            expect(texts.challenges[challenge.id]?.text, challenge.id).toBeTruthy()
            expect(texts.challenges[challenge.id]?.hint, challenge.id).toBeTruthy()
            if (challenge.block) expect(findBlock(doc, challenge.block)).toBeDefined()
            for (const id of referencedIds(challenge.check))
              expect(findBlock(doc, id), id).toBeDefined()
            // Nothing is done before the learner changes something.
            expect(evaluate(challenge.check, state(doc)), challenge.id).toBe(false)
          }
        })
      }

      const next = app.levels.find((entry) => entry.level === level.level + 1)
      if (next) {
        it(`level ${next.level} keeps the blocks and components of level ${level.level}`, () => {
          for (const locale of LOCALES) {
            const before = project(level, locale)
            const after = project(next, locale)
            const kept = blockIds(after)
            for (const id of blockIds(before)) expect(kept.has(id), `block ${id}`).toBe(true)
            for (const [screenId, screen] of Object.entries(before.screens)) {
              for (const id of Object.keys(screen.components))
                expect(after.screens[screenId]?.components[id], `component ${id}`).toBeDefined()
            }
            const changes = newInLevel(next, locale)
            expect(changes?.blocks.length).toBeGreaterThan(0)
          }
        })
      }
    }

    it('names its components with types of the catalog', () => {
      for (const level of app.levels) {
        const doc = project(level, 'fr')
        for (const screen of Object.values(doc.screens))
          for (const node of Object.values(screen.components))
            expect(getComponentDef(node.type), node.type).toBeDefined()
      }
    })
  })
}
