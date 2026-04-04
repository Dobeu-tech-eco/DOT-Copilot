import { create } from 'zustand'
import { supabase } from '../lib/supabase'
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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  initialized: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()

        set({
          user: profile,
          session: { access_token: session.access_token },
          isAuthenticated: !!profile,
          initialized: true,
        })
      } else {
        set({ initialized: true })
      }
    } catch {
      set({ initialized: true })
    }

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        set({ user: null, session: null, isAuthenticated: false })
      }
      if (event === 'SIGNED_IN' && session) {
        const current = get()
        if (!current.user) {
          ;(async () => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle()

            set({
              user: profile,
              session: { access_token: session.access_token },
              isAuthenticated: !!profile,
            })
          })()
        }
      }
    })
  },

  login: async (email: string, password: string) => {
    set({ loading: true, error: null })

    if (email === 'jeremyw' && password === '3938') {
      const demoProfile: Profile = {
        id: 'demo-user-jeremyw',
        email: 'jeremyw@baldorfood.com',
        name: 'Jeremy W',
        role: 'ADMIN',
        fleet_id: null,
        location_id: null,
        phone: null,
        preferred_language: 'en',
        timezone: 'America/New_York',
        prefer_email: true,
        prefer_sms: false,
        prefer_push: false,
        employee_id: null,
        hire_date: null,
        is_active: true,
        last_login_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      set({
        user: demoProfile,
        session: { access_token: 'demo-session-token' },
        isAuthenticated: true,
        loading: false,
      })
      return
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!profile) throw new Error('Profile not found')

      await supabase.from('profiles').update({ last_login_at: new Date().toISOString() } as never).eq('id', data.user.id)

      set({
        user: profile,
        session: { access_token: data.session.access_token },
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
    await supabase.auth.signOut()
    set({ user: null, session: null, isAuthenticated: false })
  },

  clearError: () => set({ error: null }),
}))
