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
  resetPassword: (email: string) => Promise<void>
  clearError: () => void
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  return data
}

export const useAuthStore = create<AuthState>((set, _get) => ({
  user: null,
  session: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  initialized: false,

  initialize: async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        const profile = await fetchProfile(session.user.id)
        set({
          user: profile,
          session: { access_token: session.access_token },
          isAuthenticated: !!profile,
          initialized: true,
        })
      } else {
        set({ initialized: true })
      }

      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (newSession) {
          const profile = await fetchProfile(newSession.user.id)
          set({
            user: profile,
            session: { access_token: newSession.access_token },
            isAuthenticated: !!profile,
          })
        } else {
          set({ user: null, session: null, isAuthenticated: false })
        }
      })
    } catch {
      set({ initialized: true })
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true, error: null })

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (!data.session) throw new Error('Login failed')

      const profile = await fetchProfile(data.session.user.id)

      set({
        user: profile,
        session: { access_token: data.session.access_token },
        isAuthenticated: !!profile,
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

      const profile = await fetchProfile(data.user.id)

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
    try {
      await supabase.auth.signOut()
    } finally {
      set({ user: null, session: null, isAuthenticated: false })
    }
  },

  resetPassword: async (email: string) => {
    set({ loading: true, error: null })
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
      set({ loading: false })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Password reset failed'
      set({ error: msg, loading: false })
      throw error
    }
  },

  clearError: () => set({ error: null }),
}))
