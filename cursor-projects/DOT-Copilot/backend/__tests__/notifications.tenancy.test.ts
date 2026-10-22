import request from 'supertest';
import express from 'express';
import { generateTokenPair } from '../src/utils/jwt';
import notificationRoutes from '../src/routes/notifications';

jest.mock('../src/db', () => ({
  __esModule: true,
  default: {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

import prisma from '../src/db';

const app = express();
app.use(express.json());
app.use('/api/notifications', notificationRoutes);

describe('Notifications API ownership isolation', () => {
  const token = (userId: string) =>
    generateTokenPair({
      userId,
      email: `${userId}@test.com`,
      role: 'DRIVER',
      fleetId: 'fleet-a',
    }).accessToken;

  it('scopes notification lists to the authenticated user', async () => {
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.notification.count as jest.Mock).mockResolvedValue(0);

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token('driver-a')}`);

    expect(res.status).toBe(200);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'driver-a' } })
    );
  });

  it('does not mark another user notification as read', async () => {
    (prisma.notification.findUnique as jest.Mock).mockResolvedValue({
      id: 'notification-b',
      userId: 'driver-b',
    });

    const res = await request(app)
      .put('/api/notifications/notification-b/read')
      .set('Authorization', `Bearer ${token('driver-a')}`);

    expect(res.status).toBe(403);
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });
});
