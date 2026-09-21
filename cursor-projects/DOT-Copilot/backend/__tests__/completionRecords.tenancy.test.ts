import request from 'supertest';
import express from 'express';
import { generateTokenPair } from '../src/utils/jwt';
import completionRecordRoutes from '../src/routes/completionRecords';

jest.mock('../src/db', () => ({
  __esModule: true,
  default: {
    completionRecord: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    lesson: { findUnique: jest.fn() },
    module: { findUnique: jest.fn() },
    assignment: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

import prisma from '../src/db';

const app = express();
app.use(express.json());
app.use('/api/completion-records', completionRecordRoutes);

describe('Completion records API tenant isolation', () => {
  const token = (role: string, fleetId: string | null, userId = 'user-a') =>
    generateTokenPair({ userId, email: `${userId}@test.com`, role, fleetId }).accessToken;

  it('uses a non-matching fleet sentinel when a non-admin has no fleet context', async () => {
    (prisma.completionRecord.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.completionRecord.count as jest.Mock).mockResolvedValue(0);

    const res = await request(app)
      .get('/api/completion-records')
      .set('Authorization', `Bearer ${token('SUPERVISOR', null)}`);

    expect(res.status).toBe(200);
    expect(prisma.completionRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fleetId: '__NO_FLEET__' } })
    );
  });

  it('rejects creating a record for another fleet before inserting it', async () => {
    const res = await request(app)
      .post('/api/completion-records')
      .set('Authorization', `Bearer ${token('DRIVER', 'fleet-a')}`)
      .send({ userId: 'user-a', fleetId: 'fleet-b' });

    expect(res.status).toBe(404);
    expect(prisma.completionRecord.create).not.toHaveBeenCalled();
  });

  it('rejects an assignment that belongs to a different user before inserting', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ fleetId: 'fleet-a' });
    (prisma.assignment.findUnique as jest.Mock).mockResolvedValue({
      fleetId: 'fleet-a',
      userId: 'user-b',
    });

    const res = await request(app)
      .post('/api/completion-records')
      .set('Authorization', `Bearer ${token('DRIVER', 'fleet-a')}`)
      .send({ userId: 'user-a', fleetId: 'fleet-a', assignmentId: 'assignment-b' });

    expect(res.status).toBe(404);
    expect(prisma.completionRecord.create).not.toHaveBeenCalled();
    expect(prisma.assignment.update).not.toHaveBeenCalled();
  });

  it('returns 404 for another fleet completion record', async () => {
    (prisma.completionRecord.findUnique as jest.Mock).mockResolvedValue({
      id: 'record-b',
      userId: 'user-b',
      fleetId: 'fleet-b',
    });

    const res = await request(app)
      .get('/api/completion-records/record-b')
      .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`);

    expect(res.status).toBe(404);
  });
});
