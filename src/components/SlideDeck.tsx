import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from 'framer-motion'
import type { Slide } from '../lib/awards'

const easeOut = [0.16, 1, 0.3, 1] as const
const easeSnap = [0.22, 1, 0.36, 1] as const

function dur(reduce: boolean, ms: number) {
  return reduce ? Math.min(ms, 0.12) : ms / 1000
}

function outerTransition(reduce: boolean) {
  return reduce
    ? { duration: 0.12 }
    : { duration: 0.85, ease: easeSnap }
}

export function SlideDeck({
  slide,
  slideKey,
}: {
  slide: Slide
  slideKey: string
}) {
  const reduce = useReducedMotion() ?? false

  return (
    <div className="relative flex min-h-[60vh] w-full flex-col items-center justify-center overflow-hidden px-6 py-12 text-center">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(207,185,145,0.2),transparent_55%)]"
        aria-hidden
      />
      {!reduce && (
        <motion.div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_50%,rgba(218,170,0,0.08),transparent_70%)]"
          aria-hidden
          initial={{ opacity: 0, scale: 1.15 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: easeOut }}
        />
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={slideKey}
          initial={
            reduce
              ? { opacity: 0 }
              : { opacity: 0, y: 48, scale: 0.97, filter: 'blur(14px)' }
          }
          animate={
            reduce
              ? { opacity: 1 }
              : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
          }
          exit={
            reduce
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  y: -36,
                  scale: 0.98,
                  filter: 'blur(10px)',
                }
          }
          transition={outerTransition(reduce)}
          className="relative z-10 w-full max-w-4xl"
        >
          {slide.kind === 'title' ? (
            <TitleSlide slide={slide} reduce={reduce} />
          ) : (
            <PlaceSlide slide={slide} reduce={reduce} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function TitleSlide({
  slide,
  reduce,
}: {
  slide: Extract<Slide, { kind: 'title' }>
  reduce: boolean
}) {
  const t = dur(reduce, 900)

  if (slide.isIntro) {
    return (
      <div className="flex flex-col items-center">
        <motion.div
          className="mb-8 h-px w-32 origin-center bg-gradient-to-r from-transparent via-[#cfb991]/80 to-transparent sm:w-48"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: dur(reduce, 1100), ease: easeOut }}
        />
        <motion.p
          className="mb-5 font-sans text-sm font-medium uppercase tracking-[0.35em] text-[#ddb945]"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: t, delay: dur(reduce, 120), ease: easeOut }}
        >
          Welcome
        </motion.p>
        <motion.h2
          className="max-w-4xl font-display text-4xl font-semibold leading-tight text-[#ebd99f] sm:text-5xl md:text-6xl"
          initial={
            reduce
              ? { opacity: 0 }
              : { opacity: 0, y: 28, scale: 0.94, filter: 'blur(12px)' }
          }
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          transition={{
            duration: dur(reduce, 1000),
            delay: dur(reduce, 200),
            ease: easeOut,
          }}
        >
          {slide.label}
        </motion.h2>
        {slide.subtitle ? (
          <motion.p
            className="mt-4 font-sans text-lg font-medium tracking-[0.2em] text-[#cfb991] sm:text-xl md:text-2xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: dur(reduce, 700),
              delay: dur(reduce, 380),
              ease: easeOut,
            }}
          >
            {slide.subtitle}
          </motion.p>
        ) : null}
        <motion.p
          className="mt-12 font-sans text-xs uppercase tracking-[0.25em] text-[#9d9795]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: dur(reduce, 900),
            duration: dur(reduce, 500),
          }}
        >
          Press D or → to begin
        </motion.p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <motion.div
        className="mb-6 h-px w-24 origin-center bg-gradient-to-r from-transparent via-[#cfb991]/80 to-transparent sm:w-40"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: dur(reduce, 1100), ease: easeOut }}
      />
      <motion.p
        className="mb-4 font-sans text-sm font-medium uppercase tracking-[0.35em] text-[#ddb945]"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: t, delay: dur(reduce, 120), ease: easeOut }}
      >
        {slide.isOverall ? 'Final award' : 'Category'}
      </motion.p>
      <motion.h2
        className="font-display text-3xl font-semibold leading-tight text-[#ebd99f] sm:text-4xl md:text-5xl"
        initial={
          reduce
            ? { opacity: 0 }
            : { opacity: 0, y: 28, scale: 0.94, filter: 'blur(12px)' }
        }
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{
          duration: dur(reduce, 1000),
          delay: dur(reduce, 200),
          ease: easeOut,
        }}
      >
        {slide.label}
      </motion.h2>
      <motion.p
        className="mt-10 font-sans text-sm text-[#c4bfc0]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          delay: dur(reduce, 650),
          duration: dur(reduce, 600),
          ease: easeOut,
        }}
      >
        Section {slide.sectionIndex} of {slide.sectionTotal}
      </motion.p>
      <motion.p
        className="mt-3 font-sans text-xs uppercase tracking-[0.25em] text-[#9d9795]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          delay: dur(reduce, 900),
          duration: dur(reduce, 500),
        }}
      >
        Press D or → to continue
      </motion.p>
    </div>
  )
}

