import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { LVDetail, LVTitel, Position } from '../lib/types'
import { formatEUR, toNum } from '../lib/format'
import KatalogPicker from '../components/KatalogPicker'

const TYP_LABEL: Record<Position['typ'], string> = {
  normal: 'Normal',
  alternativ: 'Alternativ',
  eventualposition: 'Eventual',
  pauschale: 'Pauschale',
}

function aktiveSumme(positionen: Position[]) {
  return positionen.filter((p) => !p.entfaellt).reduce((s, p) => s + toNum(p.kalkulation?.gesamtpreis), 0)
}

export default function LVEditor() {
  const { lvId } = useParams()
  const [lv, setLv] = useState<LVDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [neuerTitel, setNeuerTitel] = useState('')
  const [pickerTitelId, setPickerTitelId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function load() {
    return api.get<LVDetail>(`/lvs/${lvId}`).then(setLv)
  }
  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [lvId])

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="p-6 text-[13px] text-gray-400">Lädt …</div>
  if (!lv) return <div className="p-6 text-[13px] text-gray-400">LV nicht gefunden.</div>

  const tops = lv.titel.filter((t) => t.parentId == null).sort((a, b) => a.reihenfolge - b.reihenfolge)
  const kinderVon = (id: string) =>
    lv.titel.filter((t) => t.parentId === id).sort((a, b) => a.reihenfolge - b.reihenfolge)

  // Flache Liste aller Titel/Untertitel für das „Verschieben"-Dropdown.
  const titelOptionen: { id: string; label: string }[] = []
  for (const top of tops) {
    titelOptionen.push({ id: top.id, label: `${top.nummer} ${top.bezeichnung}` })
    for (const k of kinderVon(top.id)) titelOptionen.push({ id: k.id, label: ` ${k.nummer} ${k.bezeichnung}` })
  }

  const gesamt = tops.reduce(
    (s, top) => s + aktiveSumme(top.positionen) + kinderVon(top.id).reduce((ks, k) => ks + aktiveSumme(k.positionen), 0),
    0,
  )

  const titelProps = { lvId: lvId!, run, titelOptionen, onPickKatalog: setPickerTitelId }

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
          <div className="flex items-center gap-4">
            <button
              onClick={() => run(() => api.post(`/lvs/${lvId}/ordnungszahlen`))}
              disabled={busy}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-[12px] text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Nummern neu generieren
            </button>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-gray-400">Summe netto</div>
              <div className="text-[15px] font-semibold text-gray-900">{formatEUR(gesamt)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {tops.map((top) => (
          <TitelBlock key={top.id} titel={top} kinder={kinderVon(top.id)} {...titelProps} />
        ))}

        <div className="mt-4 flex gap-2">
          <input
            value={neuerTitel}
            onChange={(e) => setNeuerTitel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && neuerTitel.trim() && run(() => api.post(`/lvs/${lvId}/titel`, { bezeichnung: neuerTitel }).then(() => setNeuerTitel('')))}
            placeholder="Neuer Titel – z. B. „Erdarbeiten“"
            className="max-w-md flex-1 rounded-md border border-gray-300 px-3 py-2 text-[13px] outline-none focus:border-gray-900"
          />
          <button
            onClick={() => run(() => api.post(`/lvs/${lvId}/titel`, { bezeichnung: neuerTitel }).then(() => setNeuerTitel('')))}
            disabled={!neuerTitel.trim() || busy}
            className="rounded-md border border-gray-300 px-4 text-[12px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Titel hinzufügen
          </button>
        </div>
      </div>

      {pickerTitelId && (
        <KatalogPicker
          onClose={() => setPickerTitelId(null)}
          onPick={(pos) => {
            const titelId = pickerTitelId
            setPickerTitelId(null)
            run(() => api.post(`/lvs/${lvId}/positionen`, { titelId, katalogPosId: pos.id, menge: 1 }))
          }}
        />
      )}
    </div>
  )
}

interface TitelProps {
  lvId: string
  run: (fn: () => Promise<unknown>) => Promise<void>
  titelOptionen: { id: string; label: string }[]
  onPickKatalog: (titelId: string) => void
}

