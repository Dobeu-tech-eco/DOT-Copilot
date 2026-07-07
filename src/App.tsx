import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { supabase } from './lib/supabase'
import { Layout } from './components/Layout'
import { LoadingSpinner } from './components/LoadingSpinner'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastContainer } from './components/ToastContainer'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { WelcomePage } from './pages/WelcomePage'
import { DashboardPage } from './pages/DashboardPage'
import { CompliancePage } from './pages/CompliancePage'
import { TrainingPage } from './pages/TrainingPage'
import { VehiclesPage } from './pages/VehiclesPage'
import { UsersPage } from './pages/UsersPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { AdminFleetsPage, NewFleetWizard } from './pages/admin'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function PlatformAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore()
  const [checking, setChecking] = useState(true)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      if (!user?.id) {
        if (!cancelled) {
          setIsPlatformAdmin(false)
          setChecking(false)
        }
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', user.id)
        .maybeSingle() as { data: { is_platform_admin: boolean } | null }

      if (!cancelled) {
        setIsPlatformAdmin(!!data?.is_platform_admin)
        setChecking(false)
      }
    }

    check()
    return () => { cancelled = true }
  }, [user?.id])

  if (!isAuthenticated) return <Navigate to="/" replace />
  if (checking) return null
  if (!isPlatformAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const { initialize, initialized } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/welcome" element={<WelcomePage />} />

          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/compliance" element={<CompliancePage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/vehicles" element={<VehiclesPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<PlatformAdminRoute><AdminFleetsPage /></PlatformAdminRoute>} />
            <Route path="/admin/fleets/new" element={<PlatformAdminRoute><NewFleetWizard /></PlatformAdminRoute>} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
