-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DRIVER', 'DRIVER_COACH', 'SUPERVISOR', 'BRANCH_MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CDL', 'MEDICAL_CARD', 'HAZMAT_ENDORSEMENT', 'TWIC_CARD', 'PASSPORT', 'MVR', 'DRUG_TEST', 'BACKGROUND_CHECK', 'STATE_PERMIT', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('COMPLIANT', 'EXPIRING_SOON', 'EXPIRED', 'NOT_STARTED', 'IN_PROGRESS', 'WAIVED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('VIDEO', 'PDF', 'POWERPOINT', 'SCORM', 'TEXT', 'IMAGE', 'QUICK_ACKNOWLEDGE');

-- CreateEnum
CREATE TYPE "WebhookEventType" AS ENUM ('USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'ASSIGNMENT_CREATED', 'ASSIGNMENT_UPDATED', 'ASSIGNMENT_DUE_SOON', 'ASSIGNMENT_OVERDUE', 'TRAINING_STARTED', 'TRAINING_PROGRESS', 'TRAINING_COMPLETED', 'QUIZ_SUBMITTED', 'QUIZ_PASSED', 'QUIZ_FAILED', 'LESSON_COMPLETED', 'ESIGNATURE_CAPTURED', 'DOCUMENT_EXPIRING', 'DOCUMENT_EXPIRED', 'COMPLIANCE_AT_RISK', 'COMPLIANCE_EXPIRED', 'BTW_SESSION_COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'DRIVER',
    "fleet_id" TEXT,
    "phone" TEXT,
    "preferred_language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "prefer_email" BOOLEAN NOT NULL DEFAULT true,
    "prefer_sms" BOOLEAN NOT NULL DEFAULT false,
    "prefer_push" BOOLEAN NOT NULL DEFAULT true,
    "employee_id" TEXT,
    "hire_date" TIMESTAMP(3),
    "location_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip_code" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "fleet_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fleets" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "locations" TEXT,
    "cargo_type" TEXT,
    "cdl_status" TEXT,
    "vehicle_types" TEXT,
    "key_risk_areas" TEXT,
    "operation_type" TEXT,
    "states_of_operation" TEXT,
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "compliance_profile_configured" BOOLEAN NOT NULL DEFAULT false,
    "logo_url" TEXT,
    "primary_color" TEXT,
    "secondary_color" TEXT,
    "default_language" TEXT NOT NULL DEFAULT 'en',
    "enable_sms_notifications" BOOLEAN NOT NULL DEFAULT false,
    "enable_push_notifications" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fleets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_programs" (
    "id" TEXT NOT NULL,
    "program_name" TEXT NOT NULL,
    "description" TEXT,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "fleet_id" TEXT NOT NULL,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "template_category" TEXT,
    "estimated_duration" INTEGER,
    "default_language" TEXT NOT NULL DEFAULT 'en',
    "thumbnail_url" TEXT,
    "compliance_requirement_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_program_translations" (
    "id" TEXT NOT NULL,
    "training_program_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "program_name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "training_program_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "module_name" TEXT NOT NULL,
    "description" TEXT,
    "sequence_order" INTEGER NOT NULL DEFAULT 0,
    "fleet_id" TEXT NOT NULL,
    "training_program_id" TEXT NOT NULL,
    "estimated_duration" INTEGER,
    "passing_score" INTEGER NOT NULL DEFAULT 80,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_translations" (
    "id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "module_name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "module_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "lesson_name" TEXT NOT NULL,
    "content" TEXT,
    "content_type" "ContentType" NOT NULL DEFAULT 'TEXT',
    "file_url" TEXT,
    "sequence_order" INTEGER NOT NULL DEFAULT 0,
    "requires_esignature" BOOLEAN NOT NULL DEFAULT false,
    "fleet_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "video_duration" INTEGER,
    "video_url" TEXT,
    "video_thumbnail" TEXT,
    "scorm_package_url" TEXT,
    "scorm_version" TEXT,
    "scorm_entry_point" TEXT,
    "ppt_original_url" TEXT,
    "ppt_converted_url" TEXT,
    "ppt_slide_count" INTEGER,
    "acknowledgment_text" TEXT,
    "geo_restriction" JSONB,
    "estimated_duration" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_translations" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "lesson_name" TEXT NOT NULL,
    "content" TEXT,
    "file_url" TEXT,
    "video_url" TEXT,
    "acknowledgment_text" TEXT,

    CONSTRAINT "lesson_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "assignment_id" TEXT,
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "video_position" INTEGER,
    "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "time_spent" INTEGER NOT NULL DEFAULT 0,
    "scorm_status" TEXT,
    "scorm_score" DOUBLE PRECISION,
    "scorm_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "answer_options" TEXT NOT NULL,
    "correct_answer" TEXT NOT NULL,
    "sequence_order" INTEGER NOT NULL DEFAULT 0,
    "lesson_id" TEXT NOT NULL,
    "question_type" TEXT NOT NULL DEFAULT 'multiple_choice',
    "points" INTEGER NOT NULL DEFAULT 1,
    "explanation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_question_translations" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "answer_options" TEXT NOT NULL,
    "explanation" TEXT,

    CONSTRAINT "quiz_question_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_responses" (
    "id" TEXT NOT NULL,
    "selected_answer" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "quiz_question_id" TEXT NOT NULL,
    "completion_record_id" TEXT,
    "time_spent" INTEGER,

    CONSTRAINT "quiz_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "due_date" TIMESTAMP(3),
    "assigned_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "fleet_id" TEXT NOT NULL,
    "module_id" TEXT,
    "training_program_id" TEXT,
    "assigned_by" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "reminders_sent" INTEGER NOT NULL DEFAULT 0,
    "last_reminder_at" TIMESTAMP(3),
    "triggered_by" TEXT,
    "trigger_event_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "completion_records" (
    "id" TEXT NOT NULL,
    "completed_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quiz_score" INTEGER,
    "esignature" TEXT,
    "esignature_timestamp" TIMESTAMP(3),
    "user_id" TEXT NOT NULL,
    "fleet_id" TEXT NOT NULL,
    "lesson_id" TEXT,
    "module_id" TEXT,
    "assignment_id" TEXT,
    "time_spent" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "passed" BOOLEAN NOT NULL DEFAULT true,
    "certificate_url" TEXT,
    "certificate_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "completion_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_requirements" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "regulatory_body" TEXT NOT NULL,
    "required_hours" INTEGER,
    "renewal_period" INTEGER,
    "applies_to" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "fleet_id" TEXT,
    "alert_days" INTEGER[] DEFAULT ARRAY[90, 60, 30, 14, 7]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_compliance" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "requirement_id" TEXT NOT NULL,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completed_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "hours_completed" INTEGER,
    "certificate_url" TEXT,
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_compliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "fleet_id" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "document_number" TEXT,
    "issued_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3) NOT NULL,
    "issuing_state" TEXT,
    "issuing_country" TEXT,
    "cdl_class" TEXT,
    "endorsements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "restrictions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "front_image_url" TEXT,
    "back_image_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'valid',
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "last_alert_sent" TIMESTAMP(3),
    "alerts_sent" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "btw_sessions" (
    "id" TEXT NOT NULL,
    "trainee_id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "session_date" TIMESTAMP(3) NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "total_minutes" INTEGER NOT NULL,
    "route_type" TEXT NOT NULL,
    "vehicle_type" TEXT,
    "vehicle_id" TEXT,
    "start_location" TEXT,
    "end_location" TEXT,
    "skills_checklist" JSONB NOT NULL,
    "overall_rating" INTEGER,
    "trainer_notes" TEXT,
    "areas_for_improvement" TEXT,
    "trainer_signature" TEXT,
    "trainer_signed_at" TIMESTAMP(3),
    "trainee_signature" TEXT,
    "trainee_signed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "btw_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "title" TEXT,
    "notification_type" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_sent" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "user_id" TEXT NOT NULL,
    "fleet_id" TEXT,
    "related_assignment_id" TEXT,
    "action_url" TEXT,
    "action_label" TEXT,
    "delivery_status" TEXT,
    "delivery_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "device_name" TEXT,
    "app_version" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reminder_date" TIMESTAMP(3) NOT NULL,
    "reminder_time" TEXT,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrence" TEXT,
    "recurrence_end" TIMESTAMP(3),
    "user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "is_snoozed" BOOLEAN NOT NULL DEFAULT false,
    "snoozed_until" TIMESTAMP(3),
    "notify_email" BOOLEAN NOT NULL DEFAULT false,
    "notify_sms" BOOLEAN NOT NULL DEFAULT false,
    "notify_push" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "events" "WebhookEventType"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "fleet_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "headers" JSONB,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "retry_delay_ms" INTEGER NOT NULL DEFAULT 1000,
    "last_triggered_at" TIMESTAMP(3),
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event" "WebhookEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "response_status" INTEGER,
    "response_body" TEXT,
    "response_time_ms" INTEGER,
    "success" BOOLEAN NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "last_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_triggers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "event_type" TEXT NOT NULL,
    "event_source" TEXT NOT NULL,
    "threshold" JSONB,
    "training_program_id" TEXT NOT NULL,
    "fleet_id" TEXT NOT NULL,
    "due_days" INTEGER NOT NULL DEFAULT 7,
    "priority" TEXT NOT NULL DEFAULT 'high',
    "auto_assign" BOOLEAN NOT NULL DEFAULT true,
    "notify_supervisor" BOOLEAN NOT NULL DEFAULT true,
    "notify_driver" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trigger_assignments" (
    "id" TEXT NOT NULL,
    "trigger_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_data" JSONB NOT NULL,
    "assignment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trigger_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "report_type" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "recipients" TEXT[],
    "filters" JSONB,
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "fleet_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "last_run_at" TIMESTAMP(3),
    "last_run_status" TEXT,
    "last_run_error" TEXT,
    "next_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_stats" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "total_trainings_completed" INTEGER NOT NULL DEFAULT 0,
    "total_lessons_completed" INTEGER NOT NULL DEFAULT 0,
    "total_quizzes_taken" INTEGER NOT NULL DEFAULT 0,
    "average_quiz_score" DOUBLE PRECISION,
    "highest_quiz_score" INTEGER,
    "total_time_spent" INTEGER NOT NULL DEFAULT 0,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "last_activity_date" TIMESTAMP(3),
    "overall_rank" INTEGER,
    "fleet_rank" INTEGER,
    "location_rank" INTEGER,
    "compliance_score" DOUBLE PRECISION,
    "overdue_count" INTEGER NOT NULL DEFAULT 0,
    "btw_hours_completed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "btw_sessions_completed" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "details" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "fleet_id" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "training_program_translations_training_program_id_language_key" ON "training_program_translations"("training_program_id", "language");

-- CreateIndex
CREATE UNIQUE INDEX "module_translations_module_id_language_key" ON "module_translations"("module_id", "language");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_translations_lesson_id_language_key" ON "lesson_translations"("lesson_id", "language");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_user_id_lesson_id_assignment_id_key" ON "lesson_progress"("user_id", "lesson_id", "assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_question_translations_question_id_language_key" ON "quiz_question_translations"("question_id", "language");

-- CreateIndex
CREATE UNIQUE INDEX "driver_compliance_user_id_requirement_id_key" ON "driver_compliance"("user_id", "requirement_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_devices_device_token_key" ON "push_devices"("device_token");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhook_id_created_at_idx" ON "webhook_deliveries"("webhook_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "driver_stats_user_id_key" ON "driver_stats"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_timestamp_idx" ON "audit_logs"("user_id", "timestamp");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_compliance_requirement_id_fkey" FOREIGN KEY ("compliance_requirement_id") REFERENCES "compliance_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_program_translations" ADD CONSTRAINT "training_program_translations_training_program_id_fkey" FOREIGN KEY ("training_program_id") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_training_program_id_fkey" FOREIGN KEY ("training_program_id") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_translations" ADD CONSTRAINT "module_translations_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_translations" ADD CONSTRAINT "lesson_translations_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_question_translations" ADD CONSTRAINT "quiz_question_translations_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_responses" ADD CONSTRAINT "quiz_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_responses" ADD CONSTRAINT "quiz_responses_quiz_question_id_fkey" FOREIGN KEY ("quiz_question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_responses" ADD CONSTRAINT "quiz_responses_completion_record_id_fkey" FOREIGN KEY ("completion_record_id") REFERENCES "completion_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_training_program_id_fkey" FOREIGN KEY ("training_program_id") REFERENCES "training_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "completion_records" ADD CONSTRAINT "completion_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "completion_records" ADD CONSTRAINT "completion_records_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "completion_records" ADD CONSTRAINT "completion_records_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "completion_records" ADD CONSTRAINT "completion_records_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "completion_records" ADD CONSTRAINT "completion_records_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_requirements" ADD CONSTRAINT "compliance_requirements_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_compliance" ADD CONSTRAINT "driver_compliance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_compliance" ADD CONSTRAINT "driver_compliance_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "compliance_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "btw_sessions" ADD CONSTRAINT "btw_sessions_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "btw_sessions" ADD CONSTRAINT "btw_sessions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_assignment_id_fkey" FOREIGN KEY ("related_assignment_id") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_triggers" ADD CONSTRAINT "training_triggers_training_program_id_fkey" FOREIGN KEY ("training_program_id") REFERENCES "training_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_triggers" ADD CONSTRAINT "training_triggers_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trigger_assignments" ADD CONSTRAINT "trigger_assignments_trigger_id_fkey" FOREIGN KEY ("trigger_id") REFERENCES "training_triggers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trigger_assignments" ADD CONSTRAINT "trigger_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_stats" ADD CONSTRAINT "driver_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
