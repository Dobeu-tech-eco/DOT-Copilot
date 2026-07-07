import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ShieldAlert, Eye, EyeOff, AlertCircle } from 'lucide-react'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'DOT-Copilot Platform Administration — Dobeu Tech Solutions'
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) throw signInError
      if (!data.session) throw new Error('Sign in failed')

      const { data: profile } = (await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', data.session.user.id)
        .maybeSingle()) as { data: { is_platform_admin: boolean } | null }

      if (!profile?.is_platform_admin) {
        await supabase.auth.signOut()
        setError('Restricted to Dobeu Tech administrators.')
        setSubmitting(false)
        return
      }

      navigate('/fleets')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center">
            <ShieldAlert size={22} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold text-white leading-tight">DOT-Copilot Platform Administration</h1>
            <p className="text-xs text-slate-400">Dobeu Tech Solutions</p>
          </div>
        </div>

        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold text-white mb-1">Internal Sign In</h2>
          <p className="text-slate-400 text-sm">Restricted to Dobeu Tech administrators</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@dobeutech.com"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white
                         placeholder:text-slate-500 text-sm
                         focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500
                         transition-all duration-150"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white
                           placeholder:text-slate-500 text-sm pr-10
                           focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500
                           transition-all duration-150"
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

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800
                       text-white font-medium text-sm transition-colors duration-150
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-slate-500">
          Dobeu Tech Solutions LLC &middot; internal use only
        </p>
      </div>
    </div>
  )
}