function placeVariants(reduce: boolean): {
  wrap: Variants
  eyebrow: Variants
  placeLabel: Variants
  tie: Variants
  card: Variants
  list: Variants
  item: Variants
  score: Variants
} {
  const stagger = reduce ? 0.06 : 0.24
  const delayChild = reduce ? 0.08 : 0.55

  return {
    wrap: {
      hidden: {},
      show: {
        transition: {
          staggerChildren: stagger,
          delayChildren: delayChild,
        },
      },
    },
    eyebrow: {
      hidden: { opacity: 0, y: -12 },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: dur(reduce, 700), ease: easeOut },
      },
    },
    placeLabel: {
      hidden: reduce
        ? { opacity: 0 }
        : { opacity: 0, scale: 0.82, filter: 'blur(8px)', letterSpacing: '0.35em' },
      show: {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px)',
        letterSpacing: '0.05em',
        transition: { duration: dur(reduce, 900), ease: easeOut },
      },
    },
    tie: {
      hidden: { opacity: 0, y: 8 },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: dur(reduce, 500), ease: easeOut },
      },
    },
    card: {
      hidden: reduce
        ? { opacity: 0 }
        : { opacity: 0, scale: 0.94, y: 24 },
      show: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { duration: dur(reduce, 900), ease: easeOut },
      },
    },
    list: {
      hidden: {},
      show: {
        transition: {
          staggerChildren: stagger,
          delayChildren: reduce ? 0.05 : 0.2,
        },
      },
    },
    item: {
      hidden: reduce
        ? { opacity: 0 }
        : { opacity: 0, y: 40, filter: 'blur(10px)' },
      show: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: { duration: dur(reduce, 850), ease: easeOut },
      },
    },
    score: {
      hidden: { opacity: 0, y: 16 },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: dur(reduce, 700), ease: easeOut },
      },
    },
  }
}

function PlaceSlide({
  slide,
  reduce,
}: {
  slide: Extract<Slide, { kind: 'place' }>
  reduce: boolean
}) {
  const isFirst = slide.rank === 1
  const tie = slide.teams.length > 1
  const score = slide.teams[0]?.score ?? 0
  const v = placeVariants(reduce)

  return (
    <motion.div
      className="flex flex-col items-center"
      variants={v.wrap}
      initial="hidden"
      animate="show"
    >
      <motion.p
        variants={v.eyebrow}
        className="mb-2 font-sans text-xs font-medium uppercase tracking-[0.3em] text-[#9d9795]"
      >
        {slide.categoryLabel}
      </motion.p>
      <motion.p
        variants={v.placeLabel}
        className={`mb-2 font-display text-2xl font-semibold sm:text-3xl ${
          isFirst ? 'animate-gold-sheen text-[#ddb945]' : 'text-[#cfb991]'
        }`}
      >
        {slide.placeLabel}
      </motion.p>
      {tie && (
        <motion.p
          variants={v.tie}
          className="mb-4 font-sans text-sm font-medium uppercase tracking-[0.2em] text-[#c4bfc0]"
        >
          Tie
        </motion.p>
      )}
      {!tie && <div className="mb-4" />}

      <motion.div
        variants={v.card}
        className={`relative w-full max-w-2xl overflow-hidden rounded-2xl border px-8 py-10 backdrop-blur-sm ${
          isFirst
            ? 'border-[#cfb991]/60 bg-[#cfb991]/[0.1] shadow-[0_0_60px_-12px_rgba(218,170,0,0.4)]'
            : 'border-white/10 bg-white/[0.03]'
        }`}
      >
        {!reduce && (
          <motion.div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-[#daa000]/25 to-transparent"
            style={{ transform: 'translateX(-40%) skewX(-14deg)' }}
            initial={{ opacity: 0, x: '-20%' }}
            animate={{ opacity: [0, 0.55, 0], x: ['-20%', '30%', '60%'] }}
            transition={{ duration: 1.35, ease: easeOut }}
            aria-hidden
          />
        )}
        {isFirst && !reduce && (
          <motion.div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(207,185,145,0.24),transparent_58%)]"
            animate={{ opacity: [0.15, 0.38, 0.15] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />
        )}

        <motion.div variants={v.list} className="relative z-[1]">
          <ul className="space-y-8">
            {slide.teams.map((t) => (
              <motion.li key={t.name} variants={v.item}>
                <p className="font-display text-3xl font-bold tracking-tight text-[#ebd99f] sm:text-4xl md:text-5xl">
                  {t.name}
                </p>
              </motion.li>
            ))}
          </ul>

          <motion.p
            variants={v.score}
            className="mt-10 font-sans text-2xl tabular-nums text-[#c4bfc0]"
          >
            {score.toFixed(2)}
            {tie && (
              <span className="ml-2 text-base font-normal text-[#9d9795]">
                (same score)
              </span>
            )}
          </motion.p>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
