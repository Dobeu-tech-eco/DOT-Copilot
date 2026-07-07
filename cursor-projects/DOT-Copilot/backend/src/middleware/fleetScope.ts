import { Response } from 'express';
import prisma from '../db';
import { AuthenticatedRequest } from './auth';
import { sendError } from '../utils/response';

/**
 * Fleet-scoping helpers for multi-tenant IDOR prevention.
 *
 * Every non-ADMIN user is confined to the fleet recorded on their JWT
 * (req.user.fleetId). These helpers centralize the two recurring patterns
 * across route files:
 *   1. Scoping `findMany` list queries to the caller's fleet.
 *   2. Verifying ownership of a single record (by id) before it is
 *      returned, mutated, or deleted.
 *
 * ADMIN users (platform-level, req.user.role === 'ADMIN') bypass fleet
 * scoping, consistent with existing patterns in users.ts.
 */

export const ADMIN_ROLE = 'ADMIN';

/**
 * Returns true if the caller should bypass fleet scoping entirely.
 */
export function isPlatformAdmin(user: { role: string } | undefined | null): boolean {
  return !!user && user.role === ADMIN_ROLE;
}

/**
 * Applies fleet scoping to a Prisma `where` clause for list queries.
 *
 * - ADMIN users: returned unchanged (no scoping applied).
 * - Everyone else: merges `{ fleetId: req.user.fleetId }` into the where
 *   clause. If the caller has no fleetId, scoping to a sentinel value
 *   ensures the query returns zero rows rather than leaking data.
 *
 * @param where existing where clause (mutated copy is returned, original untouched)
 * @param user the authenticated user (req.user)
 * @param fleetField the field name that holds the fleet id on this model (default: 'fleetId')
 */
export function scopeWhereToFleet<T extends Record<string, any>>(
  where: T,
  user: { role: string; fleetId?: string | null } | undefined | null,
  fleetField: string = 'fleetId'
): T {
  if (isPlatformAdmin(user)) {
    return where;
  }

  const fleetId = user?.fleetId ?? '__NO_FLEET__';
  return {
    ...where,
    [fleetField]: fleetId,
  };
}

/**
 * Applies fleet scoping via a related model, e.g. `{ user: { fleetId } }`
 * for models that don't carry fleetId directly (Reminder, PushDevice,
 * DriverStats, QuizResponse, etc.). ADMIN bypasses scoping.
 */
export function scopeWhereToFleetViaRelation<T extends Record<string, any>>(
  where: T,
  user: { role: string; fleetId?: string | null } | undefined | null,
  relationField: string,
  fleetField: string = 'fleetId'
): T {
  if (isPlatformAdmin(user)) {
    return where;
  }

  const fleetId = user?.fleetId ?? '__NO_FLEET__';
  return {
    ...where,
    [relationField]: {
      ...(where[relationField] || {}),
      [fleetField]: fleetId,
    },
  };
}

/**
 * Verifies a fetched record belongs to the caller's fleet before allowing
 * read/update/delete. Sends a 404 (not 403) on mismatch to avoid leaking
 * existence of cross-tenant records, matching the pattern already used in
 * users.ts and documents.ts.
 *
 * Usage:
 *   const record = await prisma.someModel.findUnique({ where: { id } });
 *   if (!record || !assertFleetOwnership(record, req.user, res)) return;
 *
 * @param record the fetched record (must include a fleetId field, or null/undefined)
 * @param user the authenticated user (req.user)
 * @param res Express response, used to send 404 on mismatch
 * @param notFoundMessage message to send when record is missing or not owned
 */
export function assertFleetOwnership(
  record: { fleetId?: string | null } | null | undefined,
  user: { role: string; fleetId?: string | null } | undefined | null,
  res: Response,
  notFoundMessage: string = 'Not found'
): boolean {
  if (!record) {
    sendError(res, notFoundMessage, 'NOT_FOUND', 404);
    return false;
  }

  if (isPlatformAdmin(user)) {
    return true;
  }

  const callerFleetId = user?.fleetId ?? null;
  if (!callerFleetId || record.fleetId !== callerFleetId) {
    sendError(res, notFoundMessage, 'NOT_FOUND', 404);
    return false;
  }

  return true;
}

/**
 * Like assertFleetOwnership, but for records whose fleet is derived from a
 * related record rather than a direct fleetId column (e.g. a QuizQuestion's
 * fleet comes from its Lesson; a Reminder's "fleet" comes from its User).
 *
 * @param record the fetched record, or null/undefined
 * @param recordFleetId the resolved fleetId for this record (already extracted from the relation)
 */
export function assertFleetOwnershipByResolvedId(
  record: unknown,
  recordFleetId: string | null | undefined,
  user: { role: string; fleetId?: string | null } | undefined | null,
  res: Response,
  notFoundMessage: string = 'Not found'
): boolean {
  if (!record) {
    sendError(res, notFoundMessage, 'NOT_FOUND', 404);
    return false;
  }

  if (isPlatformAdmin(user)) {
    return true;
  }

  const callerFleetId = user?.fleetId ?? null;
  if (!callerFleetId || recordFleetId !== callerFleetId) {
    sendError(res, notFoundMessage, 'NOT_FOUND', 404);
    return false;
  }

  return true;
}

/**
 * Fetches a record by id via the given Prisma delegate and verifies fleet
 * ownership in one step. Returns the record if the caller may access it,
 * or null after sending an appropriate 404 response.
 *
 * Example:
 *   const fleet = await loadFleetScoped(prisma.fleet, req.params.id, req.user, res, 'Fleet not found');
 *   if (!fleet) return;
 */
export async function loadFleetScoped<
  TDelegate extends {
    findUnique: (args: { where: { id: string } } & Record<string, any>) => Promise<any>;
  }
>(
  delegate: TDelegate,
  id: string,
  user: { role: string; fleetId?: string | null } | undefined | null,
  res: Response,
  notFoundMessage: string = 'Not found',
  extraArgs?: Record<string, any>
): Promise<any | null> {
  const record = await delegate.findUnique({ where: { id }, ...(extraArgs || {}) });

  if (!assertFleetOwnership(record, user, res, notFoundMessage)) {
    return null;
  }

  return record;
}

/**
 * Helper for the common "fleetId ?? undefined" pattern used when a role
 * (e.g. ADMIN with no fleet) is allowed to omit fleet scoping, matching
 * existing conventions across compliance.ts / driverStats.ts.
 */
export function fleetFilterValue(user: { fleetId?: string | null } | undefined | null): string | undefined {
  return user?.fleetId ?? undefined;
}

export default {
  isPlatformAdmin,
  scopeWhereToFleet,
  scopeWhereToFleetViaRelation,
  assertFleetOwnership,
  assertFleetOwnershipByResolvedId,
  loadFleetScoped,
  fleetFilterValue,
};
