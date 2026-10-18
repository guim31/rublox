/**
 * Sound effects of the game templates (J10), synthesized here: oscillators and noise with
 * envelopes, mixed and written as short WAV files (22 050 Hz, 16 bits, mono). Nothing is taken
 * from elsewhere (CLAUDE.md); the files are rebuilt identically each time (the noise is seeded).
 */

const RATE = 22050

export type Wave = 'sine' | 'square' | 'triangle' | 'saw' | 'noise'

/** One voice: a pitch that slides from `from` to `to` hertz over `seconds`. */
export type Voice = {
  wave: Wave
  from: number
  to?: number
  seconds: number
  /** When it starts, in seconds from the start of the sound. */
  at?: number
  volume?: number
  /** Rise and fall, in seconds. */
  attack?: number
  release?: number
  /** Wobble of the pitch: depth (0 to 1) and speed (hertz). */
  vibrato?: [number, number]
  /** For the square wave: the part of the period that is up (0.5 = square). */
  duty?: number
}

function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

function sample(voice: Voice, phase: number, random: () => number): number {
  const p = phase - Math.floor(phase)
  switch (voice.wave) {
    case 'sine':
      return Math.sin(2 * Math.PI * p)
    case 'square':
      return p < (voice.duty ?? 0.5) ? 1 : -1
    case 'triangle':
      return 1 - 4 * Math.abs(p - 0.5)
    case 'saw':
      return 2 * p - 1
    case 'noise':
      return random() * 2 - 1
  }
}

/** Mixes voices into samples in [-1, 1]. */
function render(voices: Voice[], seed: number): Float32Array {
  const end = Math.max(...voices.map((voice) => (voice.at ?? 0) + voice.seconds))
  const out = new Float32Array(Math.ceil(end * RATE) + 1)
  const random = seeded(seed)
  for (const voice of voices) {
    const start = Math.round((voice.at ?? 0) * RATE)
    const count = Math.round(voice.seconds * RATE)
    const attack = Math.max(1, Math.round((voice.attack ?? 0.005) * RATE))
    const release = Math.max(1, Math.round((voice.release ?? voice.seconds * 0.6) * RATE))
    let phase = 0
    let held = 0
    // Noise is held for a few samples at low "pitches": a rumble instead of a hiss.
    let noiseValue = 0
    for (let i = 0; i < count; i++) {
      const t = i / count
      let frequency = voice.from + ((voice.to ?? voice.from) - voice.from) * t
      if (voice.vibrato) {
        frequency *= 1 + voice.vibrato[0] * Math.sin((2 * Math.PI * voice.vibrato[1] * i) / RATE)
      }
      phase += frequency / RATE
      let value: number
      if (voice.wave === 'noise') {
        held -= 1
        if (held <= 0) {
          noiseValue = sample(voice, phase, random)
          held = Math.max(1, Math.round(RATE / Math.max(1, frequency)))
        }
        value = noiseValue
      } else value = sample(voice, phase, random)
      const envelope = Math.min(1, i / attack, (count - i) / release)
      const index = start + i
      if (index < out.length)
        out[index] = (out[index] ?? 0) + value * envelope * (voice.volume ?? 0.5)
    }
  }
  return out
}

/** A WAV file of the mixed voices. */
export function wav(voices: Voice[], seed = 1): Uint8Array {
  const samples = render(voices, seed)
  const peak = Math.max(1, ...Array.from(samples, Math.abs))
  const bytes = new Uint8Array(44 + samples.length * 2)
  const view = new DataView(bytes.buffer)
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, RATE, true)
  view.setUint32(28, RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  samples.forEach((value, index) => {
    view.setInt16(44 + index * 2, Math.round((value / peak) * 0.85 * 32767), true)
  })
  return bytes
}

/** A note's frequency: `note(0)` is A4 (440 Hz), one step per semitone. */
export const note = (semitones: number) => 440 * 2 ** (semitones / 12)

/** A few notes one after the other (a jingle). */
export function melody(
  notes: number[],
  step: number,
  voice: Omit<Voice, 'from' | 'seconds' | 'at'> = { wave: 'square', duty: 0.25 },
): Voice[] {
  return notes.map((semitones, index) => ({
    ...voice,
    from: note(semitones),
    seconds: step * (index === notes.length - 1 ? 2.2 : 1),
    at: index * step,
    release: step * 0.7,
  }))
}

/** Sounds used by several games. */
export const COMMON_SOUNDS = {
  click: () =>
    wav([{ wave: 'square', from: 880, to: 1320, seconds: 0.06, volume: 0.4, duty: 0.3 }]),
  coin: () =>
    wav([
      { wave: 'square', from: note(14), seconds: 0.07, volume: 0.4, duty: 0.25 },
      { wave: 'square', from: note(19), seconds: 0.2, at: 0.07, volume: 0.4, duty: 0.25 },
    ]),
  start: () => wav(melody([3, 7, 10, 15], 0.08)),
  gameOver: () =>
    wav(
      melody([7, 3, 0, -5], 0.16, { wave: 'triangle' }).concat(
        melody([-2, -6, -9, -14], 0.16, { wave: 'square', duty: 0.5, volume: 0.15 }),
      ),
    ),
  win: () => wav(melody([0, 4, 7, 12, 7, 12, 16], 0.09)),
  hurt: () =>
    wav(
      [
        { wave: 'square', from: 300, to: 90, seconds: 0.25, volume: 0.5, duty: 0.4 },
        { wave: 'noise', from: 2000, to: 400, seconds: 0.2, volume: 0.3 },
      ],
      7,
    ),
  explosion: () =>
    wav(
      [
        { wave: 'noise', from: 1800, to: 60, seconds: 0.5, volume: 0.8, release: 0.45 },
        { wave: 'sine', from: 120, to: 40, seconds: 0.4, volume: 0.5 },
      ],
      3,
    ),
  jump: () => wav([{ wave: 'square', from: 300, to: 760, seconds: 0.16, volume: 0.4, duty: 0.35 }]),
  powerUp: () =>
    wav(
      [
        {
          wave: 'square',
          from: 400,
          to: 1200,
          seconds: 0.35,
          volume: 0.35,
          duty: 0.25,
          vibrato: [0.05, 18],
        },
        { wave: 'triangle', from: 800, to: 2400, seconds: 0.35, volume: 0.25 },
      ],
      2,
    ),
}
