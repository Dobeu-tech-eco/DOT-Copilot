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
  register: (email: string, password: string, name: string) => Promise<void>
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

  register: async (email: string, password: string, name: string) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })
      if (error) throw error
      if (!data.user) throw new Error('Registration failed')

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle()

      set({
        user: profile,
        session: data.session ? { access_token: data.session.access_token } : null,
        isAuthenticated: !!profile,
        loading: false,
      })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Registration failed'
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
