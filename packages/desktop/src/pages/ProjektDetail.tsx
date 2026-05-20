import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { LV, Projekt } from '../lib/types'

interface ProjektMitLvs extends Projekt {
  lvs: LV[]
}

export default function ProjektDetail() {
  const { projektId } = useParams()
  const navigate = useNavigate()
  const [projekt, setProjekt] = useState<ProjektMitLvs | null>(null)
  const [loading, setLoading] = useState(true)
  const [bezeichnung, setBezeichnung] = useState('')
  const [busy, setBusy] = useState(false)

  function load() {
    setLoading(true)
    api
      .get<ProjektMitLvs>(`/projekte/${projektId}`)
      .then(setProjekt)
      .finally(() => setLoading(false))
  }
  useEffect(load, [projektId])

  async function createLv() {
    if (!bezeichnung.trim()) return
    setBusy(true)
    try {
      const lv = await api.post<LV>(`/projekte/${projektId}/lvs`, { bezeichnung })
      setBezeichnung('')
      navigate(`/lvs/${lv.id}`)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="p-6 text-[13px] text-gray-400">Lädt …</div>
  if (!projekt) return <div className="p-6 text-[13px] text-gray-400">Projekt nicht gefunden.</div>

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-gray-200 px-6 py-4">
        <Link to="/projekte" className="text-[11px] text-gray-400 hover:text-gray-700">
          ← Projekte
        </Link>
        <div className="mt-1 text-lg font-semibold text-gray-900">{projekt.name}</div>
        {projekt.ort && <div className="text-[12px] text-gray-400">{projekt.ort}</div>}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mb-3 text-[12px] font-medium uppercase tracking-wider text-gray-400">
          Leistungsverzeichnisse
        </div>

        <div className="mb-4 flex gap-2">
          <input
            value={bezeichnung}
            onChange={(e) => setBezeichnung(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createLv()}
            placeholder="Neues LV – Bezeichnung"
            className="flex-1 max-w-md rounded-md border border-gray-300 px-3 py-2 text-[13px] outline-none focus:border-gray-900"
          />
          <button
            onClick={createLv}
            disabled={busy || !bezeichnung.trim()}
            className="rounded-md bg-gray-900 px-4 text-[12px] font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            LV anlegen
          </button>
        </div>

        {projekt.lvs.length === 0 ? (
          <div className="text-[13px] text-gray-400">Noch kein LV in diesem Projekt.</div>
        ) : (
          <div className="space-y-1.5">
            {projekt.lvs.map((lv) => (
              <button
                key={lv.id}
                onClick={() => navigate(`/lvs/${lv.id}`)}
                className="flex w-full items-center gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 text-left hover:bg-gray-50"
              >
                <span className="flex-1 text-[13px] font-medium text-gray-900">{lv.bezeichnung}</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">v{lv.version}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
