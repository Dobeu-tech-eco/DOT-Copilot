/*
  # Add Missing Foreign Key Indexes

  Adds covering indexes for all foreign key columns that were missing indexes.
  This prevents sequential scans on JOIN operations and DELETE cascades.

  1. Tables affected
    - assignments: module_id, training_program_id
    - audit_logs: fleet_id
    - completion_records: assignment_id, lesson_id, module_id
    - compliance_requirements: fleet_id
    - driver_compliance: requirement_id
    - locations: fleet_id
    - notifications: fleet_id, related_assignment_id
    - profiles: location_id
    - quiz_responses: completion_record_id, quiz_question_id

  2. Important notes
    - Uses IF NOT EXISTS to avoid errors if indexes already exist
    - All indexes are on single foreign key columns
*/

CREATE INDEX IF NOT EXISTS idx_assignments_module_id ON assignments(module_id);
CREATE INDEX IF NOT EXISTS idx_assignments_training_program_id ON assignments(training_program_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_fleet_id ON audit_logs(fleet_id);
CREATE INDEX IF NOT EXISTS idx_completion_records_assignment_id ON completion_records(assignment_id);
CREATE INDEX IF NOT EXISTS idx_completion_records_lesson_id ON completion_records(lesson_id);
CREATE INDEX IF NOT EXISTS idx_completion_records_module_id ON completion_records(module_id);
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_fleet_id ON compliance_requirements(fleet_id);
CREATE INDEX IF NOT EXISTS idx_driver_compliance_requirement_id ON driver_compliance(requirement_id);
CREATE INDEX IF NOT EXISTS idx_locations_fleet_id ON locations(fleet_id);
CREATE INDEX IF NOT EXISTS idx_notifications_fleet_id ON notifications(fleet_id);
CREATE INDEX IF NOT EXISTS idx_notifications_related_assignment_id ON notifications(related_assignment_id);
CREATE INDEX IF NOT EXISTS idx_profiles_location_id ON profiles(location_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_completion_record_id ON quiz_responses(completion_record_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_quiz_question_id ON quiz_responses(quiz_question_id);
