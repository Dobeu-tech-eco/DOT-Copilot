import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  profile: vi.fn(), getSession: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(),
  signOut: vi.fn(), onAuthStateChange: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({ supabase: {
  auth: mocks,
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) }),
} }))

const session = { access_token: 'local-test-token', user: { id: 'driver-1' } }
const profile = { id: 'driver-1', is_active: true, role: 'DRIVER' }
async function store() {
  const { useAuthStore } = await import('./authStore')
  return useAuthStore
}
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.getSession.mockResolvedValue({ data: { session }, error: null })
  mocks.profile.mockResolvedValue({ data: profile, error: null })
  mocks.signOut.mockResolvedValue({ error: null })
})

describe('Supabase identity admission', () => {
  it('admits an active profile with a session', async () => {
    const s = await store()
    await s.getState().initialize()
    expect(s.getState()).toMatchObject({ user: profile, isAuthenticated: true, initialized: true })
  })
  it.each([null, { ...profile, is_active: false }])('rejects missing or inactive profiles', async value => {
    mocks.profile.mockResolvedValue({ data: value, error: null })
    const s = await store()
    await s.getState().initialize()
    expect(s.getState()).toMatchObject({ user: null, session: null, isAuthenticated: false, initialized: true })
  })
  it('does not authenticate signup awaiting email confirmation', async () => {
    mocks.signUp.mockResolvedValue({ data: { user: session.user, session: null }, error: null })
    const s = await store()
    await s.getState().register('driver@example.invalid', 'test-password', 'Driver')
    expect(s.getState().isAuthenticated).toBe(false)
    expect(mocks.profile).not.toHaveBeenCalled()
  })
  it('clears a previous identity when session lookup fails', async () => {
    const s = await store()
    await s.getState().initialize()
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: new Error('offline') })
    await s.getState().initialize()
    expect(s.getState()).toMatchObject({ user: null, session: null, isAuthenticated: false })
  })
  it('does not restore access when a profile lookup finishes after logout', async () => {
    let resolve!: (value: unknown) => void
    mocks.profile.mockReturnValue(new Promise(r => { resolve = r }))
    const s = await store()
    const pending = s.getState().initialize()
    await vi.waitFor(() => expect(mocks.profile).toHaveBeenCalled())
    await s.getState().logout()
    resolve({ data: profile, error: null })
    await pending
    expect(s.getState()).toMatchObject({ user: null, session: null, isAuthenticated: false })
  })
  it('registers only one auth listener across repeated initialization', async () => {
    const s = await store()
    await s.getState().initialize()
    await s.getState().initialize()
    expect(mocks.onAuthStateChange).toHaveBeenCalledTimes(1)
  })
  it('fails closed on profile read errors', async () => {
    mocks.profile.mockResolvedValue({ data: profile, error: new Error('denied') })
    const s = await store()
    await s.getState().initialize()
    expect(s.getState()).toMatchObject({ user: null, session: null, isAuthenticated: false })
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
const signedIn = { data: { session, user: session.user }, error: null }
const profileResult = { data: profile, error: null }
const signedOutState = { user: null, session: null, isAuthenticated: false, loading: false, error: null }

describe('serialized latest auth intent', () => {
  let notify: (event: string, value: typeof session | null) => void
  let sdkSession: typeof session | null
  const otherSession = { access_token: 'other-token', user: { id: 'driver-2' } }
  const otherProfile = { ...profile, id: 'driver-2' }

  beforeEach(() => {
    vi.useFakeTimers()
    sdkSession = null
    mocks.onAuthStateChange.mockImplementation(callback => { notify = callback })
    mocks.getSession.mockImplementation(async () => ({ data: { session: sdkSession }, error: null }))
    mocks.profile.mockResolvedValue(profileResult)
    mocks.signInWithPassword.mockImplementation(async () => {
      sdkSession = session
      notify('SIGNED_IN', session)
      return signedIn
    })
    mocks.signUp.mockImplementation(async () => {
      sdkSession = session
      notify('SIGNED_IN', session)
      return signedIn
    })
    mocks.signOut.mockImplementation(async () => {
      sdkSession = null
      notify('SIGNED_OUT', null)
      return { error: null }
    })
  })
  afterEach(() => vi.useRealTimers())

  async function initializedStore() {
    const s = await store()
    await s.getState().initialize()
    return s
  }
  function request(s: Awaited<ReturnType<typeof store>>, method: 'login' | 'register') {
    return method === 'login'
      ? s.getState().login('driver@example.invalid', 'test-password')
      : s.getState().register('driver@example.invalid', 'test-password', 'Driver')
  }
  async function flush() {
    for (let i = 0; i < 12; i++) await Promise.resolve()
  }

  it.each(['login', 'register'] as const)('serializes logout after pending %s SDK callback and result', async method => {
    const gate = deferred<void>()
    mocks[method === 'login' ? 'signInWithPassword' : 'signUp'].mockImplementationOnce(async () => {
      await gate.promise
      sdkSession = session
      notify('SIGNED_IN', session)
      return signedIn
    })
    const s = await initializedStore()
    const pending = request(s, method)
    await flush()
    const logout = s.getState().logout()
    expect(mocks.signOut).not.toHaveBeenCalled()
    gate.resolve()
    await Promise.all([pending, logout])
    await vi.runAllTimersAsync()
    expect(s.getState()).toMatchObject(signedOutState)
    expect(sdkSession).toBeNull()
    expect(mocks.profile).not.toHaveBeenCalled()
  })

  it.each(['login', 'register'] as const)('ignores %s profile completion after logout', async method => {
    const lookup = deferred<typeof profileResult>()
    mocks.profile.mockReturnValueOnce(lookup.promise)
    const s = await initializedStore()
    const pending = request(s, method)
    await flush()
    expect(mocks.profile).toHaveBeenCalledTimes(1)
    await s.getState().logout()
    lookup.resolve(profileResult)
    await pending
    expect(s.getState()).toMatchObject(signedOutState)
  })

  it.each(['login', 'register'] as const)('ignores stale %s SDK rejection without stranding newer loading', async method => {
    const gate = deferred<typeof signedIn>()
    mocks[method === 'login' ? 'signInWithPassword' : 'signUp'].mockReturnValueOnce(gate.promise)
    const s = await initializedStore()
    const old = request(s, method)
    await flush()
    const current = request(s, 'login')
    expect(s.getState().loading).toBe(true)
    gate.reject(new Error('old failure'))
    await Promise.all([old, current])
    expect(s.getState()).toMatchObject({ user: profile, isAuthenticated: true, initialized: true, loading: false, error: null })
  })

  it('serializes distinct-user A and B so late A callback cannot replace latest B', async () => {
    const gate = deferred<void>()
    mocks.signInWithPassword.mockImplementationOnce(async () => {
      await gate.promise
      sdkSession = session
      notify('SIGNED_IN', session)
      return signedIn
    }).mockImplementationOnce(async () => {
      sdkSession = otherSession
      notify('SIGNED_IN', otherSession)
      return { data: { session: otherSession, user: otherSession.user }, error: null }
    })
    mocks.profile.mockResolvedValue({ data: otherProfile, error: null })
    const s = await initializedStore()
    const a = request(s, 'login')
    await flush()
    const b = request(s, 'login')
    expect(mocks.signInWithPassword).toHaveBeenCalledTimes(1)
    gate.resolve()
    await Promise.all([a, b])
    await vi.runAllTimersAsync()
    expect(s.getState()).toMatchObject({ user: otherProfile, session: { access_token: otherSession.access_token }, loading: false })
    expect(sdkSession).toEqual(otherSession)
    expect(mocks.profile).toHaveBeenCalledTimes(1)
  })

  it('skips queued signup superseded by a newer login', async () => {
    const gate = deferred<void>()
    mocks.signOut.mockImplementationOnce(async () => {
      await gate.promise
      notify('SIGNED_OUT', null)
      return { error: null }
    })
    const s = await initializedStore()
    const logout = s.getState().logout()
    await flush()
    const signup = request(s, 'register')
    const login = request(s, 'login')
    gate.resolve()
    await Promise.all([logout, signup, login])
    expect(mocks.signUp).not.toHaveBeenCalled()
    expect(s.getState()).toMatchObject({ user: profile, isAuthenticated: true, loading: false })
  })

  it('old logout SIGNED_OUT and completion cannot cancel queued newer login', async () => {
    const gate = deferred<void>()
    mocks.signOut.mockImplementationOnce(async () => {
      await gate.promise
      sdkSession = null
      notify('SIGNED_OUT', null)
      return { error: null }
    })
    const s = await initializedStore()
    const logout = s.getState().logout()
    await flush()
    const login = request(s, 'login')
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
    gate.resolve()
    await Promise.all([logout, login])
    expect(s.getState()).toMatchObject({ user: profile, isAuthenticated: true, loading: false })
  })

  it.each(['SIGNED_IN', 'INITIAL_SESSION', 'TOKEN_REFRESHED'])('reconciles genuine external %s after logout from current SDK state', async event => {
    const s = await initializedStore()
    await s.getState().logout()
    sdkSession = otherSession
    mocks.profile.mockResolvedValue({ data: otherProfile, error: null })
    notify(event, session) // Delayed event payload is deliberately stale.
    await vi.runAllTimersAsync()
    expect(s.getState()).toMatchObject({ user: otherProfile, session: { access_token: otherSession.access_token }, isAuthenticated: true })
  })

  it('clears the previous account while external account admission is pending', async () => {
    const s = await initializedStore()
    await request(s, 'login')
    const lookup = deferred<typeof profileResult>()
    mocks.profile.mockReturnValueOnce(lookup.promise)
    sdkSession = otherSession
    notify('SIGNED_IN', otherSession)
    expect(s.getState()).toMatchObject(signedOutState)
    await vi.runAllTimersAsync()
    expect(s.getState()).toMatchObject(signedOutState)
    lookup.resolve({ data: otherProfile, error: null })
    await flush()
    expect(s.getState()).toMatchObject({ user: otherProfile, isAuthenticated: true })
  })

  it('does not admit a late event payload when current SDK session is signed out', async () => {
    const s = await initializedStore()
    await s.getState().logout()
    notify('SIGNED_IN', session)
    await vi.runAllTimersAsync()
    expect(s.getState()).toMatchObject(signedOutState)
    expect(mocks.profile).not.toHaveBeenCalled()
  })

  it.each(['login', 'register'] as const)('keeps %s loading through its awaited own callback and profile read', async method => {
    const lookup = deferred<typeof profileResult>()
    mocks.profile.mockReturnValueOnce(lookup.promise)
    const s = await initializedStore()
    const pending = request(s, method)
    await flush()
    expect(s.getState().loading).toBe(true)
    expect(mocks.profile).toHaveBeenCalledTimes(1)
    lookup.resolve(profileResult)
    await pending
    expect(s.getState()).toMatchObject({ user: profile, loading: false, initialized: true })
  })

  it.each(['initialize', 'login', 'register', 'callback'] as const)('invalidates %s profile read on external signed-out event', async method => {
    const lookup = deferred<typeof profileResult>()
    mocks.profile.mockReturnValueOnce(lookup.promise)
    const s = await initializedStore()
    let pending: Promise<void>
    if (method === 'initialize') {
      sdkSession = session
      pending = s.getState().initialize()
      await flush()
    } else if (method === 'callback') {
      sdkSession = session
      notify('SIGNED_IN', session)
      await vi.runAllTimersAsync()
      pending = Promise.resolve()
    } else {
      pending = request(s, method)
      await flush()
    }
    expect(mocks.profile).toHaveBeenCalledTimes(1)
    sdkSession = null
    notify('SIGNED_OUT', null)
    lookup.resolve(profileResult)
    await pending
    await vi.runAllTimersAsync()
    expect(s.getState()).toMatchObject(signedOutState)
  })

  it('does not restore old SDK identity when latest login fails', async () => {
    const gate = deferred<void>()
    mocks.signInWithPassword.mockImplementationOnce(async () => {
      await gate.promise
      sdkSession = session
      notify('SIGNED_IN', session)
      return signedIn
    }).mockResolvedValueOnce({ data: { session: null }, error: new Error('latest failure') })
    const s = await initializedStore()
    const old = request(s, 'login')
    await flush()
    const latest = request(s, 'login')
    const rejected = expect(latest).rejects.toThrow('latest failure')
    gate.resolve()
    await old
    await rejected
    await vi.runAllTimersAsync()
    expect(s.getState()).toMatchObject({ ...signedOutState, initialized: true, error: 'latest failure' })
  })

  it('ignores initialization finishing after a login begins', async () => {
    const sessionRead = deferred<{ data: { session: typeof session | null }; error: null }>()
    mocks.getSession.mockReturnValueOnce(sessionRead.promise)
    const s = await store()
    const init = s.getState().initialize()
    await request(s, 'login')
    sessionRead.resolve({ data: { session: null }, error: null })
    await init
    expect(s.getState()).toMatchObject({ user: profile, isAuthenticated: true, initialized: true, loading: false })
  })
  it.each(['resolved', 'rejected'])('keeps admission closed after %s logout failure and permits retry', async mode => {
    const s = await initializedStore()
    await request(s, 'login')
    const error = new Error('logout unavailable')
    if (mode === 'resolved') mocks.signOut.mockResolvedValueOnce({ error })
    else mocks.signOut.mockRejectedValueOnce(error)
    await expect(s.getState().logout()).rejects.toThrow('logout unavailable')
    notify('TOKEN_REFRESHED', session)
    await vi.runAllTimersAsync()
    await s.getState().initialize()
    expect(s.getState()).toMatchObject({ user: null, session: null, isAuthenticated: false, error: 'logout unavailable' })
    await s.getState().logout()
    sdkSession = session
    notify('SIGNED_IN', session)
    await vi.runAllTimersAsync()
    expect(s.getState().isAuthenticated).toBe(true)
  })

  it.each(['login', 'register'] as const)('reconciles external sign-out during %s SDK mutation', async method => {
    const s = await initializedStore()
    mocks[method === 'login' ? 'signInWithPassword' : 'signUp'].mockImplementationOnce(async () => {
      sdkSession = session
      notify('SIGNED_IN', session)
      sdkSession = null
      notify('SIGNED_OUT', null)
      return signedIn
    })
    await request(s, method)
    expect(s.getState()).toMatchObject(signedOutState)
    expect(mocks.profile).not.toHaveBeenCalled()
  })

  it('does not re-admit an SDK identity after the latest explicit login fails', async () => {
    const s = await initializedStore()
    await request(s, 'login')
    mocks.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: new Error('bad login') })
    await expect(request(s, 'login')).rejects.toThrow('bad login')
    notify('TOKEN_REFRESHED', session)
    await vi.runAllTimersAsync()
    await s.getState().initialize()
    expect(s.getState().isAuthenticated).toBe(false)
    await request(s, 'login')
    expect(s.getState().isAuthenticated).toBe(true)
  })

})


