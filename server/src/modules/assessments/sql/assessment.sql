-- server/src/modules/assessments/sql/assessment.sql

-- Table to store assessments (quizzes, tests, exams)
CREATE TABLE Assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL, -- REFERENCES Courses(id) ON DELETE CASCADE, -- Assuming Courses table exists
    title VARCHAR(255) NOT NULL,
    description TEXT,
    time_limit_minutes INTEGER, -- Nullable, if no time limit
    passing_score_percentage DECIMAL(5, 2) CHECK (passing_score_percentage >= 0 AND passing_score_percentage <= 100), -- e.g., 70.00
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- e.g., 'draft', 'published', 'archived'

    -- Settings like shuffle_questions, reveal_correct_answers, max_attempts can be stored in a JSONB column
    settings JSONB DEFAULT '{
        "shuffle_questions": false,
        "shuffle_answer_options": false,
        "reveal_correct_answers": "never",
        "max_attempts": 1,
        "show_feedback_after": "grading"
    }',
    -- Example values for settings:
    -- reveal_correct_answers: 'never', 'after_submission', 'after_grading', 'after_due_date'
    -- show_feedback_after: 'never', 'submission', 'grading'
    -- max_attempts: 1 (integer, 0 or null for unlimited)

    created_by UUID NOT NULL, -- REFERENCES Users(id), -- Assuming Users table exists
    updated_by UUID NOT NULL, -- REFERENCES Users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments for FK constraints if Courses/Users tables are not created in this script
-- ALTER TABLE Assessments ADD CONSTRAINT fk_course FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE;
-- ALTER TABLE Assessments ADD CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES Users(id) ON DELETE SET NULL; -- Or NOT NULL if required
-- ALTER TABLE Assessments ADD CONSTRAINT fk_updated_by FOREIGN KEY (updated_by) REFERENCES Users(id) ON DELETE SET NULL; -- Or NOT NULL if required

-- Indexes
CREATE INDEX idx_assessments_course_id ON Assessments(course_id);
CREATE INDEX idx_assessments_status ON Assessments(status);
CREATE INDEX idx_assessments_created_by ON Assessments(created_by);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_assessment_timestamp
BEFORE UPDATE ON Assessments
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
