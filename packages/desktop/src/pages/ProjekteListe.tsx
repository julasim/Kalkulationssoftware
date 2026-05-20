import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Projekt } from '../lib/types'

const STATUS_LABEL: Record<string, string> = {
  offen: 'Offen',
  in_arbeit: 'In Arbeit',
  abgeschlossen: 'Abgeschlossen',
  archiviert: 'Archiviert',
}

export default function ProjekteListe() {
  const navigate = useNavigate()
  const [projekte, setProjekte] = useState<Projekt[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [ort, setOrt] = useState('')
  const [busy, setBusy] = useState(false)

  function load() {
    setLoading(true)
    api
      .get<{ projekte: Projekt[] }>('/projekte')
      .then((res) => setProjekte(res.projekte))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    try {
      const p = await api.post<Projekt>('/projekte', { name, ort })
      setName('')
      setOrt('')
      setShowForm(false)
      navigate(`/projekte/${p.id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div>
          <div className="text-lg font-semibold text-gray-900">Projekte</div>
          <div className="mt-0.5 text-[12px] text-gray-400">{projekte.length} Projekte</div>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-gray-800"
        >
          Neues Projekt
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {showForm && (
          <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-4">
            <div className="flex gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
                placeholder="Projektname"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-[13px] outline-none focus:border-gray-900"
              />
              <input
                value={ort}
                onChange={(e) => setOrt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
                placeholder="Ort (optional)"
                className="w-40 rounded-md border border-gray-300 px-3 py-2 text-[13px] outline-none focus:border-gray-900"
              />
              <button
                onClick={create}
                disabled={busy || !name.trim()}
                className="rounded-md bg-gray-900 px-4 text-[12px] font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                Anlegen
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-[13px] text-gray-400">Lädt …</div>
        ) : projekte.length === 0 ? (
          <div className="text-[13px] text-gray-400">Noch keine Projekte. Lege das erste an.</div>
        ) : (
          <div className="space-y-1.5">
            {projekte.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/projekte/${p.id}`)}
                className="flex w-full items-center gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 text-left hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-gray-900">{p.name}</div>
                  {p.ort && <div className="text-[11px] text-gray-400">{p.ort}</div>}
                </div>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
                <span className="text-[11px] text-gray-400">{p._count?.lvs ?? 0} LV</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