describe('review regressions', () => {
  it.each([null, { ...profile, is_active: false }])('explains explicit login denial', async value => {
    mocks.signInWithPassword.mockResolvedValue(signedIn)
    mocks.profile.mockResolvedValue({ data: value, error: null })
    const s = await store()
    await expect(s.getState().login('driver@example.invalid', 'test')).rejects.toThrow('unavailable or inactive')
    expect(s.getState().isAuthenticated).toBe(false)
    expect(s.getState().error).toContain('Contact your administrator')
  })
  it.each(['TOKEN_REFRESHED', 'USER_UPDATED'])('preserves admission during same-user %s and revokes on denial', async event => {
    vi.useFakeTimers()
    try {
      const s = await store()
      await s.getState().initialize()
      const pending = deferred<{ data: typeof profile | null; error: null }>()
      mocks.profile.mockReturnValue(pending.promise)
      mocks.onAuthStateChange.mock.calls[0][0](event, session)
      expect(s.getState().isAuthenticated).toBe(true)
      await vi.advanceTimersByTimeAsync(0)
      expect(s.getState().isAuthenticated).toBe(true)
      pending.resolve({ data: null, error: null })
      await vi.advanceTimersByTimeAsync(0)
      expect(s.getState().isAuthenticated).toBe(false)
    } finally { vi.useRealTimers() }
  })
})
