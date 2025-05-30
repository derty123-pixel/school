-- server/src/modules/courses/sql/lesson.sql

-- Minimal Courses table for context (if not already created)
CREATE TABLE IF NOT EXISTS Courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    instructor_id UUID, -- REFERENCES Users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for Courses updated_at (if not already created)
-- Assuming trigger_set_timestamp() function from previous modules
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_course_updated_at_timestamp' AND tgrelid = 'courses'::regclass) THEN
      CREATE TRIGGER set_course_updated_at_timestamp
      BEFORE UPDATE ON Courses
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_timestamp();
   END IF;
END
$$;

-- Lessons table with video integration fields
CREATE TABLE IF NOT EXISTS Lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES Courses(id) ON DELETE CASCADE,
    -- module_id UUID NULL, -- REFERENCES CourseModules(id) ON DELETE SET NULL, -- Optional if lessons are grouped
    title VARCHAR(255) NOT NULL,
    description TEXT,
    order_in_course INTEGER NOT NULL DEFAULT 0,

    -- Content type and video-specific fields
    content_type VARCHAR(50) NOT NULL DEFAULT 'text'
        CHECK (content_type IN ('text', 'video', 'quiz_link', 'assignment', 'document')),

    text_content TEXT NULL, -- For 'text' type lessons

    video_provider VARCHAR(50) NULL
        CHECK (video_provider IS NULL OR video_provider IN ('vimeo', 'youtube', 'mux', 'aws_mediaservices', 'custom_s3', 'other')),
    external_video_id VARCHAR(255) NULL,
    video_duration_seconds INTEGER NULL CHECK (video_duration_seconds IS NULL OR video_duration_seconds >= 0),
    video_title_override VARCHAR(255) NULL,
    video_description_override TEXT NULL,
    thumbnail_url VARCHAR(1024) NULL,
    is_preview_allowed BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_video_fields_if_video_type
        CHECK (content_type != 'video' OR (video_provider IS NOT NULL AND external_video_id IS NOT NULL)),

    -- Ensure either text_content or video fields are relevant based on content_type
    CONSTRAINT chk_content_relevance
        CHECK (
            (content_type = 'text' AND text_content IS NOT NULL) OR
            (content_type = 'video' AND video_provider IS NOT NULL AND external_video_id IS NOT NULL) OR
            (content_type NOT IN ('text', 'video')) -- For other types like quiz_link, document, etc.
        )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON Lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_content_type ON Lessons(content_type);
CREATE INDEX IF NOT EXISTS idx_lessons_video_provider ON Lessons(video_provider);
CREATE INDEX IF NOT EXISTS idx_lessons_external_video_id ON Lessons(external_video_id);

-- Trigger for Lessons updated_at (if not already created)
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_lesson_updated_at_timestamp' AND tgrelid = 'lessons'::regclass) THEN
      CREATE TRIGGER set_lesson_updated_at_timestamp
      BEFORE UPDATE ON Lessons
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_timestamp();
   END IF;
END
$$;
