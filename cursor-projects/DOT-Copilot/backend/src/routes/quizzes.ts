import { logError } from '../services/logger';
import { Router, Response } from 'express';
import prisma from '../db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, createQuizQuestionSchema, updateQuizQuestionSchema, createQuizResponseSchema } from '../schemas';
import {
  assertFleetOwnershipByResolvedId,
  assertRecordInFleet,
  isPlatformAdmin,
} from '../middleware/fleetScope';

const router = Router();

router.use(authenticate);

// Get quiz questions for a lesson
router.get('/lessons/:lessonId/questions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // SECURITY: A QuizQuestion has no fleetId of its own — it inherits
    // tenancy from its parent Lesson. Verify the lesson belongs to the
    // caller's fleet before returning any questions.
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.lessonId },
      select: { fleetId: true },
    });

    if (!assertFleetOwnershipByResolvedId(lesson, lesson?.fleetId, req.user, res, 'Lesson not found')) {
      return;
    }

    const questions = await prisma.quizQuestion.findMany({
      where: { lessonId: req.params.lessonId },
      orderBy: { sequenceOrder: 'asc' },
    });

    res.json({ data: questions });
  } catch (error: any) {
    logError('Get quiz questions error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create quiz question
router.post('/questions', requireRole('ADMIN', 'SUPERVISOR'), validateBody(createQuizQuestionSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // SECURITY: Verify the target lesson belongs to the caller's fleet
    // before creating a question under it.
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.body.lessonId },
      select: { fleetId: true },
    });

    if (!assertFleetOwnershipByResolvedId(lesson, lesson?.fleetId, req.user, res, 'Lesson not found')) {
      return;
    }

    const question = await prisma.quizQuestion.create({
      data: req.body,
    });

    res.status(201).json({ data: question });
  } catch (error: any) {
    logError('Create quiz question error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update quiz question
router.put('/questions/:id', requireRole('ADMIN', 'SUPERVISOR'), validateBody(updateQuizQuestionSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.quizQuestion.findUnique({
      where: { id },
      include: { lesson: { select: { fleetId: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Quiz question not found' });
    }
    if (
      !assertFleetOwnershipByResolvedId(
        existing,
        existing.lesson?.fleetId,
        req.user,
        res,
        'Quiz question not found'
      )
    ) {
      return;
    }

    if (req.body.lessonId && req.body.lessonId !== existing.lessonId) {
      const targetLesson = await prisma.lesson.findUnique({
        where: { id: req.body.lessonId },
        select: { fleetId: true },
      });
      if (
        !assertFleetOwnershipByResolvedId(
          targetLesson,
          targetLesson?.fleetId,
          req.user,
          res,
          'Lesson not found'
        )
      ) {
        return;
      }
    }

    const question = await prisma.quizQuestion.update({
      where: { id },
      data: req.body,
    });

    res.json({ data: question });
  } catch (error: any) {
    logError('Update quiz question error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete quiz question
router.delete('/questions/:id', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.quizQuestion.findUnique({
      where: { id },
      include: { lesson: { select: { fleetId: true } } },
    });
    if (
      !assertFleetOwnershipByResolvedId(
        existing,
        existing?.lesson?.fleetId,
        req.user,
        res,
        'Quiz question not found'
      )
    ) {
      return;
    }

    await prisma.quizQuestion.delete({ where: { id } });

    res.json({ message: 'Quiz question deleted successfully' });
  } catch (error: any) {
    logError('Delete quiz question error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit quiz response
router.post('/responses', validateBody(createQuizResponseSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { selectedAnswer, quizQuestionId, completionRecordId } = req.body;
    const user = req.user!;

    // Get the question to check correctness
    const question = await prisma.quizQuestion.findUnique({
      where: { id: quizQuestionId },
      include: { lesson: { select: { fleetId: true } } },
    });

    if (!question) {
      return res.status(404).json({ error: 'Quiz question not found' });
    }
    if (
      !assertFleetOwnershipByResolvedId(
        question,
        question.lesson?.fleetId,
        user,
        res,
        'Quiz question not found'
      )
    ) {
      return;
    }

    // SECURITY: If a completionRecordId is supplied, make sure it actually
    // belongs to the submitting user — otherwise a response could be linked
    // to another user's completion record.
    if (completionRecordId) {
      const completionRecord = await prisma.completionRecord.findUnique({
        where: { id: completionRecordId },
        select: { userId: true, fleetId: true },
      });

      if (!completionRecord || completionRecord.userId !== user.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (!assertRecordInFleet(completionRecord, question.lesson.fleetId, res, 'Completion record not found')) {
        return;
      }
    }

    const isCorrect = selectedAnswer === question.correctAnswer;

    const response = await prisma.quizResponse.create({
      data: {
        selectedAnswer,
        isCorrect,
        userId: req.user!.userId,
        quizQuestionId,
        completionRecordId,
      },
      include: {
        quizQuestion: true,
      },
    });

    res.status(201).json({ 
      data: {
        ...response,
        isCorrect,
        correctAnswer: isCorrect ? undefined : question.correctAnswer, // Only show correct answer if wrong
      },
    });
  } catch (error: any) {
    logError('Create quiz response error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's quiz responses for a lesson
router.get('/lessons/:lessonId/responses', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.lessonId },
      select: { fleetId: true },
    });
    if (
      !assertFleetOwnershipByResolvedId(lesson, lesson?.fleetId, req.user, res, 'Lesson not found')
    ) {
      return;
    }

    const responses = await prisma.quizResponse.findMany({
      where: {
        userId: req.user!.userId,
        quizQuestion: {
          lessonId: req.params.lessonId,
        },
      },
      include: {
        quizQuestion: true,
      },
      orderBy: { answeredAt: 'desc' },
    });

    res.json({ data: responses });
  } catch (error: any) {
    logError('Get quiz responses error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get quiz score for a completion record
router.get('/completion-records/:recordId/score', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;

    // SECURITY: Verify the completion record belongs to the caller (drivers)
    // or their fleet (supervisors/admins) before exposing its quiz score.
    const record = await prisma.completionRecord.findUnique({
      where: { id: req.params.recordId },
      select: { userId: true, fleetId: true },
    });

    if (!record) {
      return res.status(404).json({ error: 'Completion record not found' });
    }

    if (user.role === 'DRIVER' && record.userId !== user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (user.role !== 'DRIVER' && !isPlatformAdmin(user) && record.fleetId !== user.fleetId) {
      return res.status(404).json({ error: 'Completion record not found' });
    }

    const responses = await prisma.quizResponse.findMany({
      where: { completionRecordId: req.params.recordId },
    });

    const total = responses.length;
    const correct = responses.filter((r: { isCorrect: boolean }) => r.isCorrect).length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;

    res.json({
      data: {
        total,
        correct,
        score,
      },
    });
  } catch (error: any) {
    logError('Get quiz score error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
