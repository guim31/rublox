import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, call } from '../lib/api.ts'
import type { ProjectSummary } from '../storage/projects.ts'

const gallery = api.gallery

export const GALLERY_KEY = ['gallery'] as const

export const galleryKey = (sort: string, mode: string) => [...GALLERY_KEY, 'list', sort, mode]

export async function listGallery(sort: 'recent' | 'popular', mode: 'all' | 'junior' | 'studio') {
  const body = await call(gallery.$get({ query: { sort, mode } }))
  return {
    ...body,
    entries: body.entries.map((entry) => ({
      ...entry,
      preview: entry.preview as ProjectSummary['preview'],
    })),
  }
}

export type GalleryEntry = Awaited<ReturnType<typeof listGallery>>['entries'][number]

export async function galleryEntry(projectId: string) {
  const body = await call(gallery[':projectId'].$get({ param: { projectId } }))
  return {
    ...body,
    entry: { ...body.entry, preview: body.entry.preview as ProjectSummary['preview'] },
  }
}

export type RemixNode = Awaited<ReturnType<typeof galleryEntry>>['remixes'][number]

/** "I like", applied at once on the cards and the open project (optimistic). */
export function useLike() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, liked }: { id: string; liked: boolean }) => {
      const like = gallery[':projectId'].like
      await call(
        liked
          ? like.$put({ param: { projectId: id } })
          : like.$delete({ param: { projectId: id } }),
      )
    },
    onMutate: ({ id, liked }) => {
      const patch = <T extends { id: string; liked: boolean; likes: number }>(entry: T): T =>
        entry.id === id && entry.liked !== liked
          ? { ...entry, liked, likes: entry.likes + (liked ? 1 : -1) }
          : entry
      client.setQueriesData<Awaited<ReturnType<typeof listGallery>>>(
        { queryKey: [...GALLERY_KEY, 'list'] },
        (data) => (data ? { ...data, entries: data.entries.map(patch) } : data),
      )
      client.setQueriesData<Awaited<ReturnType<typeof galleryEntry>>>(
        { queryKey: [...GALLERY_KEY, 'entry', id] },
        (data) => (data ? { ...data, entry: patch(data.entry) } : data),
      )
    },
    onSettled: () => client.invalidateQueries({ queryKey: GALLERY_KEY }),
  })
}

/** "Remix": a copy in my projects, with the credit. */
export async function remix(projectId: string, name: string): Promise<string> {
  const body = await call(
    gallery[':projectId'].remix.$post({ param: { projectId }, json: { name } }),
  )
  return body.id
}
