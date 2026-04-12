import { z } from 'zod'

const USER_ROLES = ['DRIVER', 'DRIVER_COACH', 'SUPERVISOR', 'BRANCH_MANAGER', 'ADMIN'] as const

export const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  role: z.enum(USER_ROLES, { message: 'Role is required' }),
  phone: z.string().optional(),
  employee_id: z.string().optional(),
  hire_date: z.string().optional(),
  preferred_language: z.string().optional(),
  timezone: z.string().optional(),
})

export type ProfileFormData = z.infer<typeof profileSchema>

export const createUserSchema = z.object({
  email: z.string().email('Valid email required'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(USER_ROLES, { message: 'Role is required' }),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type CreateUserFormData = z.infer<typeof createUserSchema>

export const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password is required'),
})

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export type RegisterFormData = z.infer<typeof registerSchema>

export { USER_ROLES }
