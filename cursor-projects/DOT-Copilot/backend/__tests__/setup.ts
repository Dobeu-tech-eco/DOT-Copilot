import prisma from '../src/db';

/** Extra hooks after env is set by jest.env.setup.js */
beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});
