import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Truck, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'

type Status = 'checking' | 'ready' | 'no-session' | 'success'

export function WelcomePage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function checkSession() {
      // supabase-js automatically parses the invite tokens from the URL hash
      // (detectSessionInUrl) and establishes a session before this resolves.
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      setStatus(data.session ? 'ready' : 'no-session')
    }

    checkSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setStatus(prev => (prev === 'success' ? prev : 'ready'))
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setStatus('success')
      setTimeout(() => navigate('/'), 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to set password')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClasses = `w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white
    placeholder:text-slate-500 text-sm
    focus:outline-none focus:ring-2 focus:ring-baldor-500/30 focus:border-baldor-500
    transition-all duration-150`

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-baldor-500 flex items-center justify-center">
            <Truck size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">DOT Copilot</h1>
          </div>
        </div>

        {status === 'checking' && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-slate-700 border-t-baldor-500 rounded-full animate-spin" />
          </div>
        )}

        {status === 'no-session' && (
          <div className="text-center space-y-3">
            <div className="inline-flex p-4 rounded-full bg-red-500/10 text-red-400">
              <AlertCircle size={28} />
            </div>
            <h2 className="text-xl font-bold text-white">Invite link expired or invalid</h2>
            <p className="text-slate-400 text-sm">
              This invitation link is no longer valid. Please ask your administrator to send a new invite,
              or sign in if you already have an account.
            </p>
            <button onClick={() => navigate('/')} className="btn-primary mt-2">
              Go to Sign In
            </button>
          </div>
        )}

        {status === 'ready' && (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">Welcome</h2>
              <p className="text-slate-400">Set a password to finish setting up your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="Min 8 characters"
                    className={`${inputClasses} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Re-enter your password"
                  className={inputClasses}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-baldor-600 hover:bg-baldor-700 active:bg-baldor-800
                           text-white font-medium text-sm transition-colors duration-150
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Set Password & Continue'
                )}
              </button>
            </form>
          </>
        )}

        {status === 'success' && (
          <div className="text-center space-y-3">
            <div className="inline-flex p-4 rounded-full bg-green-500/10 text-green-400">
              <CheckCircle2 size={28} />
            </div>
            <h2 className="text-xl font-bold text-white">You're all set</h2>
            <p className="text-slate-400 text-sm">Taking you to your dashboard...</p>
          </div>
        )}
      </div>
    </div>
  )
}
