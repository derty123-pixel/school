-- server/src/modules/assessments/sql/question.sql

-- Table to store individual questions within an assessment
CREATE TABLE Questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES Assessments(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL CHECK (question_type IN ('multiple-choice-single', 'multiple-choice-multiple', 'true-false', 'short-answer', 'essay')),
    points DECIMAL(6, 2) NOT NULL DEFAULT 1.00 CHECK (points >= 0), -- Points this question is worth
    order_in_assessment INTEGER NOT NULL DEFAULT 0, -- To maintain question order
    feedback_general TEXT,    -- Optional general feedback for the question (shown after attempt)
    feedback_correct TEXT,    -- Optional feedback if answered correctly (for auto-graded types)
    feedback_incorrect TEXT,  -- Optional feedback if answered incorrectly (for auto-graded types)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table to store answer options for multiple-choice or true-false questions
CREATE TABLE AnswerOptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES Questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    order_in_question INTEGER NOT NULL DEFAULT 0, -- Optional, for maintaining option order
    feedback TEXT, -- Optional specific feedback for choosing this option
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_questions_assessment_id ON Questions(assessment_id);
CREATE INDEX idx_questions_question_type ON Questions(question_type);
CREATE INDEX idx_answeroptions_question_id ON AnswerOptions(question_id);

-- Trigger to update updated_at timestamp for Questions
CREATE TRIGGER set_question_timestamp
BEFORE UPDATE ON Questions
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp(); -- Assumes trigger_set_timestamp() is created from assessment.sql

-- Trigger to update updated_at timestamp for AnswerOptions
CREATE TRIGGER set_answeroption_timestamp
BEFORE UPDATE ON AnswerOptions
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp(); -- Assumes trigger_set_timestamp() is created from assessment.sql
