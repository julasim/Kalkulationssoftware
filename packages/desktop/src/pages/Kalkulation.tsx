import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { formatEUR, toNum } from '../lib/format'
import BetriebsmittelPicker from '../components/BetriebsmittelPicker'
import type { Betriebsmittel, BetriebsmittelArt, KalkulationGet, Zuschlagsschema } from '../lib/types'

const num = (s: string) => {
  const x = Number(String(s).replace(',', '.'))
  return Number.isFinite(x) ? x : 0
}

// Zeile im UI-State — Zahlenfelder als String fürs Editieren.
interface Zeile {
  art: BetriebsmittelArt
  betriebsmittelId: string | null
  bezeichnung: string
  einheit: string
  menge: string
  einzelpreis: string
  aufschlag: string
}

interface PosInfo { id: string; nummer: string; kurztext: string; einheit: string; menge: string | number }

const SECTIONS: { art: BetriebsmittelArt; label: string; optional: boolean }[] = [
  { art: 'lohn', label: 'Lohn', optional: false },
  { art: 'material', label: 'Material', optional: true },
  { art: 'geraet', label: 'Geräte', optional: true },
  { art: 'nu', label: 'Nachunternehmer', optional: true },
  { art: 'sonstiges', label: 'Sonstiges', optional: false },
]

const inp = 'rounded border border-gray-200 px-1.5 py-0.5 text-[12px] outline-none focus:border-gray-900'

function zeileKosten(z: Zeile) {
  // Aufschlag nur bei Material — konsistent mit der Speicher-Logik (save) und der
  // Backend-Engine, die für die übrigen Arten aufschlag=0 erhält.
  const aufschlag = z.art === 'material' ? num(z.aufschlag) : 0
  return num(z.menge) * num(z.einzelpreis) * (1 + aufschlag / 100)
}

function neueZeile(art: BetriebsmittelArt): Zeile {
  const betrag = art === 'nu' || art === 'sonstiges'
  return {
    art,
    betriebsmittelId: null,
    bezeichnung: '',
    einheit: art === 'lohn' ? 'h' : '',
    menge: betrag ? '1' : '1',
    einzelpreis: '',
    aufschlag: '0',
  }
}

