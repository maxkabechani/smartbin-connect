export type Role = 'customer' | 'collector' | 'superadmin'
export type Bin = { bin_id: string; name?: string; fill_level: number; priority: string; wifi_rssi?: number; last_seen?: string | null; owner_name?: string | null; owner_email?: string | null }
export type Dispatch = { id: number; bin_id: string; priority: string; reason: string; status?: string; owner_name?: string | null; owner_email?: string | null }
export type RouteStop = { sequence: number; bin_id: string; fill_level: number; priority: string; reason: string; owner_name?: string | null; distance_from_previous_km: number; location_available: boolean }
export type OptimizedRoute = { stops: RouteStop[]; total_distance_km: number; estimated_minutes: number; estimated_savings_percent: number; algorithm: string; unlocated_stops: number }
export type AppUser = { id: string; name: string; email: string; role: Role; created_at?: string }
export type Session = { user: AppUser }
export type CollectorInput = { name: string; email: string; password: string }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } })
  if (!response.ok) {
    const body = await response.text()
    let parsed: { error?: string; message?: string; code?: string } | null = null
    try { parsed = JSON.parse(body) as { error?: string; message?: string; code?: string } } catch { /* keep the raw response */ }
    if (parsed?.code === 'INVALID_EMAIL_OR_PASSWORD' || response.status === 401) throw new Error('The email or password is incorrect.')
    if (parsed?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') throw new Error('An account with this email already exists. Try signing in instead.')
    if (parsed?.code === 'PASSWORD_TOO_SHORT') throw new Error('Use a password with at least 8 characters.')
    if (parsed?.code === 'INVALID_EMAIL') throw new Error('Enter a valid email address.')
    throw new Error(parsed?.message || parsed?.error || 'We could not complete that request. Please try again.')
  }
  return response.json() as Promise<T>
}

export const api = {
  session: () => request<Session>('/api/me'),
  bins: () => request<Bin[]>('/api/bins'),
  dispatch: () => request<Dispatch[]>('/api/dispatch'),
  optimizedRoute: () => request<OptimizedRoute>('/api/routes/optimized'),
  claimBin: (bin_id: string, claim_code: string) => request<{ ok: true }>('/api/bins/claim', { method: 'POST', body: JSON.stringify({ bin_id, claim_code }) }),
  registerBin: (bin_id: string, claim_code: string) => request<{ ok: true }>('/api/admin/bins', { method: 'POST', body: JSON.stringify({ bin_id, claim_code }) }),
  closeDispatch: (id: number) => request<{ ok: true }>(`/api/dispatch/${id}/close`, { method: 'POST' }),
  users: () => request<AppUser[]>('/api/admin/users'),
  updateUserRole: (id: string, role: Role) => request<{ ok: true }>(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  createCollector: (input: CollectorInput) => request<{ ok: true; user: AppUser }>('/api/admin/collectors', { method: 'POST', body: JSON.stringify(input) }),
  updateProfile: (name: string) => request<{ status: boolean }>('/api/auth/update-user', { method: 'POST', body: JSON.stringify({ name }) }),
  changePassword: (currentPassword: string, newPassword: string) => request<{ status: boolean }>('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: false }) }),
  signIn: (email: string, password: string) => request<Session>('/api/auth/sign-in/email', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signUp: (name: string, email: string, password: string) => request<Session>('/api/auth/sign-up/email', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  signOut: () => request<{ success: boolean }>('/api/auth/sign-out', { method: 'POST' }),
}
