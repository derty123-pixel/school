// server/src/modules/courses/course.student.service.js
const db = require('../../config/database');

class CourseStudentService {

  async enrollInCourse(userId, courseId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Check if course exists and is published
      const courseResult = await client.query('SELECT id, product_id FROM courses WHERE id = $1 AND is_published = TRUE;', [courseId]);
      if (courseResult.rows.length === 0) {
        throw { statusCode: 404, message: 'Course not found or not available for enrollment.' };
      }
      const course = courseResult.rows[0];

      // 2. TODO (Future): Monetization Check
      // If course.product_id is not NULL, this implies the course is not free.
      // Here, you would check if the user has already purchased this product_id
      // or if the enrollment should be gated by a payment flow.
      // For this MVP, we assume direct enrollment is allowed if course is published.
      // Example placeholder: if (course.product_id) { console.log("Monetization check needed for course:", courseId); }


      // 3. Check if already enrolled (DB constraint also handles this, but for friendly error)
      const existingEnrollment = await client.query(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2;',
        [userId, courseId]
      );
      if (existingEnrollment.rows.length > 0) {
        throw { statusCode: 409, message: 'You are already enrolled in this course.' };
      }

      // 4. Create enrollment record
      const enrollmentQuery = `
        INSERT INTO enrollments (user_id, course_id, progress_percent) 
        VALUES ($1, $2, 0) RETURNING *;
      `;
      const enrollmentResult = await client.query(enrollmentQuery, [userId, courseId]);
      
      await client.query('COMMIT');
      return enrollmentResult.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      if (error.statusCode) throw error;
      if (error.code === '23505' && error.constraint === 'uq_user_course_enrollment') { // Redundant due to check above, but good fallback
         throw { statusCode: 409, message: 'You are already enrolled in this course.' };
      }
      if (error.code === '23503') { // FK violation
         if (error.constraint === 'enrollments_course_id_fkey') throw { statusCode: 404, message: 'Course not found for enrollment.'};
         if (error.constraint === 'enrollments_user_id_fkey') throw { statusCode: 404, message: 'User not found for enrollment.'};
      }
      console.error('Error enrolling in course:', error);
      throw { statusCode: 500, message: 'Failed to enroll in course.' };
    } finally {
      client.release();
    }
  }

  async getEnrolledCourses(userId, { page = 1, limit = 10 }) {
    const offset = (page - 1) * limit;
    const coursesQuery = `
      SELECT 
        c.id, c.title, c.slug, c.cover_image_url, c.level, c.duration_estimate,
        u.first_name || ' ' || u.last_name as instructor_name,
        e.enrolled_at, e.completed_at, e.progress_percent, e.last_accessed_lesson_id
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      JOIN users u ON c.instructor_id = u.id
      WHERE e.user_id = $1
      ORDER BY e.enrolled_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const countQuery = 'SELECT COUNT(*) FROM enrollments WHERE user_id = $1;';

    try {
      const coursesResult = await db.query(coursesQuery, [userId, limit, offset]);
      const countResult = await db.query(countQuery, [userId]);
      
      const totalCourses = parseInt(countResult.rows[0].count, 10);
      const totalPages = Math.ceil(totalCourses / limit);

      return {
        courses: coursesResult.rows,
        pagination: { currentPage: parseInt(page, 10), totalPages, totalCourses, limit: parseInt(limit, 10) }
      };
    } catch (error) {
      console.error('Error fetching enrolled courses:', error);
      throw { statusCode: 500, message: 'Failed to retrieve your enrolled courses.' };
    }
  }

  // Helper to check enrollment status
  async _isUserEnrolled(userId, courseId, client = db) { // client can be passed if already in transaction
    const enrollmentCheck = await client.query(
        'SELECT id, progress_percent, last_accessed_lesson_id FROM enrollments WHERE user_id = $1 AND course_id = $2;',
        [userId, courseId]
    );
    return enrollmentCheck.rows[0]; // Returns enrollment record or undefined
  }


  async getEnrolledCourseContent(userId, courseId) {
    const client = await db.pool.connect(); // Use a client for multiple queries
    try {
      const enrollment = await this._isUserEnrolled(userId, courseId, client);
      if (!enrollment) {
        throw { statusCode: 403, message: 'You are not enrolled in this course or it does not exist.' };
      }

      // Fetch course details (similar to public, but no is_published check needed as user is enrolled)
      const courseQuery = `
        SELECT c.*, u.first_name || ' ' || u.last_name as instructor_name, cc.name as category_name
        FROM courses c
        JOIN users u ON c.instructor_id = u.id
        LEFT JOIN course_categories cc ON c.category_id = cc.id
        WHERE c.id = $1;
      `;
      const courseResult = await client.query(courseQuery, [courseId]);
      if (courseResult.rows.length === 0) throw { statusCode: 404, message: 'Course not found.' }; // Should not happen if enrolled
      const course = courseResult.rows[0];

      // Fetch modules and ALL lessons (including full content)
      const modulesQuery = `SELECT * FROM course_modules WHERE course_id = $1 ORDER BY module_order ASC;`;
      const lessonsQuery = `
        SELECT l.* FROM lessons l -- Select all fields for enrolled user
        JOIN course_modules cm ON l.module_id = cm.id
        WHERE cm.course_id = $1
        ORDER BY cm.module_order ASC, l.lesson_order ASC;
      `;
      // Fetch completed lesson IDs for this enrollment
      const completedLessonsQuery = `SELECT lesson_id FROM lesson_completions WHERE enrollment_id = $1;`;

      const modulesResult = await client.query(modulesQuery, [courseId]);
      const lessonsResult = await client.query(lessonsQuery, [courseId]);
      const completedLessonsResult = await client.query(completedLessonsQuery, [enrollment.id]);
      const completedLessonIds = new Set(completedLessonsResult.rows.map(r => r.lesson_id));

      const lessonsByModuleId = lessonsResult.rows.reduce((acc, lesson) => {
        if (!acc[lesson.module_id]) acc[lesson.module_id] = [];
        acc[lesson.module_id].push({ ...lesson, is_completed: completedLessonIds.has(lesson.id) });
        return acc;
      }, {});

      course.modules = modulesResult.rows.map(module => ({
        ...module,
        lessons: lessonsByModuleId[module.id] || []
      }));
      
      // Add enrollment specific details to the course object for the student
      course.enrollment_details = {
          progress_percent: enrollment.progress_percent,
          last_accessed_lesson_id: enrollment.last_accessed_lesson_id,
          enrolled_at: enrollment.enrolled_at,
          completed_at: enrollment.completed_at,
      };

      return course;
    } catch (error) {
      if (error.statusCode) throw error;
      console.error('Error fetching enrolled course content:', error);
      throw { statusCode: 500, message: 'Failed to retrieve course content.' };
    } finally {
      client.release();
    }
  }

  async getEnrolledLessonDetails(userId, courseId, lessonId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const enrollment = await this._isUserEnrolled(userId, courseId, client);
      if (!enrollment) {
        throw { statusCode: 403, message: 'You are not enrolled in this course.' };
      }

      const lessonQuery = `
        SELECT l.* FROM lessons l
        JOIN course_modules cm ON l.module_id = cm.id
        WHERE l.id = $1 AND cm.course_id = $2;
      `;
      const lessonResult = await client.query(lessonQuery, [lessonId, courseId]);
      if (lessonResult.rows.length === 0) {
        throw { statusCode: 404, message: 'Lesson not found in this course.' };
      }
      const lesson = lessonResult.rows[0];

      // Update last_accessed_lesson_id
      if (enrollment.last_accessed_lesson_id !== lessonId) {
        await client.query(
          'UPDATE enrollments SET last_accessed_lesson_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;',
          [lessonId, enrollment.id]
        );
      }
      await client.query('COMMIT');
      
      // Check if this lesson is completed for this enrollment
      const completionCheck = await db.query( // Use db.query as it's outside main transaction now
          'SELECT id FROM lesson_completions WHERE enrollment_id = $1 AND lesson_id = $2',
          [enrollment.id, lessonId]
      );
      lesson.is_completed = completionCheck.rows.length > 0;

      return lesson;
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.statusCode) throw error;
      console.error('Error fetching enrolled lesson details:', error);
      throw { statusCode: 500, message: 'Failed to retrieve lesson details.' };
    } finally {
      client.release();
    }
  }

  async markLessonAsComplete(userId, courseId, lessonId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const enrollment = await this._isUserEnrolled(userId, courseId, client);
      if (!enrollment) {
        throw { statusCode: 403, message: 'You are not enrolled in this course.' };
      }

      // Check if lesson exists in the course (implicitly checked by FK if we try to insert)
      const lessonExistsResult = await client.query(
          'SELECT l.id FROM lessons l JOIN course_modules cm ON l.module_id = cm.id WHERE l.id = $1 AND cm.course_id = $2',
          [lessonId, courseId]
      );
      if (lessonExistsResult.rows.length === 0) {
          throw { statusCode: 404, message: 'Lesson not found in this course.'};
      }

      // Insert into lesson_completions (ignore if already completed due to UNIQUE constraint)
      await client.query(
        'INSERT INTO lesson_completions (enrollment_id, lesson_id) VALUES ($1, $2) ON CONFLICT (enrollment_id, lesson_id) DO NOTHING;',
        [enrollment.id, lessonId]
      );

      // Recalculate progress_percent
      const totalLessonsResult = await client.query(
        'SELECT COUNT(l.id) as total_lessons FROM lessons l JOIN course_modules cm ON l.module_id = cm.id WHERE cm.course_id = $1;',
        [courseId]
      );
      const totalLessons = parseInt(totalLessonsResult.rows[0]?.total_lessons || 0, 10);

      const completedLessonsResult = await client.query(
        'SELECT COUNT(id) as completed_lessons FROM lesson_completions WHERE enrollment_id = $1;',
        [enrollment.id]
      );
      const completedLessons = parseInt(completedLessonsResult.rows[0]?.completed_lessons || 0, 10);

      let progressPercent = 0;
      if (totalLessons > 0) {
        progressPercent = Math.round((completedLessons / totalLessons) * 100);
      }
      
      let completedAt = enrollment.completed_at;
      if (progressPercent === 100 && !completedAt) {
          completedAt = new Date(); // Mark course as completed
      }

      const updatedEnrollmentResult = await client.query(
        'UPDATE enrollments SET progress_percent = $1, completed_at = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING progress_percent, completed_at;',
        [progressPercent, completedAt, enrollment.id]
      );

      await client.query('COMMIT');
      return { 
          message: 'Lesson marked as complete.', 
          progress_percent: updatedEnrollmentResult.rows[0].progress_percent,
          course_completed_at: updatedEnrollmentResult.rows[0].completed_at,
          lesson_id: lessonId,
          completed: true
        };
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.statusCode) throw error;
      console.error('Error marking lesson as complete:', error);
      throw { statusCode: 500, message: 'Failed to mark lesson as complete.' };
    } finally {
      client.release();
    }
  }
}

module.exports = new CourseStudentService();
