import { usePrefs } from '../lib/prefs.ts'

/**
 * Junior's little success sounds (SPEC § 5.2), synthesized with Web Audio: no file to ship,
 * nothing borrowed. Silent in Studio and when the sounds are turned off.
 */
export type Sound = 'step' | 'star' | 'badge' | 'finish'

// Notes in Hz: a major arpeggio, brighter for bigger successes.
const TUNES: Record<Sound, number[]> = {
  step: [659.25, 987.77],
  star: [783.99, 1046.5, 1318.51],
  badge: [523.25, 659.25, 783.99, 1046.5],
  finish: [523.25, 659.25, 783.99, 1046.5, 1318.51],
}

let context: AudioContext | undefined

export function play(sound: Sound): void {
  const prefs = usePrefs.getState()
  if (prefs.mode !== 'junior' || !prefs.sounds) return
  try {
    context ??= new AudioContext()
    const now = context.currentTime
    TUNES[sound].forEach((frequency, index) => {
      if (!context) return
      const start = now + index * 0.085
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'triangle'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.3)
    })
  } catch {
    // No audio (autoplay policy, old browser): the success is still shown.
  }
}
