import request from 'supertest';
import express from 'express';
import { generateTokenPair } from '../src/utils/jwt';
import driverStatsRoutes from '../src/routes/driverStats';

jest.mock('../src/db', () => ({
  __esModule: true,
  default: {
    user: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    driverStats: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      upsert: jest.fn(),
    },
    completionRecord: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
    assignment: { count: jest.fn() },
    btwSession: { findMany: jest.fn() },
  },
}));

import prisma from '../src/db';

const app = express();
app.use(express.json());
app.use('/api/driver-stats', driverStatsRoutes);

describe('Driver stats API tenant isolation', () => {
  const token = (role: string, fleetId: string | null, userId = 'user-a') =>
    generateTokenPair({ userId, email: `${userId}@test.com`, role, fleetId }).accessToken;

  it('does not drop the rankings fleet filter when tenant context is missing', async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/driver-stats/rankings')
      .set('Authorization', `Bearer ${token('DRIVER', null)}`);

    expect(res.status).toBe(200);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fleetId: '__NO_FLEET__' }),
      })
    );
  });

  it('returns 404 for another fleet driver stats', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ fleetId: 'fleet-b' });

    const res = await request(app)
      .get('/api/driver-stats/user-b')
      .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`);

    expect(res.status).toBe(404);
    expect(prisma.driverStats.findUnique).not.toHaveBeenCalled();
  });

  it('uses the non-matching sentinel throughout a fleet summary without tenant context', async () => {
    (prisma.user.count as jest.Mock).mockResolvedValue(0);
    (prisma.completionRecord.count as jest.Mock).mockResolvedValue(0);
    (prisma.completionRecord.aggregate as jest.Mock).mockResolvedValue({ _avg: { quizScore: null } });
    (prisma.driverStats.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalTimeSpent: null } });
    (prisma.driverStats.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.assignment.count as jest.Mock).mockResolvedValue(0);

    const res = await request(app)
      .get('/api/driver-stats/fleet/summary')
      .set('Authorization', `Bearer ${token('SUPERVISOR', null)}`);

    expect(res.status).toBe(200);
    expect(prisma.user.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fleetId: '__NO_FLEET__' }),
      })
    );
    expect(prisma.completionRecord.count).toHaveBeenCalledWith({
      where: { fleetId: '__NO_FLEET__' },
    });
  });
});
