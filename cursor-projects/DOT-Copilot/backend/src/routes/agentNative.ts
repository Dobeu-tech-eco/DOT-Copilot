import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, agentInvokeSchema } from '../schemas';

const router = Router();

router.use(authenticate);
router.use(requireRole('ADMIN', 'SUPERVISOR', 'BRANCH_MANAGER'));

/**
 * Agent-native API: atomic tools with fleet parity. An LLM orchestrator calls POST /invoke
 * with tool + arguments instead of bundling business logic in one mega-endpoint.
 */
router.get('/tools', (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    data: {
      tools: [
        {
          name: 'list_assignments',
          description: 'List assignments for the authenticated user fleet (read-only).',
          parameters: { type: 'object', properties: { limit: { type: 'number', default: 50 } } },
        },
        {
          name: 'update_assignment_status',
          description: 'Update assignment status within the fleet (same outcome as PATCH via UI when exposed).',
          parameters: {
            type: 'object',
            required: ['assignmentId', 'status'],
            properties: {
              assignmentId: { type: 'string' },
              status: { type: 'string', description: 'e.g. pending, in_progress, completed, overdue' },
            },
          },
        },
        {
          name: 'complete_task',
          description: 'Explicit completion signal for an agent turn (summary for audit logs).',
          parameters: {
            type: 'object',
            required: ['summary'],
            properties: { summary: { type: 'string' } },
          },
        },
      ],
    },
  });
});

router.post('/invoke', validateBody(agentInvokeSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fleetId = req.user?.fleetId;
    if (!fleetId) {
      return res.status(403).json({ error: 'Fleet context required' });
    }

    const { tool, arguments: args } = req.body as { tool: string; arguments: Record<string, unknown> };

    switch (tool) {
      case 'list_assignments': {
        const limit = Math.min(Number(args.limit) || 50, 200);
        const rows = await prisma.assignment.findMany({
          where: { fleetId },
          take: limit,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            status: true,
            dueDate: true,
            userId: true,
            moduleId: true,
            trainingProgramId: true,
            updatedAt: true,
          },
        });
        return res.json({ data: { assignments: rows } });
      }

      case 'update_assignment_status': {
        const assignmentId = args.assignmentId as string | undefined;
        const status = args.status as string | undefined;
        if (!assignmentId || !status) {
          return res.status(400).json({ error: 'assignmentId and status are required' });
        }
        const existing = await prisma.assignment.findFirst({
          where: { id: assignmentId, fleetId },
        });
        if (!existing) {
          return res.status(404).json({ error: 'Assignment not found' });
        }
        const updated = await prisma.assignment.update({
          where: { id: assignmentId },
          data: { status },
          select: { id: true, status: true, updatedAt: true },
        });
        return res.json({ data: { assignment: updated } });
      }

      case 'complete_task': {
        const summary = args.summary as string | undefined;
        if (!summary || typeof summary !== 'string') {
          return res.status(400).json({ error: 'summary is required' });
        }
        return res.json({
          data: {
            completed: true,
            summary,
            completedAt: new Date().toISOString(),
            completedBy: req.user?.userId,
          },
        });
      }

      default:
        return res.status(400).json({ error: 'Unknown tool' });
    }
  } catch (error: any) {
    console.error('Agent invoke error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
