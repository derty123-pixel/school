-- server/src/modules/progress/sql/student_progress.sql

-- Table to track student progress for each lesson
CREATE TABLE StudentLessonProgress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL, -- REFERENCES Users(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL, -- REFERENCES Lessons(id) ON DELETE CASCADE,
    course_id UUID NOT NULL, -- REFERENCES Courses(id) ON DELETE CASCADE, -- Denormalized

    status VARCHAR(50) NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'completed')),

    completed_at TIMESTAMPTZ NULL,
    last_viewed_at TIMESTAMPTZ NULL,

    video_progress_seconds INTEGER NULL CHECK (video_progress_seconds IS NULL OR video_progress_seconds >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (student_id, lesson_id)
);

-- Foreign Key Comments (Uncomment when Users, Lessons, Courses tables are confirmed and available)
-- ALTER TABLE StudentLessonProgress ADD CONSTRAINT fk_slp_student FOREIGN KEY (student_id) REFERENCES Users(id) ON DELETE CASCADE;
-- ALTER TABLE StudentLessonProgress ADD CONSTRAINT fk_slp_lesson FOREIGN KEY (lesson_id) REFERENCES Lessons(id) ON DELETE CASCADE;
-- ALTER TABLE StudentLessonProgress ADD CONSTRAINT fk_slp_course FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE;


-- Indexes
CREATE INDEX idx_studentlessonprogress_student_course ON StudentLessonProgress(student_id, course_id);
-- Unique constraint on (student_id, lesson_id) already creates an index.
CREATE INDEX idx_studentlessonprogress_status ON StudentLessonProgress(status);


-- Trigger for updated_at
-- Assuming trigger_set_timestamp() function from previous modules
CREATE TRIGGER set_studentlessonprogress_updated_at
BEFORE UPDATE ON StudentLessonProgress
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
