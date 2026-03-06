import { supabase } from '../lib/supabase'
import type { VehicleFormData } from '../schemas/vehicle.schema'

export async function getVehicles(fleetId: string) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*, profiles(*)')
    .eq('fleet_id', fleetId)
    .order('vehicle_number')
  if (error) throw error
  return data
}

export async function createVehicle(fleetId: string, vehicle: VehicleFormData) {
  const { data, error } = await supabase
    .from('vehicles')
    .insert({ ...vehicle, fleet_id: fleetId } as never)
    .select('*, profiles(*)')
    .single()
  if (error) throw error
  return data
}

export async function updateVehicle(id: string, updates: Partial<VehicleFormData>) {
  const { data, error } = await supabase
    .from('vehicles')
    .update(updates as never)
    .eq('id', id)
    .select('*, profiles(*)')
    .single()
  if (error) throw error
  return data
}

export async function deleteVehicle(id: string) {
  const { error } = await supabase.from('vehicles').delete().eq('id', id)
  if (error) throw error
}
