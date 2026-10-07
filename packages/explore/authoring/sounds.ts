/**
 * Short sounds made for the apps to take apart: a sweep of a sine wave, written as a WAV
 * `data:` address (8 kHz, 8 bits). Nothing is taken from elsewhere (CLAUDE.md).
 */
function sweep(from: number, to: number, seconds: number): string {
  const rate = 8000
  const count = Math.round(rate * seconds)
  const data = Buffer.alloc(44 + count)
  data.write('RIFF', 0)
  data.writeUInt32LE(36 + count, 4)
  data.write('WAVEfmt ', 8)
  data.writeUInt32LE(16, 16)
  data.writeUInt16LE(1, 20) // PCM
  data.writeUInt16LE(1, 22) // mono
  data.writeUInt32LE(rate, 24)
  data.writeUInt32LE(rate, 28)
  data.writeUInt16LE(1, 32)
  data.writeUInt16LE(8, 34)
  data.write('data', 36)
  data.writeUInt32LE(count, 40)
  let phase = 0
  for (let i = 0; i < count; i++) {
    const t = i / count
    phase += (2 * Math.PI * (from + (to - from) * t)) / rate
    const envelope = Math.min(1, t * 20) * (1 - t)
    data.writeUInt8(Math.round(128 + 90 * envelope * Math.sin(phase)), 44 + i)
  }
  return `data:audio/wav;base64,${data.toString('base64')}`
}

/** A bright "pop" going up: something caught. */
export const POP = sweep(520, 1040, 0.14)
/** A low "oops" going down: something missed. */
export const OOPS = sweep(330, 140, 0.28)
/** Two notes: a win. */
export const TADA = sweep(660, 1320, 0.32)
