import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '../Modal'
import { FormInput, FormTextarea } from '../FormField'
import { moduleSchema } from '../../schemas/module.schema'
import type { ModuleFormData } from '../../schemas/module.schema'
import type { Module } from '../../types/database'

interface ModuleModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: ModuleFormData) => Promise<void>
  editing: Module | null
  submitting: boolean
}

export function ModuleModal({ open, onClose, onSubmit, editing, submitting }: ModuleModalProps) {
  const form = useForm<ModuleFormData>({
    resolver: zodResolver(moduleSchema) as never,
    defaultValues: { sequence_order: 0, passing_score: 80 },
  })

  useEffect(() => {
    if (editing) {
      form.reset({
        module_name: editing.module_name,
        description: editing.description ?? '',
        sequence_order: editing.sequence_order,
        estimated_duration: editing.estimated_duration ?? undefined,
        passing_score: editing.passing_score,
      })
    } else {
      form.reset({ sequence_order: 0, passing_score: 80 })
    }
  }, [editing, open])

  const handleSubmit = form.handleSubmit(onSubmit)

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Module' : 'Add Module'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Module Name"
          required
          registration={form.register('module_name')}
          error={form.formState.errors.module_name?.message}
        />
        <FormTextarea
          label="Description"
          registration={form.register('description')}
          rows={3}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Sequence Order"
            type="number"
            registration={form.register('sequence_order', { valueAsNumber: true })}
          />
          <FormInput
            label="Estimated Duration (min)"
            type="number"
            registration={form.register('estimated_duration', { valueAsNumber: true })}
          />
        </div>
        <FormInput
          label="Passing Score (%)"
          type="number"
          registration={form.register('passing_score', { valueAsNumber: true })}
          placeholder="80"
        />
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : editing ? 'Save Changes' : 'Add Module'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
