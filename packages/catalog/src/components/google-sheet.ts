import { errorEvent } from '../common.ts'
import { defineComponent } from '../component.ts'
import { event, method, prop } from '../define.ts'

/**
 * A Google sheet published on the web as CSV (SPEC § 4.4, P2): read only, through the relay
 * of the server. The first line names the columns.
 */
export const GoogleSheet = defineComponent({
  type: 'GoogleSheet',
  category: 'data',
  icon: 'sheet',
  visible: false,
  container: false,
  junior: false,
  props: {
    url: prop.string({ default: '', group: 'content', blocks: 'get-set' }),
  },
  events: {
    loaded: event(),
    ...errorEvent(),
  },
  methods: {
    rows: method({ async: true, returns: 'list' }),
  },
  strings: {
    fr: {
      label: 'Feuille Google',
      prefix: 'Feuille',
      description: 'Lit une feuille Google publiée sur le Web.',
      help: 'Lit les lignes d’une feuille Google Sheets publiée en CSV (dans Google Sheets : Fichier › Partager › Publier sur le Web, format CSV ; colle l’adresse donnée). La première ligne donne les noms des colonnes ; chaque ligne devient un objet dont on lit les champs avec « … de … ». Lecture seule : l’appli ne peut pas écrire dans la feuille.',
      example: 'mettre éléments de Liste1 à (lignes de Feuille1)',
      props: { url: 'adresse (CSV publié)' },
      events: { loaded: 'quand %1 a lu la feuille' },
      methods: { rows: 'lignes de %1' },
      enums: {},
    },
    en: {
      label: 'Google sheet',
      prefix: 'Sheet',
      description: 'Reads a Google sheet published on the web.',
      help: 'Reads the rows of a Google Sheets sheet published as CSV (in Google Sheets: File › Share › Publish to the web, CSV format; paste the address it gives). The first line names the columns; each line becomes an object whose fields are read with “… of …”. Read only: the app cannot write to the sheet.',
      example: 'set items of List1 to (rows of Sheet1)',
      props: { url: 'address (published CSV)' },
      events: { loaded: 'when %1 has read the sheet' },
      methods: { rows: 'rows of %1' },
      enums: {},
    },
  },
})
