import { createFileRoute } from '@tanstack/react-router'
import { GalleryPage } from '../gallery/gallery-page.tsx'

type Search = { p?: string }

export const Route = createFileRoute('/gallery')({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search.p === 'string' && search.p ? { p: search.p } : {},
  component: function Gallery() {
    return <GalleryPage open={Route.useSearch().p} />
  },
})
