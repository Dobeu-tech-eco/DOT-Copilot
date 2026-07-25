import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted mutable state so the mock factory (hoisted above imports) can read it.
const authState = vi.hoisted(() => ({ role: undefined as string | undefined }));

vi.mock("../store/authStore", () => ({
  useAuthStore: (selector: (s: { user: { role: string } | null }) => unknown) =>
    selector({ user: authState.role == null ? null : { role: authState.role } }),
}));

import { usePermissions } from "./usePermissions";

function withRole(role: string | undefined) {
  authState.role = role;
  return usePermissions();
}

describe("usePermissions", () => {
  beforeEach(() => {
    authState.role = undefined;
  });

  it("grants an ADMIN every capability", () => {
    const p = withRole("ADMIN");
    expect(p).toMatchObject({
      canManageUsers: true,
      canManageVehicles: true,
      canManageTraining: true,
      canManageCompliance: true,
      canAssignTraining: true,
      canViewAllData: true,
      isManager: true,
      isAdmin: true,
      role: "ADMIN",
    });
  });

  it("treats a BRANCH_MANAGER as a manager with full management rights", () => {
    const p = withRole("BRANCH_MANAGER");
    expect(p.canManageUsers).toBe(true);
    expect(p.isManager).toBe(true);
    expect(p.isAdmin).toBe(false);
    expect(p.canViewAllData).toBe(true);
  });

  it("lets a SUPERVISOR manage vehicles/training but not users, and is not a manager", () => {
    const p = withRole("SUPERVISOR");
    expect(p.canManageUsers).toBe(false);
    expect(p.canManageVehicles).toBe(true);
    expect(p.canManageCompliance).toBe(true);
    expect(p.canViewAllData).toBe(true);
    expect(p.isManager).toBe(false);
  });

  it("limits a DRIVER_COACH to training only", () => {
    const p = withRole("DRIVER_COACH");
    expect(p.canManageTraining).toBe(true);
    expect(p.canAssignTraining).toBe(true);
    expect(p.canManageVehicles).toBe(false);
    expect(p.canManageCompliance).toBe(false);
    expect(p.canViewAllData).toBe(false);
  });

  it("grants a plain DRIVER no elevated capabilities", () => {
    const p = withRole("DRIVER");
    expect(p.canManageUsers).toBe(false);
    expect(p.canManageVehicles).toBe(false);
    expect(p.canManageTraining).toBe(false);
    expect(p.canAssignTraining).toBe(false);
    expect(p.canViewAllData).toBe(false);
    expect(p.isManager).toBe(false);
  });

  it("denies everything when there is no authenticated user", () => {
    const p = withRole(undefined);
    expect(p.canManageUsers).toBe(false);
    expect(p.canViewAllData).toBe(false);
    expect(p.isManager).toBe(false);
    expect(p.role).toBeUndefined();
  });
});
