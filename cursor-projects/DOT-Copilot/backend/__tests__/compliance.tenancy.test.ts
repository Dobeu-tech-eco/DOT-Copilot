import request from 'supertest';
import express from 'express';
import { generateTokenPair } from '../src/utils/jwt';
import complianceRoutes from '../src/routes/compliance';

jest.mock('../src/db', () => ({
  __esModule: true,
  default: {
    complianceRequirement: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    driverCompliance: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    driverDocument: {
      findMany: jest.fn(),
    },
    completionRecord: {
      findMany: jest.fn(),
    },
    assignment: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from '../src/db';

const app = express();
app.use(express.json());
app.use('/api/compliance', complianceRoutes);

describe('Compliance API tenant isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const token = (role: string, fleetId: string | null, userId = 'u1') =>
    generateTokenPair({
      userId,
      email: `${userId}@test.com`,
      role,
      fleetId,
    }).accessToken;

  describe('PUT /requirements/:id', () => {
    it('returns 404 when the requirement belongs to another fleet', async () => {
      (prisma.complianceRequirement.findUnique as jest.Mock).mockResolvedValue({
        id: 'req-1',
        fleetId: 'fleet-b',
        name: 'Other Fleet Requirement',
      });

      const res = await request(app)
        .put('/api/compliance/requirements/req-1')
        .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`)
        .send({ name: 'Hacked' });

      expect(res.status).toBe(404);
      expect(prisma.complianceRequirement.update).not.toHaveBeenCalled();
    });

    it('allows a supervisor to update a requirement in their own fleet', async () => {
      (prisma.complianceRequirement.findUnique as jest.Mock).mockResolvedValue({
        id: 'req-1',
        fleetId: 'fleet-a',
        name: 'My Requirement',
      });
      (prisma.complianceRequirement.update as jest.Mock).mockResolvedValue({
        id: 'req-1',
        fleetId: 'fleet-a',
        name: 'Updated',
      });

      const res = await request(app)
        .put('/api/compliance/requirements/req-1')
        .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(prisma.complianceRequirement.update).toHaveBeenCalled();
    });

    it('returns 404 for a fleet-scoped supervisor attempting to edit a system-wide template', async () => {
      (prisma.complianceRequirement.findUnique as jest.Mock).mockResolvedValue({
        id: 'req-system',
        fleetId: null,
        name: 'System Template',
      });

      const res = await request(app)
        .put('/api/compliance/requirements/req-system')
        .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`)
        .send({ name: 'Hacked System Template' });

      expect(res.status).toBe(404);
      expect(prisma.complianceRequirement.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /requirements/:id', () => {
    // Note: ADMIN is a platform-wide role (bypasses fleet scoping) per the
    // existing convention in users.ts; requireRole('ADMIN') gates this route
    // so a fleet-scoped non-admin can't reach it. The scoped-block path this
    // route does enforce is: a fleet-bound ADMIN may not delete a
    // system-wide (fleetId === null) template.
    it('returns 404 when a fleet-scoped ADMIN attempts to delete a system-wide template', async () => {
      (prisma.complianceRequirement.findUnique as jest.Mock).mockResolvedValue({
        id: 'req-system',
        fleetId: null,
      });

      const res = await request(app)
        .delete('/api/compliance/requirements/req-system')
        .set('Authorization', `Bearer ${token('ADMIN', 'fleet-a')}`);

      expect(res.status).toBe(404);
      expect(prisma.complianceRequirement.delete).not.toHaveBeenCalled();
    });

    it('allows a platform ADMIN (no fleetId) to delete a system-wide template', async () => {
      (prisma.complianceRequirement.findUnique as jest.Mock).mockResolvedValue({
        id: 'req-system',
        fleetId: null,
      });
      (prisma.complianceRequirement.delete as jest.Mock).mockResolvedValue({ id: 'req-system' });

      const res = await request(app)
        .delete('/api/compliance/requirements/req-system')
        .set('Authorization', `Bearer ${token('ADMIN', null)}`);

      expect(res.status).toBe(200);
      expect(prisma.complianceRequirement.delete).toHaveBeenCalledWith({ where: { id: 'req-system' } });
    });
  });

  describe('GET /drivers/:userId', () => {
    it('returns 404 when the driver belongs to another fleet', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ fleetId: 'fleet-b' });

      const res = await request(app)
        .get('/api/compliance/drivers/driver-b')
        .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`);

      expect(res.status).toBe(404);
      expect(prisma.driverCompliance.findMany).not.toHaveBeenCalled();
    });
  });

  describe('PUT /drivers/:userId/requirements/:requirementId', () => {
    it('returns 404 when the target driver belongs to another fleet', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ fleetId: 'fleet-b' });

      const res = await request(app)
        .put('/api/compliance/drivers/driver-b/requirements/req-1')
        .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`)
        .send({ status: 'COMPLIANT' });

      expect(res.status).toBe(404);
      expect(prisma.driverCompliance.upsert).not.toHaveBeenCalled();
    });

    it('returns 404 when the requirement belongs to another fleet', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ fleetId: 'fleet-a' });
      (prisma.complianceRequirement.findUnique as jest.Mock).mockResolvedValue({ fleetId: 'fleet-b' });

      const res = await request(app)
        .put('/api/compliance/drivers/driver-a/requirements/req-b')
        .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`)
        .send({ status: 'COMPLIANT' });

      expect(res.status).toBe(404);
      expect(prisma.driverCompliance.upsert).not.toHaveBeenCalled();
    });
  });
});