export default function Kalkulation() {
  const { positionId } = useParams()
  const navigate = useNavigate()

  const [pos, setPos] = useState<PosInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [agk, setAgk] = useState('5')
  const [gu, setGu] = useState('3')
  const [gewinn, setGewinn] = useState('3')
  const [zeilen, setZeilen] = useState<Zeile[]>([])
  const [extra, setExtra] = useState<Set<BetriebsmittelArt>>(new Set())
  const [schemas, setSchemas] = useState<Zuschlagsschema[]>([])
  const [picker, setPicker] = useState<BetriebsmittelArt | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get<KalkulationGet>(`/positionen/${positionId}/kalkulation`),
      api.get<{ zuschlagsschemata: Zuschlagsschema[] }>('/zuschlagsschemata').catch(() => ({ zuschlagsschemata: [] })),
    ])
      .then(([res, sres]) => {
        setPos(res.position)
        setSchemas(sres.zuschlagsschemata)
        const k = res.kalkulation
        const std = res.standardSchema
        if (k) {
          setAgk(String(toNum(k.agkProzent)))
          setGu(String(toNum(k.guProzent)))
          setGewinn(String(toNum(k.gewinnProzent)))
          const zs: Zeile[] = k.zeilen.map((z) => ({
            art: z.art,
            betriebsmittelId: z.betriebsmittelId,
            bezeichnung: z.bezeichnung,
            einheit: z.einheit,
            menge: String(toNum(z.menge)),
            einzelpreis: String(toNum(z.einzelpreis)),
            aufschlag: String(toNum(z.aufschlag)),
          }))
          setZeilen(zs)
          setExtra(new Set(zs.map((z) => z.art).filter((a) => a === 'material' || a === 'geraet' || a === 'nu')))
        } else {
          // Neue/leere Kalkulation: State zurücksetzen, sonst bleiben beim Wechsel
          // zwischen Positionen die Zeilen/Zuschläge der vorherigen Position erhalten.
          setZeilen([])
          setExtra(new Set())
          setAgk(String(toNum(std?.agkProzent ?? 5)))
          setGu(String(toNum(std?.guProzent ?? 3)))
          setGewinn(String(toNum(std?.gewinnProzent ?? 3)))
        }
      })
      .finally(() => setLoading(false))
  }, [positionId])

  const calc = useMemo(() => {
    const epBasis = zeilen.reduce((s, z) => s + zeileKosten(z), 0)
    const faktor = (1 + num(agk) / 100) * (1 + num(gu) / 100) * (1 + num(gewinn) / 100)
    const ep = epBasis * faktor
    return { epBasis, faktor, ep, gesamt: ep * toNum(pos?.menge) }
  }, [zeilen, agk, gu, gewinn, pos])

  function update(idx: number, patch: Partial<Zeile>) {
    setZeilen((zs) => zs.map((z, i) => (i === idx ? { ...z, ...patch } : z)))
  }
  function add(art: BetriebsmittelArt) {
    setZeilen((zs) => [...zs, neueZeile(art)])
  }
  function remove(idx: number) {
    setZeilen((zs) => zs.filter((_, i) => i !== idx))
  }
  function pickInto(art: BetriebsmittelArt, b: Betriebsmittel) {
    const z: Zeile = {
      art,
      betriebsmittelId: b.id,
      bezeichnung: b.bezeichnung,
      einheit: b.einheit,
      menge: '1',
      einzelpreis: String(toNum(b.kostenProEinheit)),
      aufschlag: art === 'material' ? String(toNum(b.aufschlag)) : '0',
    }
    setZeilen((zs) => [...zs, z])
    setPicker(null)
  }
  function applySchema(id: string) {
    const s = schemas.find((x) => x.id === id)
    if (!s) return
    setAgk(String(toNum(s.agkProzent)))
    setGu(String(toNum(s.guProzent)))
    setGewinn(String(toNum(s.gewinnProzent)))
  }

  async function save() {
    setSaving(true)
    setSaveError(null)
    try {
      await api.put(`/positionen/${positionId}/kalkulation`, {
        agkProzent: num(agk),
        guProzent: num(gu),
        gewinnProzent: num(gewinn),
        zeilen: zeilen.map((z) => ({
          art: z.art,
          betriebsmittelId: z.betriebsmittelId,
          bezeichnung: z.bezeichnung,
          einheit: z.art === 'lohn' ? 'h' : z.einheit,
          menge: z.art === 'nu' || z.art === 'sonstiges' ? 1 : num(z.menge),
          einzelpreis: num(z.einzelpreis),
          aufschlag: z.art === 'material' ? num(z.aufschlag) : 0,
        })),
      })
      navigate(-1)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-[13px] text-gray-400">Lädt …</div>
  if (!pos) return <div className="p-6 text-[13px] text-gray-400">Position nicht gefunden.</div>

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div>
          <button onClick={() => navigate(-1)} className="text-[11px] text-gray-400 hover:text-gray-700">
            ← zurück zum LV
          </button>
          <div className="mt-1 text-lg font-semibold text-gray-900">
            <span className="mr-2 font-mono text-[12px] text-gray-400">{pos.nummer}</span>
            {pos.kurztext}
          </div>
          <div className="text-[12px] text-gray-400">
            Menge {toNum(pos.menge)} {pos.einheit}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saveError && <span className="text-[12px] text-red-600">{saveError}</span>}
          <button onClick={save} disabled={saving} className="rounded-md bg-gray-900 px-4 py-2 text-[12px] font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {saving ? 'Speichern …' : 'Speichern'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {SECTIONS.map((sec) => {
            const rows = zeilen.map((z, i) => ({ z, i })).filter((r) => r.z.art === sec.art)
            const visible = !sec.optional || extra.has(sec.art) || rows.length > 0
            if (!visible) {
              return (
                <button
                  key={sec.art}
                  onClick={() => setExtra((s) => new Set(s).add(sec.art))}
                  className="block text-[12px] text-gray-500 hover:text-gray-900"
                >
                  + {sec.label} hinzufügen
                </button>
              )
            }
            const summe = rows.reduce((s, r) => s + zeileKosten(r.z), 0)
            return (
              <div key={sec.art}>
                <div className="mb-1.5 flex items-center justify-between border-b border-gray-200 pb-1">
                  <span className="text-[12px] font-semibold text-gray-900">{sec.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-gray-500">{formatEUR(summe)}</span>
                    <button onClick={() => setPicker(sec.art)} className="text-[11px] text-gray-500 hover:text-gray-900">
                      aus Stammdaten
                    </button>
                    <button onClick={() => add(sec.art)} className="text-[11px] text-gray-500 hover:text-gray-900">
                      + Zeile
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {rows.length === 0 && <div className="py-1 text-[12px] text-gray-400">Keine Zeilen.</div>}
                  {rows.map(({ z, i }) => (
                    <ZeileRow key={i} z={z} onChange={(p) => update(i, p)} onRemove={() => remove(i)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="w-72 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-gray-50 px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Zuschläge</span>
            {schemas.length > 0 && (
              <select
                onChange={(e) => {
                  if (e.target.value) applySchema(e.target.value)
                  e.target.value = ''
                }}
                defaultValue=""
                className="rounded border border-gray-200 px-1 py-0.5 text-[10px] text-gray-600 outline-none focus:border-gray-900"
              >
                <option value="">Schema …</option>
                {schemas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.bezeichnung}
                  </option>
                ))}
              </select>
            )}
          </div>
          {[
            { l: 'AGK %', v: agk, set: setAgk },
            { l: 'GU %', v: gu, set: setGu },
            { l: 'Gewinn %', v: gewinn, set: setGewinn },
          ].map((r) => (
            <div key={r.l} className="mb-2 flex items-center justify-between">
              <span className="text-[12px] text-gray-600">{r.l}</span>
              <input className={`${inp} w-20 text-right`} value={r.v} onChange={(e) => r.set(e.target.value)} />
            </div>
          ))}

          <div className="my-4 border-t border-gray-200" />
          <Row l="EP-Basis" v={formatEUR(calc.epBasis)} />
          <Row l={`× Faktor ${calc.faktor.toFixed(4)}`} v="" />
          <div className="my-3 border-t border-gray-200" />
          <Row l="Einheitspreis" v={formatEUR(calc.ep)} strong />
          <Row l={`Gesamt (× ${toNum(pos.menge)})`} v={formatEUR(calc.gesamt)} strong />
        </div>
      </div>

      {picker && (
        <BetriebsmittelPicker art={picker} onClose={() => setPicker(null)} onPick={(b) => pickInto(picker, b)} />
      )}
    </div>
  )
}

function ZeileRow({ z, onChange, onRemove }: { z: Zeile; onChange: (p: Partial<Zeile>) => void; onRemove: () => void }) {
  const betrag = z.art === 'nu' || z.art === 'sonstiges'
  return (
    <div className="flex items-center gap-2">
      <input
        className={`${inp} flex-1`}
        placeholder="Bezeichnung"
        value={z.bezeichnung}
        onChange={(e) => onChange({ bezeichnung: e.target.value })}
      />
      {z.art === 'lohn' && (
        <>
          <input className={`${inp} w-20 text-right`} placeholder="h/Einh." value={z.menge} onChange={(e) => onChange({ menge: e.target.value })} />
          <input className={`${inp} w-24 text-right`} placeholder="€/h" value={z.einzelpreis} onChange={(e) => onChange({ einzelpreis: e.target.value })} />
        </>
      )}
      {(z.art === 'material' || z.art === 'geraet') && (
        <>
          <input className={`${inp} w-12`} placeholder="Einh." value={z.einheit} onChange={(e) => onChange({ einheit: e.target.value })} />
          <input className={`${inp} w-16 text-right`} placeholder="Menge" value={z.menge} onChange={(e) => onChange({ menge: e.target.value })} />
          <input className={`${inp} w-20 text-right`} placeholder="€/Einh." value={z.einzelpreis} onChange={(e) => onChange({ einzelpreis: e.target.value })} />
        </>
      )}
      {z.art === 'material' && (
        <input className={`${inp} w-16 text-right`} placeholder="% Aufschl." value={z.aufschlag} onChange={(e) => onChange({ aufschlag: e.target.value })} />
      )}
      {betrag && (
        <input className={`${inp} w-28 text-right`} placeholder="Betrag €" value={z.einzelpreis} onChange={(e) => onChange({ einzelpreis: e.target.value })} />
      )}
      <button onClick={onRemove} className="text-[12px] text-gray-300 hover:text-red-600">
        ✕
      </button>
    </div>
  )
}

function Row({ l, v, strong }: { l: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={`text-[12px] ${strong ? 'font-medium text-gray-900' : 'text-gray-500'}`}>{l}</span>
      <span className={`text-[13px] ${strong ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{v}</span>
    </div>
  )
}
