import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

// Get pool size from environment or default to 10
const poolSize = process.env.DATABASE_POOL_SIZE ? parseInt(process.env.DATABASE_POOL_SIZE) : 10;

const prisma = globalThis.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export { prisma };
export default prisma;
