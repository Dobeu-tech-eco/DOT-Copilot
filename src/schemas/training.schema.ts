import { z } from 'zod'

export const trainingProgramSchema = z.object({
  program_name: z.string().min(1, 'Program name is required'),
  description: z.string().optional(),
  estimated_duration: z.number().int().positive().optional().nullable(),
  is_recommended: z.boolean(),
  template_category: z.string().optional(),
  compliance_requirement_id: z.string().optional().nullable(),
})

export type TrainingProgramFormData = z.infer<typeof trainingProgramSchema>

const CONTENT_TYPES = ['VIDEO', 'PDF', 'POWERPOINT', 'SCORM', 'TEXT', 'IMAGE', 'QUICK_ACKNOWLEDGE'] as const

export const assignmentSchema = z.object({
  user_id: z.string().min(1, 'Driver is required'),
  training_program_id: z.string().min(1, 'Training program is required'),
  due_date: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
})

export type AssignmentFormData = z.infer<typeof assignmentSchema>
export { CONTENT_TYPES }
