import { createProject } from '@rublox/catalog'
import {
  APP_WORKSPACE,
  addComponent,
  createUndoManager,
  projectToYDoc,
  setBlockStack,
  setMeta,
  setProp,
  yBlocks,
} from '@rublox/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import type { PresenceUser } from '../src/collab.ts'
import {
  ADMIN,
  type Client,
  createTestServer,
  json,
  type Tab,
  type TestServer,
  until,
} from './server.ts'

/** Editing by several people at once (SPEC § 4.9): presence, rights, undo, offline. */

let server: TestServer
let owner: Client
let editor: Client
let viewer: Client
let ids: { owner: string; editor: string; viewer: string }

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

async function createUser(username: string, avatar?: string) {
  const res = await owner.request('POST', '/api/admin/users', {
    username,
    displayName: `${username} name`,
    password: `${username}-password`,
  })
  expect(res.status).toBe(201)
  const client = await server.signIn(username, `${username}-password`, '203.0.113.20')
  if (avatar) await client.request('PATCH', '/api/me', { avatar })
  return client
}

async function idOf(client: Client) {
  const me = await json<{ user: { id: string } }>(await client.request('GET', '/api/me'))
  return me.user.id
}

async function newProject(name: string) {
  const doc = createProject({ name, locale: 'fr', mode: 'junior' })
  const res = await owner.request('POST', '/api/projects', {
    state: b64(Y.encodeStateAsUpdate(projectToYDoc(doc))),
  })
  const { id } = await json<{ id: string }>(res)
  for (const [username, role] of [
    ['collab-editor', 'editor'],
    ['collab-viewer', 'viewer'],
  ]) {
    const shared = await owner.request('PUT', `/api/projects/${id}/members`, { username, role })
    expect(shared.status).toBe(200)
  }
  return id
}

/** The presence states a tab sees from the others: client id → state. */
function peers(tab: Tab) {
  const states = new Map(tab.provider.awareness?.getStates() ?? [])
  states.delete(tab.ydoc.clientID)
  return states as Map<number, { user?: PresenceUser; view?: { screen: string } }>
}

/** Cuts the tab's socket, as the studio does when the browser goes offline. */
async function offline(...tabs: Tab[]) {
  for (const tab of tabs) tab.socket.disconnect()
  await until(() => tabs.every((tab) => tab.socket.status === 'disconnected'), 'offline')
}

async function online(...tabs: Tab[]) {
  for (const tab of tabs) void tab.socket.connect()
  await until(() => tabs.every((tab) => tab.provider.isSynced), 'back online')
}

const firstScreen = (tab: Tab) => {
  const screen = tab.doc.screenOrder[0] ?? ''
  return { screen, root: tab.doc.screens[screen]?.rootId ?? '' }
}

beforeAll(async () => {
  server = await createTestServer()
  owner = await server.signIn(ADMIN.username, ADMIN.password)
  editor = await createUser('collab-editor', 'fox')
  viewer = await createUser('collab-viewer')
  ids = { owner: await idOf(owner), editor: await idOf(editor), viewer: await idOf(viewer) }
})
afterAll(() => server.close())

