import type { Player } from './play.ts'

/**
 * Players for the game templates (J10): a good one, who should score at least `goodScore` in
 * 60 seconds (the game is not impossible), and a lazy one, who starts and lets go (the game
 * ends: it is not endless without playing), then presses Enter to play again.
 */
export type Bot = {
  good(player: Player): void
  goodScore: number
  lazy(player: Player): void
  lazySeconds: number
}

/** Starts with Enter, does nothing, and starts again with Enter 2 seconds before the end. */
const lazy =
  (seconds: number) =>
  ({ frame, press, release }: Player) => {
    if (frame === 30 || frame === (seconds - 2) * 60) press('enter')
    if (frame === 32 || frame === (seconds - 2) * 60 + 2) release('enter')
  }

export const BOTS: Record<string, Bot> = {
  'buzzy-bee': {
    goodScore: 12,
    good: (p) => {
      if (p.frame === 20) p.tap(180, 430)
      if (p.variable('state') !== 'play') return
      const fr = p.world.bodies.some((body) => body.name === 'Abeille')
      const bee = p.body(fr ? 'Abeille' : 'Bee')
      // The next pair of columns not yet behind the bee: aim a bit under the middle of the way.
      const ahead = (name: string) =>
        p
          .clones(name)
          .filter((column) => Number(column.values.x) > Number(bee.values.x) - 75)
          .sort((a, b) => Number(a.values.x) - Number(b.values.x))[0]
      const top = ahead(fr ? 'ColonneHaut' : 'TopColumn')
      const bottom = ahead(fr ? 'ColonneBas' : 'BottomColumn')
      const target = top && bottom ? (Number(top.values.y) + Number(bottom.values.y)) / 2 + 20 : 330
      if (Number(bee.values.y) > target && Number(bee.values.vy) > -60) p.tap(200, 300)
    },
    lazy: lazy(8),
    lazySeconds: 8,
  },
}
