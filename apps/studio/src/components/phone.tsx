import type { ReactNode } from 'react'
import { cn } from '../lib/cn.ts'

export const STATUS_BAR_HEIGHT = 30

/**
 * A phone drawn around an app (canvas and preview): bezel, status bar, camera. The screen
 * area below the status bar is `height - STATUS_BAR_HEIGHT` tall.
 */
export function PhoneFrame({
  width,
  height,
  scale,
  dark,
  children,
  className,
}: {
  width: number
  height: number
  scale: number
  dark: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div
      style={{ width: (width + 24) * scale, height: (height + 24) * scale }}
      className={cn('relative shrink-0', className)}
    >
      <div
        className="absolute top-0 left-0 origin-top-left rounded-[46px] bg-[#16141f] p-3 shadow-3 dark:bg-[#05040a] dark:ring-1 dark:ring-white/10"
        style={{ width: width + 24, height: height + 24, transform: `scale(${scale})` }}
      >
        <div
          className={cn(
            'relative flex size-full flex-col overflow-hidden rounded-[34px]',
            dark ? 'bg-[#121219] text-white' : 'bg-white text-[#1b1a24]',
          )}
        >
          <div
            className="relative flex shrink-0 items-center justify-between px-7 text-[13px] font-semibold"
            style={{ height: STATUS_BAR_HEIGHT }}
            aria-hidden="true"
          >
            <span>9:41</span>
            <span className="absolute top-1.5 left-1/2 h-[18px] w-24 -translate-x-1/2 rounded-full bg-[#16141f]" />
            <span className="flex items-center gap-1">
              <svg
                width="16"
                height="10"
                viewBox="0 0 16 10"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="0" y="6" width="3" height="4" rx="1" />
                <rect x="4.5" y="4" width="3" height="6" rx="1" />
                <rect x="9" y="2" width="3" height="8" rx="1" />
                <rect x="13" y="0" width="3" height="10" rx="1" opacity="0.4" />
              </svg>
              <svg width="22" height="11" viewBox="0 0 22 11" fill="none" aria-hidden="true">
                <rect
                  x="0.5"
                  y="0.5"
                  width="18"
                  height="10"
                  rx="3"
                  stroke="currentColor"
                  opacity="0.5"
                />
                <rect x="2" y="2" width="12" height="7" rx="1.5" fill="currentColor" />
                <rect
                  x="19.5"
                  y="3.5"
                  width="2"
                  height="4"
                  rx="1"
                  fill="currentColor"
                  opacity="0.5"
                />
              </svg>
            </span>
          </div>
          <div className="relative min-h-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  )
}
