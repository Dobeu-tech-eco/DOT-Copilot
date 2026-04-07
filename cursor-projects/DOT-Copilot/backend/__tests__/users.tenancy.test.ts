import request from 'supertest';
import express from 'express';
import { generateTokenPair } from '../src/utils/jwt';
import userRoutes from '../src/routes/users';

jest.mock('../src/db', () => ({
  __esModule: true,
  default: {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

import prisma from '../src/db';

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);

describe('Users API fleet isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const tokenForFleet = (fleetId: string | null) =>
    generateTokenPair({
      userId: 'u1',
      email: 'u1@test.com',
      role: 'ADMIN',
      fleetId,
    }).accessToken;

  it('GET / returns 403 when JWT has no fleetId', async () => {
    const res = await request(app)
      .get('/api/users')
      .query({ page: 1, limit: 10 })
      .set('Authorization', `Bearer ${tokenForFleet(null)}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Fleet context required/);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('GET / scopes queries to caller fleetId', async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.count as jest.Mock).mockResolvedValue(0);

    const res = await request(app)
      .get('/api/users')
      .query({ page: 1, limit: 10 })
      .set('Authorization', `Bearer ${tokenForFleet('fleet-a')}`);

    expect(res.status).toBe(200);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fleetId: 'fleet-a' },
      })
    );
  });

  it('GET /:id returns 404 for user in another fleet', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/users/user-other-fleet')
      .set('Authorization', `Bearer ${tokenForFleet('fleet-a')}`);

    expect(res.status).toBe(404);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-other-fleet', fleetId: 'fleet-a' },
      })
    );
  });
});
