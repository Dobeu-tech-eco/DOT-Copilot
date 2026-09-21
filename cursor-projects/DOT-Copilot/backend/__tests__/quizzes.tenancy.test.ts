import request from 'supertest';
import express from 'express';
import { generateTokenPair } from '../src/utils/jwt';
import quizRoutes from '../src/routes/quizzes';

jest.mock('../src/db', () => ({
  __esModule: true,
  default: {
    lesson: { findUnique: jest.fn() },
    quizQuestion: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    quizResponse: { findMany: jest.fn(), create: jest.fn() },
    completionRecord: { findUnique: jest.fn() },
  },
}));

import prisma from '../src/db';

const app = express();
app.use(express.json());
app.use('/api/quizzes', quizRoutes);

describe('Quizzes API tenant isolation', () => {
  const token = (role: string = 'SUPERVISOR') =>
    generateTokenPair({
      userId: 'user-a',
      email: 'user-a@test.com',
      role,
      fleetId: 'fleet-a',
    }).accessToken;

  it('does not return questions for another fleet lesson', async () => {
    (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({ fleetId: 'fleet-b' });

    const res = await request(app)
      .get('/api/quizzes/lessons/lesson-b/questions')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(404);
    expect(prisma.quizQuestion.findMany).not.toHaveBeenCalled();
  });

  it('returns 404 when the requested lesson does not exist', async () => {
    (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/quizzes/lessons/missing-lesson/questions')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(404);
    expect(prisma.quizQuestion.findMany).not.toHaveBeenCalled();
  });

  it('does not accept an answer for another fleet question', async () => {
    (prisma.quizQuestion.findUnique as jest.Mock).mockResolvedValue({
      id: 'question-b',
      correctAnswer: 'B',
      lesson: { fleetId: 'fleet-b' },
    });

    const res = await request(app)
      .post('/api/quizzes/responses')
      .set('Authorization', `Bearer ${token('DRIVER')}`)
      .send({ selectedAnswer: 'A', quizQuestionId: 'question-b' });

    expect(res.status).toBe(404);
    expect(prisma.quizResponse.create).not.toHaveBeenCalled();
  });

  it('does not move a question to another fleet lesson', async () => {
    (prisma.quizQuestion.findUnique as jest.Mock).mockResolvedValue({
      id: 'question-a',
      lessonId: 'lesson-a',
      lesson: { fleetId: 'fleet-a' },
    });
    (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({ fleetId: 'fleet-b' });

    const res = await request(app)
      .put('/api/quizzes/questions/question-a')
      .set('Authorization', `Bearer ${token()}`)
      .send({ lessonId: 'lesson-b' });

    expect(res.status).toBe(404);
    expect(prisma.quizQuestion.update).not.toHaveBeenCalled();
  });
});