function TitelBlock({
  titel,
  kinder,
  lvId,
  run,
  titelOptionen,
  onPickKatalog,
}: TitelProps & { titel: LVTitel; kinder: LVTitel[] }) {
  const summe = aktiveSumme(titel.positionen) + kinder.reduce((s, k) => s + aktiveSumme(k.positionen), 0)
  return (
    <div className="mb-5">
      <TitelKopf titel={titel} summe={summe} top run={run} lvId={lvId} onPickKatalog={onPickKatalog} />
      <PositionTabelle positionen={titel.positionen} lvId={lvId} run={run} titelOptionen={titelOptionen} />
      {kinder.map((k) => (
        <div key={k.id} className="ml-5 mt-3">
          <TitelKopf titel={k} summe={aktiveSumme(k.positionen)} top={false} run={run} lvId={lvId} onPickKatalog={onPickKatalog} />
          <PositionTabelle positionen={k.positionen} lvId={lvId} run={run} titelOptionen={titelOptionen} />
        </div>
      ))}
    </div>
  )
}

function TitelKopf({
  titel,
  summe,
  top,
  run,
  lvId,
  onPickKatalog,
}: {
  titel: LVTitel
  summe: number
  top: boolean
  run: TitelProps['run']
  lvId: string
  onPickKatalog: (id: string) => void
}) {
  const [bez, setBez] = useState(titel.bezeichnung)
  useEffect(() => setBez(titel.bezeichnung), [titel.bezeichnung])

  return (
    <div className="mb-1.5 flex items-center gap-2 border-b border-gray-200 pb-1">
      <span className="font-mono text-[11px] text-gray-400">{titel.nummer}</span>
      <input
        value={bez}
        onChange={(e) => setBez(e.target.value)}
        onBlur={() => bez.trim() && bez !== titel.bezeichnung && run(() => api.patch(`/titel/${titel.id}`, { bezeichnung: bez }))}
        className={`flex-1 rounded border border-transparent px-1 py-0.5 outline-none hover:border-gray-200 focus:border-gray-900 ${top ? 'text-[13px] font-semibold text-gray-900' : 'text-[12px] font-medium text-gray-800'}`}
      />
      <span className="text-[12px] text-gray-500">{formatEUR(summe)}</span>
      <button onClick={() => run(() => api.patch(`/titel/${titel.id}/reihenfolge`, { richtung: 'hoch' }))} className="text-[11px] text-gray-400 hover:text-gray-900" title="nach oben">↑</button>
      <button onClick={() => run(() => api.patch(`/titel/${titel.id}/reihenfolge`, { richtung: 'runter' }))} className="text-[11px] text-gray-400 hover:text-gray-900" title="nach unten">↓</button>
      {top && (
        <button onClick={() => run(() => api.post(`/lvs/${lvId}/titel`, { bezeichnung: 'Neuer Untertitel', parentId: titel.id }))} className="text-[11px] text-gray-500 hover:text-gray-900">+ Untertitel</button>
      )}
      <button onClick={() => onPickKatalog(titel.id)} className="text-[11px] text-gray-500 hover:text-gray-900">+ Katalog</button>
      <button onClick={() => run(() => api.post(`/lvs/${lvId}/positionen`, { titelId: titel.id, kurztext: 'Neue Position', einheit: '', menge: 0 }))} className="text-[11px] text-gray-500 hover:text-gray-900">+ leer</button>
      <button
        onClick={() => { if (confirm(`Titel „${titel.bezeichnung}" inkl. Untertitel/Positionen löschen?`)) run(() => api.delete(`/titel/${titel.id}`)) }}
        className="text-[11px] text-gray-300 hover:text-red-600"
        title="Titel löschen"
      >✕</button>
    </div>
  )
}

function PositionTabelle({
  positionen,
  lvId,
  run,
  titelOptionen,
}: {
  positionen: Position[]
  lvId: string
  run: TitelProps['run']
  titelOptionen: { id: string; label: string }[]
}) {
  if (positionen.length === 0) return <div className="py-1 text-[12px] text-gray-400">Keine Positionen.</div>
  return (
    <div className="divide-y divide-gray-100">
      {[...positionen].sort((a, b) => a.reihenfolge - b.reihenfolge).map((p) => (
        <PositionRow key={p.id} pos={p} lvId={lvId} run={run} titelOptionen={titelOptionen} />
      ))}
    </div>
  )
}

