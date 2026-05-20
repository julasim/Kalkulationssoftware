import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[#FAFAFA]">
      <form
        onSubmit={handleSubmit}
        className="w-80 rounded-lg border border-gray-200 bg-white p-7 shadow-sm"
      >
        <div className="mb-6">
          <div className="text-[15px] font-medium text-[#0A0A0A]">Julius Sima</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-gray-400">LV-Manager</div>
        </div>

        <label className="mb-1 block text-[12px] font-medium text-gray-600">E-Mail</label>
        <input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] outline-none focus:border-gray-900"
        />

        <label className="mb-1 block text-[12px] font-medium text-gray-600">Passwort</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] outline-none focus:border-gray-900"
        />

        {error && <div className="mb-3 text-[12px] text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-gray-900 py-2 text-[13px] font-medium text-white transition-colors duration-[180ms] hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? 'Anmelden …' : 'Anmelden'}
        </button>
      </form>
    </div>
  )
}
