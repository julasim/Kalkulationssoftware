import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { KatalogTreffer } from '../pages/Katalog'

interface Props {
  onPick: (pos: KatalogTreffer) => void
  onClose: () => void
}

export default function KatalogPicker({ onPick, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<KatalogTreffer[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    const handle = setTimeout(() => {
      setLoading(true)
      api
        .get<{ results: KatalogTreffer[] }>(`/katalog/search?q=${encodeURIComponent(term)}&limit=30`)
        .then((res) => setResults(res.results))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(handle)
  }, [query])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-10" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-[640px] flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 p-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Katalog durchsuchen – Stichwort oder Positionsnummer …"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] outline-none focus:border-gray-900"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading && <div className="p-2 text-[12px] text-gray-400">Suche …</div>}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="p-2 text-[12px] text-gray-400">Keine Treffer.</div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => onPick(r)}
              className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-gray-100"
            >
              <span className="mt-0.5 font-mono text-[11px] text-gray-400">{r.posNummer}</span>
              <span className="flex-1 text-[13px] text-gray-900">{r.kurztext}</span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                {r.einheit || '—'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