function PositionRow({
  pos,
  lvId,
  run,
  titelOptionen,
}: {
  pos: Position
  lvId: string
  run: TitelProps['run']
  titelOptionen: { id: string; label: string }[]
}) {
  const [kurztext, setKurztext] = useState(pos.kurztext)
  const [menge, setMenge] = useState(String(toNum(pos.menge)))
  const [einheit, setEinheit] = useState(pos.einheit)
  const [langtext, setLangtext] = useState(pos.langtext ?? '')
  const [open, setOpen] = useState(false)

  useEffect(() => { setKurztext(pos.kurztext); setMenge(String(toNum(pos.menge))); setEinheit(pos.einheit); setLangtext(pos.langtext ?? '') }, [pos])

  const save = (patch: Record<string, unknown>) => run(() => api.put(`/positionen/${pos.id}`, patch))
  const numField = 'w-20 rounded border border-gray-200 px-1.5 py-0.5 text-right text-[12px] outline-none focus:border-gray-900'

  return (
    <div className={`py-1.5 ${pos.entfaellt ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="w-16 font-mono text-[11px] text-gray-400">{pos.nummer}</span>
        <input
          value={kurztext}
          onChange={(e) => setKurztext(e.target.value)}
          onBlur={() => kurztext.trim() && kurztext !== pos.kurztext && save({ kurztext })}
          className={`flex-1 rounded border border-transparent px-1 py-0.5 text-[12px] outline-none hover:border-gray-200 focus:border-gray-900 ${pos.entfaellt ? 'line-through' : 'text-gray-900'}`}
        />
        <input
          value={menge}
          onChange={(e) => setMenge(e.target.value)}
          onBlur={() => { const n = Number(menge.replace(',', '.')); if (!Number.isNaN(n) && n !== toNum(pos.menge)) save({ menge: n }) }}
          className={numField}
        />
        <input
          value={einheit}
          onChange={(e) => setEinheit(e.target.value)}
          onBlur={() => einheit !== pos.einheit && save({ einheit })}
          className="w-12 rounded border border-gray-200 px-1.5 py-0.5 text-[12px] outline-none focus:border-gray-900"
          placeholder="Einh."
        />
        <span className="w-24 text-right text-[12px] text-gray-500">{pos.kalkulation?.einheitspreis != null ? formatEUR(pos.kalkulation.einheitspreis) : '–'}</span>
        <span className="w-28 text-right text-[12px] text-gray-900">{pos.kalkulation?.gesamtpreis != null ? formatEUR(pos.kalkulation.gesamtpreis) : '–'}</span>
        <button onClick={() => run(() => api.patch(`/positionen/${pos.id}/reihenfolge`, { richtung: 'hoch' }))} className="text-[11px] text-gray-400 hover:text-gray-900" title="nach oben">↑</button>
        <button onClick={() => run(() => api.patch(`/positionen/${pos.id}/reihenfolge`, { richtung: 'runter' }))} className="text-[11px] text-gray-400 hover:text-gray-900" title="nach unten">↓</button>
        <button onClick={() => setOpen((o) => !o)} className="text-[11px] text-gray-400 hover:text-gray-900" title="Details">⋯</button>
        <Link to={`positionen/${pos.id}/kalkulation`} className="text-[11px] text-gray-500 hover:text-gray-900">Kalk.</Link>
        <button onClick={() => { if (confirm('Position löschen?')) run(() => api.delete(`/positionen/${pos.id}`)) }} className="text-[11px] text-gray-300 hover:text-red-600">✕</button>
      </div>

      {open && (
        <div className="ml-16 mt-1.5 space-y-2 rounded-md bg-gray-50 p-2.5">
          <div className="flex flex-wrap items-center gap-3 text-[12px]">
            <label className="flex items-center gap-1.5">
              <span className="text-gray-500">Typ</span>
              <select
                value={pos.typ}
                onChange={(e) => save({ typ: e.target.value })}
                className="rounded border border-gray-300 px-1.5 py-1 text-[12px] outline-none focus:border-gray-900"
              >
                {(['normal', 'alternativ', 'eventualposition', 'pauschale'] as const).map((t) => (
                  <option key={t} value={t}>{TYP_LABEL[t]}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={pos.entfaellt} onChange={(e) => save({ entfaellt: e.target.checked })} />
              <span className="text-gray-600">entfällt</span>
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-gray-500">Verschieben nach</span>
              <select
                value=""
                onChange={(e) => e.target.value && save({ titelId: e.target.value })}
                className="rounded border border-gray-300 px-1.5 py-1 text-[12px] outline-none focus:border-gray-900"
              >
                <option value="">Titel wählen …</option>
                {titelOptionen.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
          <textarea
            value={langtext}
            onChange={(e) => setLangtext(e.target.value)}
            onBlur={() => langtext !== (pos.langtext ?? '') && save({ langtext: langtext || null })}
            placeholder="Langtext …"
            rows={3}
            className="w-full rounded border border-gray-200 px-2 py-1 text-[12px] outline-none focus:border-gray-900"
          />
        </div>
      )}
    </div>
  )
}
