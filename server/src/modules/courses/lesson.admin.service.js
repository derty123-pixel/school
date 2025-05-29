// server/src/modules/courses/lesson.admin.service.js
const db = require('../../config/database');
// const slugify = require('../../shared/utils/slugify'); // Conceptual

// Simple slugify function (embed for now, ideally from shared util)
const slugify = (text) => {
  if (!text) return '';
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-') 
    .replace(/[^\w-]+/g, '');
};

const checkLessonSlugUniqueness = async (moduleId, slug, currentLessonId = null) => {
    let query = 'SELECT id FROM lessons WHERE module_id = $1 AND slug = $2';
    const params = [moduleId, slug];
    if (currentLessonId) {
        query += ' AND id != $3';
        params.push(currentLessonId);
    }
    const { rows } = await db.query(query, params);
    return rows.length === 0;
};

const generateUniqueLessonSlug = async (moduleId, title, currentLessonId = null) => {
    let baseSlug = slugify(title);
    let finalSlug = baseSlug;
    let counter = 1;
    while (!(await checkLessonSlugUniqueness(moduleId, finalSlug, currentLessonId))) {
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
    }
    return finalSlug;
};


class LessonAdminService {
  // Helper to check module ownership (which implies course ownership)
  async _ensureModuleOwnership(courseId, moduleId, user) {
    // First, check if module belongs to course
    const moduleCheck = await db.query('SELECT course_id FROM course_modules WHERE id = $1', [moduleId]);
    if (moduleCheck.rows.length === 0) {
        throw { statusCode: 404, message: `Module with ID ${moduleId} not found.`};
    }
    if (moduleCheck.rows[0].course_id !== courseId) {
        throw { statusCode: 400, message: `Module ${moduleId} does not belong to course ${courseId}.`};
    }

    // Then, check course ownership for non-admins
    if (user.roles && !user.roles.includes('admin')) {
      const course = await db.query('SELECT instructor_id FROM courses WHERE id = $1', [courseId]);
      // Course existence already checked by module check if module exists and belongs to course
      if (course.rows[0].instructor_id !== user.id) {
        throw { statusCode: 403, message: 'You are not authorized to manage lessons for this course.' };
      }
    }
    // Admin passes, or instructor owns the course.
    // Also check if course exists, even for admin
     const courseExists = await db.query('SELECT id FROM courses WHERE id = $1', [courseId]);
     if (courseExists.rows.length === 0) { // Should be caught by module check if module ID is valid
        throw { statusCode: 404, message: `Course with ID ${courseId} not found.` };
     }
  }

