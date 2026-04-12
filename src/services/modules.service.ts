import { supabase } from '../lib/supabase'
import type { ModuleFormData, LessonFormData } from '../schemas/module.schema'

export async function getModules(programId: string) {
  const { data, error } = await supabase
    .from('modules')
    .select('*')
    .eq('training_program_id', programId)
    .order('sequence_order')
  if (error) throw error
  return data
}

export async function createModule(fleetId: string, programId: string, data: ModuleFormData) {
  const { data: result, error } = await supabase
    .from('modules')
    .insert({ ...data, fleet_id: fleetId, training_program_id: programId } as never)
    .select()
    .single()
  if (error) throw error
  return result
}

export async function updateModule(id: string, data: Partial<ModuleFormData>) {
  const { data: result, error } = await supabase
    .from('modules')
    .update(data as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return result
}

export async function deleteModule(id: string) {
  const { error } = await supabase.from('modules').delete().eq('id', id)
  if (error) throw error
}

export async function getLessons(moduleId: string) {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('module_id', moduleId)
    .order('sequence_order')
  if (error) throw error
  return data
}

export async function getLessonsForProgram(programId: string, fleetId: string) {
  const { data: modules } = await supabase
    .from('modules')
    .select('id')
    .eq('training_program_id', programId)
    .eq('fleet_id', fleetId)
  if (!modules?.length) return []
  const moduleIds = modules.map((m: { id: string }) => m.id)
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .in('module_id', moduleIds)
    .order('sequence_order')
  if (error) throw error
  return data
}

export async function createLesson(fleetId: string, moduleId: string, data: LessonFormData) {
  const cleaned = {
    ...data,
    fleet_id: fleetId,
    module_id: moduleId,
    file_url: data.file_url || null,
    video_url: data.video_url || null,
  }
  const { data: result, error } = await supabase
    .from('lessons')
    .insert(cleaned as never)
    .select()
    .single()
  if (error) throw error
  return result
}

export async function updateLesson(id: string, data: Partial<LessonFormData>) {
  const cleaned = {
    ...data,
    file_url: data.file_url || null,
    video_url: data.video_url || null,
  }
  const { data: result, error } = await supabase
    .from('lessons')
    .update(cleaned as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return result
}

export async function deleteLesson(id: string) {
  const { error } = await supabase.from('lessons').delete().eq('id', id)
  if (error) throw error
}
