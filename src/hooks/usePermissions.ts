import { useAuthStore } from '../store/authStore'

export function usePermissions() {
  const role = useAuthStore(s => s.user?.role)

  const isAdmin = role === 'ADMIN'
  const isBranchManager = role === 'BRANCH_MANAGER'
  const isSupervisor = role === 'SUPERVISOR'
  const isDriverCoach = role === 'DRIVER_COACH'
  const isManager = isAdmin || isBranchManager

  return {
    canManageUsers: isAdmin || isBranchManager,
    canManageVehicles: isAdmin || isBranchManager || isSupervisor,
    canManageTraining: isAdmin || isBranchManager || isSupervisor || isDriverCoach,
    canManageCompliance: isAdmin || isBranchManager || isSupervisor,
    canAssignTraining: isAdmin || isBranchManager || isSupervisor || isDriverCoach,
    canViewAllData: isManager || isSupervisor,
    isManager,
    isAdmin,
    role,
  }
}
