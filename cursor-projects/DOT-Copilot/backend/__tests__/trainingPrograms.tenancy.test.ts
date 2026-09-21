import request from 'supertest';
import express from 'express';
import { generateTokenPair } from '../src/utils/jwt';
import trainingProgramRoutes from '../src/routes/trainingPrograms';

jest.mock('../src/db', () => ({
  __esModule: true,
  default: {
    trainingProgram: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import prisma from '../src/db';

const app = express();
app.use(express.json());
app.use('/api/training-programs', trainingProgramRoutes);

describe('Training programs API tenant isolation', () => {
  const token = (fleetId: string | null) =>
    generateTokenPair({
      userId: 'supervisor-a',
      email: 'supervisor-a@test.com',
      role: 'SUPERVISOR',
      fleetId,
    }).accessToken;

  it('scopes list queries to the caller fleet', async () => {
    (prisma.trainingProgram.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.trainingProgram.count as jest.Mock).mockResolvedValue(0);

    const res = await request(app)
      .get('/api/training-programs')
      .query({ fleetId: 'fleet-b' })
      .set('Authorization', `Bearer ${token('fleet-a')}`);

    expect(res.status).toBe(200);
    expect(prisma.trainingProgram.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fleetId: 'fleet-a' } })
    );
  });

  it('rejects creating a training program for another fleet', async () => {
    const res = await request(app)
      .post('/api/training-programs')
      .set('Authorization', `Bearer ${token('fleet-a')}`)
      .send({ programName: 'Other Fleet Program', fleetId: 'fleet-b' });

    expect(res.status).toBe(404);
    expect(prisma.trainingProgram.create).not.toHaveBeenCalled();
  });

  it('returns 404 for a training program owned by another fleet', async () => {
    (prisma.trainingProgram.findUnique as jest.Mock).mockResolvedValue({
      id: 'program-b',
      fleetId: 'fleet-b',
    });

    const res = await request(app)
      .get('/api/training-programs/program-b')
      .set('Authorization', `Bearer ${token('fleet-a')}`);

    expect(res.status).toBe(404);
  });
});
