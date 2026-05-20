import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { LVDetail, LVTitel, Position } from '../lib/types'
import { formatEUR, toNum } from '../lib/format'
import KatalogPicker from '../components/KatalogPicker'

export default function LVEditor() {
  const { lvId } = useParams()
  const [lv, setLv] = useState<LVDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [neuerTitel, setNeuerTitel] = useState('')
  const [pickerTitelId, setPickerTitelId] = useState<string | null>(null)

  function load() {
    return api.get<LVDetail>(`/lvs/${lvId}`).then(setLv)
  }
  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [lvId])

  async function addTitel() {
    if (!neuerTitel.trim()) return
    await api.post(`/lvs/${lvId}/titel`, { bezeichnung: neuerTitel })
    setNeuerTitel('')
    await load()
  }

  async function addAusKatalog(titelId: string, katalogPosId: string) {
    await api.post(`/lvs/${lvId}/positionen`, { titelId, katalogPosId, menge: 1 })
    setPickerTitelId(null)
    await load()
  }

  async function setMenge(positionId: string, menge: number) {
    await api.put(`/positionen/${positionId}`, { menge })
    await load()
  }

  async function deletePosition(positionId: string) {
    await api.delete(`/positionen/${positionId}`)
    await load()
  }

  if (loading) return <div className="p-6 text-[13px] text-gray-400">Lädt …</div>
  if (!lv) return <div className="p-6 text-[13px] text-gray-400">LV nicht gefunden.</div>

  const gesamt = lv.titel.reduce(
    (s, t) => s + t.positionen.reduce((ps, p) => ps + toNum(p.kalkulation?.gesamtpreis), 0),
    0,
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-gray-200 px-6 py-4">
        <Link to={`/projekte/${lv.projekt.id}`} className="text-[11px] text-gray-400 hover:text-gray-700">
          ← {lv.projekt.name}
        </Link>
        <div className="mt-1 flex items-end justify-between">
          <div>
            <div className="text-lg font-semibold text-gray-900">{lv.bezeichnung}</div>
            <div className="text-[12px] text-gray-400">Version {lv.version}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-gray-400">Summe netto</div>
            <div className="text-[15px] font-semibold text-gray-900">{formatEUR(gesamt)}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {lv.titel.map((t) => (
          <TitelBlock
            key={t.id}
            titel={t}
            onAddKatalog={() => setPickerTitelId(t.id)}
            onSetMenge={setMenge}
            onDelete={deletePosition}
          />
        ))}

        <div className="mt-4 flex gap-2">
          <input
            value={neuerTitel}
            onChange={(e) => setNeuerTitel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTitel()}
            placeholder="Neuer Titel – z. B. „Erdarbeiten“"
            className="max-w-md flex-1 rounded-md border border-gray-300 px-3 py-2 text-[13px] outline-none focus:border-gray-900"
          />
          <button
            onClick={addTitel}
            disabled={!neuerTitel.trim()}
            className="rounded-md border border-gray-300 px-4 text-[12px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Titel hinzufügen
          </button>
        </div>
      </div>

      {pickerTitelId && (
        <KatalogPicker
          onClose={() => setPickerTitelId(null)}
          onPick={(pos) => addAusKatalog(pickerTitelId, pos.id)}
        />
      )}
    </div>
  )
}

function TitelBlock({
  titel,
  onAddKatalog,
  onSetMenge,
  onDelete,
}: {
  titel: LVTitel
  onAddKatalog: () => void
  onSetMenge: (id: string, menge: number) => void
  onDelete: (id: string) => void
}) {
  const summe = titel.positionen.reduce((s, p) => s + toNum(p.kalkulation?.gesamtpreis), 0)

  return (
    <div className="mb-5">
      <div className="mb-1.5 flex items-center justify-between border-b border-gray-200 pb-1">
        <div className="text-[13px] font-semibold text-gray-900">
          <span className="mr-2 font-mono text-[11px] text-gray-400">{titel.nummer}</span>
          {titel.bezeichnung}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-gray-500">{formatEUR(summe)}</span>
          <button onClick={onAddKatalog} className="text-[11px] text-gray-500 hover:text-gray-900">
            + Position aus Katalog
          </button>
        </div>
      </div>

      {titel.positionen.length === 0 ? (
        <div className="py-2 text-[12px] text-gray-400">Keine Positionen.</div>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-gray-400">
              <th className="w-20 py-1 font-medium">Pos</th>
              <th className="py-1 font-medium">Kurztext</th>
              <th className="w-24 py-1 text-right font-medium">Menge</th>
              <th className="w-14 py-1 font-medium">Einh.</th>
              <th className="w-24 py-1 text-right font-medium">EP</th>
              <th className="w-28 py-1 text-right font-medium">Gesamt</th>
              <th className="w-16 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {titel.positionen.map((p) => (
              <PositionRow key={p.id} pos={p} onSetMenge={onSetMenge} onDelete={onDelete} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function PositionRow({
  pos,
  onSetMenge,
  onDelete,
}: {
  pos: Position
  onSetMenge: (id: string, menge: number) => void
  onDelete: (id: string) => void
}) {
  const [menge, setMengeLocal] = useState(String(toNum(pos.menge)))

  function commit() {
    const n = Number(menge.replace(',', '.'))
    if (!Number.isNaN(n) && n !== toNum(pos.menge)) onSetMenge(pos.id, n)
  }

  return (
    <tr className="border-b border-gray-100 align-top">
      <td className="py-1.5 font-mono text-[11px] text-gray-400">{pos.nummer}</td>
      <td className="py-1.5 pr-2 text-gray-900">{pos.kurztext}</td>
      <td className="py-1.5 text-right">
        <input
          value={menge}
          onChange={(e) => setMengeLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-20 rounded border border-gray-200 px-1.5 py-0.5 text-right outline-none focus:border-gray-900"
        />
      </td>
      <td className="py-1.5 text-gray-500">{pos.einheit || '—'}</td>
      <td className="py-1.5 text-right text-gray-500">
        {pos.kalkulation?.einheitspreis != null ? formatEUR(pos.kalkulation.einheitspreis) : '–'}
      </td>
      <td className="py-1.5 text-right text-gray-900">
        {pos.kalkulation?.gesamtpreis != null ? formatEUR(pos.kalkulation.gesamtpreis) : '–'}
      </td>
      <td className="py-1.5 text-right">
        <Link
          to={`positionen/${pos.id}/kalkulation`}
          className="mr-2 text-[11px] text-gray-500 hover:text-gray-900"
        >
          Kalk.
        </Link>
        <button onClick={() => onDelete(pos.id)} className="text-[11px] text-gray-300 hover:text-red-600">
          ✕
        </button>
      </td>
    </tr>
  )
}
