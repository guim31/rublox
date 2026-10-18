import buzzyBeeEn from '../../../content/templates/buzzy-bee/en.json' with { type: 'json' }
import buzzyBeeFr from '../../../content/templates/buzzy-bee/fr.json' with { type: 'json' }
import buzzyBee from '../../../content/templates/buzzy-bee/template.json' with { type: 'json' }
import puckClashEn from '../../../content/templates/puck-clash/en.json' with { type: 'json' }
import puckClashFr from '../../../content/templates/puck-clash/fr.json' with { type: 'json' }
import puckClash from '../../../content/templates/puck-clash/template.json' with { type: 'json' }
import roboDashEn from '../../../content/templates/robo-dash/en.json' with { type: 'json' }
import roboDashFr from '../../../content/templates/robo-dash/fr.json' with { type: 'json' }
import roboDash from '../../../content/templates/robo-dash/template.json' with { type: 'json' }
import wiggleSnakeEn from '../../../content/templates/wiggle-snake/en.json' with { type: 'json' }
import wiggleSnakeFr from '../../../content/templates/wiggle-snake/fr.json' with { type: 'json' }
import wiggleSnake from '../../../content/templates/wiggle-snake/template.json' with {
  type: 'json',
}
import { type Template, template } from './template.ts'

/**
 * The game templates (J10), written in `authoring/games/` and generated into
 * `content/templates/` with their pictures and sounds (`pnpm --filter @rublox/templates
 * content`).
 */
export const GAME_TEMPLATES: readonly Template[] = [
  template(buzzyBee, buzzyBeeFr, buzzyBeeEn),
  template(wiggleSnake, wiggleSnakeFr, wiggleSnakeEn),
  template(roboDash, roboDashFr, roboDashEn),
  template(puckClash, puckClashFr, puckClashEn),
]
