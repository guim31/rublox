import { availableProp, errorEvent } from '../common.ts'
import { defineComponent } from '../component.ts'
import { arg, event, method, prop } from '../define.ts'

const MARKER_FIELDS = { latitude: 'string', longitude: 'string', title: 'string' } as const

/**
 * A map (SPEC § 4.5): MapLibre GL with OpenFreeMap's vector tiles, free and without a key.
 * Markers come from the inspector, from blocks, or from a table (`source`).
 */
export const MapComponent = defineComponent({
  type: 'Map',
  category: 'maps',
  icon: 'map',
  visible: true,
  container: false,
  junior: true,
  commonDefaults: { width: 'fill', height: 300, radius: 12 },
  props: {
    latitude: prop.number({
      default: 48.8566,
      min: -90,
      max: 90,
      step: 0.0001,
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    longitude: prop.number({
      default: 2.3522,
      min: -180,
      max: 180,
      step: 0.0001,
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    zoom: prop.number({
      default: 12,
      min: 1,
      max: 19,
      step: 1,
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    markers: prop.list({
      default: [],
      itemFields: MARKER_FIELDS,
      group: 'content',
      blocks: 'get-set',
    }),
    source: prop.binding({ fields: MARKER_FIELDS, group: 'content' }),
    mapStyle: prop.enum(['liberty', 'bright', 'positron', 'dark'], {
      default: 'liberty',
      group: 'style',
      junior: true,
      blocks: 'get-set',
    }),
    showLocation: prop.boolean({ default: false, group: 'content', blocks: 'get-set' }),
    interactive: prop.boolean({ default: true, group: 'advanced' }),
    ...availableProp(),
  },
  events: {
    markerClick: event({
      junior: true,
      args: {
        index: arg('number'),
        title: arg('string'),
        latitude: arg('number'),
        longitude: arg('number'),
        row: arg('any'),
      },
    }),
    mapClick: event({ args: { latitude: arg('number'), longitude: arg('number') } }),
    ...errorEvent(),
  },
  methods: {
    addMarker: method({
      junior: true,
      args: {
        latitude: arg('number', { default: 48.8584 }),
        longitude: arg('number', { default: 2.2945 }),
        title: arg('string'),
      },
    }),
    clearMarkers: method(),
    moveTo: method({
      junior: true,
      args: {
        latitude: arg('number', { default: 43.6047 }),
        longitude: arg('number', { default: 1.4442 }),
        zoom: arg('number', { default: 13 }),
      },
    }),
    centerOnMe: method({ async: true }),
  },
  strings: {
    fr: {
      label: 'Carte',
      prefix: 'Carte',
      description: 'Une carte du monde, avec des repères.',
      help: 'Une carte qu’on peut déplacer et agrandir, avec des repères (latitude, longitude, titre). Ajoute-les dans l’inspecteur, avec les blocs, ou branche la carte sur une table qui a des colonnes de latitude et de longitude. Les fonds de carte viennent d’OpenFreeMap (données © OpenStreetMap) : il faut Internet. « me situer » demande la position du téléphone.',
      example:
        'Quand un repère de Carte1 est touché, afficher le message valeur titre de l’événement',
      props: {
        latitude: 'latitude du centre',
        longitude: 'longitude du centre',
        zoom: 'zoom',
        markers: 'repères',
        source: 'source (table)',
        mapStyle: 'style',
        showLocation: 'montrer ma position',
        interactive: 'déplaçable au doigt',
      },
      events: {
        markerClick: 'quand un repère de %1 est touché',
        mapClick: 'quand %1 est touchée',
      },
      methods: {
        addMarker: 'ajouter à %1 un repère latitude %2 longitude %3 titre %4',
        clearMarkers: 'retirer les repères de %1',
        moveTo: 'centrer %1 sur latitude %2 longitude %3 zoom %4',
        centerOnMe: 'centrer %1 sur ma position',
      },
      enums: {
        mapStyle: { liberty: 'Rues', bright: 'Clair', positron: 'Pâle', dark: 'Sombre' },
      },
      args: {
        index: 'position',
        title: 'titre',
        latitude: 'latitude',
        longitude: 'longitude',
        row: 'ligne',
      },
    },
    en: {
      label: 'Map',
      prefix: 'Map',
      description: 'A map of the world, with markers.',
      help: 'A map you can move and zoom, with markers (latitude, longitude, title). Add them in the inspector, with blocks, or bind the map to a table that has latitude and longitude columns. Map tiles come from OpenFreeMap (data © OpenStreetMap): it needs the Internet. “center on me” asks for the phone’s position.',
      example: 'When a marker of Map1 is tapped, show the message event value title',
      props: {
        latitude: 'center latitude',
        longitude: 'center longitude',
        zoom: 'zoom',
        markers: 'markers',
        source: 'source (table)',
        mapStyle: 'style',
        showLocation: 'show my position',
        interactive: 'can be moved with a finger',
      },
      events: {
        markerClick: 'when a marker of %1 is tapped',
        mapClick: 'when %1 is tapped',
      },
      methods: {
        addMarker: 'add to %1 a marker latitude %2 longitude %3 title %4',
        clearMarkers: 'remove the markers of %1',
        moveTo: 'center %1 on latitude %2 longitude %3 zoom %4',
        centerOnMe: 'center %1 on my position',
      },
      enums: {
        mapStyle: { liberty: 'Streets', bright: 'Bright', positron: 'Pale', dark: 'Dark' },
      },
      args: {
        index: 'position',
        title: 'title',
        latitude: 'latitude',
        longitude: 'longitude',
        row: 'row',
      },
    },
  },
})
