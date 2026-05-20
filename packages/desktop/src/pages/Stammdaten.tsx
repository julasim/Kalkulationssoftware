import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatEUR, formatNum, toNum } from '../lib/format'
import type { Betriebsmittel, BetriebsmittelArt, Zuschlagsschema } from '../lib/types'

const num = (s: string) => {
  const x = Number(String(s).replace(',', '.'))
  return Number.isFinite(x) ? x : 0
}

type Toast = (kind: 'ok' | 'err', msg: string) => void

const TABS = [
  { key: 'lohn', label: 'Löhne' },
  { key: 'material', label: 'Material' },
  { key: 'geraet', label: 'Geräte' },
  { key: 'sonstiges', label: 'Sonstiges' },
  { key: 'nu', label: 'Nachunternehmer' },
  { key: 'zuschlag', label: 'Zuschläge' },
] as const
type Tab = (typeof TABS)[number]['key']

const inp = 'rounded border border-gray-200 px-2 py-1 text-[12px] outline-none focus:border-gray-900'
const btnPrimary = 'rounded-md bg-gray-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-gray-800 disabled:opacity-50'

function artConfig(art: BetriebsmittelArt) {
  return {
    einheit: art !== 'lohn',
    aufschlag: art === 'material',
    kostenLabel: art === 'lohn' ? '€/h' : art === 'material' || art === 'geraet' ? '€/Einh.' : 'Betrag',
    defaultEinheit: art === 'lohn' ? 'h' : '',
  }
}

interface Draft {
  bezeichnung: string
  einheit: string
  kostenProEinheit: string
  aufschlag: string
}
const emptyDraft = (cfg: ReturnType<typeof artConfig>): Draft => ({
  bezeichnung: '',
  einheit: cfg.defaultEinheit,
  kostenProEinheit: '',
  aufschlag: '0',
})

