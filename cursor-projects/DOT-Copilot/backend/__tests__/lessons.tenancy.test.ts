import request from 'supertest';
import express from 'express';
import { generateTokenPair } from '../src/utils/jwt';
import lessonRoutes from '../src/routes/lessons';

jest.mock('../src/db', () => ({
  __esModule: true,
  default: {
    lesson: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    module: { findUnique: jest.fn() },
  },
}));

import prisma from '../src/db';

const app = express();
app.use(express.json());
app.use('/api/lessons', lessonRoutes);

describe('Lessons API tenant isolation', () => {
  const token = (fleetId: string | null) =>
    generateTokenPair({
      userId: 'supervisor-a',
      email: 'supervisor-a@test.com',
      role: 'SUPERVISOR',
      fleetId,
    }).accessToken;

  it('scopes list queries to the caller fleet', async () => {
    (prisma.lesson.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.lesson.count as jest.Mock).mockResolvedValue(0);

    const res = await request(app)
      .get('/api/lessons')
      .query({ fleetId: 'fleet-b' })
      .set('Authorization', `Bearer ${token('fleet-a')}`);

    expect(res.status).toBe(200);
    expect(prisma.lesson.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fleetId: 'fleet-a' } })
    );
  });

  it('rejects creating a lesson under another fleet module', async () => {
    (prisma.module.findUnique as jest.Mock).mockResolvedValue({ fleetId: 'fleet-b' });

    const res = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${token('fleet-a')}`)
      .send({ lessonName: 'Backing', fleetId: 'fleet-a', moduleId: 'module-b' });

    expect(res.status).toBe(404);
    expect(prisma.lesson.create).not.toHaveBeenCalled();
  });

  it('returns 404 for a lesson owned by another fleet', async () => {
    (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({ id: 'lesson-b', fleetId: 'fleet-b' });

    const res = await request(app)
      .get('/api/lessons/lesson-b')
      .set('Authorization', `Bearer ${token('fleet-a')}`);

    expect(res.status).toBe(404);
  });
});
