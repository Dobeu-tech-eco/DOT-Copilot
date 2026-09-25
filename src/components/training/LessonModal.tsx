import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '../Modal'
import { FormInput, FormTextarea } from '../FormField'
import { lessonSchema } from '../../schemas/module.schema'
import type { LessonFormData } from '../../schemas/module.schema'
import type { Lesson, ContentType } from '../../types/database'

const CONTENT_TYPE_OPTIONS = [
  { value: 'TEXT', label: 'Text' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'PDF', label: 'PDF Document' },
  { value: 'POWERPOINT', label: 'PowerPoint' },
  { value: 'SCORM', label: 'SCORM Package' },
  { value: 'IMAGE', label: 'Image' },
  { value: 'QUICK_ACKNOWLEDGE', label: 'Quick Acknowledge' },
]

const CONTENT_TYPE_ICONS: Record<ContentType, string> = {
  VIDEO: '🎬',
  PDF: '📄',
  POWERPOINT: '📊',
  SCORM: '📦',
  TEXT: '📝',
  IMAGE: '🖼️',
  QUICK_ACKNOWLEDGE: '✅',
}

interface LessonModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: LessonFormData) => Promise<void>
  editing: Lesson | null
  submitting: boolean
}

export function LessonModal({ open, onClose, onSubmit, editing, submitting }: LessonModalProps) {
  const form = useForm<LessonFormData>({
    resolver: zodResolver(lessonSchema) as never,
    defaultValues: {
      content_type: 'TEXT',
      requires_esignature: false,
      sequence_order: 0,
    },
  })

  const contentType = form.watch('content_type')

  useEffect(() => {
    if (editing) {
      form.reset({
        lesson_name: editing.lesson_name,
        content_type: editing.content_type,
        content: editing.content ?? '',
        file_url: editing.file_url ?? '',
        video_url: editing.video_url ?? '',
        video_duration: editing.video_duration ?? undefined,
        acknowledgment_text: editing.acknowledgment_text ?? '',
        sequence_order: editing.sequence_order,
        estimated_duration: editing.estimated_duration ?? undefined,
        requires_esignature: editing.requires_esignature,
      })
    } else {
      form.reset({ content_type: 'TEXT', requires_esignature: false, sequence_order: 0 })
    }
  }, [editing, open])

  const handleSubmit = form.handleSubmit(onSubmit)

  const showContent = contentType === 'TEXT'
  const showFileUrl = ['PDF', 'POWERPOINT', 'SCORM', 'IMAGE'].includes(contentType)
  const showVideoUrl = contentType === 'VIDEO'
  const showAcknowledgment = contentType === 'QUICK_ACKNOWLEDGE'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Lesson' : 'Add Lesson'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Lesson Name"
          required
          registration={form.register('lesson_name')}
          error={form.formState.errors.lesson_name?.message}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Content Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CONTENT_TYPE_OPTIONS.map(opt => (
              <label
                key={opt.value}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                  contentType === opt.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  value={opt.value}
                  {...form.register('content_type')}
                  className="sr-only"
                />
                <span className="text-base">{CONTENT_TYPE_ICONS[opt.value as ContentType]}</span>
                <span className="text-sm font-medium">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {showContent && (
          <FormTextarea
            label="Content"
            rows={5}
            registration={form.register('content')}
            placeholder="Enter the lesson content..."
          />
        )}

        {showVideoUrl && (
          <>
            <FormInput
              label="Video URL"
              type="url"
              registration={form.register('video_url')}
              error={form.formState.errors.video_url?.message}
              placeholder="https://..."
            />
            <FormInput
              label="Video Duration (seconds)"
              type="number"
              registration={form.register('video_duration', { valueAsNumber: true })}
            />
          </>
        )}

        {showFileUrl && (
          <FormInput
            label="File URL"
            type="url"
            registration={form.register('file_url')}
            error={form.formState.errors.file_url?.message}
            placeholder="https://..."
          />
        )}

        {showAcknowledgment && (
          <FormTextarea
            label="Acknowledgment Text"
            rows={4}
            registration={form.register('acknowledgment_text')}
            placeholder="I acknowledge that I have read and understood..."
          />
        )}

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

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="requires_esignature"
            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            {...form.register('requires_esignature')}
          />
          <label htmlFor="requires_esignature" className="text-sm text-gray-700">
            Requires e-signature to complete
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : editing ? 'Save Changes' : 'Add Lesson'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export { CONTENT_TYPE_ICONS }
