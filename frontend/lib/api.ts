export type Bin = { bin_id: string; name?: string; fill_level: number; priority: string; wifi_rssi?: number; last_seen?: string | null }
export type Dispatch = { id: number; bin_id: string; priority: string; reason: string; status?: string }
export type DemoData = { bins: Bin[]; dispatch: Dispatch[] }
export type Session = { user: { id: string; name: string; email: string } } | null

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } })
  if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`)
  return response.json() as Promise<T>
}

export const api = {
  session: () => request<Session>('/api/me'),
  demo: () => request<DemoData>('/api/demo'),
  bins: () => request<Bin[]>('/api/bins'),
  dispatch: () => request<Dispatch[]>('/api/dispatch'),
  claimBin: (bin_id: string, claim_code: string) => request<{ ok: true }>('/api/bins/claim', { method: 'POST', body: JSON.stringify({ bin_id, claim_code }) }),
  signIn: (email: string, password: string) => request<Session>('/api/auth/sign-in/email', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signUp: (name: string, email: string, password: string) => request<Session>('/api/auth/sign-up/email', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  signOut: () => request<{ success: boolean }>('/api/auth/sign-out', { method: 'POST' }),
}
