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

/** Starts with Enter, does nothing, and presses Enter again a second after the end screen. */
const lazy =
  (_seconds: number) =>
  ({ frame, press, release, variable }: Player) => {
    release('enter')
    if (frame === 0) lazyOver = undefined
    if (frame === 30) press('enter')
    if (variable('state') === 'over') {
      lazyOver ??= frame
      if (frame - lazyOver === 60) press('enter')
    } else if (variable('state') === 'play') lazyOver = undefined
  }
let lazyOver: number | undefined

/** Snake: goes towards the fruit by a free cell, never into a dead end. */
function snake(p: Player) {
  if (p.frame === 20) p.press('enter')
  if (p.frame === 22) p.release('enter')
  for (const key of ['left', 'right', 'up', 'down']) p.release(key)
  if (p.variable('state') !== 'play') return
  const path = (p.variable('path') as number[]) ?? []
  const size = Number(p.variable('size'))
  const head = path.at(-1)
  if (head === undefined) return
  const body = new Set(path.slice(-size + 1))
  const free = (cell: number) => {
    const col = Math.floor(cell / 100)
    const row = cell % 100
    return col >= 0 && col <= 11 && row >= 0 && row <= 15 && !body.has(cell)
  }
  const bonus = Number(p.variable('bonusCell'))
  const goal = bonus >= 0 ? bonus : Number(p.variable('fruitCell'))
  const distance = (a: number, b: number) =>
    Math.abs(Math.floor(a / 100) - Math.floor(b / 100)) + Math.abs((a % 100) - (b % 100))
  // Free cells reachable from there (a small flood fill): never enter a dead end.
  const room = (cell: number) => {
    const seen = new Set([cell])
    const queue = [cell]
    while (queue.length && seen.size < 60) {
      const at = queue.shift() as number
      for (const next of [at + 100, at - 100, at + 1, at - 1]) {
        if (!seen.has(next) && free(next) && Math.abs((next % 100) - (at % 100)) <= 1) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    return seen.size
  }
  const dirX = Number(p.variable('dirX'))
  const dirY = Number(p.variable('dirY'))
  const moves = [
    ['right', 1, 0],
    ['left', -1, 0],
    ['down', 0, 1],
    ['up', 0, -1],
  ] as const
  const best = moves
    .filter(([, dx, dy]) => !(dx === -dirX && dy === -dirY))
    .map(([key, dx, dy]) => ({ key, cell: head + dx * 100 + dy }))
    .filter((option) => free(option.cell) && Math.abs((option.cell % 100) - (head % 100)) <= 1)
    .map((option) => ({
      ...option,
      room: room(option.cell),
      distance: distance(option.cell, goal),
    }))
    .sort(
      (a, b) => Math.min(b.room, size + 4) - Math.min(a.room, size + 4) || a.distance - b.distance,
    )[0]
  if (best) p.press(best.key)
}

/** Runner: jumps over what stands on the road, slides under the drones, just in time. */
function runner(p: Player) {
  if (p.frame === 20) p.press('enter')
  for (const key of ['enter', 'space', 'down']) if (p.frame % 2 === 1) p.release(key)
  if (p.variable('state') !== 'play') return
  const robot = p.body('Robot')
  const speed = Number(p.variable('speed'))
  const next = p
    .clones('Obstacle')
    .filter((o) => Number(o.values.x) > Number(robot.values.x) - 20)
    .sort((a, b) => Number(a.values.x) - Number(b.values.x))[0]
  if (!next) return
  const distance = Number(next.values.x) - Number(robot.values.x)
  const drone = next.values.costume === 3
  if (drone && distance < speed * 0.3 + 50) p.press('down')
  else if (!drone && distance < speed * 0.16 + 60 && robot.values.onGround === true)
    p.press('space')
}

/**
 * Air hockey: one side steers its bat with its keys (W A S D for blue, the arrows for red),
 * behind the puck when it is in its half, back home otherwise.
 */
function hockey(side: 'blue' | 'red') {
  return (p: Player) => {
    if (p.frame === 20) p.press('enter')
    const keys =
      side === 'blue'
        ? { left: 'a', right: 'd', up: 'w', down: 's' }
        : { left: 'left', right: 'right', up: 'up', down: 'down' }
    if (p.frame === 22) p.release('enter')
    if (p.variable('state') !== 'play') {
      for (const key of Object.values(keys)) p.release(key)
      return
    }
    const fr = p.world.bodies.some((body) => body.name === 'Palet')
    const puck = p.body(fr ? 'Palet' : 'Puck')
    const bat = p.body(side === 'blue' ? (fr ? 'Bleu' : 'Blue') : fr ? 'Rouge' : 'Red')
    const px = Number(puck.values.x)
    const py = Number(puck.values.y)
    const mine = side === 'blue' ? py > 360 : py < 360
    // Aim at the side of the goal the other bat does not cover, from behind the puck.
    const other = p.body(side === 'blue' ? (fr ? 'Rouge' : 'Red') : fr ? 'Bleu' : 'Blue')
    const gap = Number(other.values.x) - 180
    const aim = {
      x: Math.abs(gap) > 30 ? (gap > 0 ? 130 : 230) : px < 180 ? 130 : 230,
      y: side === 'blue' ? 0 : 720,
    }
    const length = Math.hypot(px - aim.x, py - aim.y) || 1
    const target = mine
      ? { x: px + ((px - aim.x) / length) * 44, y: py + ((py - aim.y) / length) * 44 }
      : { x: 180, y: side === 'blue' ? 620 : 100 }
    const bx = Number(bat.values.x)
    const by = Number(bat.values.y)
    const go = (key: string, on: boolean) => (on ? p.press(key) : p.release(key))
    go(keys.left, target.x < bx - 4)
    go(keys.right, target.x > bx + 4)
    go(keys.up, target.y < by - 4)
    go(keys.down, target.y > by + 4)
  }
}

export const BOTS: Record<string, Bot> = {
  'puck-clash': {
    goodScore: 3,
    // Blue plays well against a slow red (red moves one frame in four).
    good: (p) => {
      hockey('blue')(p)
      if (p.frame % 4 === 0) hockey('red')(p)
      else for (const key of ['left', 'right', 'up', 'down']) p.release(key)
    },
    // Blue does nothing: red wins, then Enter starts again.
    lazy: (p) => {
      lazy(0)(p)
      hockey('red')(p)
    },
    lazySeconds: 100,
  },
  'robo-dash': { goodScore: 600, good: runner, lazy: lazy(20), lazySeconds: 20 },
  'wiggle-snake': { goodScore: 10, good: snake, lazy: lazy(20), lazySeconds: 20 },
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
