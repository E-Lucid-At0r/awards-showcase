let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  return ctx
}

/** Must be called from inside a user-gesture handler (e.g. the spin button's onClick). */
export function primeWheelAudio(): void {
  const audio = getContext()
  if (audio && audio.state === 'suspended') void audio.resume()
}

/**
 * A short percussive click — mimics the ratchet/peg sound of a spinning prize wheel.
 * Synthesized (filtered noise burst) so no audio asset is needed.
 */
export function playTick(): void {
  const audio = getContext()
  if (!audio) return

  const now = audio.currentTime
  const duration = 0.055

  const bufferSize = Math.max(1, Math.floor(audio.sampleRate * duration))
  const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  }

  const source = audio.createBufferSource()
  source.buffer = buffer

  const filter = audio.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 950
  filter.Q.value = 0.8

  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.32, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(audio.destination)
  source.start(now)
  source.stop(now + duration)
}
