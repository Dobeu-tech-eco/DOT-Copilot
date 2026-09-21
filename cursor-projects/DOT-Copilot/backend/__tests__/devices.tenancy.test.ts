import request from 'supertest';
import express from 'express';
import { generateTokenPair } from '../src/utils/jwt';
import deviceRoutes from '../src/routes/devices';

jest.mock('../src/db', () => ({
  __esModule: true,
  default: {
    pushDevice: { findUnique: jest.fn() },
  },
}));

jest.mock('../src/services/pushNotification', () => ({
  __esModule: true,
  default: {
    registerDevice: jest.fn(),
    unregisterDevice: jest.fn(),
    sendToUser: jest.fn(),
  },
}));

import prisma from '../src/db';
import pushNotificationService from '../src/services/pushNotification';

const app = express();
app.use(express.json());
app.use('/api/devices', deviceRoutes);

describe('Devices API ownership isolation', () => {
  const token = (userId: string) =>
    generateTokenPair({
      userId,
      email: `${userId}@test.com`,
      role: 'DRIVER',
      fleetId: 'fleet-a',
    }).accessToken;

  it('does not let a user unregister another user device', async () => {
    (prisma.pushDevice.findUnique as jest.Mock).mockResolvedValue({
      deviceToken: 'device-b',
      userId: 'driver-b',
    });

    const res = await request(app)
      .delete('/api/devices/device-b')
      .set('Authorization', `Bearer ${token('driver-a')}`);

    expect(res.status).toBe(403);
    expect(pushNotificationService.unregisterDevice).not.toHaveBeenCalled();
  });

  it('lets a user unregister their own device', async () => {
    (prisma.pushDevice.findUnique as jest.Mock).mockResolvedValue({
      deviceToken: 'device-a',
      userId: 'driver-a',
    });
    (pushNotificationService.unregisterDevice as jest.Mock).mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/devices/device-a')
      .set('Authorization', `Bearer ${token('driver-a')}`);

    expect(res.status).toBe(200);
    expect(pushNotificationService.unregisterDevice).toHaveBeenCalledWith('device-a');
  });
});
