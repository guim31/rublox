import { createRoot } from 'react-dom/client'
import '@rublox/runtime/styles.css'
import './player.css'
import { listenForInstall } from './install.tsx'
import { LiveView } from './live.tsx'
import { readPage } from './page.ts'
import { Preview } from './preview.tsx'
import { PublishedView } from './published.tsx'

const page = readPage()
const root = document.getElementById('root')
if (page.kind === 'app' || page.kind === 'site') listenForInstall()
if (root) {
  createRoot(root).render(
    page.kind === 'live' ? (
      <LiveView token={page.token} />
    ) : page.kind === 'app' ? (
      <PublishedView
        base={`/a/${page.slug}/`}
        slug={page.slug}
        install={page.install}
        serviceWorker={import.meta.env.PROD}
      />
    ) : page.kind === 'site' ? (
      <PublishedView base="./" install={false} serviceWorker={false} />
    ) : (
      <Preview />
    ),
  )
}
