import request from 'supertest';
import express from 'express';
import { generateTokenPair } from '../src/utils/jwt';
import moduleRoutes from '../src/routes/modules';

jest.mock('../src/db', () => ({
  __esModule: true,
  default: {
    module: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    trainingProgram: { findUnique: jest.fn() },
  },
}));

import prisma from '../src/db';

const app = express();
app.use(express.json());
app.use('/api/modules', moduleRoutes);

describe('Modules API tenant isolation', () => {
  const token = (fleetId: string | null) =>
    generateTokenPair({
      userId: 'supervisor-a',
      email: 'supervisor-a@test.com',
      role: 'SUPERVISOR',
      fleetId,
    }).accessToken;

  it('scopes list queries to the caller fleet', async () => {
    (prisma.module.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.module.count as jest.Mock).mockResolvedValue(0);

    const res = await request(app)
      .get('/api/modules')
      .query({ fleetId: 'fleet-b' })
      .set('Authorization', `Bearer ${token('fleet-a')}`);

    expect(res.status).toBe(200);
    expect(prisma.module.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fleetId: 'fleet-a' } })
    );
  });

  it('rejects creating a module under another fleet training program', async () => {
    (prisma.trainingProgram.findUnique as jest.Mock).mockResolvedValue({ fleetId: 'fleet-b' });

    const res = await request(app)
      .post('/api/modules')
      .set('Authorization', `Bearer ${token('fleet-a')}`)
      .send({ moduleName: 'Safety', fleetId: 'fleet-a', trainingProgramId: 'program-b' });

    expect(res.status).toBe(404);
    expect(prisma.module.create).not.toHaveBeenCalled();
  });

  it('returns 404 for a module owned by another fleet', async () => {
    (prisma.module.findUnique as jest.Mock).mockResolvedValue({ id: 'module-b', fleetId: 'fleet-b' });

    const res = await request(app)
      .get('/api/modules/module-b')
      .set('Authorization', `Bearer ${token('fleet-a')}`);

    expect(res.status).toBe(404);
  });
});
