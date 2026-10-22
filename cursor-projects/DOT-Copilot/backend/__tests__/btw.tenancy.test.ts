import request from 'supertest';
import express from 'express';
import { generateTokenPair } from '../src/utils/jwt';
import btwRoutes from '../src/routes/btw';

jest.mock('../src/db', () => ({
  __esModule: true,
  default: {
    btwSession: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('../src/services/eventDispatcher', () => ({
  __esModule: true,
  default: { btwSessionCompleted: jest.fn() },
}));

import prisma from '../src/db';
import eventDispatcher from '../src/services/eventDispatcher';

const app = express();
app.use(express.json());
app.use('/api/btw', btwRoutes);

describe('BTW API tenant isolation', () => {
  const token = (role: string = 'SUPERVISOR') =>
    generateTokenPair({
      userId: 'trainer-a',
      email: 'trainer-a@test.com',
      role,
      fleetId: 'fleet-a',
    }).accessToken;

  it('scopes session lists to the caller fleet', async () => {
    (prisma.btwSession.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/btw/sessions')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(prisma.btwSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fleetId: 'fleet-a' } })
    );
  });

  it('does not create a session for a trainee in another fleet', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ fleetId: 'fleet-b' });

    const res = await request(app)
      .post('/api/btw/sessions')
      .set('Authorization', `Bearer ${token('DRIVER_COACH')}`)
      .send({
        traineeId: 'trainee-b',
        sessionDate: '2026-09-22T12:00:00.000Z',
        startTime: '2026-09-22T12:00:00.000Z',
        endTime: '2026-09-22T13:00:00.000Z',
        routeType: 'city',
      });

    expect(res.status).toBe(404);
    expect(prisma.btwSession.create).not.toHaveBeenCalled();
  });

  it('does not complete a signed session from another fleet', async () => {
    (prisma.btwSession.findUnique as jest.Mock).mockResolvedValue({
      id: 'session-b',
      fleetId: 'fleet-b',
      trainerSignature: 'trainer-signature',
      traineeSignature: 'trainee-signature',
      trainee: { fleetId: 'fleet-b' },
    });

    const res = await request(app)
      .post('/api/btw/sessions/session-b/complete')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(404);
    expect(prisma.btwSession.update).not.toHaveBeenCalled();
    expect(eventDispatcher.btwSessionCompleted).not.toHaveBeenCalled();
  });
});
