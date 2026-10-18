import buzzyBeeEn from '../../../content/templates/buzzy-bee/en.json' with { type: 'json' }
import buzzyBeeFr from '../../../content/templates/buzzy-bee/fr.json' with { type: 'json' }
import buzzyBee from '../../../content/templates/buzzy-bee/template.json' with { type: 'json' }
import { type Template, template } from './template.ts'

/**
 * The game templates (J10), written in `authoring/games/` and generated into
 * `content/templates/` with their pictures and sounds (`pnpm --filter @rublox/templates
 * content`).
 */
export const GAME_TEMPLATES: readonly Template[] = [template(buzzyBee, buzzyBeeFr, buzzyBeeEn)]
