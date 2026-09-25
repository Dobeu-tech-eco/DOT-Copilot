import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.tsx'
import AdminApp from './admin/AdminApp.tsx'
import { ThemeProvider } from './components/ThemeProvider.tsx'
import './index.css'

const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  })
}

const isAdminBuild = import.meta.env.VITE_APP_MODE === 'admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminBuild ? <AdminApp /> : <ThemeProvider><App /></ThemeProvider>}
  </StrictMode>,
)
