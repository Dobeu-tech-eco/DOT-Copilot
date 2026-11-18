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
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  const profile = data as Profile | null
  return profile?.is_active ? profile : null
}

let authRevision = 0
let subscribed = false
let activeRequest: number | null = null
// A failed explicit operation may leave an older SDK session intact. Require
// explicit retry before admitting that session again in this runtime.
let admissionBlocked = false
let pendingMutations = 0
let mutationQueue = Promise.resolve()

const clearedIdentity = { user: null, session: null, isAuthenticated: false }
type AuthSession = { access_token: string; user: { id: string } } | null

// Supabase awaits auth callbacks before mutation promises settle. Serializing
// these calls prevents an older request from changing the SDK session last.
function mutateSession<T>(revision: number, mutate: () => Promise<T>): Promise<T | undefined> {
  ++pendingMutations
  const result = mutationQueue.then(async () => {
    if (revision !== authRevision) return undefined
    return mutate()
  })
  mutationQueue = result.then(() => undefined, () => undefined)
  return result.finally(() => { --pendingMutations })
}

export const useAuthStore = create<AuthState>((set) => {
  const applySession = async (session: AuthSession, revision: number) => {
    const profile = session ? await fetchProfile(session.user.id) : null
    if (revision !== authRevision || admissionBlocked) return
    set({
      user: profile,
      session: session && profile ? { access_token: session.access_token } : null,
      isAuthenticated: !!profile,
      initialized: true,
      loading: false,
    })
  }

  const readSession = async (revision: number) => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (revision !== authRevision) return
      if (error) throw error
      await applySession(session, revision)
    } catch {
      if (revision === authRevision) set({ ...clearedIdentity, initialized: true, loading: false })
    }
  }

  const beginRequest = (loading: boolean) => {
    const revision = ++authRevision
    activeRequest = revision
    set({ ...clearedIdentity, loading, error: null })
    return revision
  }
  const finishRequest = (revision: number) => {
    if (activeRequest === revision) activeRequest = null
  }

  return {
    user: null,
    session: null,
    isAuthenticated: false,
    loading: false,
    error: null,
    initialized: false,

    initialize: async () => {
      if (!subscribed) {
        subscribed = true
        supabase.auth.onAuthStateChange(() => {
          // Local mutations own admission, including their awaited SDK callbacks.
          if (pendingMutations || admissionBlocked) return
          const revision = ++authRevision
          activeRequest = null
          set({ ...clearedIdentity, loading: false })
          // Auth callbacks hold the SDK lock. Read the current session afterward,
          // rather than trusting a potentially delayed callback payload.
          setTimeout(() => {
            if (revision === authRevision) void readSession(revision)
          }, 0)
        })
      }
      if (activeRequest !== null || pendingMutations || admissionBlocked) return
      const revision = ++authRevision
      set(clearedIdentity)
      await readSession(revision)
    },

    login: async (email: string, password: string) => {
      const revision = beginRequest(true)
      admissionBlocked = false
      try {
        const result = await mutateSession(revision, () => supabase.auth.signInWithPassword({ email, password }))
        if (revision !== authRevision || !result) return
        const { data, error } = result
        if (error) throw error
        if (!data.session) throw new Error('Login failed')
        const { data: current, error: sessionError } = await supabase.auth.getSession()
        if (revision !== authRevision) return
        if (sessionError) throw sessionError
        if (current.session?.user.id !== data.session?.user.id) {
          admissionBlocked = true
          set({ ...clearedIdentity, initialized: true, loading: false })
          return
        }
        await applySession(current.session, revision)
      } catch (error: unknown) {
        if (revision !== authRevision) return
        admissionBlocked = true
        const msg = error instanceof Error ? error.message : 'Login failed'
        set({ ...clearedIdentity, error: msg, initialized: true, loading: false })
        throw error
      } finally {
        finishRequest(revision)
      }
    },

    register: async (email: string, password: string, name: string) => {
      const revision = beginRequest(true)
      admissionBlocked = false
      try {
        const result = await mutateSession(revision, () => supabase.auth.signUp({
          email, password, options: { data: { name } },
        }))
        if (revision !== authRevision || !result) return
        const { data, error } = result
        if (error) throw error
        if (!data.user) throw new Error('Registration failed')
        const { data: current, error: sessionError } = await supabase.auth.getSession()
        if (revision !== authRevision) return
        if (sessionError) throw sessionError
        if (current.session?.user.id !== data.session?.user.id) {
          admissionBlocked = true
          set({ ...clearedIdentity, initialized: true, loading: false })
          return
        }
        await applySession(current.session, revision)
      } catch (error: unknown) {
        if (revision !== authRevision) return
        admissionBlocked = true
        const msg = error instanceof Error ? error.message : 'Registration failed'
        set({ ...clearedIdentity, error: msg, initialized: true, loading: false })
        throw error
      } finally {
        finishRequest(revision)
      }
    },

    logout: async () => {
      const revision = beginRequest(false)
      set({ initialized: true })
      try {
        const result = await mutateSession(revision, () => supabase.auth.signOut())
        if (revision !== authRevision || !result) return
        if (result.error) throw result.error
        admissionBlocked = false
      } catch (error: unknown) {
        if (revision !== authRevision) return
        admissionBlocked = true
        set({ ...clearedIdentity, error: error instanceof Error ? error.message : 'Logout failed' })
        throw error
      } finally {
        if (revision === authRevision) set(clearedIdentity)
        finishRequest(revision)
      }
    },

    resetPassword: async (email: string) => {
      const revision = authRevision
      set({ loading: true, error: null })
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) throw error
        if (revision === authRevision) set({ loading: false })
      } catch (error: unknown) {
        if (revision !== authRevision) return
        const msg = error instanceof Error ? error.message : 'Password reset failed'
        set({ error: msg, loading: false })
        throw error
      }
    },

    clearError: () => set({ error: null }),
  }
})
