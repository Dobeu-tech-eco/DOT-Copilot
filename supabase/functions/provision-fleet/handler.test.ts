import { createProvisionHandler } from './handler.ts'

Deno.test('malformed JSON and payloads return 400 without a privileged client', async () => {
  for (const body of ['{', 'null', '{}', JSON.stringify({ fleet: { name: 123 }, admin: {} })]) {
    let clients = 0
    const factory = (() => {
      clients++
      if (clients > 1) throw new Error('Privileged client must not be created')
      return {
        auth: { getUser: async () => ({ data: { user: { id: 'operator' } }, error: null }) },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
          data: { id: 'operator', is_active: true, is_platform_admin: true }, error: null,
        }) }) }) }),
      }
    }) as unknown as NonNullable<Parameters<typeof createProvisionHandler>[0]>
    const handler = createProvisionHandler(factory, () => 'local-test')
    const response = await handler(new Request('http://localhost/provision-fleet', {
      method: 'POST', headers: { Authorization: 'Bearer local-test' }, body,
    }))
    if (response.status !== 400 || clients !== 1) throw new Error('Request was not rejected before writes')
  }
})
Deno.test('missing authorization returns 401 before client creation', async () => {
  const factory = (() => { throw new Error('Unexpected client') }) as unknown as NonNullable<Parameters<typeof createProvisionHandler>[0]>
  const response = await createProvisionHandler(factory)(new Request('http://localhost/provision-fleet', { method: 'POST' }))
  if (response.status !== 401) throw new Error('Expected 401')
})
