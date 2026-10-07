import { defineComponent } from '../component.ts'
import { arg, event, method, prop } from '../define.ts'

/** A drawing area: finger strokes, shapes and texts drawn by blocks. */
export const Canvas = defineComponent({
  type: 'Canvas',
  category: 'media',
  icon: 'brush',
  visible: true,
  container: false,
  junior: true,
  commonDefaults: { width: 'fill', height: 300, radius: 12, borderWidth: 1 },
  props: {
    backgroundColor: prop.color({
      default: '#ffffff',
      group: 'style',
      junior: true,
      blocks: 'get-set',
    }),
    penColor: prop.color({ default: '@primary', group: 'style', junior: true, blocks: 'get-set' }),
    penWidth: prop.number({
      default: 6,
      min: 1,
      max: 80,
      group: 'style',
      junior: true,
      blocks: 'get-set',
    }),
    fingerDrawing: prop.boolean({
      default: true,
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
  },
  events: {
    touch: event({ junior: true, args: { x: arg('number'), y: arg('number') } }),
    drag: event({ args: { x: arg('number'), y: arg('number') } }),
    release: event({ args: { x: arg('number'), y: arg('number') } }),
  },
  methods: {
    clear: method({ junior: true }),
    drawLine: method({
      args: { x1: arg('number'), y1: arg('number'), x2: arg('number'), y2: arg('number') },
    }),
    drawCircle: method({
      junior: true,
      args: { x: arg('number'), y: arg('number'), radius: arg('number') },
    }),
    drawRect: method({
      args: { x: arg('number'), y: arg('number'), width: arg('number'), height: arg('number') },
    }),
    drawText: method({ args: { text: arg('string'), x: arg('number'), y: arg('number') } }),
    getImage: method({ returns: 'asset' }),
  },
  strings: {
    fr: {
      label: 'Zone de dessin',
      prefix: 'Dessin',
      description: 'Dessine avec le doigt ou avec des blocs.',
      help: 'Une zone de dessin se dessine au doigt (si « dessin au doigt » est activé) ou avec des blocs : traits, cercles, rectangles, textes. Les positions se comptent en pixels depuis le coin en haut à gauche.',
      example: 'Quand Dessin1 est touché, dessiner dans Dessin1 un cercle en x, y de rayon 20',
      props: {
        backgroundColor: 'couleur du fond',
        penColor: 'couleur du crayon',
        penWidth: 'épaisseur du crayon',
        fingerDrawing: 'dessin au doigt',
      },
      events: {
        touch: 'quand %1 est touché',
        drag: 'quand le doigt glisse sur %1',
        release: 'quand le doigt quitte %1',
      },
      methods: {
        clear: 'effacer %1',
        drawLine: 'dans %1 tracer un trait de x %2 y %3 à x %4 y %5',
        drawCircle: 'dans %1 dessiner un cercle en x %2 y %3 de rayon %4',
        drawRect: 'dans %1 dessiner un rectangle en x %2 y %3 largeur %4 hauteur %5',
        drawText: 'dans %1 écrire %2 en x %3 y %4',
        getImage: 'image de %1',
      },
      enums: {},
      args: { x: 'x', y: 'y' },
    },
    en: {
      label: 'Drawing area',
      prefix: 'Drawing',
      description: 'Draw with a finger or with blocks.',
      help: 'A drawing area is drawn on with a finger (when "finger drawing" is on) or with blocks: lines, circles, rectangles, texts. Positions count in pixels from the top left corner.',
      example: 'When Drawing1 is touched, in Drawing1 draw a circle at x, y with radius 20',
      props: {
        backgroundColor: 'background color',
        penColor: 'pen color',
        penWidth: 'pen width',
        fingerDrawing: 'finger drawing',
      },
      events: {
        touch: 'when %1 is touched',
        drag: 'when a finger moves on %1',
        release: 'when the finger leaves %1',
      },
      methods: {
        clear: 'clear %1',
        drawLine: 'in %1 draw a line from x %2 y %3 to x %4 y %5',
        drawCircle: 'in %1 draw a circle at x %2 y %3 with radius %4',
        drawRect: 'in %1 draw a rectangle at x %2 y %3 width %4 height %5',
        drawText: 'in %1 write %2 at x %3 y %4',
        getImage: 'image of %1',
      },
      enums: {},
      args: { x: 'x', y: 'y' },
    },
  },
})
