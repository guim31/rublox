import type { AssetKind } from '@rublox/schema'
import type { Template } from '@rublox/templates'

/**
 * The pictures and sounds of the templates (J10: the games), served with the studio as plain
 * files (never inlined: they are fetched to be stored in the new project).
 */
const FILES = import.meta.glob<string>('../../../../content/templates/*/assets/*', {
  query: '?url&no-inline',
  import: 'default',
})

/** The animated pictures of the template cards (J10), by template id. */
const COVERS = import.meta.glob<string>('../../../../content/templates/*/cover.svg', {
  query: '?url&no-inline',
  import: 'default',
  eager: true,
})

export function templateCover(template: Template): string | undefined {
  return template.cover
    ? COVERS[`../../../../content/templates/${template.id}/${template.cover}`]
    : undefined
}

/** A file to store in a new project, and the kind of asset it is. */
export type TemplateFile = { file: File; kind: AssetKind }

/** Fetches the files a template comes with, named as in the project. */
export async function templateFiles(template: Template): Promise<TemplateFile[]> {
  const assets = template.recipe.assets ?? []
  return Promise.all(
    assets.map(async (asset) => {
      const load = FILES[`../../../../content/templates/${template.id}/assets/${asset.file}`]
      if (!load) throw new Error(`missing template file ${template.id}/${asset.file}`)
      const response = await fetch(await load())
      if (!response.ok) throw new Error(`template file ${asset.file}: ${response.status}`)
      const name = typeof asset.name === 'string' ? asset.name : asset.name.en
      return {
        file: new File([await response.blob()], `${name}.${asset.file.split('.').pop()}`, {
          type: asset.mime,
        }),
        kind: asset.kind,
      }
    }),
  )
}
