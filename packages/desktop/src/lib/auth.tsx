import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setToken, clearToken, getToken, setUnauthorizedHandler } from './api'

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'editor' | 'viewer'
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    if (!getToken()) {
      setLoading(false)
      return
    }
    api
      .get<{ user: User | null }>('/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { email, password })
    setToken(res.token)
    setUser(res.user)
  }

  function logout() {
    clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden')
  return ctx
}
