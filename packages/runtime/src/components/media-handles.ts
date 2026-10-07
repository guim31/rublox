/** What media renderers expose to their behaviors (`useExpose`). */

export type VideoHandle = { element: () => HTMLVideoElement | null }

export type LottieHandle = {
  animation: () => { play(): void; pause(): void; stop(): void; setSpeed(s: number): void } | null
}

export type CameraViewHandle = { video: () => HTMLVideoElement | null }

export type CanvasHandle = {
  clear(): void
  line(x1: number, y1: number, x2: number, y2: number): void
  circle(x: number, y: number, r: number): void
  rect(x: number, y: number, w: number, h: number): void
  text(text: string, x: number, y: number): void
  image(): string
}
