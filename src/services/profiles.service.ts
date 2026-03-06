import { supabase } from '../lib/supabase'
import type { ProfileFormData, CreateUserFormData } from '../schemas/profile.schema'

export async function getProfiles(fleetId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('fleet_id', fleetId)
    .order('name')
  if (error) throw error
  return data
}

export async function updateProfile(id: string, updates: Partial<ProfileFormData>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleUserActive(id: string, isActive: boolean) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_active: isActive } as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createUserViaEdge(fleetId: string, userData: CreateUserFormData) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ ...userData, fleet_id: fleetId }),
    },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create user' }))
    throw new Error(err.error || 'Failed to create user')
  }
  return res.json()
}
