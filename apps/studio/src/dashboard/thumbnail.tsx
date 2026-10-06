import { AppSurface, ScreenView } from '@rublox/runtime'
import type { ProjectSummary } from '../storage/projects.ts'

const WIDTH = 360
const HEIGHT = 640

/** The start screen drawn small: the card thumbnail (SPEC § 4.8). */
export function ProjectThumbnail({
  preview,
  dark,
}: {
  preview: ProjectSummary['preview']
  dark: boolean
}) {
  if (!preview) return <div className="size-full bg-surface-2" />
  return (
    <div
      className="pointer-events-none relative size-full overflow-hidden"
      aria-hidden="true"
      inert
    >
      <div
        className="absolute top-0 left-1/2 origin-top"
        style={{
          width: WIDTH,
          height: HEIGHT,
          transform: 'translateX(-50%) scale(var(--thumb-scale, 0.5))',
        }}
      >
        <AppSurface theme={preview.theme} scheme={dark ? 'dark' : 'light'}>
          <ScreenView screen={preview.screen} locale={preview.locale} mode="design" />
        </AppSurface>
      </div>
    </div>
  )
}
