import request from 'supertest';
import express from 'express';
import { generateTokenPair } from '../src/utils/jwt';
import fleetRoutes from '../src/routes/fleets';

jest.mock('../src/db', () => ({
  __esModule: true,
  default: {
    fleet: {
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
app.use('/api/fleets', fleetRoutes);

describe('Fleets API tenant isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const token = (role: string, fleetId: string | null) =>
    generateTokenPair({
      userId: 'u1',
      email: 'u1@test.com',
      role,
      fleetId,
    }).accessToken;

  describe('GET /', () => {
    it('scopes list query to caller fleet for non-admin roles', async () => {
      (prisma.fleet.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.fleet.count as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .get('/api/fleets')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`);

      expect(res.status).toBe(200);
      expect(prisma.fleet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'fleet-a' } })
      );
    });

    it('does not scope the list query for platform ADMIN', async () => {
      (prisma.fleet.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.fleet.count as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .get('/api/fleets')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${token('ADMIN', null)}`);

      expect(res.status).toBe(200);
      expect(prisma.fleet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
    });
  });

  describe('GET /:id', () => {
    it('returns 404 when the fleet does not match the caller fleet', async () => {
      (prisma.fleet.findUnique as jest.Mock).mockResolvedValue({
        id: 'fleet-b',
        companyName: 'Other Fleet',
      });

      const res = await request(app)
        .get('/api/fleets/fleet-b')
        .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`);

      expect(res.status).toBe(404);
    });

    it('allows access when the fleet matches the caller fleet', async () => {
      (prisma.fleet.findUnique as jest.Mock).mockResolvedValue({
        id: 'fleet-a',
        companyName: 'My Fleet',
      });

      const res = await request(app)
        .get('/api/fleets/fleet-a')
        .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`);

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /:id', () => {
    it('returns 404 (not 200) when trying to update another fleet', async () => {
      (prisma.fleet.findUnique as jest.Mock).mockResolvedValue({
        id: 'fleet-b',
        companyName: 'Other Fleet',
      });

      const res = await request(app)
        .put('/api/fleets/fleet-b')
        .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`)
        .send({ companyName: 'Hacked Name' });

      expect(res.status).toBe(404);
      expect(prisma.fleet.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /:id', () => {
    // Note: ADMIN is treated as a platform-wide role (bypasses fleet scoping),
    // matching the existing convention in users.ts. requireRole('ADMIN') still
    // gates this route, so we can't exercise the ownership check with a
    // non-ADMIN role here; this test instead documents that a platform ADMIN
    // is intentionally allowed to delete any fleet.
    it('allows a platform ADMIN to delete a fleet regardless of their own fleetId', async () => {
      (prisma.fleet.findUnique as jest.Mock).mockResolvedValue({
        id: 'fleet-b',
        companyName: 'Other Fleet',
      });
      (prisma.fleet.delete as jest.Mock).mockResolvedValue({ id: 'fleet-b' });

      const res = await request(app)
        .delete('/api/fleets/fleet-b')
        .set('Authorization', `Bearer ${token('ADMIN', 'fleet-a')}`);

      expect(res.status).toBe(200);
      expect(prisma.fleet.delete).toHaveBeenCalledWith({ where: { id: 'fleet-b' } });
    });
  });
});