describe('presence', () => {
  it('shows who is there, with the identity of their session, whatever they claim', async () => {
    const id = await newProject('Presence')
    const a = await server.tab(owner, id)
    const b = await server.tab(editor, id)
    const c = await server.tab(viewer, id)
    a.provider.setAwarenessField('view', { tab: 'design', screen: 'one' })
    // A client that tries to pass for someone else keeps its own name.
    b.provider.setAwarenessField('user', { id: ids.owner, name: 'Impostor', readOnly: false })
    b.provider.setAwarenessField('view', { tab: 'blocks', screen: 'two' })
    c.provider.setAwarenessField('view', { tab: 'design', screen: 'one' })
    await until(
      () => [...peers(a).values()].filter((state) => state.view).length === 2,
      'the others in the presence',
    )
    const seen = [...peers(a).values()].map((state) => state.user)
    expect(seen).toEqual(
      expect.arrayContaining([
        { id: ids.editor, name: 'collab-editor name', avatar: 'fox', readOnly: false },
        { id: ids.viewer, name: 'collab-viewer name', avatar: null, readOnly: true },
      ]),
    )
    await until(() => [...peers(c).values()].some((state) => state.view?.screen === 'two'))
    expect(peers(c).get(b.ydoc.clientID)?.user?.name).toBe('collab-editor name')
    // Leaving takes one out of the presence.
    b.close()
    await until(() => !peers(a).has(b.ydoc.clientID), 'the editor to leave')
    a.close()
    c.close()
  })

  it('never lets a connection rewrite or remove the state of another one', async () => {
    const id = await newProject('Spoof')
    const a = await server.tab(owner, id)
    const b = await server.tab(editor, id)
    a.provider.setAwarenessField('view', { tab: 'design', screen: 'mine' })
    await until(() => peers(b).get(a.ydoc.clientID)?.view?.screen === 'mine')
    // B forges a newer state for A's client.
    const awareness = b.provider.awareness
    if (!awareness) throw new Error('no awareness')
    const meta = awareness.meta.get(a.ydoc.clientID)
    awareness.states.set(a.ydoc.clientID, { view: { tab: 'design', screen: 'forged' } })
    awareness.meta.set(a.ydoc.clientID, { clock: (meta?.clock ?? 0) + 10, lastUpdated: Date.now() })
    awareness.emit('update', [{ added: [], updated: [a.ydoc.clientID], removed: [] }, 'local'])
    b.provider.setAwarenessField('view', { tab: 'design', screen: 'after' })
    const c = await server.tab(owner, id)
    await until(() => peers(c).get(b.ydoc.clientID)?.view?.screen === 'after')
    expect(peers(c).get(a.ydoc.clientID)?.view?.screen).toBe('mine')
    a.close()
    b.close()
    c.close()
  })

  it('leaves the visitors of a gallery project out of the presence', async () => {
    const id = await newProject('Gallery')
    await owner.request('PATCH', '/api/admin/settings', { galleryEnabled: true })
    expect(
      (await owner.request('PUT', `/api/gallery/${id}/sharing`, { shared: true })).status,
    ).toBe(200)
    const visitor = await createUser('collab-visitor')
    const a = await server.tab(owner, id)
    const v = await server.tab(visitor, id)
    expect(v.readOnly).toBe(true)
    v.provider.setAwarenessField('view', { tab: 'design', screen: 'peeking' })
    a.provider.setAwarenessField('view', { tab: 'design', screen: 'here' })
    const later = await server.tab(owner, id)
    await until(() => peers(later).has(a.ydoc.clientID), 'the owner in the presence')
    expect(peers(later).has(v.ydoc.clientID)).toBe(false)
    expect(peers(a).has(v.ydoc.clientID)).toBe(false)
    for (const tab of [a, v, later]) tab.close()
  })
})

