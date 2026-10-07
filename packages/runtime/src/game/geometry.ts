/** Collision shapes of scene bodies (SPEC § 4.4): boxes or circles, in scene units. */
export type Shape =
  | { kind: 'box'; x: number; y: number; hw: number; hh: number }
  | { kind: 'circle'; x: number; y: number; r: number }

/** How far a shape reaches from its center, along x and y. */
export function extent(shape: Shape): { hw: number; hh: number } {
  return shape.kind === 'box' ? { hw: shape.hw, hh: shape.hh } : { hw: shape.r, hh: shape.r }
}

/**
 * Whether two shapes overlap and, if so, the shortest push (`nx`, `ny`, unit vector from
 * `a` to `b`, and `depth`) that separates them.
 */
export function overlap(a: Shape, b: Shape): { nx: number; ny: number; depth: number } | null {
  if (a.kind === 'box' && b.kind === 'box') {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const px = a.hw + b.hw - Math.abs(dx)
    const py = a.hh + b.hh - Math.abs(dy)
    if (px <= 0 || py <= 0) return null
    return px < py
      ? { nx: Math.sign(dx) || 1, ny: 0, depth: px }
      : { nx: 0, ny: Math.sign(dy) || 1, depth: py }
  }
  if (a.kind === 'circle' && b.kind === 'circle') {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const distance = Math.hypot(dx, dy)
    const depth = a.r + b.r - distance
    if (depth <= 0) return null
    return distance > 0 ? { nx: dx / distance, ny: dy / distance, depth } : { nx: 0, ny: 1, depth }
  }
  // A box and a circle: from the closest point of the box to the circle's center.
  const box = (a.kind === 'box' ? a : b) as Extract<Shape, { kind: 'box' }>
  const circle = (a.kind === 'circle' ? a : b) as Extract<Shape, { kind: 'circle' }>
  const flip = a.kind === 'circle' ? -1 : 1
  const cx = Math.max(box.x - box.hw, Math.min(circle.x, box.x + box.hw))
  const cy = Math.max(box.y - box.hh, Math.min(circle.y, box.y + box.hh))
  let dx = circle.x - cx
  let dy = circle.y - cy
  const distance = Math.hypot(dx, dy)
  if (distance >= circle.r) return null
  if (distance > 0) {
    dx /= distance
    dy /= distance
    return { nx: dx * flip, ny: dy * flip, depth: circle.r - distance }
  }
  // The center is inside the box: push out along the closest side.
  const px = box.hw - Math.abs(circle.x - box.x)
  const py = box.hh - Math.abs(circle.y - box.y)
  return px < py
    ? { nx: (Math.sign(circle.x - box.x) || 1) * flip, ny: 0, depth: px + circle.r }
    : { nx: 0, ny: (Math.sign(circle.y - box.y) || 1) * flip, depth: py + circle.r }
}
