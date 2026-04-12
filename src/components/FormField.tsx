import type { UseFormRegisterReturn } from 'react-hook-form'

interface BaseProps {
  label: string
  error?: string
  required?: boolean
}

interface FormInputProps extends BaseProps {
  type?: string
  placeholder?: string
  registration: UseFormRegisterReturn
  disabled?: boolean
}

interface FormSelectProps extends BaseProps {
  options: { value: string; label: string }[]
  registration: UseFormRegisterReturn
  placeholder?: string
}

interface FormTextareaProps extends BaseProps {
  registration: UseFormRegisterReturn
  placeholder?: string
  rows?: number
}

interface FormSectionProps {
  title: string
  children: React.ReactNode
}

export function FormInput({ label, type = 'text', placeholder, registration, error, required, disabled }: FormInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        className={`input-field ${error ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : ''} ${disabled ? 'bg-gray-50 text-gray-500' : ''}`}
        {...registration}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function FormSelect({ label, options, registration, error, required, placeholder }: FormSelectProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select className={`input-field ${error ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : ''}`} {...registration}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function FormTextarea({ label, registration, error, required, placeholder, rows = 3 }: FormTextareaProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <textarea
        rows={rows}
        placeholder={placeholder}
        className={`input-field resize-none ${error ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : ''}`}
        {...registration}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function FormSection({ title, children }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}