export default function Stammdaten() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [tab, setTab] = useState<Tab>('lohn')
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  const showToast: Toast = (kind, msg) => {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-gray-200 px-6 pt-4">
        <div className="text-lg font-semibold text-gray-900">Stammdaten</div>
        <div className="mt-0.5 text-[12px] text-gray-400">
          Zentrale Betriebsmittel &amp; Zuschläge für die Kalkulation
        </div>
        <div className="mt-3 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-3 py-2 text-[13px] transition-colors duration-[180ms] ${
                tab === t.key
                  ? 'border-gray-900 font-medium text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {tab === 'zuschlag' ? (
          <ZuschlagPanel isAdmin={isAdmin} showToast={showToast} />
        ) : (
          <BetriebsmittelPanel key={tab} art={tab} isAdmin={isAdmin} showToast={showToast} />
        )}
      </div>

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-md px-4 py-2.5 text-[12px] shadow-lg ${
            toast.kind === 'ok' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function BetriebsmittelPanel({
  art,
  isAdmin,
  showToast,
}: {
  art: BetriebsmittelArt
  isAdmin: boolean
  showToast: Toast
}) {
  const cfg = artConfig(art)
  const [items, setItems] = useState<Betriebsmittel[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft(cfg))
  const [editId, setEditId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft(cfg))
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function load() {
    setLoading(true)
    api
      .get<{ betriebsmittel: Betriebsmittel[] }>(`/betriebsmittel?art=${art}`)
      .then((r) => setItems(r.betriebsmittel))
      .finally(() => setLoading(false))
  }
  useEffect(load, [art])

  function payload(d: Draft) {
    return {
      art,
      bezeichnung: d.bezeichnung.trim(),
      einheit: cfg.einheit ? d.einheit.trim() : 'h',
      kostenProEinheit: num(d.kostenProEinheit),
      aufschlag: cfg.aufschlag ? num(d.aufschlag) : 0,
    }
  }

  async function create() {
    if (!draft.bezeichnung.trim()) return
    try {
      await api.post('/betriebsmittel', payload(draft))
      setDraft(emptyDraft(cfg))
      setAdding(false)
      showToast('ok', 'Angelegt.')
      load()
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'Fehler beim Anlegen')
    }
  }

  function startEdit(b: Betriebsmittel) {
    setEditId(b.id)
    setEditDraft({
      bezeichnung: b.bezeichnung,
      einheit: b.einheit,
      kostenProEinheit: String(toNum(b.kostenProEinheit)),
      aufschlag: String(toNum(b.aufschlag)),
    })
  }

  async function saveEdit(id: string) {
    try {
      await api.patch(`/betriebsmittel/${id}`, payload(editDraft))
      setEditId(null)
      showToast('ok', 'Gespeichert.')
      load()
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'Fehler beim Speichern')
    }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/betriebsmittel/${id}`)
      showToast('ok', 'Gelöscht.')
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'Fehler beim Löschen')
    } finally {
      setConfirmDelete(null)
      load()
    }
  }

  const colCount = 2 + (cfg.einheit ? 1 : 0) + (cfg.aufschlag ? 1 : 0) + (isAdmin ? 1 : 0)

  return (
    <div>
      {isAdmin && (
        <div className="mb-3">
          {adding ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              <input
                autoFocus
                className={`${inp} min-w-[200px] flex-1`}
                placeholder="Bezeichnung"
                value={draft.bezeichnung}
                onChange={(e) => setDraft({ ...draft, bezeichnung: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && create()}
              />
              {cfg.einheit && (
                <input
                  className={`${inp} w-20`}
                  placeholder="Einheit"
                  value={draft.einheit}
                  onChange={(e) => setDraft({ ...draft, einheit: e.target.value })}
                />
              )}
              <input
                className={`${inp} w-28 text-right`}
                placeholder={cfg.kostenLabel}
                value={draft.kostenProEinheit}
                onChange={(e) => setDraft({ ...draft, kostenProEinheit: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && create()}
              />
              {cfg.aufschlag && (
                <input
                  className={`${inp} w-20 text-right`}
                  placeholder="Aufschl. %"
                  value={draft.aufschlag}
                  onChange={(e) => setDraft({ ...draft, aufschlag: e.target.value })}
                />
              )}
              <button onClick={create} disabled={!draft.bezeichnung.trim()} className={btnPrimary}>
                Anlegen
              </button>
              <button
                onClick={() => {
                  setAdding(false)
                  setDraft(emptyDraft(cfg))
                }}
                className="text-[12px] text-gray-400 hover:text-gray-700"
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className={btnPrimary}>
              + Eintrag hinzufügen
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-[13px] text-gray-400">Lädt …</div>
      ) : items.length === 0 ? (
        <div className="text-[13px] text-gray-400">Noch keine Einträge.</div>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-gray-400">
              <th className="py-1 font-medium">Bezeichnung</th>
              {cfg.einheit && <th className="w-20 py-1 font-medium">Einheit</th>}
              <th className="w-28 py-1 text-right font-medium">{cfg.kostenLabel}</th>
              {cfg.aufschlag && <th className="w-24 py-1 text-right font-medium">Aufschlag</th>}
              {isAdmin && <th className="w-28 py-1"></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((b) =>
              editId === b.id ? (
                <tr key={b.id} className="border-b border-gray-100">
                  <td className="py-1.5 pr-2">
                    <input
                      className={`${inp} w-full`}
                      value={editDraft.bezeichnung}
                      onChange={(e) => setEditDraft({ ...editDraft, bezeichnung: e.target.value })}
                    />
                  </td>
                  {cfg.einheit && (
                    <td className="py-1.5 pr-2">
                      <input
                        className={`${inp} w-16`}
                        value={editDraft.einheit}
                        onChange={(e) => setEditDraft({ ...editDraft, einheit: e.target.value })}
                      />
                    </td>
                  )}
                  <td className="py-1.5 text-right">
                    <input
                      className={`${inp} w-24 text-right`}
                      value={editDraft.kostenProEinheit}
                      onChange={(e) => setEditDraft({ ...editDraft, kostenProEinheit: e.target.value })}
                    />
                  </td>
                  {cfg.aufschlag && (
                    <td className="py-1.5 text-right">
                      <input
                        className={`${inp} w-16 text-right`}
                        value={editDraft.aufschlag}
                        onChange={(e) => setEditDraft({ ...editDraft, aufschlag: e.target.value })}
                      />
                    </td>
                  )}
                  <td className="py-1.5 text-right">
                    <button onClick={() => saveEdit(b.id)} className="mr-2 text-[11px] font-medium text-gray-900 hover:underline">
                      Speichern
                    </button>
                    <button onClick={() => setEditId(null)} className="text-[11px] text-gray-400 hover:text-gray-700">
                      Abbr.
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={b.id} className="border-b border-gray-100">
                  <td className="py-1.5 pr-2 text-gray-900">{b.bezeichnung}</td>
                  {cfg.einheit && <td className="py-1.5 text-gray-500">{b.einheit}</td>}
                  <td className="py-1.5 text-right text-gray-900">{formatEUR(b.kostenProEinheit)}</td>
                  {cfg.aufschlag && (
                    <td className="py-1.5 text-right text-gray-500">{formatNum(b.aufschlag)} %</td>
                  )}
                  {isAdmin && (
                    <td className="py-1.5 text-right">
                      <button onClick={() => startEdit(b)} className="mr-2 text-[11px] text-gray-500 hover:text-gray-900">
                        Bearb.
                      </button>
                      {confirmDelete === b.id ? (
                        <>
                          <button onClick={() => remove(b.id)} className="mr-1 text-[11px] font-medium text-red-600 hover:underline">
                            Löschen?
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="text-[11px] text-gray-400 hover:text-gray-700">
                            ✕
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(b.id)} className="text-[11px] text-gray-300 hover:text-red-600">
                          ✕
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

function ZuschlagPanel({ isAdmin, showToast }: { isAdmin: boolean; showToast: Toast }) {
  const [items, setItems] = useState<Zuschlagsschema[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [bez, setBez] = useState('')
  const [agk, setAgk] = useState('5')
  const [gu, setGu] = useState('3')
  const [gewinn, setGewinn] = useState('3')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function load() {
    setLoading(true)
    api
      .get<{ zuschlagsschemata: Zuschlagsschema[] }>('/zuschlagsschemata')
      .then((r) => setItems(r.zuschlagsschemata))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function create() {
    if (!bez.trim()) return
    try {
      await api.post('/zuschlagsschemata', {
        bezeichnung: bez.trim(),
        agkProzent: num(agk),
        guProzent: num(gu),
        gewinnProzent: num(gewinn),
        istStandard: items.length === 0,
      })
      setBez('')
      setAdding(false)
      showToast('ok', 'Angelegt.')
      load()
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'Fehler beim Anlegen')
    }
  }

  async function setStandard(id: string) {
    await api.patch(`/zuschlagsschemata/${id}`, { istStandard: true })
    load()
  }

  async function remove(id: string) {
    try {
      await api.delete(`/zuschlagsschemata/${id}`)
      showToast('ok', 'Gelöscht.')
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'Fehler beim Löschen')
    } finally {
      setConfirmDelete(null)
      load()
    }
  }

  return (
    <div>
      {isAdmin && (
        <div className="mb-3">
          {adding ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              <input
                autoFocus
                className={`${inp} min-w-[200px] flex-1`}
                placeholder="Bezeichnung (z. B. „Standard“)"
                value={bez}
                onChange={(e) => setBez(e.target.value)}
              />
              <input className={`${inp} w-20 text-right`} placeholder="AGK %" value={agk} onChange={(e) => setAgk(e.target.value)} />
              <input className={`${inp} w-20 text-right`} placeholder="GU %" value={gu} onChange={(e) => setGu(e.target.value)} />
              <input className={`${inp} w-20 text-right`} placeholder="Gewinn %" value={gewinn} onChange={(e) => setGewinn(e.target.value)} />
              <button onClick={create} disabled={!bez.trim()} className={btnPrimary}>
                Anlegen
              </button>
              <button onClick={() => setAdding(false)} className="text-[12px] text-gray-400 hover:text-gray-700">
                Abbrechen
              </button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className={btnPrimary}>
              + Zuschlagsschema hinzufügen
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-[13px] text-gray-400">Lädt …</div>
      ) : items.length === 0 ? (
        <div className="text-[13px] text-gray-400">Noch keine Zuschlagsschemata.</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((z) => (
            <div key={z.id} className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-4 py-2.5">
              <div className="flex-1 text-[13px] font-medium text-gray-900">
                {z.bezeichnung}
                {z.istStandard && (
                  <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-normal text-gray-500">Standard</span>
                )}
              </div>
              <div className="text-[12px] text-gray-500">
                AGK {formatNum(z.agkProzent)}% · GU {formatNum(z.guProzent)}% · Gewinn {formatNum(z.gewinnProzent)}%
              </div>
              {isAdmin && (
                <>
                  {!z.istStandard && (
                    <button onClick={() => setStandard(z.id)} className="text-[11px] text-gray-500 hover:text-gray-900">
                      Als Standard
                    </button>
                  )}
                  {confirmDelete === z.id ? (
                    <span className="flex items-center gap-1 text-[11px]">
                      <button onClick={() => remove(z.id)} className="font-medium text-red-600 hover:underline">
                        Löschen?
                      </button>
                      <button onClick={() => setConfirmDelete(null)} className="text-gray-400 hover:text-gray-700">
                        ✕
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDelete(z.id)} className="text-[11px] text-gray-300 hover:text-red-600">
                      ✕
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
