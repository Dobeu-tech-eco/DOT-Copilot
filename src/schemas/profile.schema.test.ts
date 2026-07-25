import { describe, it, expect } from "vitest";
import {
  profileSchema,
  createUserSchema,
  loginSchema,
  registerSchema,
  USER_ROLES,
} from "./profile.schema";

describe("profileSchema", () => {
  it("accepts a valid profile", () => {
    expect(profileSchema.safeParse({ name: "Sam", role: "DRIVER" }).success).toBe(true);
  });

  it("rejects an unknown role", () => {
    expect(profileSchema.safeParse({ name: "Sam", role: "CEO" }).success).toBe(false);
  });

  it("accepts every declared user role", () => {
    for (const role of USER_ROLES) {
      expect(profileSchema.safeParse({ name: "Sam", role }).success).toBe(true);
    }
  });
});

describe("createUserSchema", () => {
  it("accepts a valid new-user payload", () => {
    const result = createUserSchema.safeParse({
      email: "a@b.com",
      name: "Sam",
      role: "SUPERVISOR",
      password: "longenough",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(
      createUserSchema.safeParse({
        email: "not-an-email",
        name: "Sam",
        role: "SUPERVISOR",
        password: "longenough",
      }).success,
    ).toBe(false);
  });

  it("rejects a password under 8 characters", () => {
    expect(
      createUserSchema.safeParse({
        email: "a@b.com",
        name: "Sam",
        role: "SUPERVISOR",
        password: "short",
      }).success,
    ).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts a valid login", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("requires a password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    name: "Sam",
    email: "a@b.com",
    password: "Password1",
    confirmPassword: "Password1",
  };

  it("accepts a valid registration", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("requires an uppercase letter in the password", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "password1",
      confirmPassword: "password1",
    });
    expect(result.success).toBe(false);
  });

  it("requires a digit in the password", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "Passwordx",
      confirmPassword: "Passwordx",
    });
    expect(result.success).toBe(false);
  });

  it("flags mismatched confirmPassword on the right path", () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: "Different1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["confirmPassword"]);
      expect(result.error.issues[0].message).toBe("Passwords do not match");
    }
  });

  it("requires a name of at least 2 characters", () => {
    expect(registerSchema.safeParse({ ...valid, name: "S" }).success).toBe(false);
  });
});
