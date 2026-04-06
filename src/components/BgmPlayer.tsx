import { useCallback, useEffect, useRef, useState } from 'react'

const SRC = '/bgm/theme.mp3'
const DEFAULT_VOL = 0.12

/**
 * Ultra-subdued background music. Browsers require a user gesture to start audio.
 */
export function BgmPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [vol, setVol] = useState(DEFAULT_VOL)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.volume = vol
  }, [vol])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const enforceLoop = () => {
      a.loop = true
    }
    enforceLoop()
    a.addEventListener('loadedmetadata', enforceLoop)
    return () => a.removeEventListener('loadedmetadata', enforceLoop)
  }, [])

  const syncPlaying = useCallback(() => {
    const a = audioRef.current
    setPlaying(!!a && !a.paused)
  }, [])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('ended', syncPlaying)
    return () => {
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('ended', syncPlaying)
    }
  }, [syncPlaying])

  const toggle = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) {
      void a.play().catch(() => {})
    } else {
      a.pause()
    }
  }, [])

  return (
    <div
      className="pointer-events-auto fixed bottom-4 left-4 z-[25] max-w-[min(100%-2rem,20rem)] opacity-[0.38] transition-opacity duration-300 hover:opacity-95"
      role="region"
      aria-label="Background music"
    >
      <audio
        ref={audioRef}
        src={SRC}
        loop
        preload="metadata"
        playsInline
        onEnded={() => {
          const a = audioRef.current
          if (!a) return
          a.currentTime = 0
          void a.play().catch(() => {})
        }}
      />
      <div className="rounded-xl border border-white/[0.06] bg-black/45 px-2.5 py-2 shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={toggle}
          className="w-full text-left font-sans text-[10px] leading-snug text-[#9a9285] transition-colors hover:text-[#d4c4a8] sm:text-[11px]"
        >
          {playing ? (
            <>
              <span className="text-[#c9a227]/90">⏸</span>{' '}
              <span className="italic">pause the extremely serious orchestral moment</span>
            </>
          ) : (
            <>
              <span className="text-[#c9a227]/90">▶</span>{' '}
              <span className="italic">play cool video game music</span>
            </>
          )}
        </button>
        <div className="mt-2 flex items-center gap-2">
          <span className="shrink-0 font-sans text-[9px] uppercase tracking-wider text-[#5c574e]">
            shh
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={vol}
            onChange={(e) => setVol(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer accent-[#6b5a20] opacity-80"
            aria-label="Background music volume"
          />
        </div>
        <p className="mt-1.5 font-sans text-[9px] leading-tight text-[#4a4640]">
          loops forever (you&apos;re welcome). for emotional support during spreadsheets.
          not affiliated with any dragons.
        </p>
      </div>
    </div>
  )
}
