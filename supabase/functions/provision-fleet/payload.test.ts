import { parseProvisionPayload } from './payload.ts'

const valid = () => ({
  fleet: { name: ' Test Fleet ', address: ' 1 Main St ' },
  admin: { email: ' ADMIN@example.invalid ', full_name: ' Fleet Admin ' },
  redirect_origin: 'https://app.example.invalid/',
})
Deno.test('normalizes the request before fleet creation and invitation', () => {
  const result = parseProvisionPayload(valid())
  if (result.fleet.name !== 'Test Fleet' || result.admin.email !== 'admin@example.invalid' ||
    result.redirect_origin !== 'https://app.example.invalid') throw new Error('Normalization failed')
})
const invalid: unknown[] = [null, [], 'text', {},
  { ...valid(), fleet: null },
  { ...valid(), fleet: { name: '   ' } },
  { ...valid(), fleet: { name: 123 } },
  { ...valid(), fleet: { name: 'x'.repeat(201) } },
  { ...valid(), admin: { email: {}, full_name: 'Admin' } },
  { ...valid(), admin: { email: 'not-an-email', full_name: 'Admin' } },
  ...['javascript:alert(1)', 'https://user:password@example.invalid',
    'https://example.invalid/path', 'https://example.invalid/?next=evil',
    'https://example.invalid/#fragment'].map(redirect_origin => ({ ...valid(), redirect_origin })),
]
invalid.forEach((value, index) => Deno.test(`rejects malformed payload ${index + 1}`, () => {
  let rejected = false
  try { parseProvisionPayload(value) } catch { rejected = true }
  if (!rejected) throw new Error('Malformed payload accepted')
}))
Deno.test('allows a disposable local web origin', () => {
  parseProvisionPayload({ ...valid(), redirect_origin: 'http://127.0.0.1:5173' })
})
