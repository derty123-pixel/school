// server/src/modules/courses/course.admin.service.js
const db = require('../../config/database');
// const slugify = require('../../shared/utils/slugify'); // Conceptual: assume this utility exists

// Simple slugify function (embed for now, ideally from shared util)
const slugify = (text) => {
  if (!text) return '';
  // Basic slugification: lowercase, replace spaces with hyphens, remove non-alphanumeric/non-hyphen
  let slug = text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, ''); // Remove all non-word chars (keeps hyphens)
  
  // Check for existing slug and append number if needed (simplified check)
  // In a real app, this would involve a DB query within a loop or a more robust unique slug generation.
  // This basic version doesn't guarantee uniqueness against DB, DB constraint handles final check.
  return slug; 
};

const checkSlugUniqueness = async (slug, currentCourseId = null) => {
    let query = 'SELECT id FROM courses WHERE slug = $1';
    const params = [slug];
    if (currentCourseId) {
        query += ' AND id != $2';
        params.push(currentCourseId);
    }
    const { rows } = await db.query(query, params);
    return rows.length === 0;
};

const generateUniqueSlug = async (title, currentCourseId = null) => {
    let baseSlug = slugify(title);
    let finalSlug = baseSlug;
    let counter = 1;
    while (!(await checkSlugUniqueness(finalSlug, currentCourseId))) {
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
    }
    return finalSlug;
};


class CourseAdminService {
  async createCourse({ title, description, instructor_id, category_id, product_id = null, level, duration_estimate, cover_image_url, is_published = false }) {
    const slug = await generateUniqueSlug(title);

    const query = `
      INSERT INTO courses (title, slug, description, instructor_id, category_id, product_id, level, duration_estimate, cover_image_url, is_published)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const values = [title, slug, description, instructor_id, category_id, product_id, level, duration_estimate, cover_image_url, is_published];
    
    try {
      const { rows } = await db.query(query, values);
      return rows[0];
    } catch (error) {
      if (error.code === '23503') { // Foreign key violation
        if (error.constraint === 'courses_category_id_fkey') {
            throw { statusCode: 400, message: 'Invalid category ID.' };
        }
        if (error.constraint === 'courses_instructor_id_fkey') {
            throw { statusCode: 400, message: 'Invalid instructor ID.' };
        }
        if (error.constraint === 'courses_product_id_fkey') {
            throw { statusCode: 400, message: 'Invalid product ID.' };
        }
      }
      if (error.code === '23505' && error.constraint === 'courses_slug_key') { // Should be rare due to generateUniqueSlug
        throw { statusCode: 409, message: 'Course slug already exists. Try a different title.' };
      }
      console.error('Error creating course:', error);
      throw { statusCode: 500, message: 'Failed to create course.' };
    }
  }

  async getAllCoursesForAdmin(user, { page = 1, limit = 10 }) {
    // user: { id: userId, roles: ['role1', 'role2'] }
    const offset = (page - 1) * limit;
    let query;
    let countQuery;
    const queryParams = [limit, offset];
    const countQueryParams = [];

    let whereClause = '';
    if (user.roles && !user.roles.includes('admin')) { // If not admin, assume instructor, show only their courses
        whereClause = 'WHERE c.instructor_id = $3';
        queryParams.push(user.id);
        countQueryParams.push(user.id);
    } else { // Admin sees all
         // No additional where clause needed for admin to see all
    }


    query = `
      SELECT c.*, u.email as instructor_email, cat.name as category_name 
      FROM courses c
      JOIN users u ON c.instructor_id = u.id
      LEFT JOIN course_categories cat ON c.category_id = cat.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    
    countQuery = `SELECT COUNT(*) FROM courses c ${whereClause};`;

    try {
      const coursesResult = await db.query(query, queryParams);
      const countResult = await db.query(countQuery, countQueryParams);
      
      const totalCourses = parseInt(countResult.rows[0].count, 10);
      const totalPages = Math.ceil(totalCourses / limit);

      return {
        courses: coursesResult.rows,
        pagination: { currentPage: parseInt(page, 10), totalPages, totalCourses, limit: parseInt(limit, 10) }
      };
    } catch (error) {
      console.error('Error fetching courses for admin:', error);
      throw { statusCode: 500, message: 'Failed to retrieve courses.' };
    }
  }

