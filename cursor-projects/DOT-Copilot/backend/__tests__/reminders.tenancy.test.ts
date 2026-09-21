import request from 'supertest';
import express from 'express';
import { generateTokenPair } from '../src/utils/jwt';
import reminderRoutes from '../src/routes/reminders';

jest.mock('../src/db', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    reminder: {
      findMany: jest.fn(),
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
app.use('/api/reminders', reminderRoutes);

describe('Reminders API tenant isolation', () => {
  const token = () =>
    generateTokenPair({
      userId: 'supervisor-a',
      email: 'supervisor-a@test.com',
      role: 'SUPERVISOR',
      fleetId: 'fleet-a',
    }).accessToken;

  it('does not list reminders for a user in another fleet', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ fleetId: 'fleet-b' });

    const res = await request(app)
      .get('/api/reminders')
      .query({ userId: 'driver-b' })
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(404);
    expect(prisma.reminder.findMany).not.toHaveBeenCalled();
  });

  it('does not create a reminder for a user in another fleet', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ fleetId: 'fleet-b' });

    const res = await request(app)
      .post('/api/reminders')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        title: 'Cross-fleet reminder',
        reminderDate: '2026-09-30T12:00:00.000Z',
        userId: 'driver-b',
      });

    expect(res.status).toBe(404);
    expect(prisma.reminder.create).not.toHaveBeenCalled();
  });

  it('returns 404 for a reminder belonging to another fleet user', async () => {
    (prisma.reminder.findUnique as jest.Mock).mockResolvedValue({
      id: 'reminder-b',
      userId: 'driver-b',
      user: { fleetId: 'fleet-b' },
    });

    const res = await request(app)
      .get('/api/reminders/reminder-b')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(404);
  });
});
