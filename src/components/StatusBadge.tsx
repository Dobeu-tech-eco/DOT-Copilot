import type { ComplianceStatus, AssignmentStatus } from '../types/database'

const complianceConfig: Record<ComplianceStatus, { label: string; className: string }> = {
  COMPLIANT: { label: 'Compliant', className: 'badge-success' },
  EXPIRING_SOON: { label: 'Expiring Soon', className: 'badge-warning' },
  EXPIRED: { label: 'Expired', className: 'badge-danger' },
  NOT_STARTED: { label: 'Not Started', className: 'badge-neutral' },
  IN_PROGRESS: { label: 'In Progress', className: 'badge-info' },
  WAIVED: { label: 'Waived', className: 'badge-neutral' },
}

const assignmentConfig: Record<AssignmentStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'badge-neutral' },
  in_progress: { label: 'In Progress', className: 'badge-info' },
  completed: { label: 'Completed', className: 'badge-success' },
  overdue: { label: 'Overdue', className: 'badge-danger' },
}

export function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  const config = complianceConfig[status]
  return <span className={`badge ${config.className}`}>{config.label}</span>
}

export function AssignmentBadge({ status }: { status: AssignmentStatus }) {
  const config = assignmentConfig[status]
  return <span className={`badge ${config.className}`}>{config.label}</span>
}

export function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { label: string; className: string }> = {
    low: { label: 'Low', className: 'badge-neutral' },
    normal: { label: 'Normal', className: 'badge-info' },
    high: { label: 'High', className: 'badge-warning' },
    urgent: { label: 'Urgent', className: 'badge-danger' },
  }
  const c = config[priority] ?? config.normal
  return <span className={`badge ${c.className}`}>{c.label}</span>
}
