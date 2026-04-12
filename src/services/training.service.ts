import { supabase } from '../lib/supabase'
import type { TrainingProgramFormData, AssignmentFormData } from '../schemas/training.schema'

export async function getTrainingPrograms(fleetId: string) {
  const { data, error } = await supabase
    .from('training_programs')
    .select('*')
    .eq('fleet_id', fleetId)
    .order('program_name')
  if (error) throw error
  return data
}

export async function createTrainingProgram(fleetId: string, program: TrainingProgramFormData) {
  const { data, error } = await supabase
    .from('training_programs')
    .insert({ ...program, fleet_id: fleetId } as never)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTrainingProgram(id: string, updates: Partial<TrainingProgramFormData>) {
  const { data, error } = await supabase
    .from('training_programs')
    .update(updates as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTrainingProgram(id: string) {
  const { error } = await supabase.from('training_programs').delete().eq('id', id)
  if (error) throw error
}

export async function getAssignments(fleetId: string) {
  const { data, error } = await supabase
    .from('assignments')
    .select('*, profiles(*), training_programs(*), modules(*)')
    .eq('fleet_id', fleetId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createAssignment(fleetId: string, assignedBy: string, assignment: AssignmentFormData) {
  const { data, error } = await supabase
    .from('assignments')
    .insert({ ...assignment, fleet_id: fleetId, assigned_by: assignedBy } as never)
    .select('*, profiles(*), training_programs(*), modules(*)')
    .single()
  if (error) throw error
  return data
}

export async function deleteAssignment(id: string) {
  const { error } = await supabase.from('assignments').delete().eq('id', id)
  if (error) throw error
}
