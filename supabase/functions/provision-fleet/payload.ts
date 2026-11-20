// Validate before any service-role writes. This is shape validation, not an
// invitation policy or redirect allowlist; Auth must enforce allowed redirects.
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object')
  return value as Record<string, unknown>
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new Error('Invalid text')
  }
  return value.trim()
}

export function parseProvisionPayload(value: unknown) {
  const payload = object(value)
  const fleet = object(payload.fleet)
  const admin = object(payload.admin)
  const email = text(admin.email, 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email')
  const origin = new URL(text(payload.redirect_origin, 2048))
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password ||
    origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Expected web origin')
  return {
    fleet: {
      name: text(fleet.name, 200),
      address: fleet.address == null || fleet.address === '' ? null : text(fleet.address, 1000),
    },
    admin: { email, full_name: text(admin.full_name, 200) },
    redirect_origin: origin.origin,
  }
}
