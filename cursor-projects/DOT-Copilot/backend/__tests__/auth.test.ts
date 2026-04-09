import request from 'supertest';
import express from 'express';
import authRoutes from '../src/routes/auth';
import { hashPassword } from '../src/utils/password';
import { generateTokenPair, verifyAccessToken } from '../src/utils/jwt';

jest.mock('../src/db', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import prisma from '../src/db';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

function adminToken(fleetId: string | null = 'fleet-test') {
  return generateTokenPair({
    userId: 'admin-1',
    email: 'admin@test.com',
    role: 'ADMIN',
    fleetId,
  }).accessToken;
}

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 if email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 for invalid credentials', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Invalid credentials');
    });

    it('should return tokens for valid credentials', async () => {
      const passwordHash = await hashPassword('correctpassword');
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash,
        role: 'DRIVER',
        fleetId: 'fleet-test',
        fleet: null,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'correctpassword' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user.email).toBe('test@example.com');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should return 400 if email already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: '1' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'password1234',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should create user and return tokens', async () => {
      const passwordHash = await hashPassword('password1234');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'new@example.com',
        name: 'New User',
        role: 'DRIVER',
        fleetId: 'fleet-test',
        fleet: null,
      });
      // Mock subsequent login
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null) // for check
                                           .mockResolvedValueOnce({    // for login
        id: '1',
        email: 'new@example.com',
        name: 'New User',
        passwordHash,
        role: 'DRIVER',
        fleetId: 'fleet-test',
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'new@example.com',
          password: 'password1234',
          name: 'New User',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user.email).toBe('new@example.com');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should return success even if user not found (security)', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('If the email exists');
    });
  });
});
