import request from 'supertest';
import express from 'express';
import { generateTokenPair } from '../src/utils/jwt';
import assignmentRoutes from '../src/routes/assignments';

jest.mock('../src/db', () => ({
  __esModule: true,
  default: {
    assignment: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    module: { findUnique: jest.fn() },
    trainingProgram: { findUnique: jest.fn() },
    notification: { create: jest.fn() },
  },
}));

import prisma from '../src/db';

const app = express();
app.use(express.json());
app.use('/api/assignments', assignmentRoutes);

describe('Assignments API tenant isolation', () => {
  const token = (fleetId: string | null) =>
    generateTokenPair({
      userId: 'supervisor-a',
      email: 'supervisor-a@test.com',
      role: 'SUPERVISOR',
      fleetId,
    }).accessToken;

  it('scopes list queries to the caller fleet and ignores a hostile fleetId filter', async () => {
    (prisma.assignment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.assignment.count as jest.Mock).mockResolvedValue(0);

    const res = await request(app)
      .get('/api/assignments')
      .query({ fleetId: 'fleet-b' })
      .set('Authorization', `Bearer ${token('fleet-a')}`);

    expect(res.status).toBe(200);
    expect(prisma.assignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fleetId: 'fleet-a' } })
    );
  });

  it('rejects creating an assignment for a user from another fleet', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ fleetId: 'fleet-b' });

    const res = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${token('fleet-a')}`)
      .send({ userId: 'driver-b', fleetId: 'fleet-a' });

    expect(res.status).toBe(404);
    expect(prisma.assignment.create).not.toHaveBeenCalled();
  });

  it('returns 404 for an assignment owned by another fleet', async () => {
    (prisma.assignment.findUnique as jest.Mock).mockResolvedValue({
      id: 'assignment-b',
      userId: 'driver-b',
      fleetId: 'fleet-b',
    });

    const res = await request(app)
      .get('/api/assignments/assignment-b')
      .set('Authorization', `Bearer ${token('fleet-a')}`);

    expect(res.status).toBe(404);
  });
});
