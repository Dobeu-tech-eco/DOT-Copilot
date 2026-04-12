import { z } from 'zod'

export const VEHICLE_TYPES = ['refrigerated_truck', 'delivery_van', 'dry_goods_truck', 'box_truck', 'other'] as const

export const vehicleSchema = z.object({
  vehicle_number: z.string().min(1, 'Vehicle number is required'),
  vehicle_type: z.enum(VEHICLE_TYPES, { message: 'Vehicle type is required' }),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1).optional().nullable(),
  license_plate: z.string().optional(),
  has_temperature_monitoring: z.boolean(),
  assigned_route: z.string().optional(),
  assigned_driver_id: z.string().optional().nullable(),
  notes: z.string().optional(),
  last_inspection_date: z.string().optional(),
  next_inspection_due: z.string().optional(),
})

export type VehicleFormData = z.infer<typeof vehicleSchema>
