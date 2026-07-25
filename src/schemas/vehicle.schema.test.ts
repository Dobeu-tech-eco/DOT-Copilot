import { describe, it, expect } from "vitest";
import { vehicleSchema, VEHICLE_TYPES } from "./vehicle.schema";

const base = {
  vehicle_number: "TRK-100",
  vehicle_type: "delivery_van" as const,
  has_temperature_monitoring: false,
};

describe("vehicleSchema", () => {
  it("accepts a minimal valid vehicle", () => {
    const result = vehicleSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("requires a non-empty vehicle_number", () => {
    const result = vehicleSchema.safeParse({ ...base, vehicle_number: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Vehicle number is required");
    }
  });

  it("rejects a vehicle_type outside the enum", () => {
    const result = vehicleSchema.safeParse({ ...base, vehicle_type: "spaceship" });
    expect(result.success).toBe(false);
  });

  it("accepts every declared vehicle type", () => {
    for (const type of VEHICLE_TYPES) {
      expect(vehicleSchema.safeParse({ ...base, vehicle_type: type }).success).toBe(true);
    }
  });

  it("rejects a year before 1990", () => {
    expect(vehicleSchema.safeParse({ ...base, year: 1989 }).success).toBe(false);
  });

  it("rejects a year beyond next calendar year", () => {
    const tooFar = new Date().getFullYear() + 2;
    expect(vehicleSchema.safeParse({ ...base, year: tooFar }).success).toBe(false);
  });

  it("allows a null year (unknown model year)", () => {
    expect(vehicleSchema.safeParse({ ...base, year: null }).success).toBe(true);
  });

  it("requires has_temperature_monitoring to be present", () => {
    const { has_temperature_monitoring, ...withoutFlag } = base;
    void has_temperature_monitoring;
    expect(vehicleSchema.safeParse(withoutFlag).success).toBe(false);
  });
});
