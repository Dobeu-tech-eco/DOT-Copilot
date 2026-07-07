import { useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { LayoutDashboard, Users, BookOpen, ShieldCheck, Truck, Bell, LogOut, Menu, X, ChevronDown, ChartBar as BarChart2, Settings } from 'lucide-react'
import type { UserRole } from '../types/database'

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
  roles: UserRole[]
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR', 'DRIVER_COACH', 'DRIVER'] },
  { path: '/compliance', label: 'Compliance', icon: <ShieldCheck size={20} />, roles: ['ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR', 'DRIVER_COACH', 'DRIVER'] },
  { path: '/training', label: 'Training', icon: <BookOpen size={20} />, roles: ['ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR', 'DRIVER_COACH', 'DRIVER'] },
  { path: '/vehicles', label: 'Fleet Vehicles', icon: <Truck size={20} />, roles: ['ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR'] },
  { path: '/users', label: 'User Management', icon: <Users size={20} />, roles: ['ADMIN', 'BRANCH_MANAGER'] },
  { path: '/reports', label: 'Reports', icon: <BarChart2 size={20} />, roles: ['ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR'] },
  { path: '/settings', label: 'Settings', icon: <Settings size={20} />, roles: ['ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR', 'DRIVER_COACH', 'DRIVER'] },
]

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { notifications } = useAppStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const unreadCount = notifications.filter(n => !n.is_read).length

  const filteredNavItems = navItems.filter(item =>
    user?.role && item.roles.includes(user.role)
  )

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const handleNav = (path: string) => {
    navigate(path)
    setSidebarOpen(false)
  }

  const roleLabel = (role: UserRole | undefined) => {
    const labels: Record<UserRole, string> = {
      ADMIN: 'Administrator',
      BRANCH_MANAGER: 'Branch Manager',
      SUPERVISOR: 'Supervisor',
      DRIVER_COACH: 'Driver Coach',
      DRIVER: 'Driver',
    }
    return role ? labels[role] : ''
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0 lg:static lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNav('/dashboard')}>
            <div className="w-8 h-8 rounded-lg bg-baldor-500 flex items-center justify-center">
              <Truck size={18} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight">DOT Copilot</div>
              <div className="text-[11px] text-slate-400 leading-tight">Baldor Food Company</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {filteredNavItems.map(item => {
            const isActive = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors duration-150
                  ${isActive
                    ? 'bg-baldor-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }
                `}
              >
                {item.icon}
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="p-3 border-t border-slate-700/50">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-baldor-600 flex items-center justify-center text-sm font-medium">
                {user?.name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-medium text-white truncate">{user?.name ?? user?.email}</div>
                <div className="text-xs text-slate-400">{roleLabel(user?.role)}</div>
              </div>
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 rounded-lg border border-slate-700 shadow-lg overflow-hidden animate-fade-in">
                <button
                  onClick={() => { handleNav('/settings'); setUserMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  <Settings size={16} />
                  Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700"
          >
            <Menu size={20} />
          </button>

          <div className="hidden lg:block">
            <h1 className="text-lg font-semibold text-gray-900">
              {filteredNavItems.find(i => i.path === location.pathname)?.label ?? 'DOT Copilot'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleNav('/notifications')}
              className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
