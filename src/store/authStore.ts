import { create } from 'zustand'
import { api, setTokens, clearTokens, loadTokens, getAccessToken } from '../lib/api'
import type { Profile } from '../types/database'

interface AuthState {
  user: Profile | null
  session: { access_token: string } | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  initialized: boolean
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, _get) => ({
  user: null,
  session: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  initialized: false,

  initialize: async () => {
    loadTokens()
    const token = getAccessToken()
    if (token) {
      try {
        const res = await api.get<{ data: any }>('/users/me')
        const u = res.data
        const profile: Profile = {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          fleet_id: u.fleetId || u.fleet_id || null,
          location_id: u.locationId || u.location_id || null,
          phone: u.phone || null,
          preferred_language: u.preferredLanguage || u.preferred_language || 'en',
          timezone: u.timezone || 'America/New_York',
          prefer_email: u.preferEmail ?? u.prefer_email ?? true,
          prefer_sms: u.preferSms ?? u.prefer_sms ?? false,
          prefer_push: u.preferPush ?? u.prefer_push ?? true,
          employee_id: u.employeeId || u.employee_id || null,
          hire_date: u.hireDate || u.hire_date || null,
          is_active: u.isActive ?? u.is_active ?? true,
          last_login_at: u.lastLoginAt || u.last_login_at || null,
          created_at: u.createdAt || u.created_at || '',
          updated_at: u.updatedAt || u.updated_at || '',
        }
        set({
          user: profile,
          session: { access_token: token },
          isAuthenticated: true,
          initialized: true,
        })
      } catch {
        clearTokens()
        set({ initialized: true })
      }
    } else {
      set({ initialized: true })
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true, error: null })

    try {
      const res = await api.post<{ data: any }>('/auth/login', { email, password })
      const { user, accessToken, refreshToken } = res.data
      setTokens(accessToken, refreshToken)

      const profile: Profile = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        fleet_id: user.fleet_id || null,
        location_id: user.location_id || null,
        phone: user.phone || null,
        preferred_language: user.preferred_language || 'en',
        timezone: user.timezone || 'America/New_York',
        prefer_email: user.prefer_email ?? true,
        prefer_sms: user.prefer_sms ?? false,
        prefer_push: user.prefer_push ?? true,
        employee_id: user.employee_id || null,
        hire_date: user.hire_date || null,
        is_active: user.is_active ?? true,
        last_login_at: user.last_login_at || null,
        created_at: user.created_at || '',
        updated_at: user.updated_at || '',
      }

      set({
        user: profile,
        session: { access_token: accessToken },
        isAuthenticated: true,
        loading: false,
      })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Login failed'
      set({ error: msg, loading: false })
      throw error
    }
  },

  logout: async () => {
    try {
      const rt = localStorage.getItem('refreshToken')
      await api.post('/auth/logout', { refreshToken: rt }).catch(() => {})
    } finally {
      clearTokens()
      set({ user: null, session: null, isAuthenticated: false })
    }
  },

  clearError: () => set({ error: null }),
}))
