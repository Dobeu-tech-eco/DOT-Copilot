import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { useToast } from '../../store/toastStore'
import { ConfirmDialog } from '../ConfirmDialog'
import { ModuleModal } from './ModuleModal'
import { LessonModal, CONTENT_TYPE_ICONS } from './LessonModal'
import type { ModuleFormData, LessonFormData } from '../../schemas/module.schema'
import type { TrainingProgram, Module, Lesson, ContentType } from '../../types/database'
import {
  BookOpen, ChevronRight, ChevronDown, Plus, Pencil, Trash2,
  Clock, FileCheck, Layers,
} from 'lucide-react'

interface ContentTabProps {
  trainingPrograms: TrainingProgram[]
  fleetId: string
  canManage: boolean
}

export function ContentTab({ trainingPrograms, fleetId, canManage }: ContentTabProps) {
  const { modules, lessons, loading, fetchModules, fetchLessons, createModule, updateModule, deleteModule, createLesson, updateLesson, deleteLesson } = useAppStore()
  const toast = useToast()

  const [selectedProgram, setSelectedProgram] = useState<TrainingProgram | null>(null)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())

  const [moduleModal, setModuleModal] = useState(false)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [lessonModal, setLessonModal] = useState(false)
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)
  const [lessonModuleId, setLessonModuleId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'module' | 'lesson'; id: string; name: string; moduleId?: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (trainingPrograms.length > 0 && !selectedProgram) {
      setSelectedProgram(trainingPrograms[0])
    }
  }, [trainingPrograms])

  useEffect(() => {
    if (selectedProgram) {
      fetchModules(selectedProgram.id)
    }
  }, [selectedProgram?.id])

  const toggleModule = async (moduleId: string) => {
    const next = new Set(expandedModules)
    if (next.has(moduleId)) {
      next.delete(moduleId)
    } else {
      next.add(moduleId)
      if (!lessons[moduleId]) {
        await fetchLessons(moduleId)
      }
    }
    setExpandedModules(next)
  }

  const openCreateModule = () => {
    setEditingModule(null)
    setModuleModal(true)
  }

  const openEditModule = (m: Module) => {
    setEditingModule(m)
    setModuleModal(true)
  }

  const openCreateLesson = (moduleId: string) => {
    setEditingLesson(null)
    setLessonModuleId(moduleId)
    setLessonModal(true)
  }

  const openEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson)
    setLessonModuleId(lesson.module_id)
    setLessonModal(true)
  }

  const handleModuleSubmit = async (data: ModuleFormData) => {
    if (!selectedProgram) return
    setSubmitting(true)
    try {
      if (editingModule) {
        await updateModule(editingModule.id, data)
        toast.success('Module updated')
      } else {
        await createModule(fleetId, selectedProgram.id, data)
        toast.success('Module created')
      }
      setModuleModal(false)
    } catch { toast.error('Failed to save module') }
    finally { setSubmitting(false) }
  }

  const handleLessonSubmit = async (data: LessonFormData) => {
    if (!lessonModuleId) return
    setSubmitting(true)
    try {
      if (editingLesson) {
        await updateLesson(editingLesson.id, lessonModuleId, data)
        toast.success('Lesson updated')
      } else {
        await createLesson(fleetId, lessonModuleId, data)
        toast.success('Lesson created')
      }
      setLessonModal(false)
    } catch { toast.error('Failed to save lesson') }
    finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSubmitting(true)
    try {
      if (deleteTarget.type === 'module') {
        await deleteModule(deleteTarget.id)
        toast.success('Module deleted')
      } else {
        await deleteLesson(deleteTarget.id, deleteTarget.moduleId!)
        toast.success('Lesson deleted')
      }
      setDeleteTarget(null)
    } catch { toast.error('Failed to delete') }
    finally { setSubmitting(false) }
  }

  const programModules = modules.filter(m => m.training_program_id === selectedProgram?.id)
    .sort((a, b) => a.sequence_order - b.sequence_order)

  return (
    <div className="flex h-full min-h-[500px]">
      <div className="w-64 flex-shrink-0 border-r border-gray-100 overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Programs</p>
        </div>
        {trainingPrograms.length === 0 ? (
          <p className="text-sm text-gray-400 p-4 text-center">No programs yet</p>
        ) : (
          <div className="py-1">
            {trainingPrograms.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProgram(p)}
                className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                  selectedProgram?.id === p.id
                    ? 'bg-brand-50 text-brand-700 font-medium border-r-2 border-brand-500'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="flex-shrink-0 opacity-60" />
                  <span className="truncate">{p.program_name}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selectedProgram ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Select a program to view its content
          </div>
        ) : (
          <div>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">{selectedProgram.program_name}</h4>
                <p className="text-xs text-gray-500 mt-0.5">{programModules.length} module{programModules.length !== 1 ? 's' : ''}</p>
              </div>
              {canManage && (
                <button onClick={openCreateModule} className="btn-primary">
                  <Plus size={14} />
                  Add Module
                </button>
              )}
            </div>

            {loading.modules ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
              </div>
            ) : programModules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Layers size={22} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">No modules yet</p>
                <p className="text-xs text-gray-500 mt-1">
                  {canManage ? 'Add your first module to get started' : 'No content has been added to this program'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {programModules.map(mod => {
                  const isExpanded = expandedModules.has(mod.id)
                  const modLessons = (lessons[mod.id] ?? []).sort((a, b) => a.sequence_order - b.sequence_order)

                  return (
                    <div key={mod.id}>
                      <div className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors group">
                        <button
                          onClick={() => toggleModule(mod.id)}
                          className="flex items-center gap-3 flex-1 text-left min-w-0"
                        >
                          <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                            {mod.sequence_order + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{mod.module_name}</p>
                            <div className="flex items-center gap-3 mt-0.5">
                              {mod.estimated_duration && (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <Clock size={10} />{mod.estimated_duration}m
                                </span>
                              )}
                              <span className="text-xs text-gray-400">
                                Pass: {mod.passing_score}%
                              </span>
                              {modLessons.length > 0 && (
                                <span className="text-xs text-gray-400">
                                  {modLessons.length} lesson{modLessons.length !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                          {isExpanded
                            ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                            : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
                        </button>

                        {canManage && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => openEditModule(mod)}
                              className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget({ type: 'module', id: mod.id, name: mod.module_name })}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="bg-gray-50/50 border-t border-gray-100">
                          {modLessons.length === 0 ? (
                            <p className="text-xs text-gray-400 px-14 py-4">No lessons in this module</p>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {modLessons.map(lesson => (
                                <div
                                  key={lesson.id}
                                  className="flex items-center gap-3 px-5 py-3 pl-14 hover:bg-gray-100 transition-colors group/lesson"
                                >
                                  <span className="text-base">{CONTENT_TYPE_ICONS[lesson.content_type as ContentType]}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-800 truncate">{lesson.lesson_name}</p>
                                    <div className="flex items-center gap-3 mt-0.5">
                                      <span className="text-xs text-gray-400">{lesson.content_type}</span>
                                      {lesson.estimated_duration && (
                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                          <Clock size={10} />{lesson.estimated_duration}m
                                        </span>
                                      )}
                                      {lesson.requires_esignature && (
                                        <span className="text-xs text-brand-600 flex items-center gap-1">
                                          <FileCheck size={10} />e-sig
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {canManage && (
                                    <div className="opacity-0 group-hover/lesson:opacity-100 transition-opacity flex items-center gap-1">
                                      <button
                                        onClick={() => openEditLesson(lesson)}
                                        className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                      >
                                        <Pencil size={12} />
                                      </button>
                                      <button
                                        onClick={() => setDeleteTarget({ type: 'lesson', id: lesson.id, name: lesson.lesson_name, moduleId: mod.id })}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {canManage && (
                            <div className="px-5 py-3 pl-14 border-t border-gray-100">
                              <button
                                onClick={() => openCreateLesson(mod.id)}
                                className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1.5 transition-colors"
                              >
                                <Plus size={13} />
                                Add Lesson
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <ModuleModal
        open={moduleModal}
        onClose={() => setModuleModal(false)}
        onSubmit={handleModuleSubmit}
        editing={editingModule}
        submitting={submitting}
      />

      <LessonModal
        open={lessonModal}
        onClose={() => setLessonModal(false)}
        onSubmit={handleLessonSubmit}
        editing={editingLesson}
        submitting={submitting}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleteTarget?.type === 'module' ? 'Module' : 'Lesson'}`}
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={submitting}
      />
    </div>
  )
}
