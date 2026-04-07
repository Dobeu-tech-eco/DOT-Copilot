/* Runs before test files load — must set env before src/config/env validates */
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/dot_copilot_test?schema=public';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-key-32-characters-minimum';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-32-characters';
process.env.NODE_ENV = 'test';