  async getCourseDetailsForAdmin(courseId, user) {
    // Fetches course with its modules and lessons (nested structure)
    const courseQuery = `
        SELECT c.*, u.email as instructor_email, cat.name as category_name
        FROM courses c
        JOIN users u ON c.instructor_id = u.id
        LEFT JOIN course_categories cat ON c.category_id = cat.id
        WHERE c.id = $1;
    `;
    const modulesQuery = `
        SELECT * FROM course_modules WHERE course_id = $1 ORDER BY module_order ASC;
    `;
    const lessonsQuery = `
        SELECT l.* FROM lessons l
        JOIN course_modules cm ON l.module_id = cm.id
        WHERE cm.course_id = $1
        ORDER BY cm.module_order ASC, l.lesson_order ASC;
    `;

    const client = await db.pool.connect();
    try {
        const courseResult = await client.query(courseQuery, [courseId]);
        if (courseResult.rows.length === 0) {
            throw { statusCode: 404, message: 'Course not found.' };
        }
        const course = courseResult.rows[0];

        // Ownership check for non-admins (instructors)
        if (user.roles && !user.roles.includes('admin') && course.instructor_id !== user.id) {
            throw { statusCode: 403, message: 'You are not authorized to view this course.' };
        }

        const modulesResult = await client.query(modulesQuery, [courseId]);
        const lessonsResult = await client.query(lessonsQuery, [courseId]);
        
        const lessonsByModuleId = lessonsResult.rows.reduce((acc, lesson) => {
            if (!acc[lesson.module_id]) acc[lesson.module_id] = [];
            acc[lesson.module_id].push(lesson);
            return acc;
        }, {});

        course.modules = modulesResult.rows.map(module => ({
            ...module,
            lessons: lessonsByModuleId[module.id] || []
        }));

        return course;

    } catch (error) {
        if (error.statusCode) throw error;
        console.error('Error fetching course details for admin:', error);
        throw { statusCode: 500, message: 'Failed to retrieve course details.' };
    } finally {
        client.release();
    }
  }

  async updateCourse(courseId, user, updateData) {
    const { title, ...otherData } = updateData;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const currentCourseResult = await client.query('SELECT * FROM courses WHERE id = $1;', [courseId]);
        if (currentCourseResult.rows.length === 0) {
            throw { statusCode: 404, message: 'Course not found.' };
        }
        const currentCourse = currentCourseResult.rows[0];

        if (user.roles && !user.roles.includes('admin') && currentCourse.instructor_id !== user.id) {
            throw { statusCode: 403, message: 'You are not authorized to update this course.' };
        }
        
        let slug = currentCourse.slug;
        if (title && title !== currentCourse.title) {
            slug = await generateUniqueSlug(title, courseId); // Pass courseId to allow same slug if title unchanged for this item
        }

        const setClauses = [];
        const values = [courseId];
        let paramCount = 2; // Start params from $2, $1 is courseId for WHERE

        if (title !== undefined) { setClauses.push(`title = $${paramCount++}`); values.push(title); }
        if (slug !== currentCourse.slug) { setClauses.push(`slug = $${paramCount++}`); values.push(slug); }
        
        for (const key of ['description', 'category_id', 'product_id', 'level', 'duration_estimate', 'cover_image_url', 'is_published', 'instructor_id']) {
            if (otherData[key] !== undefined) {
                // If admin is changing instructor_id, allow it. If instructor tries, it should be ignored or forbidden.
                if (key === 'instructor_id' && user.roles && !user.roles.includes('admin')) {
                    continue; // Instructors cannot reassign courses
                }
                setClauses.push(`${key} = $${paramCount++}`);
                values.push(otherData[key]);
            }
        }
        
        if (setClauses.length === 0) {
            await client.query('COMMIT'); // Or ROLLBACK if no changes is an error
            return currentCourse; // No actual updates to fields
        }

        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        const updateQuery = `UPDATE courses SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *;`;
        
        const { rows } = await client.query(updateQuery, values);
        await client.query('COMMIT');
        return rows[0];

    } catch (error) {
        await client.query('ROLLBACK');
        if (error.statusCode) throw error;
        if (error.code === '23505' && error.constraint === 'courses_slug_key') {
             throw { statusCode: 409, message: 'Course slug already exists or generated slug conflicts. Try a different title.' };
        }
        console.error('Error updating course:', error);
        throw { statusCode: 500, message: 'Failed to update course.' };
    } finally {
        client.release();
    }
  }

  async deleteCourse(courseId, user) {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const courseResult = await client.query('SELECT instructor_id FROM courses WHERE id = $1;', [courseId]);
        if (courseResult.rows.length === 0) {
            throw { statusCode: 404, message: 'Course not found.' };
        }
        const course = courseResult.rows[0];

        if (user.roles && !user.roles.includes('admin') && course.instructor_id !== user.id) {
            throw { statusCode: 403, message: 'You are not authorized to delete this course.' };
        }

        // ON DELETE CASCADE in schema handles modules and lessons.
        // Enrollments and lesson_completions also have ON DELETE CASCADE.
        // product_id in courses is ON DELETE SET NULL, so product itself isn't deleted.
        await client.query('DELETE FROM courses WHERE id = $1;', [courseId]);
        await client.query('COMMIT');
        return { message: 'Course and its associated content deleted successfully.' };
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.statusCode) throw error;
        console.error('Error deleting course:', error);
        throw { statusCode: 500, message: 'Failed to delete course.' };
    } finally {
        client.release();
    }
  }
}

module.exports = new CourseAdminService();
