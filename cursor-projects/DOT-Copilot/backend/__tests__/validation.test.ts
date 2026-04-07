import { 
  loginSchema, 
  registerSchema, 
  createFleetSchema,
  createAssignmentSchema,
  paginationSchema 
} from '../src/schemas';

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate valid login data', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'invalid-email',
        password: 'password123',
      });

      expect(result.success).toBe(false);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '1234567',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('should validate valid registration data', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password1234',
        name: 'Test User',
        role: 'DRIVER',
      });

      expect(result.success).toBe(true);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: '1234567',
      });

      expect(result.success).toBe(false);
    });

    it('should validate with optional fields missing', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password1234',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('createFleetSchema', () => {
    it('should validate valid fleet data', () => {
      const result = createFleetSchema.safeParse({
        companyName: 'Test Company',
        locations: 'New York, Los Angeles',
        cargoType: 'General',
      });

      expect(result.success).toBe(true);
    });

    it('should reject missing company name', () => {
      const result = createFleetSchema.safeParse({
        locations: 'New York',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('should use defaults for missing values', () => {
      const result = paginationSchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should coerce string numbers', () => {
      const result = paginationSchema.safeParse({
        page: '5',
        limit: '50',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(5);
        expect(result.data.limit).toBe(50);
      }
    });

    it('should reject limit over 100', () => {
      const result = paginationSchema.safeParse({
        page: 1,
        limit: 200,
      });

      expect(result.success).toBe(false);
    });
  });
});

