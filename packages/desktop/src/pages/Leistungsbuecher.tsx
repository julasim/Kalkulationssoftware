import { useEffect, useRef, useState, type DragEvent } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Leistungsbuch, ImportJobStatus } from '../lib/types'

interface UploadState {
  name: string
  processed: number
  total: number
  status: ImportJobStatus['status']
}

export default function Leistungsbuecher() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [buecher, setBuecher] = useState<Leistungsbuch[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [upload, setUpload] = useState<UploadState | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<number | null>(null)

  function load() {
    setLoading(true)
    api
      .get<{ leistungsbuecher: Leistungsbuch[] }>('/leistungsbuecher')
      .then((r) => setBuecher(r.leistungsbuecher))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  function stopPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }
  useEffect(() => stopPoll, [])

  function showToast(kind: 'ok' | 'err', msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4500)
  }

  function poll(jobId: string, name: string) {
    stopPoll() // ein etwaiges laufendes Intervall beenden, bevor ein neues startet
    pollRef.current = window.setInterval(async () => {
      try {
        const s = await api.get<ImportJobStatus>(`/leistungsbuecher/imports/${jobId}`)
        setUpload({ name, processed: s.processed, total: s.total, status: s.status })
        if (s.status === 'done' || s.status === 'error') {
          stopPoll()
          if (s.status === 'done') showToast('ok', `„${name}" importiert (${s.processed} Positionen).`)
          else showToast('err', s.message ?? 'Import fehlgeschlagen')
          setTimeout(() => setUpload(null), 1800)
          load()
        }
      } catch {
        stopPoll()
        setUpload(null)
      }
    }, 1000)
  }

  async function startUpload(file: File) {
    if (!file.name.toLowerCase().endsWith('.onlb')) {
      showToast('err', 'Bitte eine .onlb-Datei wählen.')
      return
    }
    const fd = new FormData()
    fd.append('file', file)
    setUpload({ name: file.name, processed: 0, total: 0, status: 'pending' })
    try {
      const res = await api.upload<{ jobId: string; total: number; bezeichnung: string }>(
        '/leistungsbuecher/import',
        fd,
      )
      setUpload({ name: file.name, processed: 0, total: res.total, status: 'running' })
      poll(res.jobId, file.name)
    } catch (e) {
      setUpload(null)
      showToast('err', e instanceof Error ? e.message : 'Upload fehlgeschlagen')
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) startUpload(file)
  }

  async function toggleAktiv(b: Leistungsbuch) {
    await api.patch(`/leistungsbuecher/${b.id}`, { aktiv: !b.aktiv })
    load()
  }

  async function remove(id: string) {
    try {
      await api.delete(`/leistungsbuecher/${id}`)
      showToast('ok', 'Leistungsbuch gelöscht.')
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'Löschen fehlgeschlagen')
    } finally {
      setConfirmDelete(null)
      load()
    }
  }

  const pct = upload && upload.total > 0 ? Math.round((upload.processed / upload.total) * 100) : 0

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="text-lg font-semibold text-gray-900">Leistungsbücher</div>
        <div className="mt-0.5 text-[12px] text-gray-400">
          ÖNORM-Leistungsbücher (.onlb) verwalten — {buecher.length} importiert
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Upload (nur Admin) */}
        {isAdmin && (
          <div className="mb-5">
            {upload ? (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between text-[12px]">
                  <span className="font-medium text-gray-900">{upload.name}</span>
                  <span className="text-gray-500">
                    {upload.status === 'pending'
                      ? 'Wird hochgeladen …'
                      : `${upload.processed}/${upload.total} (${pct}%)`}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gray-900 transition-all duration-[180ms]"
                    style={{ width: `${upload.status === 'pending' ? 8 : pct}%` }}
                  />
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors duration-[180ms] ${
                  dragOver ? 'border-gray-900 bg-gray-50' : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="text-[13px] font-medium text-gray-700">
                  Leistungsbuch (.onlb) hierher ziehen oder klicken
                </div>
                <div className="mt-1 text-[11px] text-gray-400">ÖNORM A2063 · max. 25 MB</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".onlb"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) startUpload(f)
                    e.target.value = ''
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Liste */}
        {loading ? (
          <div className="text-[13px] text-gray-400">Lädt …</div>
        ) : buecher.length === 0 ? (
          <div className="text-[13px] text-gray-400">
            Noch keine Leistungsbücher.{isAdmin ? ' Lade das erste hoch.' : ''}
          </div>
        ) : (
          <div className="space-y-1.5">
            {buecher.map((b) => (
              <div
                key={b.id}
                className={`flex items-center gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 ${
                  b.aktiv ? '' : 'opacity-60'
                }`}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-gray-900 font-mono text-[11px] font-semibold text-white">
                  {b.kennung}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-gray-900">
                    {b.bezeichnung}
                    <span className="ml-2 text-[11px] font-normal text-gray-400">v{b.versionsnummer}</span>
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {b._count?.positionen ?? 0} Positionen
                    {b.herausgeber ? ` · ${b.herausgeber}` : ''}
                  </div>
                </div>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    b.typ === 'eigen' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {b.typ === 'eigen' ? 'Eigen' : 'ÖNORM'}
                </span>

                {isAdmin && (
                  <>
                    <button
                      onClick={() => toggleAktiv(b)}
                      className="text-[11px] text-gray-500 hover:text-gray-900"
                      title={b.aktiv ? 'Im Katalog ausblenden' : 'Im Katalog einblenden'}
                    >
                      {b.aktiv ? 'Aktiv' : 'Inaktiv'}
                    </button>
                    {confirmDelete === b.id ? (
                      <span className="flex items-center gap-1.5 text-[11px]">
                        <button onClick={() => remove(b.id)} className="font-medium text-red-600 hover:underline">
                          Wirklich löschen?
                        </button>
                        <button onClick={() => setConfirmDelete(null)} className="text-gray-400 hover:text-gray-700">
                          Abbrechen
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(b.id)}
                        className="text-[11px] text-gray-300 hover:text-red-600"
                        title="Leistungsbuch löschen"
                      >
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

      {/* Toaster */}
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
