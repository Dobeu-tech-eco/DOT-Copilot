import prisma from '../db';
import { Prisma } from '@prisma/client';

export class UserService {
  /**
   * Get user by ID with relations
   */
  async getUserById(id: string, include?: Prisma.UserInclude) {
    return prisma.user.findUnique({
      where: { id },
      include,
    });
  }

  /**
   * List users with pagination and fleet context
   */
  async listUsers(fleetId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const where = { fleetId };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          fleetId: true,
          createdAt: true,
          fleet: {
            select: { id: true, companyName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new user
   */
  async createUser(data: Prisma.UserCreateInput) {
    return prisma.user.create({
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        fleetId: true,
        createdAt: true,
      },
    });
  }

  /**
   * Update an existing user
   */
  async updateUser(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        fleetId: true,
        createdAt: true,
      },
    });
  }

  /**
   * Delete a user
   */
  async deleteUser(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }
}

export const userService = new UserService();
