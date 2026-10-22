import request from 'supertest';
import express from 'express';
import { generateTokenPair } from '../src/utils/jwt';
import documentRoutes from '../src/routes/documents';

jest.mock('../src/db', () => ({
  __esModule: true,
  default: {
    driverDocument: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import prisma from '../src/db';

const app = express();
app.use(express.json());
app.use('/api/documents', documentRoutes);

describe('Documents API tenant isolation', () => {
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

  describe('GET /:id', () => {
    it('returns 404 for a supervisor accessing another fleet\'s document', async () => {
      (prisma.driverDocument.findUnique as jest.Mock).mockResolvedValue({
        id: 'doc-1',
        userId: 'driver-b',
        fleetId: 'fleet-b',
      });

      const res = await request(app)
        .get('/api/documents/doc-1')
        .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`);

      expect(res.status).toBe(404);
    });

    it('allows a supervisor to access a document within their own fleet', async () => {
      (prisma.driverDocument.findUnique as jest.Mock).mockResolvedValue({
        id: 'doc-1',
        userId: 'driver-a',
        fleetId: 'fleet-a',
      });

      const res = await request(app)
        .get('/api/documents/doc-1')
        .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`);

      expect(res.status).toBe(200);
    });

    it('returns 403 for a driver accessing another driver\'s document', async () => {
      (prisma.driverDocument.findUnique as jest.Mock).mockResolvedValue({
        id: 'doc-1',
        userId: 'driver-b',
        fleetId: 'fleet-a',
      });

      const res = await request(app)
        .get('/api/documents/doc-1')
        .set('Authorization', `Bearer ${token('DRIVER', 'fleet-a', 'driver-a')}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /', () => {
    it('does not create a document for a user in another fleet', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ fleetId: 'fleet-b' });

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`)
        .send({
          userId: 'driver-b',
          documentType: 'CDL',
          expirationDate: '2027-09-21T00:00:00.000Z',
        });

      expect(res.status).toBe(404);
      expect(prisma.driverDocument.create).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /:id', () => {
    it('returns 404 (not delete) when the document belongs to another fleet', async () => {
      (prisma.driverDocument.findUnique as jest.Mock).mockResolvedValue({
        id: 'doc-1',
        userId: 'driver-b',
        fleetId: 'fleet-b',
      });

      const res = await request(app)
        .delete('/api/documents/doc-1')
        .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`);

      expect(res.status).toBe(404);
      expect(prisma.driverDocument.delete).not.toHaveBeenCalled();
    });

    it('deletes when the document belongs to the caller fleet', async () => {
      (prisma.driverDocument.findUnique as jest.Mock).mockResolvedValue({
        id: 'doc-1',
        userId: 'driver-a',
        fleetId: 'fleet-a',
      });
      (prisma.driverDocument.delete as jest.Mock).mockResolvedValue({ id: 'doc-1' });

      const res = await request(app)
        .delete('/api/documents/doc-1')
        .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`);

      expect(res.status).toBe(200);
      expect(prisma.driverDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
    });
  });

  describe('GET /user/:userId', () => {
    it('returns 404 when the target user belongs to a different fleet', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ fleetId: 'fleet-b' });

      const res = await request(app)
        .get('/api/documents/user/driver-b')
        .set('Authorization', `Bearer ${token('SUPERVISOR', 'fleet-a')}`);

      expect(res.status).toBe(404);
      expect(prisma.driverDocument.findMany).not.toHaveBeenCalled();
    });
  });
});
