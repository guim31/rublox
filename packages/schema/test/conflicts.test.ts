import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import {
  APP_WORKSPACE,
  type BlocklyJson,
  ensureBlockMaps,
  entryWriter,
  projectToYDoc,
  StackConflicts,
  setBlockStack,
  yBlocks,
} from '../src/index.ts'
import { fixture } from './fixture.ts'

const sampleProject = () => ({ ...fixture(), blocks: {} })

const ORIGIN = { name: 'blockly' }
const stack = (text: string): BlocklyJson => ({ type: 'rx_log', fields: { TEXT: text } })

/** Two editors of the same project, each listening to the stacks of the first screen. */
function twoEditors() {
  const base = projectToYDoc(sampleProject())
  ensureBlockMaps(base)
  const screen = base.getArray<string>('screenOrder').get(0)
  const editor = () => {
    const ydoc = new Y.Doc()
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(base))
    const conflicts = new StackConflicts()
    const lost: { stack: string; client: number | null }[] = []
    yBlocks(ydoc)
      .get(screen)
      ?.observe((event, transaction) => {
        if (transaction.origin === ORIGIN) conflicts.wrote(event)
        else lost.push(...conflicts.lost(event))
      })
    const write = (id: string, json: BlocklyJson | null) =>
      setBlockStack(ydoc, screen, id, json, ORIGIN)
    return { ydoc, lost, write }
  }
  const a = editor()
  const b = editor()
  /** Sends what `from` has and `to` lacks (the server relaying an edit). */
  const send = (from: Y.Doc, to: Y.Doc) =>
    Y.applyUpdate(to, Y.encodeStateAsUpdate(from, Y.encodeStateVector(to)), 'remote')
  return { a, b, send, screen }
}

describe('conflicts on stacks of blocks', () => {
  it('says nothing when the other one built on my version', () => {
    const { a, b, send } = twoEditors()
    a.write('s', stack('A'))
    send(a.ydoc, b.ydoc)
    b.write('s', stack('B'))
    send(b.ydoc, a.ydoc)
    expect(a.lost).toEqual([])
    expect(b.lost).toEqual([])
  })

  it('tells the one whose version was lost who won, when both saved at once', () => {
    const { a, b, send, screen } = twoEditors()
    a.write('s', stack('A'))
    b.write('s', stack('B'))
    send(a.ydoc, b.ydoc)
    send(b.ydoc, a.ydoc)
    const value = yBlocks(a.ydoc).get(screen)?.get('s')
    expect(yBlocks(b.ydoc).get(screen)?.get('s')).toEqual(value)
    const winner =
      value === undefined ? null : (value as unknown as { fields: { TEXT: string } }).fields.TEXT
    const [loser, other, winnerClient] =
      winner === 'A' ? [b, a, a.ydoc.clientID] : [a, b, b.ydoc.clientID]
    expect(loser.lost).toEqual([{ stack: 's', client: winnerClient }])
    expect(other.lost).toEqual([])
  })

  it('tells me when someone deleted a stack I had just changed', () => {
    const { a, b, send } = twoEditors()
    a.write('s', stack('A'))
    send(a.ydoc, b.ydoc)
    b.write('s', null)
    send(b.ydoc, a.ydoc)
    expect(a.lost).toEqual([{ stack: 's', client: null }])
  })

  it('keeps a change made while someone else deleted the stack (Yjs: the write wins)', () => {
    const { a, b, send, screen } = twoEditors()
    a.write('s', stack('A'))
    send(a.ydoc, b.ydoc)
    a.write('s', stack('A2'))
    b.write('s', null)
    send(b.ydoc, a.ydoc)
    send(a.ydoc, b.ydoc)
    expect(a.lost).toEqual([])
    expect(yBlocks(b.ydoc).get(screen)?.get('s')).toEqual(stack('A2'))
  })

  it('forgets my writes after a while', () => {
    const conflicts = new StackConflicts(1000)
    const { a, b, send, screen } = twoEditors()
    const map = yBlocks(a.ydoc).get(screen)
    const late: unknown[] = []
    map?.observe((event, transaction) => {
      if (transaction.origin === ORIGIN) conflicts.wrote(event, 0)
      else late.push(...conflicts.lost(event, 5000))
    })
    a.write('s', stack('A'))
    b.write('s', stack('B'))
    send(b.ydoc, a.ydoc)
    expect(late).toEqual([])
  })

  it('names the writer of a stack', () => {
    const { a, b, send, screen } = twoEditors()
    b.write('s', stack('B'))
    send(b.ydoc, a.ydoc)
    const map = yBlocks(a.ydoc).get(screen)
    if (!map) throw new Error('no stacks')
    expect(entryWriter(map, 's')).toBe(b.ydoc.clientID)
  })
})

describe('maps of stacks', () => {
  it('gives each workspace its map, so that first stacks placed at once all stay', () => {
    const base = projectToYDoc(sampleProject())
    expect(ensureBlockMaps(base)).toBe(true)
    expect(ensureBlockMaps(base)).toBe(false)
    for (const key of [...base.getMap('screens').keys(), APP_WORKSPACE]) {
      expect(yBlocks(base).has(key)).toBe(true)
    }
    const a = new Y.Doc()
    const b = new Y.Doc()
    Y.applyUpdate(a, Y.encodeStateAsUpdate(base))
    Y.applyUpdate(b, Y.encodeStateAsUpdate(base))
    setBlockStack(a, APP_WORKSPACE, 'from-a', stack('A'))
    setBlockStack(b, APP_WORKSPACE, 'from-b', stack('B'))
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    expect(Object.keys(yBlocks(a).get(APP_WORKSPACE)?.toJSON() ?? {}).sort()).toEqual([
      'from-a',
      'from-b',
    ])
  })
})
