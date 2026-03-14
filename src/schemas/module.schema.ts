import { z } from 'zod'

export const moduleSchema = z.object({
  module_name: z.string().min(1, 'Module name is required'),
  description: z.string().optional(),
  sequence_order: z.number().int().min(0).default(0),
  estimated_duration: z.number().int().positive().optional().nullable(),
  passing_score: z.number().int().min(0).max(100).default(80),
})

export type ModuleFormData = z.infer<typeof moduleSchema>

export const lessonSchema = z.object({
  lesson_name: z.string().min(1, 'Lesson name is required'),
  content_type: z.enum(['VIDEO', 'PDF', 'POWERPOINT', 'SCORM', 'TEXT', 'IMAGE', 'QUICK_ACKNOWLEDGE']),
  content: z.string().optional().nullable(),
  file_url: z.string().url('Must be a valid URL').optional().nullable().or(z.literal('')),
  video_url: z.string().url('Must be a valid URL').optional().nullable().or(z.literal('')),
  video_duration: z.number().int().positive().optional().nullable(),
  acknowledgment_text: z.string().optional().nullable(),
  sequence_order: z.number().int().min(0).default(0),
  estimated_duration: z.number().int().positive().optional().nullable(),
  requires_esignature: z.boolean().default(false),
})

export type LessonFormData = z.infer<typeof lessonSchema>
