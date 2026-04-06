import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BgmPlayer } from './components/BgmPlayer'
import { FileDropzone } from './components/FileDropzone'
import { SlideDeck } from './components/SlideDeck'
import {
  buildSlides,
  parseAwardsCsv,
  type ParsedAwards,
  type Slide,
} from './lib/awards'

function slideKey(slide: Slide, i: number): string {
  if (slide.kind === 'title') {
    return `t-${slide.sectionIndex}-${i}`
  }
  const names = slide.teams.map((t) => t.name).join('|')
  return `p-${slide.sectionIndex}-${slide.rank}-${names}-${i}`
}

export default function App() {
  const presentationRef = useRef<HTMLDivElement>(null)
  const [presentationFs, setPresentationFs] = useState(false)

  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ParsedAwards | null>(null)
  const [slideIndex, setSlideIndex] = useState(0)

  const slides = useMemo(() => (data ? buildSlides(data) : []), [data])
  const slide = slides[slideIndex] ?? null

  useEffect(() => {
    const onFs = () => {
      setPresentationFs(
        document.fullscreenElement === presentationRef.current,
      )
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const loadText = useCallback((text: string, name: string) => {
    setError(null)
    try {
      const parsed = parseAwardsCsv(text)
      setData(parsed)
      setFileName(name)
      setSlideIndex(0)
    } catch (e) {
      setData(null)
      setFileName(null)
      setError(e instanceof Error ? e.message : 'Could not parse CSV.')
    }
  }, [])

  const loadSample = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/sample.csv')
      if (!res.ok) throw new Error('Sample file not found.')
      const text = await res.text()
      loadText(text, 'sample.csv')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sample.')
    }
  }, [loadText])

  const go = useCallback(
    (dir: -1 | 1) => {
      setSlideIndex((i) => {
        const next = i + dir
        if (next < 0 || next >= slides.length) return i
        return next
      })
    },
    [slides.length],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!slides.length) return
      const t = e.target
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        return
      }

      const next =
        e.key === 'ArrowRight' ||
        e.key === ' ' ||
        e.key === 'PageDown' ||
        e.key === 'd' ||
        e.key === 'D'
      const prev =
        e.key === 'ArrowLeft' ||
        e.key === 'PageUp' ||
        e.key === 'a' ||
        e.key === 'A'

      if (next) {
        e.preventDefault()
        go(1)
      } else if (prev) {
        e.preventDefault()
        go(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, slides.length])

  const resetFile = () => {
    if (document.fullscreenElement === presentationRef.current) {
      void document.exitFullscreen?.()
    }
    setData(null)
    setFileName(null)
    setSlideIndex(0)
    setError(null)
  }

  const togglePresentationFullscreen = useCallback(() => {
    const el = presentationRef.current
    if (!el) return
    if (document.fullscreenElement === el) {
      void document.exitFullscreen?.()
    } else {
      void el.requestFullscreen?.()
    }
  }, [])

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#000000] text-[#ebd99f]">
      <div
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,rgba(207,185,145,0.09)_0%,transparent_35%,transparent_100%)]"
        aria-hidden
      />
      {!presentationFs && (
        <header className="relative z-20 border-b border-white/5 px-4 py-4 sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-lg font-semibold tracking-wide text-[#cfb991] sm:text-xl">
                The Game Awards
              </h1>
              <p className="font-sans text-xs text-[#9d9795]">
                Presentation voting — live results
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data && (
                <>
                  <span className="font-sans text-xs text-[#c4bfc0]">
                    {data.teamCount} teams · {fileName}
                  </span>
                  <button
                    type="button"
                    onClick={resetFile}
                    className="rounded-lg border border-[#555960] px-3 py-1.5 font-sans text-xs font-medium text-[#ebd99f] hover:bg-[#555960]/20"
                  >
                    Load another CSV
                  </button>
                  <button
                    type="button"
                    onClick={togglePresentationFullscreen}
                    className="rounded-lg border border-[#555960] px-3 py-1.5 font-sans text-xs font-medium text-[#ebd99f] hover:bg-[#555960]/20"
                  >
                    Fullscreen
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-8">
        {!data && (
          <div className="mx-auto max-w-xl">
            <FileDropzone onFile={loadText} />
            <p className="mt-6 text-center">
              <button
                type="button"
                onClick={loadSample}
                className="font-sans text-sm text-[#daa000] underline-offset-4 hover:underline"
              >
                Try sample data
              </button>
            </p>
            {error && (
              <p
                className="mt-6 rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-center font-sans text-sm text-red-200"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>
        )}

        {data && (
          <div
            ref={presentationRef}
            className="relative flex min-h-[55vh] flex-col rounded-2xl border border-[#555960]/40 bg-[#000000] px-4 pb-20 pt-6 sm:min-h-[60vh] sm:px-8 sm:pb-16 sm:pt-8 [&:fullscreen]:min-h-screen [&:fullscreen]:justify-center [&:fullscreen]:rounded-none [&:fullscreen]:border-0 [&:fullscreen]:bg-[#000000] [&:fullscreen]:px-6 [&:fullscreen]:pb-28 [&:fullscreen]:pt-10"
          >
            {slide && (
              <>
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4 font-sans text-sm text-[#c4bfc0]">
                  <span>
                    Slide {slideIndex + 1} of {slides.length}
                  </span>
                  <span className="hidden text-right sm:block">
                    <span className="text-[#9d9795]">Back </span>
                    <kbd className="rounded border border-[#555960] bg-[#555960]/20 px-1.5 py-0.5 font-mono text-[#ebd99f]">
                      A
                    </kbd>
                    <span className="text-[#9d9795]"> · Next </span>
                    <kbd className="rounded border border-[#555960] bg-[#555960]/20 px-1.5 py-0.5 font-mono text-[#ebd99f]">
                      D
                    </kbd>
                    <span className="text-[#9d9795]"> · </span>
                    <kbd className="rounded border border-[#555960] bg-[#555960]/20 px-1.5 py-0.5 font-mono text-[#ebd99f]">
                      ←
                    </kbd>
                    <kbd className="rounded border border-[#555960] bg-[#555960]/20 px-1.5 py-0.5 font-mono text-[#ebd99f]">
                      →
                    </kbd>
                    <span className="text-[#9d9795]"> · </span>
                    <kbd className="rounded border border-[#555960] bg-[#555960]/20 px-1.5 py-0.5 font-mono text-[#ebd99f]">
                      Space
                    </kbd>
                  </span>
                </div>
                <SlideDeck slide={slide} slideKey={slideKey(slide, slideIndex)} />
              </>
            )}

            {!slide && slides.length === 0 && (
              <p className="py-12 text-center font-sans text-[#c4bfc0]">
                No slides.
              </p>
            )}

            {presentationFs && (
              <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pb-6 pt-10">
                <div className="flex flex-col items-center gap-2 rounded-full border border-[#555960] bg-black/70 px-5 py-2.5 text-center backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => void document.exitFullscreen?.()}
                    className="font-sans text-xs font-medium text-[#cfb991] hover:underline"
                  >
                    Exit fullscreen
                  </button>
                  <span className="font-sans text-[10px] text-[#9d9795]">
                    Esc also exits
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <BgmPlayer />
    </div>
  )
}
