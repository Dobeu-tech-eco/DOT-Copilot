import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Fleet } from '../types/database'

const themeState = vi.hoisted(() => ({
  fleetId: null as string | null,
  fleet: null as unknown,
  fleetLoading: false,
  fetchFleet: vi.fn<(fleetId: string) => Promise<void>>().mockResolvedValue(undefined),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { fleet_id: string } | null }) => unknown) => selector({
    user: themeState.fleetId ? { fleet_id: themeState.fleetId } : null,
  }),
}))

vi.mock('../store/appStore', () => ({
  useAppStore: (selector: (state: {
    fleet: unknown
    loading: { fleet: boolean }
    fetchFleet: (fleetId: string) => Promise<void>
  }) => unknown) => selector({
    fleet: themeState.fleet,
    loading: { fleet: themeState.fleetLoading },
    fetchFleet: themeState.fetchFleet,
  }),
}))

import { ThemeLogo } from './ThemeLogo'
import { ThemeProvider, useTheme } from './ThemeProvider'

function fleet(overrides: Partial<Fleet> = {}): Fleet {
  return {
    id: 'fleet-1',
    company_name: 'Acme Transport',
    locations: null,
    cargo_type: null,
    cdl_status: null,
    vehicle_types: null,
    key_risk_areas: null,
    operation_type: null,
    states_of_operation: null,
    onboarding_completed: true,
    compliance_profile_configured: true,
    logo_url: null,
    primary_color: null,
    secondary_color: null,
    default_language: 'en',
    enable_sms_notifications: false,
    enable_push_notifications: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function ThemeName() {
  return <span>{useTheme().displayName}</span>
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    themeState.fleetId = null
    themeState.fleet = null
    themeState.fleetLoading = false
    themeState.fetchFleet.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('style')
    delete document.documentElement.dataset.theme
  })

  it('renders and applies the Dobeu default for a signed-out user', async () => {
    render(<ThemeProvider><ThemeName /></ThemeProvider>)

    expect(screen.getByText('Dobeu Tech Solutions')).toBeInTheDocument()
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dobeu'))
    expect(themeState.fetchFleet).not.toHaveBeenCalled()
  })

  it('applies a matching fleet theme and displays its logo', async () => {
    themeState.fleetId = 'fleet-1'
    themeState.fleet = fleet({
      company_name: 'Acme Transport',
      primary_color: '#123456',
      logo_url: 'https://cdn.example.com/acme.svg',
    })

    render(
      <ThemeProvider>
        <ThemeName />
        <ThemeLogo className="h-10 w-10" iconSize={20} />
      </ThemeProvider>,
    )

    expect(screen.getByText('Acme Transport')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Acme Transport logo' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/acme.svg',
    )
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--color-brand-500')).toBe('18 52 86'))
    expect(document.title).toBe('DOT Copilot - Acme Transport')
    expect(themeState.fetchFleet).not.toHaveBeenCalled()
  })

  it('keeps the safe default while requesting a missing authenticated fleet', async () => {
    themeState.fleetId = 'fleet-2'
    themeState.fleet = fleet({ id: 'stale-fleet' })

    render(<ThemeProvider><ThemeName /></ThemeProvider>)

    expect(screen.getByText('Dobeu Tech Solutions')).toBeInTheDocument()
    await waitFor(() => expect(themeState.fetchFleet).toHaveBeenCalledWith('fleet-2'))
  })

  it('does not duplicate an in-flight fleet request', () => {
    themeState.fleetId = 'fleet-2'
    themeState.fleetLoading = true

    render(<ThemeProvider><ThemeName /></ThemeProvider>)

    expect(themeState.fetchFleet).not.toHaveBeenCalled()
  })
})
