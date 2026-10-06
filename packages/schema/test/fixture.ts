import { PROJECT_FORMAT, type ProjectDoc } from '../src/index.ts'

export function fixture(): ProjectDoc {
  return {
    format: PROJECT_FORMAT,
    formatVersion: 1,
    meta: {
      id: 'p1',
      name: 'Mon appli',
      mode: 'junior',
      locale: 'fr',
      createdAt: '2026-10-06T10:00:00.000Z',
      updatedAt: '2026-10-06T10:00:00.000Z',
    },
    settings: {
      theme: {
        primary: '#5b4bff',
        secondary: '#ff6b5c',
        background: '#ffffff',
        font: 'system',
        radius: 12,
        scheme: 'light',
      },
      navigation: { kind: 'stack', startScreen: 's1' },
      orientation: 'portrait',
    },
    screenOrder: ['s1', 's2'],
    screens: {
      s1: {
        name: 'Accueil',
        rootId: 'r1',
        components: {
          r1: { type: 'Screen', name: 'Accueil', props: {}, children: ['row', 'txt'] },
          row: { type: 'Row', name: 'Ligne1', props: {}, children: ['btn'] },
          btn: { type: 'Button', name: 'Bouton1', props: { text: 'Bouton' } },
          txt: { type: 'Text', name: 'Texte1', props: { text: 'Texte' } },
        },
        nonVisual: [],
      },
      s2: {
        name: 'Ecran2',
        rootId: 'r2',
        components: { r2: { type: 'Screen', name: 'Ecran2', props: {}, children: [] } },
        nonVisual: [],
      },
    },
    blocks: {
      s1: {
        b1: {
          type: 'rx_event',
          id: 'b1',
          fields: { COMPONENT: 'btn' },
        },
      },
    },
    variables: { app: [{ id: 'v1', name: 'score', initial: 0 }], stored: [], shared: [] },
    assets: {},
    data: { tables: {}, apis: {} },
  }
}
