import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AdminLoginPage } from './AdminLoginPage'
import { AdminLayout } from './AdminLayout'
import { AdminFleetsPage } from './AdminFleetsPage'
import { NewFleetWizard } from './NewFleetWizard'
import { AdminFleetDetailPage } from './AdminFleetDetailPage'
import { PlatformAdminRoute } from './PlatformAdminRoute'
import { ErrorBoundary } from '../components/ErrorBoundary'

function AdminPublicRoute({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [isAuthedAdmin, setIsAuthedAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        if (!cancelled) {
          setIsAuthedAdmin(false)
          setChecking(false)
        }
        return
      }

      const { data } = (await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', session.user.id)
        .maybeSingle()) as { data: { is_platform_admin: boolean } | null }

      if (!cancelled) {
        setIsAuthedAdmin(!!data?.is_platform_admin)
        setChecking(false)
      }
    }

    check()
    return () => { cancelled = true }
  }, [])

  if (checking) return null
  if (isAuthedAdmin) return <Navigate to="/fleets" replace />
  return <>{children}</>
}

export default function AdminApp() {
  useEffect(() => {
    document.title = 'DOT-Copilot Platform Administration — Dobeu Tech Solutions'
  }, [])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AdminPublicRoute><AdminLoginPage /></AdminPublicRoute>} />

          <Route element={<PlatformAdminRoute><AdminLayout /></PlatformAdminRoute>}>
            <Route path="/fleets" element={<AdminFleetsPage />} />
            <Route path="/fleets/new" element={<NewFleetWizard />} />
            <Route path="/fleets/:id" element={<AdminFleetDetailPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
