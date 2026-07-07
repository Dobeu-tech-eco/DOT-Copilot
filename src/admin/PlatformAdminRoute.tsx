import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type CheckState = 'checking' | 'authorized' | 'unauthorized'

export function PlatformAdminRoute({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CheckState>('checking')

  useEffect(() => {
    let cancelled = false

    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        if (!cancelled) setState('unauthorized')
        return
      }

      const { data } = (await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', session.user.id)
        .maybeSingle()) as { data: { is_platform_admin: boolean } | null }

      if (cancelled) return

      if (!data?.is_platform_admin) {
        // Not a platform admin — do not leave a session lying around in this build.
        await supabase.auth.signOut()
        if (!cancelled) setState('unauthorized')
        return
      }

      setState('authorized')
    }

    check()
    return () => { cancelled = true }
  }, [])

  if (state === 'checking') return null
  if (state === 'unauthorized') return <Navigate to="/" replace />
  return <>{children}</>
}
