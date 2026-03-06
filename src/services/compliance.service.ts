import { supabase } from '../lib/supabase'
import type { DriverDocumentFormData, ComplianceRecordFormData, ComplianceRequirementFormData } from '../schemas/compliance.schema'

export async function getComplianceRecords(fleetId: string) {
  const { data, error } = await supabase
    .from('driver_compliance')
    .select('*, compliance_requirements(*), profiles!inner(*)')
    .eq('profiles.fleet_id', fleetId)
  if (error) throw error
  return data
}

export async function updateComplianceRecord(id: string, updates: ComplianceRecordFormData) {
  const { data, error } = await supabase
    .from('driver_compliance')
    .update(updates as never)
    .eq('id', id)
    .select('*, compliance_requirements(*), profiles(*)')
    .single()
  if (error) throw error
  return data
}

export async function getDocuments(fleetId: string) {
  const { data, error } = await supabase
    .from('driver_documents')
    .select('*, profiles(*)')
    .eq('fleet_id', fleetId)
    .order('expiration_date')
  if (error) throw error
  return data
}

export async function createDocument(fleetId: string, doc: DriverDocumentFormData) {
  const { data, error } = await supabase
    .from('driver_documents')
    .insert({ ...doc, fleet_id: fleetId, status: 'active' } as never)
    .select('*, profiles(*)')
    .single()
  if (error) throw error
  return data
}

export async function updateDocument(id: string, updates: Partial<DriverDocumentFormData>) {
  const { data, error } = await supabase
    .from('driver_documents')
    .update(updates as never)
    .eq('id', id)
    .select('*, profiles(*)')
    .single()
  if (error) throw error
  return data
}

export async function deleteDocument(id: string) {
  const { error } = await supabase.from('driver_documents').delete().eq('id', id)
  if (error) throw error
}

export async function getComplianceRequirements(fleetId: string) {
  const { data, error } = await supabase
    .from('compliance_requirements')
    .select('*')
    .eq('fleet_id', fleetId)
  if (error) throw error
  return data
}

export async function createRequirement(fleetId: string, req: ComplianceRequirementFormData) {
  const { data, error } = await supabase
    .from('compliance_requirements')
    .insert({ ...req, fleet_id: fleetId } as never)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateRequirement(id: string, updates: Partial<ComplianceRequirementFormData>) {
  const { data, error } = await supabase
    .from('compliance_requirements')
    .update(updates as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
