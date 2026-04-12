import { z } from 'zod'

const DOCUMENT_TYPES = [
  'CDL', 'MEDICAL_CARD', 'HAZMAT_ENDORSEMENT', 'TWIC_CARD', 'PASSPORT',
  'MVR', 'DRUG_TEST', 'BACKGROUND_CHECK', 'STATE_PERMIT',
  'FOOD_HANDLER_CERT', 'REFRIGERATED_TRANSPORT_QUAL', 'OTHER',
] as const

const COMPLIANCE_STATUSES = [
  'COMPLIANT', 'EXPIRING_SOON', 'EXPIRED', 'NOT_STARTED', 'IN_PROGRESS', 'WAIVED',
] as const

export const driverDocumentSchema = z.object({
  user_id: z.string().min(1, 'Driver is required'),
  document_type: z.enum(DOCUMENT_TYPES, { message: 'Document type is required' }),
  document_number: z.string().optional(),
  issued_date: z.string().optional(),
  expiration_date: z.string().min(1, 'Expiration date is required'),
  issuing_state: z.string().optional(),
  cdl_class: z.string().optional(),
  endorsements: z.array(z.string()).optional(),
  restrictions: z.array(z.string()).optional(),
})

export type DriverDocumentFormData = z.infer<typeof driverDocumentSchema>

export const complianceRecordSchema = z.object({
  status: z.enum(COMPLIANCE_STATUSES, { message: 'Status is required' }),
  completed_date: z.string().optional(),
  hours_completed: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional(),
})

export type ComplianceRecordFormData = z.infer<typeof complianceRecordSchema>

export const complianceRequirementSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  regulatory_body: z.string().min(1, 'Regulatory body is required'),
  required_hours: z.number().int().nonnegative().optional().nullable(),
  renewal_period: z.number().int().nonnegative().optional().nullable(),
  applies_to: z.array(z.string()),
  is_active: z.boolean(),
  alert_days: z.array(z.number()),
})

export type ComplianceRequirementFormData = z.infer<typeof complianceRequirementSchema>

export { DOCUMENT_TYPES, COMPLIANCE_STATUSES }
