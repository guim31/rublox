import type { AppBundle, ProjectDoc } from '@rublox/schema'

/**
 * The project and the code generated from it, as a player runs it (SPEC § 6.5): sent to the
 * phones of a live test, frozen in a publication, written into an exported website. Blockly
 * is loaded on demand.
 */
export async function buildBundle(doc: ProjectDoc): Promise<AppBundle> {
  const { generateProjectCode } = await import('@rublox/blocks')
  const generated = generateProjectCode(doc)
  const code: AppBundle['code'] = {}
  for (const [key, module] of Object.entries(generated)) {
    code[key] = { code: module.code, lineMap: module.lineMap }
  }
  return { doc, code }
}
