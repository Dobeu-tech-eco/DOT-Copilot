/*
  # Add Indexes for All Unindexed Foreign Keys

  Foreign keys without covering indexes cause slow cascading deletes
  and degrade JOIN performance. This migration adds an index for every
  foreign key column that lacks one.

  1. Tables and indexes added
    - assignments: fleet_id, module_id, training_program_id, user_id
    - audit_logs: fleet_id, user_id
    - completion_records: assignment_id, fleet_id, lesson_id, module_id, user_id
    - compliance_requirements: fleet_id
    - driver_compliance: requirement_id
    - driver_documents: fleet_id, user_id
    - lessons: fleet_id, module_id
    - locations: fleet_id
    - modules: fleet_id, training_program_id
    - notifications: fleet_id, related_assignment_id, user_id
    - profiles: fleet_id, location_id
    - quiz_questions: lesson_id
    - quiz_responses: completion_record_id, quiz_question_id, user_id
    - training_programs: fleet_id
    - vehicles: assigned_driver_id, fleet_id

  2. Important notes
    - All indexes use IF NOT EXISTS for safety
    - Named with fk_ prefix to distinguish from other indexes
*/

CREATE INDEX IF NOT EXISTS fk_assignments_fleet_id ON assignments(fleet_id);
CREATE INDEX IF NOT EXISTS fk_assignments_module_id ON assignments(module_id);
CREATE INDEX IF NOT EXISTS fk_assignments_training_program_id ON assignments(training_program_id);
CREATE INDEX IF NOT EXISTS fk_assignments_user_id ON assignments(user_id);

CREATE INDEX IF NOT EXISTS fk_audit_logs_fleet_id ON audit_logs(fleet_id);
CREATE INDEX IF NOT EXISTS fk_audit_logs_user_id ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS fk_completion_records_assignment_id ON completion_records(assignment_id);
CREATE INDEX IF NOT EXISTS fk_completion_records_fleet_id ON completion_records(fleet_id);
CREATE INDEX IF NOT EXISTS fk_completion_records_lesson_id ON completion_records(lesson_id);
CREATE INDEX IF NOT EXISTS fk_completion_records_module_id ON completion_records(module_id);
CREATE INDEX IF NOT EXISTS fk_completion_records_user_id ON completion_records(user_id);

CREATE INDEX IF NOT EXISTS fk_compliance_requirements_fleet_id ON compliance_requirements(fleet_id);

CREATE INDEX IF NOT EXISTS fk_driver_compliance_requirement_id ON driver_compliance(requirement_id);

CREATE INDEX IF NOT EXISTS fk_driver_documents_fleet_id ON driver_documents(fleet_id);
CREATE INDEX IF NOT EXISTS fk_driver_documents_user_id ON driver_documents(user_id);

CREATE INDEX IF NOT EXISTS fk_lessons_fleet_id ON lessons(fleet_id);
CREATE INDEX IF NOT EXISTS fk_lessons_module_id ON lessons(module_id);

CREATE INDEX IF NOT EXISTS fk_locations_fleet_id ON locations(fleet_id);

CREATE INDEX IF NOT EXISTS fk_modules_fleet_id ON modules(fleet_id);
CREATE INDEX IF NOT EXISTS fk_modules_training_program_id ON modules(training_program_id);

CREATE INDEX IF NOT EXISTS fk_notifications_fleet_id ON notifications(fleet_id);
CREATE INDEX IF NOT EXISTS fk_notifications_related_assignment_id ON notifications(related_assignment_id);
CREATE INDEX IF NOT EXISTS fk_notifications_user_id ON notifications(user_id);

CREATE INDEX IF NOT EXISTS fk_profiles_fleet_id ON profiles(fleet_id);
CREATE INDEX IF NOT EXISTS fk_profiles_location_id ON profiles(location_id);

CREATE INDEX IF NOT EXISTS fk_quiz_questions_lesson_id ON quiz_questions(lesson_id);

CREATE INDEX IF NOT EXISTS fk_quiz_responses_completion_record_id ON quiz_responses(completion_record_id);
CREATE INDEX IF NOT EXISTS fk_quiz_responses_quiz_question_id ON quiz_responses(quiz_question_id);
CREATE INDEX IF NOT EXISTS fk_quiz_responses_user_id ON quiz_responses(user_id);

CREATE INDEX IF NOT EXISTS fk_training_programs_fleet_id ON training_programs(fleet_id);

CREATE INDEX IF NOT EXISTS fk_vehicles_assigned_driver_id ON vehicles(assigned_driver_id);
CREATE INDEX IF NOT EXISTS fk_vehicles_fleet_id ON vehicles(fleet_id);
