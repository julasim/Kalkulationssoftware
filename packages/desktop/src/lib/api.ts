const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'
const TOKEN_KEY = 'lv_token'

let token: string | null = localStorage.getItem(TOKEN_KEY)

export function setToken(t: string) {
  token = t
  localStorage.setItem(TOKEN_KEY, t)
}

export function clearToken() {
  token = null
  localStorage.removeItem(TOKEN_KEY)
}

export function getToken() {
  return token
}

/** Wird bei 401 ausgelöst, damit die App ausloggen / zum Login leiten kann. */
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })

  if (res.status === 401) {
    clearToken()
    onUnauthorized?.()
    throw new Error('Nicht autorisiert')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }

  // 204 / leere Antworten tolerieren
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** Datei-Upload via FormData — KEIN Content-Type setzen (Browser setzt die Multipart-Boundary). */
async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    body: formData,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })

  if (res.status === 401) {
    clearToken()
    onUnauthorized?.()
    throw new Error('Nicht autorisiert')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }

  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => uploadRequest<T>(path, formData),
}