describe('editing together', () => {
  it('gives each workspace its map of stacks, so first blocks placed at once all stay', async () => {
    const id = await newProject('Blocks')
    const a = await server.tab(owner, id)
    const b = await server.tab(editor, id)
    const { screen } = firstScreen(a)
    expect(yBlocks(a.ydoc).has(screen)).toBe(true)
    expect(yBlocks(a.ydoc).has(APP_WORKSPACE)).toBe(true)
    // Both offline, both place a first stack on the screen, then back.
    await offline(a, b)
    setBlockStack(a.ydoc, screen, 'from-a', { type: 'rx_app_start', id: 'from-a' })
    setBlockStack(b.ydoc, screen, 'from-b', { type: 'rx_app_start', id: 'from-b' })
    await online(a, b)
    const stacks = (tab: Tab) => Object.keys(tab.doc.blocks[screen] ?? {}).sort()
    await until(() => stacks(a).length === 2 && stacks(b).length === 2, 'both stacks on both sides')
    expect(stacks(a)).toEqual(['from-a', 'from-b'])
    a.close()
    b.close()
  })

  it('merges what two people did offline when they come back', async () => {
    const id = await newProject('Offline')
    const a = await server.tab(owner, id)
    const b = await server.tab(editor, id)
    const { screen, root } = firstScreen(a)
    const button = addComponent(
      a.ydoc,
      screen,
      { type: 'Button', name: 'Bouton1', props: {} },
      root,
    )
    await until(() => Boolean(b.doc.screens[screen]?.components[button]), 'the button')
    await offline(a, b)
    setProp(a.ydoc, screen, button, 'text', 'Offline A')
    addComponent(a.ydoc, screen, { type: 'Text', name: 'Texte1', props: {} }, root)
    setMeta(b.ydoc, { description: 'Offline B' })
    addComponent(b.ydoc, screen, { type: 'Image', name: 'Image1', props: {} }, root)
    await online(a, b)
    const names = (tab: Tab) =>
      Object.values(tab.doc.screens[screen]?.components ?? {})
        .map((c) => c.name)
        .sort()
    for (const tab of [a, b]) {
      await until(() => names(tab).length === 4, 'the merged screen')
      expect(names(tab)).toEqual(['Accueil', 'Bouton1', 'Image1', 'Texte1'])
      await until(() => tab.doc.meta.description === 'Offline B')
      expect(tab.doc.screens[screen]?.components[button]?.props.text).toBe('Offline A')
    }
    a.close()
    b.close()
  })

  it('undoes only one’s own edits', async () => {
    const id = await newProject('Undo')
    const a = await server.tab(owner, id)
    const b = await server.tab(editor, id)
    const undoA = createUndoManager(a.ydoc)
    const { screen, root } = firstScreen(a)
    addComponent(a.ydoc, screen, { type: 'Button', name: 'Bouton1', props: {} }, root)
    undoA.stopCapturing()
    await until(() => Object.keys(b.doc.screens[screen]?.components ?? {}).length === 2)
    addComponent(b.ydoc, screen, { type: 'Text', name: 'Texte1', props: {} }, root)
    const names = (tab: Tab) =>
      Object.values(tab.doc.screens[screen]?.components ?? {})
        .map((c) => c.name)
        .sort()
    await until(() => names(a).length === 3, 'the text of B')
    undoA.undo()
    expect(names(a)).toEqual(['Accueil', 'Texte1'])
    await until(() => names(b).length === 2, 'the undo to reach B')
    expect(names(b)).toEqual(['Accueil', 'Texte1'])
    // Nothing of B's to undo on A's side.
    expect(undoA.canUndo()).toBe(false)
    undoA.redo()
    await until(() => names(b).length === 3, 'the redo to reach B')
    undoA.destroy()
    a.close()
    b.close()
  })
})

describe('rights', () => {
  it('shows a viewer the edits live, and refuses whatever the viewer writes', async () => {
    const id = await newProject('Rights')
    const a = await server.tab(owner, id)
    const v = await server.tab(viewer, id)
    expect(v.readOnly).toBe(true)
    const { screen, root } = firstScreen(a)
    const button = addComponent(
      a.ydoc,
      screen,
      { type: 'Button', name: 'Bouton1', props: {} },
      root,
    )
    await until(() => Boolean(v.doc.screens[screen]?.components[button]), 'the edit at the viewer')
    // The viewer's edits go nowhere: neither to the server nor to the other editors.
    setProp(v.ydoc, screen, button, 'text', 'From the viewer')
    setMeta(v.ydoc, { name: 'Taken over' })
    setBlockStack(v.ydoc, screen, 'viewer-stack', { type: 'rx_app_start', id: 'viewer-stack' })
    setMeta(a.ydoc, { description: 'after the viewer' })
    const later = await server.tab(editor, id)
    await until(() => later.doc.meta.description === 'after the viewer')
    for (const tab of [a, later]) {
      expect(tab.doc.meta.name).toBe('Rights')
      expect(tab.doc.screens[screen]?.components[button]?.props.text).toBeUndefined()
      expect(tab.doc.blocks[screen]?.['viewer-stack']).toBeUndefined()
    }
    await server.services.collab.flush()
    const stored = await server.services.collab.read(id)
    expect(stored?.getMap('meta').get('name')).toBe('Rights')
    a.close()
    v.close()
    later.close()
  })
})
