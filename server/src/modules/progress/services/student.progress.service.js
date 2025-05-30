// server/src/modules/progress/services/student.progress.service.js
const db = require('../../../config/database');
const logger = require('../../../config/logger');

const StudentProgressService = {
  /**
   * Updates (or creates if not exists) a student's progress for a specific lesson.
   * @param {string} studentId - The ID of the student.
   * @param {string} lessonId - The ID of the lesson.
   * @param {object} progressData - Data for the progress update.
   * @param {string} [progressData.status] - e.g., 'in_progress', 'completed'.
   * @param {number} [progressData.video_progress_seconds] - Current video playback time.
   * @returns {Promise<object>} The updated or created student lesson progress record.
   * @throws {Error} If lesson not found or update fails.
   */
  async updateLessonProgress(studentId, lessonId, progressData) {
    const { status, video_progress_seconds } = progressData;
    const now = new Date();
    let completedAt = null;

    // 1. Fetch the lesson to get its course_id and validate existence
    const lessonQuery = 'SELECT course_id FROM Lessons WHERE id = $1;';
    const { rows: lessonRows } = await db.pool.query(lessonQuery, [lessonId]);
    if (lessonRows.length === 0) {
      throw new Error('Lesson not found.');
    }
    const courseId = lessonRows[0].course_id;

    // 2. Prepare fields for UPSERT
    const updates = {
      last_viewed_at: now,
    };

    if (status) {
      updates.status = status;
      if (status === 'completed') {
        // Only set completed_at if it's not already set, or if explicitly re-completing (though usually status change is enough)
        // For an UPSERT, if status becomes 'completed', we set completed_at.
        // If it was already 'completed', completed_at typically shouldn't change unless reset.
        // The ON CONFLICT clause will decide if completed_at gets updated from NULL.
        completedAt = now;
        updates.completed_at = completedAt;
      } else if (status === 'in_progress' || status === 'not_started') {
        // If status changes from 'completed' back to 'in_progress' or 'not_started', nullify completed_at
        updates.completed_at = null;
      }
    }

    if (video_progress_seconds !== undefined && video_progress_seconds !== null) {
      updates.video_progress_seconds = parseInt(video_progress_seconds, 10);
      if (updates.video_progress_seconds < 0) throw new Error('video_progress_seconds cannot be negative.');
      // If video progress is updated, and status is not 'completed', set status to 'in_progress'
      if (updates.status !== 'completed' && (!updates.status || updates.status === 'not_started')) {
          updates.status = 'in_progress';
      }
    }

    // Ensure status is set if only video_progress_seconds is provided and no prior record
    const currentStatus = updates.status || 'not_started';


    // 3. Perform UPSERT operation
    const upsertQuery = `
      INSERT INTO StudentLessonProgress
        (student_id, lesson_id, course_id, status, completed_at, last_viewed_at, video_progress_seconds, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8) -- created_at and updated_at are the same on insert
      ON CONFLICT (student_id, lesson_id)
      DO UPDATE SET
        status = COALESCE(EXCLUDED.status, StudentLessonProgress.status),
        completed_at = CASE
                         WHEN EXCLUDED.status = 'completed' THEN COALESCE(StudentLessonProgress.completed_at, EXCLUDED.completed_at)
                         WHEN EXCLUDED.status = 'in_progress' OR EXCLUDED.status = 'not_started' THEN NULL
                         ELSE StudentLessonProgress.completed_at
                       END,
        last_viewed_at = EXCLUDED.last_viewed_at,
        video_progress_seconds = COALESCE(EXCLUDED.video_progress_seconds, StudentLessonProgress.video_progress_seconds),
        updated_at = EXCLUDED.updated_at
      RETURNING *;
    `;

    const values = [
      studentId,
      lessonId,
      courseId,
      updates.status || currentStatus, // Use currentStatus if updates.status is undefined (e.g. only video progress sent)
      updates.completed_at, // This will be EXCLUDED.completed_at in the UPDATE path
      updates.last_viewed_at,
      updates.video_progress_seconds,
      now, // for created_at and updated_at on insert path
    ];

    // Refine values for the UPSERT based on what's being updated
    // The EXCLUDED keyword handles using the insert values for the update path.
    // The COALESCE ensures that if a field is not provided in `updates` (making EXCLUDED.field NULL for that part),
    // it retains its existing value during an UPDATE.
    // However, the provided values array needs to map to the INSERT part.
    // The logic for `completed_at` in the `DO UPDATE SET` clause is critical.

    const finalValuesForUpsert = [
        studentId, lessonId, courseId,
        updates.status || 'not_started', // Default for new record if only video progress sent
        (updates.status === 'completed' ? (updates.completed_at || now) : (updates.status === 'in_progress' || updates.status === 'not_started' ? null : undefined)), // completed_at logic for INSERT
        now, // last_viewed_at for INSERT
        updates.video_progress_seconds, // video_progress_seconds for INSERT
        now // created_at & updated_at timestamp for INSERT
    ];


    try {
      const { rows } = await db.pool.query(upsertQuery, finalValuesForUpsert);
      logger.info(`Lesson progress for lesson ${lessonId}, student ${studentId} updated. Status: ${rows[0].status}`);

      // TODO conceptual: After updating lesson progress, trigger an update to StudentCourseProgress
      // this.updateCourseProgress(studentId, courseId);

      return rows[0];
    } catch (error) {
      logger.error(`Error updating lesson progress for student ${studentId}, lesson ${lessonId}: ${error.message}`, { stack: error.stack, progressData });
      throw error;
    }
  },

  /**
   * Get a student's progress for a specific lesson.
   * @param {string} studentId - The ID of the student.
   * @param {string} lessonId - The ID of the lesson.
   * @returns {Promise<object|null>} The student lesson progress record, or a default object if no record exists.
   */
  async getLessonProgress(studentId, lessonId) {
    const query = 'SELECT * FROM StudentLessonProgress WHERE student_id = $1 AND lesson_id = $2;';
    try {
      const { rows } = await db.pool.query(query, [studentId, lessonId]);
      if (rows.length > 0) {
        return rows[0];
      } else {
        // Return a default 'not_started' state if no record exists
        // Fetch course_id for consistency, though it could be passed or looked up by controller too
        const lessonQuery = 'SELECT course_id FROM Lessons WHERE id = $1;';
        const { rows: lessonRows } = await db.pool.query(lessonQuery, [lessonId]);
        if (lessonRows.length === 0) throw new Error('Lesson not found when trying to get default progress.');

        return {
          student_id: studentId,
          lesson_id: lessonId,
          course_id: lessonRows[0].course_id,
          status: 'not_started',
          completed_at: null,
          last_viewed_at: null,
          video_progress_seconds: 0, // Or null, depending on preference for "never started"
        };
      }
    } catch (error) {
      logger.error(`Error getting lesson progress for student ${studentId}, lesson ${lessonId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },

  // Conceptual: async updateCourseProgress(studentId, courseId) { /* ... recalculate and update StudentCourseProgress ... */ }
};

module.exports = StudentProgressService;
