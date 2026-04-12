/*
  # Drop Unused Foreign Key Indexes

  These FK-prefixed indexes were created in a prior migration to support
  foreign key constraint checks and JOIN performance. However, the database
  has had no production traffic yet, so all are flagged as unused.

  Dropping them reduces write overhead and storage on the development
  instance. They should be selectively re-created once real query patterns
  emerge and EXPLAIN ANALYZE confirms they are needed.

  1. Indexes dropped
    - assignments: fk_assignments_fleet_id, fk_assignments_module_id,
      fk_assignments_training_program_id, fk_assignments_user_id
    - audit_logs: fk_audit_logs_fleet_id, fk_audit_logs_user_id
    - completion_records: fk_completion_records_assignment_id,
      fk_completion_records_fleet_id, fk_completion_records_lesson_id,
      fk_completion_records_module_id, fk_completion_records_user_id
    - compliance_requirements: fk_compliance_requirements_fleet_id
    - driver_compliance: fk_driver_compliance_requirement_id
    - driver_documents: fk_driver_documents_fleet_id, fk_driver_documents_user_id
    - lessons: fk_lessons_fleet_id, fk_lessons_module_id
    - locations: fk_locations_fleet_id
    - modules: fk_modules_fleet_id, fk_modules_training_program_id
    - notifications: fk_notifications_fleet_id,
      fk_notifications_related_assignment_id, fk_notifications_user_id
    - profiles: fk_profiles_fleet_id, fk_profiles_location_id, idx_profiles_email
    - quiz_questions: fk_quiz_questions_lesson_id
    - quiz_responses: fk_quiz_responses_completion_record_id,
      fk_quiz_responses_quiz_question_id, fk_quiz_responses_user_id
    - training_programs: fk_training_programs_fleet_id
    - vehicles: fk_vehicles_assigned_driver_id, fk_vehicles_fleet_id

  2. Important notes
    - Uses IF EXISTS to prevent errors if any index was already removed
    - These can be selectively re-created once query patterns are established
    - Foreign key constraints themselves remain intact; only the supplementary
      indexes are removed
*/

DROP INDEX IF EXISTS fk_assignments_fleet_id;
DROP INDEX IF EXISTS fk_assignments_module_id;
DROP INDEX IF EXISTS fk_assignments_training_program_id;
DROP INDEX IF EXISTS fk_assignments_user_id;

DROP INDEX IF EXISTS fk_audit_logs_fleet_id;
DROP INDEX IF EXISTS fk_audit_logs_user_id;

DROP INDEX IF EXISTS fk_completion_records_assignment_id;
DROP INDEX IF EXISTS fk_completion_records_fleet_id;
DROP INDEX IF EXISTS fk_completion_records_lesson_id;
DROP INDEX IF EXISTS fk_completion_records_module_id;
DROP INDEX IF EXISTS fk_completion_records_user_id;

DROP INDEX IF EXISTS fk_compliance_requirements_fleet_id;

DROP INDEX IF EXISTS fk_driver_compliance_requirement_id;

DROP INDEX IF EXISTS fk_driver_documents_fleet_id;
DROP INDEX IF EXISTS fk_driver_documents_user_id;

DROP INDEX IF EXISTS fk_lessons_fleet_id;
DROP INDEX IF EXISTS fk_lessons_module_id;

DROP INDEX IF EXISTS fk_locations_fleet_id;

DROP INDEX IF EXISTS fk_modules_fleet_id;
DROP INDEX IF EXISTS fk_modules_training_program_id;

DROP INDEX IF EXISTS fk_notifications_fleet_id;
DROP INDEX IF EXISTS fk_notifications_related_assignment_id;
DROP INDEX IF EXISTS fk_notifications_user_id;

DROP INDEX IF EXISTS fk_profiles_fleet_id;
DROP INDEX IF EXISTS fk_profiles_location_id;
DROP INDEX IF EXISTS idx_profiles_email;

DROP INDEX IF EXISTS fk_quiz_questions_lesson_id;

DROP INDEX IF EXISTS fk_quiz_responses_completion_record_id;
DROP INDEX IF EXISTS fk_quiz_responses_quiz_question_id;
DROP INDEX IF EXISTS fk_quiz_responses_user_id;

DROP INDEX IF EXISTS fk_training_programs_fleet_id;

DROP INDEX IF EXISTS fk_vehicles_assigned_driver_id;
DROP INDEX IF EXISTS fk_vehicles_fleet_id;