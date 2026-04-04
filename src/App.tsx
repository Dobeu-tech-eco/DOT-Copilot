import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { Layout } from './components/Layout'
import { LoadingSpinner } from './components/LoadingSpinner'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CompliancePage } from './pages/CompliancePage'
import { TrainingPage } from './pages/TrainingPage'
import { VehiclesPage } from './pages/VehiclesPage'
import { UsersPage } from './pages/UsersPage'
import { SettingsPage } from './pages/SettingsPage'
import { NotFoundPage } from './pages/NotFoundPage'

import type { UserRole } from './types/database'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

function RoleRoute({ children, roles }: { children: React.ReactNode; roles: UserRole[] }) {
  const { user } = useAuthStore()
  if (!user?.role || !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />

        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/compliance" element={<CompliancePage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/vehicles" element={<RoleRoute roles={['ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR']}><VehiclesPage /></RoleRoute>} />
          <Route path="/users" element={<RoleRoute roles={['ADMIN', 'BRANCH_MANAGER']}><UsersPage /></RoleRoute>} />
          <Route path="/settings" element={<RoleRoute roles={['ADMIN']}><SettingsPage /></RoleRoute>} />
          <Route path="/notifications" element={<DashboardPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
