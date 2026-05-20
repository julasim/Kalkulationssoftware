import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import ProjekteListe from './pages/ProjekteListe'
import ProjektDetail from './pages/ProjektDetail'
import LVEditor from './pages/LVEditor'
import Kalkulation from './pages/Kalkulation'
import Katalog from './pages/Katalog'
import Leistungsbuecher from './pages/Leistungsbuecher'
import Angebote from './pages/Angebote'
import Einstellungen from './pages/Einstellungen'
import { useAuth } from './lib/auth'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-[13px] text-gray-400">Lädt …</div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/projekte" replace />} />
        <Route path="projekte" element={<ProjekteListe />} />
        <Route path="projekte/:projektId" element={<ProjektDetail />} />
        <Route path="lvs/:lvId" element={<LVEditor />} />
        <Route path="lvs/:lvId/positionen/:positionId/kalkulation" element={<Kalkulation />} />
        <Route path="katalog" element={<Katalog />} />
        <Route path="leistungsbuecher" element={<Leistungsbuecher />} />
        <Route path="angebote" element={<Angebote />} />
        <Route path="einstellungen" element={<Einstellungen />} />
        <Route path="*" element={<Navigate to="/projekte" replace />} />
      </Route>
    </Routes>
  )
}
