import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { formatEUR, toNum } from '../lib/format'

const num = (s: string) => {
  const x = Number(String(s).replace(',', '.'))
  return Number.isFinite(x) ? x : 0
}

interface Lohn { bezeichnung: string; aufwandswert: string; stundensatz: string }
interface Material { bezeichnung: string; menge: string; einheit: string; preis: string; aufschlag: string }
interface Geraet { bezeichnung: string; menge: string; einheit: string; preis: string }
interface Betrag { bezeichnung: string; betrag: string }

interface PosInfo { id: string; nummer: string; kurztext: string; einheit: string; menge: string | number }

export default function Kalkulation() {
  const { positionId } = useParams()
  const navigate = useNavigate()

  const [pos, setPos] = useState<PosInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [agk, setAgk] = useState('5')
  const [gu, setGu] = useState('3')
  const [gewinn, setGewinn] = useState('3')
  const [lohn, setLohn] = useState<Lohn[]>([])
  const [material, setMaterial] = useState<Material[]>([])
  const [geraet, setGeraet] = useState<Geraet[]>([])
  const [nu, setNu] = useState<Betrag[]>([])
  const [sonstiges, setSonstiges] = useState<Betrag[]>([])

  useEffect(() => {
    setLoading(true)
    api
      .get<{ position: PosInfo; kalkulation: any }>(`/positionen/${positionId}/kalkulation`)
      .then(({ position, kalkulation }) => {
        setPos(position)
        if (kalkulation) {
          setAgk(String(toNum(kalkulation.agkProzent)))
          setGu(String(toNum(kalkulation.guProzent)))
          setGewinn(String(toNum(kalkulation.gewinnProzent)))
          setLohn((kalkulation.lohnzeilen ?? []).map((z: any) => ({
            bezeichnung: z.bezeichnung, aufwandswert: String(toNum(z.aufwandswert)), stundensatz: String(toNum(z.stundensatz)),
          })))
          setMaterial((kalkulation.materialzeilen ?? []).map((z: any) => ({
            bezeichnung: z.bezeichnung, menge: String(toNum(z.menge)), einheit: z.einheit, preis: String(toNum(z.preis)), aufschlag: String(toNum(z.aufschlag)),
          })))
          setGeraet((kalkulation.geraetezeilen ?? []).map((z: any) => ({
            bezeichnung: z.bezeichnung, menge: String(toNum(z.menge)), einheit: z.einheit, preis: String(toNum(z.preis)),
          })))
          setNu((kalkulation.nuZeilen ?? []).map((z: any) => ({ bezeichnung: z.bezeichnung, betrag: String(toNum(z.betrag)) })))
          setSonstiges((kalkulation.sonstigeZeilen ?? []).map((z: any) => ({ bezeichnung: z.bezeichnung, betrag: String(toNum(z.betrag)) })))
        }
      })
      .finally(() => setLoading(false))
  }, [positionId])

  const calc = useMemo(() => {
    const lohnS = lohn.reduce((s, z) => s + num(z.aufwandswert) * num(z.stundensatz), 0)
    const matS = material.reduce((s, z) => s + num(z.menge) * num(z.preis) * (1 + num(z.aufschlag) / 100), 0)
    const gerS = geraet.reduce((s, z) => s + num(z.menge) * num(z.preis), 0)
    const nuS = nu.reduce((s, z) => s + num(z.betrag), 0)
    const sonS = sonstiges.reduce((s, z) => s + num(z.betrag), 0)
    const epBasis = lohnS + matS + gerS + nuS + sonS
    const faktor = (1 + num(agk) / 100) * (1 + num(gu) / 100) * (1 + num(gewinn) / 100)
    const ep = epBasis * faktor
    const menge = toNum(pos?.menge)
    return { lohnS, matS, gerS, nuS, sonS, epBasis, faktor, ep, gesamt: ep * menge }
  }, [lohn, material, geraet, nu, sonstiges, agk, gu, gewinn, pos])

  async function save() {
    setSaving(true)
    try {
      await api.put(`/positionen/${positionId}/kalkulation`, {
        agkProzent: num(agk), guProzent: num(gu), gewinnProzent: num(gewinn),
        lohnzeilen: lohn.map((z) => ({ bezeichnung: z.bezeichnung, aufwandswert: num(z.aufwandswert), stundensatz: num(z.stundensatz) })),
        materialzeilen: material.map((z) => ({ bezeichnung: z.bezeichnung, menge: num(z.menge), einheit: z.einheit, preis: num(z.preis), aufschlag: num(z.aufschlag) })),
        geraetezeilen: geraet.map((z) => ({ bezeichnung: z.bezeichnung, menge: num(z.menge), einheit: z.einheit, preis: num(z.preis) })),
        nuZeilen: nu.map((z) => ({ bezeichnung: z.bezeichnung, betrag: num(z.betrag) })),
        sonstigeZeilen: sonstiges.map((z) => ({ bezeichnung: z.bezeichnung, betrag: num(z.betrag) })),
      })
      navigate(-1)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-[13px] text-gray-400">Lädt …</div>
  if (!pos) return <div className="p-6 text-[13px] text-gray-400">Position nicht gefunden.</div>

  const inp = 'rounded border border-gray-200 px-1.5 py-0.5 text-[12px] outline-none focus:border-gray-900'

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
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-gray-900 px-4 py-2 text-[12px] font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Speichern …' : 'Speichern'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {/* Lohn */}
          <Section title="Lohn" sum={formatEUR(calc.lohnS)} onAdd={() => setLohn([...lohn, { bezeichnung: '', aufwandswert: '', stundensatz: '' }])}>
            {lohn.map((z, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={`${inp} flex-1`} placeholder="Bezeichnung" value={z.bezeichnung} onChange={(e) => setLohn(upd(lohn, i, { bezeichnung: e.target.value }))} />
                <input className={`${inp} w-24 text-right`} placeholder="h/Einh." value={z.aufwandswert} onChange={(e) => setLohn(upd(lohn, i, { aufwandswert: e.target.value }))} />
                <input className={`${inp} w-24 text-right`} placeholder="€/h" value={z.stundensatz} onChange={(e) => setLohn(upd(lohn, i, { stundensatz: e.target.value }))} />
                <Del onClick={() => setLohn(lohn.filter((_, j) => j !== i))} />
              </div>
            ))}
          </Section>

          {/* Material */}
          <Section title="Material" sum={formatEUR(calc.matS)} onAdd={() => setMaterial([...material, { bezeichnung: '', menge: '', einheit: '', preis: '', aufschlag: '0' }])}>
            {material.map((z, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={`${inp} flex-1`} placeholder="Bezeichnung" value={z.bezeichnung} onChange={(e) => setMaterial(upd(material, i, { bezeichnung: e.target.value }))} />
                <input className={`${inp} w-16 text-right`} placeholder="Menge" value={z.menge} onChange={(e) => setMaterial(upd(material, i, { menge: e.target.value }))} />
                <input className={`${inp} w-12`} placeholder="Einh." value={z.einheit} onChange={(e) => setMaterial(upd(material, i, { einheit: e.target.value }))} />
                <input className={`${inp} w-20 text-right`} placeholder="€/Einh." value={z.preis} onChange={(e) => setMaterial(upd(material, i, { preis: e.target.value }))} />
                <input className={`${inp} w-16 text-right`} placeholder="% Aufschl." value={z.aufschlag} onChange={(e) => setMaterial(upd(material, i, { aufschlag: e.target.value }))} />
                <Del onClick={() => setMaterial(material.filter((_, j) => j !== i))} />
              </div>
            ))}
          </Section>

          {/* Geräte */}
          <Section title="Geräte" sum={formatEUR(calc.gerS)} onAdd={() => setGeraet([...geraet, { bezeichnung: '', menge: '', einheit: '', preis: '' }])}>
            {geraet.map((z, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={`${inp} flex-1`} placeholder="Bezeichnung" value={z.bezeichnung} onChange={(e) => setGeraet(upd(geraet, i, { bezeichnung: e.target.value }))} />
                <input className={`${inp} w-16 text-right`} placeholder="Menge" value={z.menge} onChange={(e) => setGeraet(upd(geraet, i, { menge: e.target.value }))} />
                <input className={`${inp} w-12`} placeholder="Einh." value={z.einheit} onChange={(e) => setGeraet(upd(geraet, i, { einheit: e.target.value }))} />
                <input className={`${inp} w-20 text-right`} placeholder="€/Einh." value={z.preis} onChange={(e) => setGeraet(upd(geraet, i, { preis: e.target.value }))} />
                <Del onClick={() => setGeraet(geraet.filter((_, j) => j !== i))} />
              </div>
            ))}
          </Section>

          {/* Nachunternehmer */}
          <Section title="Nachunternehmer" sum={formatEUR(calc.nuS)} onAdd={() => setNu([...nu, { bezeichnung: '', betrag: '' }])}>
            {nu.map((z, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={`${inp} flex-1`} placeholder="Bezeichnung" value={z.bezeichnung} onChange={(e) => setNu(upd(nu, i, { bezeichnung: e.target.value }))} />
                <input className={`${inp} w-24 text-right`} placeholder="€/Einh." value={z.betrag} onChange={(e) => setNu(upd(nu, i, { betrag: e.target.value }))} />
                <Del onClick={() => setNu(nu.filter((_, j) => j !== i))} />
              </div>
            ))}
          </Section>

          {/* Sonstiges */}
          <Section title="Sonstiges" sum={formatEUR(calc.sonS)} onAdd={() => setSonstiges([...sonstiges, { bezeichnung: '', betrag: '' }])}>
            {sonstiges.map((z, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={`${inp} flex-1`} placeholder="Bezeichnung" value={z.bezeichnung} onChange={(e) => setSonstiges(upd(sonstiges, i, { bezeichnung: e.target.value }))} />
                <input className={`${inp} w-24 text-right`} placeholder="€/Einh." value={z.betrag} onChange={(e) => setSonstiges(upd(sonstiges, i, { betrag: e.target.value }))} />
                <Del onClick={() => setSonstiges(sonstiges.filter((_, j) => j !== i))} />
              </div>
            ))}
          </Section>
        </div>

        {/* Zusammenfassung */}
        <div className="w-72 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-gray-50 px-5 py-4">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-gray-400">Zuschläge</div>
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
    </div>
  )
}

function upd<T>(arr: T[], i: number, patch: Partial<T>): T[] {
  return arr.map((x, j) => (j === i ? { ...x, ...patch } : x))
}

function Section({ title, sum, onAdd, children }: { title: string; sum: string; onAdd: () => void; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between border-b border-gray-200 pb-1">
        <span className="text-[12px] font-semibold text-gray-900">{title}</span>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-gray-500">{sum}</span>
          <button onClick={onAdd} className="text-[11px] text-gray-500 hover:text-gray-900">+ Zeile</button>
        </div>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Del({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[12px] text-gray-300 hover:text-red-600">✕</button>
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
