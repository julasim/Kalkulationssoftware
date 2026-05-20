import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProjekteListe from './pages/ProjekteListe'
import ProjektDetail from './pages/ProjektDetail'
import LVEditor from './pages/LVEditor'
import Kalkulation from './pages/Kalkulation'
import Katalog from './pages/Katalog'
import Angebote from './pages/Angebote'
import Einstellungen from './pages/Einstellungen'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/projekte" replace />} />
        <Route path="projekte" element={<ProjekteListe />} />
        <Route path="projekte/:projektId" element={<ProjektDetail />} />
        <Route path="lvs/:lvId" element={<LVEditor />} />
        <Route path="lvs/:lvId/positionen/:positionId/kalkulation" element={<Kalkulation />} />
        <Route path="katalog" element={<Katalog />} />
        <Route path="angebote" element={<Angebote />} />
        <Route path="einstellungen" element={<Einstellungen />} />
      </Route>
    </Routes>
  )
}
