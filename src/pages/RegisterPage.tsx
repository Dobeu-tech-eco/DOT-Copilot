import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuthStore } from '../store/authStore'
import { registerSchema, type RegisterFormData } from '../schemas/profile.schema'
import { ThemeLogo } from '../components/ThemeLogo'
import { useTheme } from '../components/ThemeProvider'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register: authRegister, isAuthenticated } = useAuthStore()
  const { displayName } = useTheme()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema) as never,
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard')
  }, [isAuthenticated, navigate])

  const onSubmit = form.handleSubmit(async (data: RegisterFormData) => {
    setServerError('')
    setSubmitting(true)
    try {
      await authRegister(data.email, data.password, data.name)
      navigate('/dashboard')
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  })

  const inputClasses = `w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white
    placeholder:text-slate-500 text-sm
    focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
    transition-all duration-150`

  const errorInputClasses = `${inputClasses} border-red-500/50 focus:ring-red-500/30 focus:border-red-500`

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="https://images.pexels.com/photos/2199293/pexels-photo-2199293.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
          alt="Fleet trucks"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <div className="max-w-md">
            <h2 className="text-3xl font-bold text-white mb-3">
              Join Your Fleet Team
            </h2>
            <p className="text-slate-300 text-lg leading-relaxed">
              Create your account to access training modules, track compliance, and stay DOT-ready.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8">
            <ThemeLogo className="w-10 h-10 rounded-xl" iconSize={22} />
            <div>
              <h1 className="text-xl font-bold text-white">DOT Copilot</h1>
              <p className="text-sm text-slate-400">{displayName}</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Create Account</h2>
            <p className="text-slate-400 mb-6">Register to get started with your fleet portal</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {serverError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
                <AlertCircle size={16} className="shrink-0" />
                {serverError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                className={form.formState.errors.name ? errorInputClasses : inputClasses}
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-red-400">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                placeholder="you@company.com"
                className={form.formState.errors.email ? errorInputClasses : inputClasses}
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="mt-1 text-xs text-red-400">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  className={`${form.formState.errors.password ? errorInputClasses : inputClasses} pr-10`}
                  {...form.register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="mt-1 text-xs text-red-400">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter your password"
                className={form.formState.errors.confirmPassword ? errorInputClasses : inputClasses}
                {...form.register('confirmPassword')}
              />
              {form.formState.errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-400">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800
                         text-white font-medium text-sm transition-colors duration-150
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>

          <p className="mt-6 text-center text-xs text-slate-500">
            Protected by DOT Copilot &middot; {displayName}
          </p>
        </div>
      </div>
    </div>
  )
}
