import type { ReactNode } from 'react'

interface StatsCardProps {
  label: string
  value: string | number
  icon: ReactNode
  trend?: { value: number; label: string }
  color?: 'green' | 'blue' | 'amber' | 'red' | 'slate'
}

const colorMap = {
  green: 'bg-green-50 text-green-600',
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  slate: 'bg-slate-100 text-slate-600',
}

export function StatsCard({ label, value, icon, trend, color = 'green' }: StatsCardProps) {
  return (
    <div className="card p-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p className={`mt-1 text-xs font-medium ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div className={`p-2.5 rounded-lg ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
