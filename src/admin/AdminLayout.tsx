import { useEffect } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ShieldAlert, Building2, LogOut } from 'lucide-react'

export function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    document.title = 'DOT-Copilot Platform Administration — Dobeu Tech Solutions'
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
              <ShieldAlert size={18} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight">DOT-Copilot Platform Administration</div>
              <div className="text-[11px] text-slate-400 leading-tight">Dobeu Tech Solutions</div>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            <button
              onClick={() => navigate('/fleets')}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${isActive('/fleets') ? 'bg-amber-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800'}
              `}
            >
              <Building2 size={16} />
              Fleets
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 lg:px-6 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-4 text-center text-xs text-gray-500">
          Dobeu Tech Solutions LLC &mdash; internal use only
        </div>
      </footer>
    </div>
  )
}
