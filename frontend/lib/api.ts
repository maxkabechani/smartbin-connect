export type Role = 'customer' | 'collector' | 'superadmin'
export type Bin = { bin_id: string; name?: string; fill_level: number; priority: string; wifi_rssi?: number; last_seen?: string | null; owner_name?: string | null; owner_email?: string | null }
export type Dispatch = { id: number; bin_id: string; priority: string; reason: string; status?: string; owner_name?: string | null; owner_email?: string | null }
export type AppUser = { id: string; name: string; email: string; role: Role; created_at?: string }
export type Session = { user: AppUser }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } })
  if (!response.ok) {
    const body = await response.text()
    let parsed: { error?: string } | null = null
    try { parsed = JSON.parse(body) as { error?: string } } catch { /* keep the raw response */ }
    throw new Error(parsed?.error || body || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export const api = {
  session: () => request<Session>('/api/me'),
  bins: () => request<Bin[]>('/api/bins'),
  dispatch: () => request<Dispatch[]>('/api/dispatch'),
  claimBin: (bin_id: string, claim_code: string) => request<{ ok: true }>('/api/bins/claim', { method: 'POST', body: JSON.stringify({ bin_id, claim_code }) }),
  registerBin: (bin_id: string, claim_code: string) => request<{ ok: true }>('/api/admin/bins', { method: 'POST', body: JSON.stringify({ bin_id, claim_code }) }),
  closeDispatch: (id: number) => request<{ ok: true }>(`/api/dispatch/${id}/close`, { method: 'POST' }),
  users: () => request<AppUser[]>('/api/admin/users'),
  updateUserRole: (id: string, role: Role) => request<{ ok: true }>(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  signIn: (email: string, password: string) => request<Session>('/api/auth/sign-in/email', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signUp: (name: string, email: string, password: string) => request<Session>('/api/auth/sign-up/email', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  signOut: () => request<{ success: boolean }>('/api/auth/sign-out', { method: 'POST' }),
}
