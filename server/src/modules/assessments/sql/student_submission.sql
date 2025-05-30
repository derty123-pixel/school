-- server/src/modules/assessments/sql/student_submission.sql

-- Table to store student submissions/attempts for an assessment
CREATE TABLE StudentSubmissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL, -- REFERENCES Users(id) ON DELETE CASCADE, -- Assuming Users table exists
    assessment_id UUID NOT NULL REFERENCES Assessments(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'in-progress' CHECK (status IN ('in-progress', 'completed', 'graded', 'aborted')),
    score DECIMAL(10, 2) NULL, -- Calculated score after grading
    percentage_score DECIMAL(5,2) NULL CHECK (percentage_score IS NULL OR (percentage_score >= 0 AND percentage_score <= 100)),
    is_passing BOOLEAN NULL, -- Based on assessment's passing_score_percentage
    attempt_number INTEGER NOT NULL DEFAULT 1,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL, -- When the student finalizes the submission
    graded_at TIMESTAMPTZ NULL,   -- When an instructor grades it (if manual grading involved)
    graded_by UUID NULL, -- REFERENCES Users(id) ON DELETE SET NULL, -- Instructor who graded
    time_spent_seconds INTEGER NULL, -- Can be calculated from started_at and completed_at or updated periodically
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, assessment_id, attempt_number) -- Ensure a student doesn't have multiple identical attempt numbers for the same assessment
);

-- Table to store student's answers for each question in a submission
CREATE TABLE StudentAnswers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES StudentSubmissions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL, -- REFERENCES Questions(id) ON DELETE CASCADE, -- FK to Questions table
    chosen_option_id UUID NULL, -- REFERENCES AnswerOptions(id) ON DELETE SET NULL, -- For multiple-choice/true-false (single select)
    -- For multiple-choice-multiple, consider storing an array of UUIDs if DB supports: chosen_option_ids UUID[]
    -- Or use a separate linking table as discussed in main schema design.
    answer_text TEXT NULL, -- For short-answer or essay questions
    awarded_points DECIMAL(6, 2) NULL, -- Points awarded for this specific answer after grading
    is_correct BOOLEAN NULL, -- Can be auto-determined for some types, or manually set
    -- Note: 'feedback' might be on the AnswerOption or Question level, or grader_feedback here.
    -- For simplicity, specific feedback on this answer can be added if needed.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments for FK constraints if Users/Questions/AnswerOptions tables are not created in this script
-- ALTER TABLE StudentSubmissions ADD CONSTRAINT fk_student FOREIGN KEY (student_id) REFERENCES Users(id) ON DELETE CASCADE;
-- ALTER TABLE StudentSubmissions ADD CONSTRAINT fk_graded_by FOREIGN KEY (graded_by) REFERENCES Users(id) ON DELETE SET NULL;
-- ALTER TABLE StudentAnswers ADD CONSTRAINT fk_question FOREIGN KEY (question_id) REFERENCES Questions(id) ON DELETE CASCADE;
-- ALTER TABLE StudentAnswers ADD CONSTRAINT fk_chosen_option FOREIGN KEY (chosen_option_id) REFERENCES AnswerOptions(id) ON DELETE SET NULL;


-- Indexes
CREATE INDEX idx_studentsubmissions_student_id ON StudentSubmissions(student_id);
CREATE INDEX idx_studentsubmissions_assessment_id ON StudentSubmissions(assessment_id);
CREATE INDEX idx_studentsubmissions_status ON StudentSubmissions(status);

CREATE INDEX idx_studentanswers_submission_id ON StudentAnswers(submission_id);
CREATE INDEX idx_studentanswers_question_id ON StudentAnswers(question_id);
CREATE INDEX idx_studentanswers_chosen_option_id ON StudentAnswers(chosen_option_id);


-- Trigger to update updated_at timestamp for StudentSubmissions
CREATE TRIGGER set_studentsubmission_timestamp
BEFORE UPDATE ON StudentSubmissions
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp(); -- Assumes trigger_set_timestamp() is created from assessment.sql

-- Trigger to update updated_at timestamp for StudentAnswers
CREATE TRIGGER set_studentanswer_timestamp
BEFORE UPDATE ON StudentAnswers
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp(); -- Assumes trigger_set_timestamp() is created from assessment.sql
