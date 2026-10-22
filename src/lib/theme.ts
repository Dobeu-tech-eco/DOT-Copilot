import type { Fleet } from '../types/database'

export const BRAND_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

export type BrandShade = (typeof BRAND_SHADES)[number]
export type BrandScale = Record<BrandShade, string>

export interface AppTheme {
  key: 'dobeu' | 'baldor' | 'tenant'
  displayName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  colors: BrandScale
}

const DOBEU_COLORS: BrandScale = {
  50: '#EFF7FF',
  100: '#DBEBFE',
  200: '#BFDBFE',
  300: '#93C5FD',
  400: '#60A5FA',
  500: '#0066CC',
  600: '#0052A3',
  700: '#004488',
  800: '#07396F',
  900: '#0C315B',
  950: '#081F3A',
}

const BALDOR_COLORS: BrandScale = {
  50: '#F0F7F0',
  100: '#DCEEDE',
  200: '#BADCBE',
  300: '#8CC494',
  400: '#5CA867',
  500: '#3A8B45',
  600: '#2C6F35',
  700: '#24592C',
  800: '#1F4725',
  900: '#1A3B20',
  950: '#0D2012',
}

export const DEFAULT_THEME: AppTheme = {
  key: 'dobeu',
  displayName: 'Dobeu Tech Solutions',
  logoUrl: null,
  primaryColor: DOBEU_COLORS[500],
  secondaryColor: '#4A4A4A',
  colors: DOBEU_COLORS,
}

const BALDOR_THEME: AppTheme = {
  key: 'baldor',
  displayName: 'Baldor Food Company',
  logoUrl: null,
  primaryColor: BALDOR_COLORS[500],
  secondaryColor: BALDOR_COLORS[700],
  colors: BALDOR_COLORS,
}

function normalizeHex(value: string | null | undefined): string | null {
  const match = value?.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)
  if (!match) return null

  const digits = match[1].length === 3
    ? [...match[1]].map(char => `${char}${char}`).join('')
    : match[1]

  return `#${digits.toUpperCase()}`
}

function normalizeLogoUrl(value: string | null | undefined): string | null {
  const candidate = value?.trim()
  if (!candidate) return null
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate

  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function toRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ]
}

function toHex([red, green, blue]: [number, number, number]): string {
  return `#${[red, green, blue]
    .map(channel => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase()
}

function mix(hex: string, target: '#FFFFFF' | '#000000', targetWeight: number): string {
  const sourceRgb = toRgb(hex)
  const targetRgb = toRgb(target)
  return toHex(sourceRgb.map((channel, index) => (
    channel * (1 - targetWeight) + targetRgb[index] * targetWeight
  )) as [number, number, number])
}

export function createBrandScale(primaryColor: string): BrandScale {
  const primary = normalizeHex(primaryColor) ?? DEFAULT_THEME.primaryColor

  return {
    50: mix(primary, '#FFFFFF', 0.94),
    100: mix(primary, '#FFFFFF', 0.86),
    200: mix(primary, '#FFFFFF', 0.72),
    300: mix(primary, '#FFFFFF', 0.52),
    400: mix(primary, '#FFFFFF', 0.26),
    500: primary,
    600: mix(primary, '#000000', 0.15),
    700: mix(primary, '#000000', 0.30),
    800: mix(primary, '#000000', 0.45),
    900: mix(primary, '#000000', 0.60),
    950: mix(primary, '#000000', 0.76),
  }
}

function isBaldorFleet(fleet: Fleet): boolean {
  return /\bbaldor\b/i.test(fleet.company_name)
}

export function resolveFleetTheme(fleet?: Fleet | null): AppTheme {
  if (!fleet) return DEFAULT_THEME

  const preset = isBaldorFleet(fleet) ? BALDOR_THEME : DEFAULT_THEME
  const primaryColor = normalizeHex(fleet.primary_color) ?? preset.primaryColor
  const secondaryColor = normalizeHex(fleet.secondary_color) ?? preset.secondaryColor
  const usesPresetScale = primaryColor === preset.primaryColor

  return {
    key: preset.key === 'baldor' ? 'baldor' : 'tenant',
    displayName: fleet.company_name.trim() || DEFAULT_THEME.displayName,
    logoUrl: normalizeLogoUrl(fleet.logo_url),
    primaryColor,
    secondaryColor,
    colors: usesPresetScale ? preset.colors : createBrandScale(primaryColor),
  }
}

function rgbChannels(hex: string): string {
  return toRgb(hex).join(' ')
}

export function applyTheme(theme: AppTheme, root: HTMLElement = document.documentElement): void {
  for (const shade of BRAND_SHADES) {
    root.style.setProperty(`--color-brand-${shade}`, rgbChannels(theme.colors[shade]))
  }
  root.style.setProperty('--color-brand-secondary', rgbChannels(theme.secondaryColor))
  root.dataset.theme = theme.key
}
