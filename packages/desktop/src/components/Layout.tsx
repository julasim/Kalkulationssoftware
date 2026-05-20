import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const navItems = [
  { to: '/projekte', label: 'Projekte', icon: '📁' },
  { to: '/katalog', label: 'Katalog', icon: '📖' },
  { to: '/angebote', label: 'Angebote', icon: '📄' },
  { to: '/einstellungen', label: 'Einstellungen', icon: '⚙️' },
]

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

export default function Layout() {
  const { user, logout } = useAuth()
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — immer hell */}
      <aside className="w-56 flex-shrink-0 bg-[#FAFAFA] border-r border-gray-200 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-200">
          <div className="text-[13px] font-medium text-[#0A0A0A]">Julius Sima</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-0.5">LV-Manager</div>
        </div>

        <nav className="flex-1 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-[7px] rounded-md text-[13px] mb-0.5 transition-colors duration-[180ms] ${
                  isActive
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-gray-200 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
            {user ? initials(user.name) : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-gray-900 truncate">{user?.name}</div>
            <div className="text-[10px] text-gray-400 capitalize">{user?.role}</div>
          </div>
          <button
            onClick={logout}
            title="Abmelden"
            className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors duration-[180ms]"
          >
            Abmelden
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white">
        <Outlet />
      </main>
    </div>
  )
}
