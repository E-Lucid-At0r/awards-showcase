import type { ParsedAwards } from '../lib/awards'

export function CategoryEditor({
  data,
  canReset,
  onRenameCategory,
  onRenameOverall,
  onReset,
  onGoToUpload,
}: {
  data: ParsedAwards | null
  canReset: boolean
  onRenameCategory: (index: number, label: string) => void
  onRenameOverall: (label: string) => void
  onReset: () => void
  onGoToUpload: () => void
}) {
  if (!data) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="font-display text-xl text-[#e8e4dc]">No CSV loaded yet</p>
        <p className="mt-2 font-sans text-sm text-[#8a8275]">
          Upload voting results on the Awards Show tab, then come back here to
          rename categories before presenting.
        </p>
        <button
          type="button"
          onClick={onGoToUpload}
          className="mt-8 rounded-full border border-[#c9a227]/60 bg-[#c9a227]/10 px-8 py-3 font-sans text-sm font-semibold uppercase tracking-wider text-[#e8d48b] transition hover:bg-[#c9a227]/20"
        >
          Go to Awards Show
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-[#ebd99f]">Categories</h2>
          <p className="mt-1 font-sans text-sm text-[#9d9795]">
            Rename any category — changes apply immediately to the slideshow.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={!canReset}
          className="font-sans text-xs text-[#c4bfc0] underline-offset-4 hover:underline disabled:opacity-40"
        >
          Reset to detected names
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {data.categoryLabels.map((label, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border border-[#555960]/40 bg-white/[0.02] px-4 py-3"
          >
            <span className="w-24 shrink-0 font-sans text-xs font-medium uppercase tracking-[0.2em] text-[#9d9795]">
              Category {i + 1}
            </span>
            <input
              type="text"
              value={label}
              onChange={(e) => onRenameCategory(i, e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-sans text-base text-[#ebd99f] outline-none placeholder:text-[#6b6560] focus:text-white"
              placeholder="Category name"
            />
          </div>
        ))}

        <div className="flex items-center gap-4 rounded-xl border border-[#cfb991]/50 bg-[#cfb991]/[0.06] px-4 py-3">
          <span className="w-24 shrink-0 font-sans text-xs font-medium uppercase tracking-[0.2em] text-[#ddb945]">
            Final Award
          </span>
          <input
            type="text"
            value={data.overall.label}
            onChange={(e) => onRenameOverall(e.target.value)}
            className="min-w-0 flex-1 bg-transparent font-sans text-base text-[#ebd99f] outline-none placeholder:text-[#6b6560] focus:text-white"
            placeholder="Final award name"
          />
        </div>
      </div>
    </div>
  )
}