  async createLesson(courseId, moduleId, user, lessonData) {
    await this._ensureModuleOwnership(courseId, moduleId, user);
    const { title, lesson_type, content_url, text_content, duration_minutes, lesson_order, is_preview_allowed = false } = lessonData;

    const slug = await generateUniqueLessonSlug(moduleId, title);

    let orderToUse = lesson_order;
    if (orderToUse === undefined || orderToUse === null) {
        const lastLessonResult = await db.query(
            'SELECT MAX(lesson_order) as max_order FROM lessons WHERE module_id = $1',
            [moduleId]
        );
        orderToUse = (lastLessonResult.rows[0]?.max_order || 0) + 1;
    }

    const query = `
      INSERT INTO lessons (module_id, title, slug, lesson_type, content_url, text_content, duration_minutes, lesson_order, is_preview_allowed)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [moduleId, title, slug, lesson_type, content_url, text_content, duration_minutes, orderToUse, is_preview_allowed];
    try {
      const { rows } = await db.query(query, values);
      return rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
         if (error.constraint === 'uq_lesson_module_order') {
            throw { statusCode: 409, message: `A lesson with order ${orderToUse} already exists for this module.` };
         }
         if (error.constraint === 'uq_lesson_module_slug') { // Should be rare due to generateUniqueLessonSlug
            throw { statusCode: 409, message: `Lesson slug '${slug}' already exists for this module. Try a different title.` };
         }
      }
      console.error('Error creating lesson:', error);
      throw { statusCode: 500, message: 'Failed to create lesson.' };
    }
  }

  async getLessonsForModule(courseId, moduleId, user) {
    await this._ensureModuleOwnership(courseId, moduleId, user);
    const query = 'SELECT * FROM lessons WHERE module_id = $1 ORDER BY lesson_order ASC;';
    try {
      const { rows } = await db.query(query, [moduleId]);
      return rows;
    } catch (error) {
      console.error('Error fetching lessons for module:', error);
      throw { statusCode: 500, message: 'Failed to retrieve lessons.' };
    }
  }

  async getLessonById(courseId, moduleId, lessonId, user) {
    await this._ensureModuleOwnership(courseId, moduleId, user);
    const query = 'SELECT * FROM lessons WHERE id = $1 AND module_id = $2;';
    try {
      const { rows } = await db.query(query, [lessonId, moduleId]);
      if (rows.length === 0) {
        throw { statusCode: 404, message: 'Lesson not found or does not belong to this module.' };
      }
      return rows[0];
    } catch (error) {
      if (error.statusCode === 404) throw error;
      console.error('Error fetching lesson by ID:', error);
      throw { statusCode: 500, message: 'Failed to retrieve lesson.' };
    }
  }

  async updateLesson(courseId, moduleId, lessonId, user, updateData) {
    await this._ensureModuleOwnership(courseId, moduleId, user);
    
    const { title, ...otherData } = updateData;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const currentLessonResult = await client.query('SELECT * FROM lessons WHERE id = $1 AND module_id = $2;', [lessonId, moduleId]);
        if (currentLessonResult.rows.length === 0) {
            throw { statusCode: 404, message: 'Lesson not found or does not belong to this module.' };
        }
        const currentLesson = currentLessonResult.rows[0];
        
        let slug = currentLesson.slug;
        if (title && title !== currentLesson.title) {
            slug = await generateUniqueLessonSlug(moduleId, title, lessonId);
        }

        const setClauses = [];
        const values = [lessonId, moduleId]; // $1 = lessonId, $2 = moduleId for WHERE
        let paramCount = 3;

        if (title !== undefined) { setClauses.push(`title = $${paramCount++}`); values.push(title); }
        if (slug !== currentLesson.slug) { setClauses.push(`slug = $${paramCount++}`); values.push(slug); }
        
        const updatableFields = ['lesson_type', 'content_url', 'text_content', 'duration_minutes', 'lesson_order', 'is_preview_allowed'];
        for (const key of updatableFields) {
            if (otherData[key] !== undefined) {
                setClauses.push(`${key} = $${paramCount++}`);
                values.push(otherData[key]);
            }
        }
        
        if (setClauses.length === 0) {
             await client.query('COMMIT');
            return currentLesson; // No actual updates
        }
        setClauses.push('updated_at = CURRENT_TIMESTAMP');

        const updateQuery = `
          UPDATE lessons 
          SET ${setClauses.join(', ')} 
          WHERE id = $1 AND module_id = $2
          RETURNING *;
        `;
        
        const { rows } = await client.query(updateQuery, values);
        await client.query('COMMIT');
        return rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.statusCode) throw error;
        if (error.code === '23505') { // Unique constraint violation
             if (error.constraint === 'uq_lesson_module_order') {
                throw { statusCode: 409, message: `A lesson with order ${updateData.lesson_order} already exists for this module.` };
             }
             if (error.constraint === 'uq_lesson_module_slug') {
                throw { statusCode: 409, message: `Lesson slug already exists or generated slug conflicts. Try a different title.` };
             }
        }
        console.error('Error updating lesson:', error);
        throw { statusCode: 500, message: 'Failed to update lesson.' };
    } finally {
        client.release();
    }
  }

  async deleteLesson(courseId, moduleId, lessonId, user) {
    await this._ensureModuleOwnership(courseId, moduleId, user);
    const query = 'DELETE FROM lessons WHERE id = $1 AND module_id = $2 RETURNING id;';
    try {
      const { rows } = await db.query(query, [lessonId, moduleId]);
      if (rows.length === 0) {
        throw { statusCode: 404, message: 'Lesson not found or does not belong to this module.' };
      }
      return { message: 'Lesson deleted successfully.' };
    } catch (error) {
      if (error.statusCode) throw error;
      console.error('Error deleting lesson:', error);
      throw { statusCode: 500, message: 'Failed to delete lesson.' };
    }
  }
}

module.exports = new LessonAdminService();
