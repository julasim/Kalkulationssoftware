import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Leistungsbuch } from '../lib/types'

export interface KatalogTreffer {
  id: string
  posNummer: string
  kurztext: string
  langtext: string | null
  grundtextLang: string | null
  einheit: string
  quelle: string
  lbNummer: string
  leistungsbuchId: string
  lgNr: string | null
  ulgNr: string | null
  lgBezeichnung: string | null
  ulgBezeichnung: string | null
}

export default function Katalog() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<KatalogTreffer[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [buecher, setBuecher] = useState<Leistungsbuch[]>([])
  const [filterId, setFilterId] = useState('')

  useEffect(() => {
    api
      .get<{ leistungsbuecher: Leistungsbuch[] }>('/leistungsbuecher')
      .then((r) => setBuecher(r.leistungsbuecher.filter((b) => b.aktiv)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setTotal(0)
      return
    }
    let cancelled = false
    const handle = setTimeout(() => {
      setLoading(true)
      setError(null)
      const lbParam = filterId ? `&leistungsbuchId=${filterId}` : ''
      api
        .get<{ results: KatalogTreffer[]; total: number }>(
          `/katalog/search?q=${encodeURIComponent(term)}&limit=50${lbParam}`,
        )
        .then((res) => {
          if (cancelled) return
          setResults(res.results)
          setTotal(res.total)
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : 'Suche fehlgeschlagen')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query, filterId])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="text-lg font-semibold text-gray-900">Katalog</div>
        <div className="mt-0.5 text-[12px] text-gray-400">
          ÖNORM-Leistungsbuch durchsuchen · Positionen übernimmst du im LV-Editor über „+ Position aus Katalog"
        </div>
        <div className="mt-3 flex max-w-xl gap-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche nach Stichwort, Positionsnummer oder Text …"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-[13px] outline-none focus:border-gray-900"
          />
          <select
            value={filterId}
            onChange={(e) => setFilterId(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-2 text-[13px] text-gray-700 outline-none focus:border-gray-900"
          >
            <option value="">Alle Bücher</option>
            {buecher.map((b) => (
              <option key={b.id} value={b.id}>
                {b.kennung} {b.versionsnummer}
              </option>
            ))}
          </select>
        </div>
        {query.trim().length >= 2 && !loading && (
          <div className="mt-2 text-[11px] text-gray-400">
            {total} Treffer{total > results.length ? ` (zeige ${results.length})` : ''}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {error && <div className="text-[13px] text-red-600">{error}</div>}
        {loading && <div className="text-[13px] text-gray-400">Suche …</div>}
        {!loading && query.trim().length >= 2 && results.length === 0 && !error && (
          <div className="text-[13px] text-gray-400">Keine Treffer.</div>
        )}

        <div className="space-y-1.5">
          {results.map((r) => {
            const open = openId === r.id
            return (
              <div key={r.id} className="rounded-md border border-gray-200 bg-white">
                <button
                  onClick={() => setOpenId(open ? null : r.id)}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
                >
                  <span className="mt-0.5 font-mono text-[11px] text-gray-400">{r.posNummer}</span>
                  <span className="flex-1 text-[13px] font-medium text-gray-900">{r.kurztext}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                    {r.einheit || '—'}
                  </span>
                </button>
                {open && (
                  <div className="border-t border-gray-100 px-3 py-2.5">
                    <div className="mb-1.5 text-[10px] uppercase tracking-wider text-gray-400">
                      {r.lbNummer} · {r.lgNr}/{r.ulgNr} {r.lgBezeichnung} › {r.ulgBezeichnung}
                    </div>
                    {r.grundtextLang && (
                      <div
                        className="lv-langtext mb-2 text-[12px] text-gray-500"
                        dangerouslySetInnerHTML={{ __html: r.grundtextLang }}
                      />
                    )}
                    {r.langtext && (
                      <div
                        className="lv-langtext text-[12px] text-gray-700"
                        dangerouslySetInnerHTML={{ __html: r.langtext }}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
