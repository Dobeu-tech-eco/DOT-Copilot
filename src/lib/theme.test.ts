import { afterEach, describe, expect, it } from 'vitest'
import type { Fleet } from '../types/database'
import { applyTheme, createBrandScale, DEFAULT_THEME, resolveFleetTheme } from './theme'

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

describe('resolveFleetTheme', () => {
  it('uses the Dobeu theme when no fleet has loaded', () => {
    expect(resolveFleetTheme()).toEqual(DEFAULT_THEME)
  })

  it('preserves the Baldor pilot palette inside the theme layer', () => {
    const theme = resolveFleetTheme(fleet({ company_name: 'Baldor Specialty Foods Inc' }))

    expect(theme).toMatchObject({
      key: 'baldor',
      displayName: 'Baldor Specialty Foods Inc',
      primaryColor: '#3A8B45',
      secondaryColor: '#24592C',
    })
    expect(theme.colors[50]).toBe('#F0F7F0')
    expect(theme.colors[600]).toBe('#2C6F35')
  })

  it('normalizes fleet colors and an HTTPS logo override', () => {
    const theme = resolveFleetTheme(fleet({
      primary_color: '#123',
      secondary_color: '#abcdef',
      logo_url: ' https://cdn.example.com/logo.svg ',
    }))

    expect(theme).toMatchObject({
      key: 'tenant',
      displayName: 'Acme Transport',
      primaryColor: '#112233',
      secondaryColor: '#ABCDEF',
      logoUrl: 'https://cdn.example.com/logo.svg',
    })
    expect(theme.colors[500]).toBe('#112233')
  })

  it('rejects unsafe or malformed branding values and retains safe defaults', () => {
    const theme = resolveFleetTheme(fleet({
      company_name: '   ',
      primary_color: 'red; background: url(evil)',
      secondary_color: '#12',
      logo_url: 'javascript:alert(1)',
    }))

    expect(theme.displayName).toBe(DEFAULT_THEME.displayName)
    expect(theme.primaryColor).toBe(DEFAULT_THEME.primaryColor)
    expect(theme.secondaryColor).toBe(DEFAULT_THEME.secondaryColor)
    expect(theme.logoUrl).toBeNull()
  })

  it('accepts root-relative logo paths but rejects protocol-relative URLs', () => {
    expect(resolveFleetTheme(fleet({ logo_url: '/tenant/logo.svg' })).logoUrl).toBe('/tenant/logo.svg')
    expect(resolveFleetTheme(fleet({ logo_url: '//tracker.example/logo.svg' })).logoUrl).toBeNull()
  })
})

describe('theme color tokens', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style')
    delete document.documentElement.dataset.theme
  })

  it('creates light and dark shades around a normalized primary color', () => {
    const scale = createBrandScale('#369')

    expect(scale[500]).toBe('#336699')
    expect(Number.parseInt(scale[50].slice(1, 3), 16)).toBeGreaterThan(Number.parseInt(scale[500].slice(1, 3), 16))
    expect(Number.parseInt(scale[900].slice(1, 3), 16)).toBeLessThan(Number.parseInt(scale[500].slice(1, 3), 16))
  })

  it('applies the resolved palette as Tailwind-compatible RGB variables', () => {
    const theme = resolveFleetTheme(fleet({ primary_color: '#123456', secondary_color: '#abcdef' }))

    applyTheme(theme)

    expect(document.documentElement.style.getPropertyValue('--color-brand-500')).toBe('18 52 86')
    expect(document.documentElement.style.getPropertyValue('--color-brand-secondary')).toBe('171 205 239')
    expect(document.documentElement.dataset.theme).toBe('tenant')
  })
})
