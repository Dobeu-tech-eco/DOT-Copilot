import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { applyTheme, DEFAULT_THEME, resolveFleetTheme, type AppTheme } from '../lib/theme'

const ThemeContext = createContext<AppTheme>(DEFAULT_THEME)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const fleetId = useAuthStore(state => state.user?.fleet_id ?? null)
  const fleet = useAppStore(state => state.fleet)
  const fleetLoading = useAppStore(state => Boolean(state.loading.fleet))
  const fetchFleet = useAppStore(state => state.fetchFleet)
  const activeFleet = fleetId && fleet?.id === fleetId ? fleet : null
  const theme = useMemo(() => resolveFleetTheme(activeFleet), [activeFleet])

  useEffect(() => {
    applyTheme(theme)
    document.title = `DOT Copilot - ${theme.displayName}`
  }, [theme])

  useEffect(() => {
    if (fleetId && fleet?.id !== fleetId && !fleetLoading) {
      void fetchFleet(fleetId).catch(() => undefined)
    }
  }, [fetchFleet, fleet?.id, fleetId, fleetLoading])

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

export function useTheme(): AppTheme {
  return useContext(ThemeContext)
}
