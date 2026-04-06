import { useCallback, useRef } from 'react'

export function FileDropzone({
  onFile,
  disabled,
}: {
  onFile: (text: string, fileName: string) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const read = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        const text = String(reader.result ?? '')
        onFile(text, file.name)
      }
      reader.readAsText(file)
    },
    [onFile],
  )

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) read(f)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (disabled) return
    const f = e.dataTransfer.files?.[0]
    if (f && (f.name.endsWith('.csv') || f.type.includes('csv'))) read(f)
  }

  return (
    <div
      className={`rounded-2xl border-2 border-dashed border-[#c9a227]/35 bg-white/[0.02] px-8 py-14 text-center transition hover:border-[#c9a227]/55 ${
        disabled ? 'pointer-events-none opacity-50' : ''
      }`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <p className="font-display text-xl text-[#e8e4dc]">Load voting results</p>
      <p className="mt-2 font-sans text-sm text-[#8a8275]">
        Drop a CSV here, or choose a file (Google Form export works)
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="mt-8 rounded-full border border-[#c9a227]/60 bg-[#c9a227]/10 px-8 py-3 font-sans text-sm font-semibold uppercase tracking-wider text-[#e8d48b] transition hover:bg-[#c9a227]/20"
      >
        Choose CSV
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onChange}
      />
    </div>
  )
}
