import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { formatEUR } from '../lib/format'
import type { Betriebsmittel, BetriebsmittelArt } from '../lib/types'

interface Props {
  art: BetriebsmittelArt
  onPick: (b: Betriebsmittel) => void
  onClose: () => void
}

export default function BetriebsmittelPicker({ art, onPick, onClose }: Props) {
  const [items, setItems] = useState<Betriebsmittel[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .get<{ betriebsmittel: Betriebsmittel[] }>(`/betriebsmittel?art=${art}&aktiv=true`)
      .then((r) => setItems(r.betriebsmittel))
      .finally(() => setLoading(false))
  }, [art])

  const filtered = items.filter((b) => b.bezeichnung.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-10" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-[560px] flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 p-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Stammdaten durchsuchen …"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] outline-none focus:border-gray-900"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading && <div className="p-2 text-[12px] text-gray-400">Lädt …</div>}
          {!loading && filtered.length === 0 && (
            <div className="p-2 text-[12px] text-gray-400">Keine Stammdaten dieser Art (in „Stammdaten" anlegen).</div>
          )}
          {filtered.map((b) => (
            <button
              key={b.id}
              onClick={() => onPick(b)}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-gray-100"
            >
              <span className="flex-1 text-[13px] text-gray-900">{b.bezeichnung}</span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{b.einheit}</span>
              <span className="w-24 text-right text-[12px] text-gray-600">{formatEUR(b.kostenProEinheit)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
