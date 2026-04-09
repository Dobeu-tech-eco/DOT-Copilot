import { z } from 'zod';
import { sendError } from '../utils/response';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').optional(),
  fleetId: z.string().optional(),
  role: z.enum(['DRIVER', 'DRIVER_COACH', 'SUPERVISOR', 'BRANCH_MANAGER', 'ADMIN']).optional(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// User schemas
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
  role: z.enum(['DRIVER', 'SUPERVISOR', 'ADMIN']).optional(),
  fleetId: z.string().optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  name: z.string().optional(),
  role: z.enum(['DRIVER', 'SUPERVISOR', 'ADMIN']).optional(),
  fleetId: z.string().nullable().optional(),
});

// Fleet schemas
export const createFleetSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  locations: z.string().optional(),
  cargoType: z.string().optional(),
  cdlStatus: z.string().optional(),
  vehicleTypes: z.string().optional(),
  keyRiskAreas: z.string().optional(),
  operationType: z.string().optional(),
  statesOfOperation: z.string().optional(),
  onboardingCompleted: z.boolean().optional(),
  complianceProfileConfigured: z.boolean().optional(),
});

export const updateFleetSchema = createFleetSchema.partial();

// Agent-native primitive tools (orchestrator calls these; same authz as REST)
export const agentInvokeSchema = z.object({
  tool: z.enum(['complete_task', 'list_assignments', 'update_assignment_status']),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

// Training Program schemas
export const createTrainingProgramSchema = z.object({
  programName: z.string().min(1, 'Program name is required'),
  description: z.string().optional(),
  isRecommended: z.boolean().optional(),
  fleetId: z.string().min(1, 'Fleet ID is required'),
});

export const updateTrainingProgramSchema = createTrainingProgramSchema.partial();

// Module schemas
export const createModuleSchema = z.object({
  moduleName: z.string().min(1, 'Module name is required'),
  description: z.string().optional(),
  sequenceOrder: z.number().int().optional(),
  fleetId: z.string().min(1, 'Fleet ID is required'),
  trainingProgramId: z.string().min(1, 'Training program ID is required'),
});

export const updateModuleSchema = createModuleSchema.partial();

// Lesson schemas
export const createLessonSchema = z.object({
  lessonName: z.string().min(1, 'Lesson name is required'),
  content: z.string().optional(),
  contentType: z.string().optional(),
  fileUrl: z.string().url().optional().nullable(),
  sequenceOrder: z.number().int().optional(),
  requiresEsignature: z.boolean().optional(),
  fleetId: z.string().min(1, 'Fleet ID is required'),
  moduleId: z.string().min(1, 'Module ID is required'),
});

export const updateLessonSchema = createLessonSchema.partial();

// Assignment schemas
export const createAssignmentSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  fleetId: z.string().min(1, 'Fleet ID is required'),
  moduleId: z.string().optional(),
  trainingProgramId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  status: z.string().optional(),
});

export const updateAssignmentSchema = z.object({
  status: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
});

// Notification schemas
export const createNotificationSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  notificationType: z.string().min(1, 'Notification type is required'),
  userId: z.string().min(1, 'User ID is required'),
  fleetId: z.string().optional(),
  relatedAssignmentId: z.string().optional(),
});

// Completion Record schemas
export const createCompletionRecordSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  fleetId: z.string().min(1, 'Fleet ID is required'),
  lessonId: z.string().optional(),
  moduleId: z.string().optional(),
  assignmentId: z.string().optional(),
  quizScore: z.number().int().min(0).max(100).optional(),
  esignature: z.string().optional(),
});

// Quiz Question schemas
export const createQuizQuestionSchema = z.object({
  questionText: z.string().min(1, 'Question text is required'),
  answerOptions: z.string().min(1, 'Answer options are required'),
  correctAnswer: z.string().min(1, 'Correct answer is required'),
  sequenceOrder: z.number().int().optional(),
  lessonId: z.string().min(1, 'Lesson ID is required'),
});

export const updateQuizQuestionSchema = createQuizQuestionSchema.partial();

// Quiz Response schemas
export const createQuizResponseSchema = z.object({
  selectedAnswer: z.string().min(1, 'Selected answer is required'),
  quizQuestionId: z.string().min(1, 'Quiz question ID is required'),
  completionRecordId: z.string().optional(),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Validation helper
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(
          res,
          'Validation failed',
          'VALIDATION_ERROR',
          400,
          error.issues.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        );
      }
      next(error);
    }
  };
}

export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(
          res,
          'Validation failed',
          'VALIDATION_ERROR',
          400,
          error.issues.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        );
      }
      next(error);
    }
  };
}
