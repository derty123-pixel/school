-- course_delivery_schema.sql
-- Database schema for Online Course Delivery functionality
-- Database System: PostgreSQL

-- Ensure UUID generation extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-------------------------------------
--      COURSE DELIVERY MODULE     --
-------------------------------------

-- 1. Define lesson_type ENUM Type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lesson_type_enum') THEN
        CREATE TYPE lesson_type_enum AS ENUM (
            'video', 
            'text', 
            'quiz', 
            'document' -- e.g., PDF, slides
        );
        COMMENT ON TYPE lesson_type_enum IS 'Defines the type of content for a lesson.';
    END IF;
END$$;

-- 2. course_categories Table
CREATE TABLE course_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE course_categories IS 'Stores categories for organizing courses.';

-- 3. courses Table
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL, -- If instructor is deleted, course remains but unassigned. App logic to handle.
    category_id UUID REFERENCES course_categories(id) ON DELETE SET NULL,
    product_id UUID UNIQUE REFERENCES products(id) ON DELETE SET NULL, -- Course can be free (NULL) or linked to a purchasable product. ON DELETE SET NULL: if product deleted, course becomes free/unpurchasable.
    level TEXT, -- e.g., 'Beginner', 'Intermediate', 'Advanced', 'All Levels'
    duration_estimate TEXT, -- e.g., 'Approx. 5 hours', '3 Weeks (2hr/week)'
    cover_image_url TEXT,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE courses IS 'Stores information about available courses.';
COMMENT ON COLUMN courses.slug IS 'User-friendly unique identifier for URLs.';
COMMENT ON COLUMN courses.instructor_id IS 'The user who is the instructor for this course.';
COMMENT ON COLUMN courses.product_id IS 'If set, links this course to a product entry for sales.';
COMMENT ON COLUMN courses.level IS 'Difficulty level of the course.';
COMMENT ON COLUMN courses.duration_estimate IS 'Estimated time to complete the course.';

-- 4. course_modules Table
CREATE TABLE course_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE, -- If course deleted, its modules are deleted.
    title TEXT NOT NULL,
    description TEXT,
    module_order INTEGER NOT NULL, -- Order of the module within the course
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_course_module_order UNIQUE (course_id, module_order)
);
COMMENT ON TABLE course_modules IS 'Stores modules (sections) within a course.';
COMMENT ON COLUMN course_modules.module_order IS 'Determines the sequence of modules in a course.';

-- 5. lessons Table
CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE, -- If module deleted, its lessons are deleted.
    title TEXT NOT NULL,
    slug TEXT NOT NULL, 
    lesson_type lesson_type_enum NOT NULL,
    content_url TEXT, -- For 'video' (Vimeo ID, YouTube ID, Mux Asset ID), 'document' (S3 URL, etc.)
    text_content TEXT, -- For 'text' lessons (Markdown or HTML)
    -- For 'quiz' type, content_url or text_content might store quiz definition (e.g., JSON) or link to external quiz platform.
    duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes >= 0), -- Estimated duration in minutes
    lesson_order INTEGER NOT NULL, -- Order of the lesson within the module
    is_preview_allowed BOOLEAN NOT NULL DEFAULT FALSE, -- Can non-enrolled users view this lesson?
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_lesson_module_order UNIQUE (module_id, lesson_order),
    CONSTRAINT uq_lesson_module_slug UNIQUE (module_id, slug) -- Lesson slugs unique within a module
);
COMMENT ON TABLE lessons IS 'Stores individual lessons within a course module.';
COMMENT ON COLUMN lessons.slug IS 'User-friendly unique identifier for lesson URLs, scoped to a module.';
COMMENT ON COLUMN lessons.lesson_type IS 'Type of content for the lesson (video, text, quiz, document).';
COMMENT ON COLUMN lessons.content_url IS 'URL or ID for video/document content.';
COMMENT ON COLUMN lessons.text_content IS 'Raw text content for text-based lessons.';
COMMENT ON COLUMN lessons.duration_minutes IS 'Estimated duration of the lesson in minutes.';
COMMENT ON COLUMN lessons.is_preview_allowed IS 'Indicates if the lesson can be previewed by non-enrolled users.';

-- 6. enrollments Table
CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- If user deleted, their enrollments are deleted.
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE, -- If course deleted, enrollments are deleted.
    enrolled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ, -- Timestamp when the course was fully completed
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    last_accessed_lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL, -- Last lesson user was viewing
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- Redundant with enrolled_at but common pattern
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- For tracking updates to progress_percent or last_accessed
    CONSTRAINT uq_user_course_enrollment UNIQUE (user_id, course_id)
);
COMMENT ON TABLE enrollments IS 'Tracks user enrollments in courses and their overall progress.';
COMMENT ON COLUMN enrollments.progress_percent IS 'Overall completion percentage of the course by the user.';
COMMENT ON COLUMN enrollments.last_accessed_lesson_id IS 'The last lesson the user accessed in this course.';

-- 7. lesson_completions Table
CREATE TABLE lesson_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_enrollment_lesson_completion UNIQUE (enrollment_id, lesson_id)
);
COMMENT ON TABLE lesson_completions IS 'Tracks completion status for each lesson by an enrolled user.';
COMMENT ON COLUMN lesson_completions.enrollment_id IS 'Link to the specific enrollment record.';
COMMENT ON COLUMN lesson_completions.lesson_id IS 'Link to the specific lesson completed.';


-- Indexes
CREATE INDEX idx_courses_instructor_id ON courses(instructor_id);
CREATE INDEX idx_courses_category_id ON courses(category_id);
CREATE INDEX idx_courses_product_id ON courses(product_id);
CREATE INDEX idx_courses_slug ON courses(slug);
CREATE INDEX idx_courses_is_published ON courses(is_published);

CREATE INDEX idx_course_modules_course_id ON course_modules(course_id);

CREATE INDEX idx_lessons_module_id ON lessons(module_id);
CREATE INDEX idx_lessons_slug ON lessons(slug); 
CREATE INDEX idx_lessons_lesson_type ON lessons(lesson_type);

CREATE INDEX idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_enrollments_last_accessed_lesson_id ON enrollments(last_accessed_lesson_id);

CREATE INDEX idx_lesson_completions_enrollment_id ON lesson_completions(enrollment_id);
CREATE INDEX idx_lesson_completions_lesson_id ON lesson_completions(lesson_id);


-- Reusing or defining the trigger function for 'updated_at'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_timestamp') THEN
    CREATE FUNCTION trigger_set_timestamp()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END
$$;

-- Apply the trigger to new tables
CREATE TRIGGER set_timestamp_course_categories
BEFORE UPDATE ON course_categories
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_courses
BEFORE UPDATE ON courses
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_course_modules
BEFORE UPDATE ON course_modules
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_lessons
BEFORE UPDATE ON lessons
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_enrollments
BEFORE UPDATE ON enrollments
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- No updated_at for lesson_completions as it's typically an immutable record once created.
-- If it were to be updatable (e.g. un-completing), then add updated_at and trigger.

COMMIT;
```
