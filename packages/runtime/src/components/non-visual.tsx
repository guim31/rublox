import { type Renderer, rootAttributes } from './types.ts'

/**
 * Non-visual components (timer, sound, sensors…) draw nothing in the app: the editor lists
 * them under the screen. This keeps `data-rx-id` so that they can still be found.
 */
export const NonVisualRenderer: Renderer = (p) => <span {...rootAttributes(p, p.type)} hidden />
