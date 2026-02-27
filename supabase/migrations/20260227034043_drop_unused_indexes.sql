/*
  # Drop Unused Indexes

  All indexes listed below have zero usage according to Supabase index
  usage statistics. Dropping them reduces write overhead and storage.

  1. Tables affected
    - profiles: idx_profiles_fleet_id, idx_profiles_role, idx_profiles_location_id
    - training_programs: idx_training_programs_fleet_id
    - modules: idx_modules_training_program_id, idx_modules_fleet_id
    - lessons: idx_lessons_module_id, idx_lessons_fleet_id
    - assignments: idx_assignments_user_id, idx_assignments_fleet_id,
      idx_assignments_status, idx_assignments_due_date,
      idx_assignments_module_id, idx_assignments_training_program_id
    - completion_records: idx_completion_records_user_id, idx_completion_records_fleet_id,
      idx_completion_records_completed_date, idx_completion_records_assignment_id,
      idx_completion_records_lesson_id, idx_completion_records_module_id
    - driver_compliance: idx_driver_compliance_user_id, idx_driver_compliance_status,
      idx_driver_compliance_expiration, idx_driver_compliance_requirement_id
    - driver_documents: idx_driver_documents_user_id, idx_driver_documents_fleet_id,
      idx_driver_documents_type, idx_driver_documents_expiration,
      idx_driver_documents_status
    - vehicles: idx_vehicles_fleet_id, idx_vehicles_type, idx_vehicles_assigned_driver
    - notifications: idx_notifications_user_id, idx_notifications_is_read,
      idx_notifications_fleet_id, idx_notifications_related_assignment_id
    - audit_logs: idx_audit_logs_entity, idx_audit_logs_user, idx_audit_logs_fleet_id
    - quiz_responses: idx_quiz_responses_completion_record_id,
      idx_quiz_responses_quiz_question_id, idx_quiz_questions_lesson_id,
      idx_quiz_responses_user_id
    - compliance_requirements: idx_compliance_requirements_fleet_id
    - locations: idx_locations_fleet_id

  2. Important notes
    - These indexes can be re-created later if query patterns require them
    - Uses IF EXISTS to avoid errors if indexes were already removed
*/

DROP INDEX IF EXISTS idx_profiles_fleet_id;
DROP INDEX IF EXISTS idx_profiles_role;
DROP INDEX IF EXISTS idx_profiles_location_id;

DROP INDEX IF EXISTS idx_training_programs_fleet_id;

DROP INDEX IF EXISTS idx_modules_training_program_id;
DROP INDEX IF EXISTS idx_modules_fleet_id;

DROP INDEX IF EXISTS idx_lessons_module_id;
DROP INDEX IF EXISTS idx_lessons_fleet_id;

DROP INDEX IF EXISTS idx_assignments_user_id;
DROP INDEX IF EXISTS idx_assignments_fleet_id;
DROP INDEX IF EXISTS idx_assignments_status;
DROP INDEX IF EXISTS idx_assignments_due_date;
DROP INDEX IF EXISTS idx_assignments_module_id;
DROP INDEX IF EXISTS idx_assignments_training_program_id;

DROP INDEX IF EXISTS idx_completion_records_user_id;
DROP INDEX IF EXISTS idx_completion_records_fleet_id;
DROP INDEX IF EXISTS idx_completion_records_completed_date;
DROP INDEX IF EXISTS idx_completion_records_assignment_id;
DROP INDEX IF EXISTS idx_completion_records_lesson_id;
DROP INDEX IF EXISTS idx_completion_records_module_id;

DROP INDEX IF EXISTS idx_driver_compliance_user_id;
DROP INDEX IF EXISTS idx_driver_compliance_status;
DROP INDEX IF EXISTS idx_driver_compliance_expiration;
DROP INDEX IF EXISTS idx_driver_compliance_requirement_id;

DROP INDEX IF EXISTS idx_driver_documents_user_id;
DROP INDEX IF EXISTS idx_driver_documents_fleet_id;
DROP INDEX IF EXISTS idx_driver_documents_type;
DROP INDEX IF EXISTS idx_driver_documents_expiration;
DROP INDEX IF EXISTS idx_driver_documents_status;

DROP INDEX IF EXISTS idx_vehicles_fleet_id;
DROP INDEX IF EXISTS idx_vehicles_type;
DROP INDEX IF EXISTS idx_vehicles_assigned_driver;

DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_notifications_is_read;
DROP INDEX IF EXISTS idx_notifications_fleet_id;
DROP INDEX IF EXISTS idx_notifications_related_assignment_id;

DROP INDEX IF EXISTS idx_audit_logs_entity;
DROP INDEX IF EXISTS idx_audit_logs_user;
DROP INDEX IF EXISTS idx_audit_logs_fleet_id;

DROP INDEX IF EXISTS idx_quiz_responses_completion_record_id;
DROP INDEX IF EXISTS idx_quiz_responses_quiz_question_id;
DROP INDEX IF EXISTS idx_quiz_questions_lesson_id;
DROP INDEX IF EXISTS idx_quiz_responses_user_id;

DROP INDEX IF EXISTS idx_compliance_requirements_fleet_id;

DROP INDEX IF EXISTS idx_locations_fleet_id;
