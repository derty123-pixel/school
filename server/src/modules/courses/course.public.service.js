// server/src/modules/courses/course.public.service.js
const db = require('../../config/database');

class CoursePublicService {
  async getPublishedCourses({ page = 1, limit = 10, categoryId = null, instructorId = null }) {
    const offset = (page - 1) * limit;
    let queryParams = [limit, offset];
    const countQueryParams = [];
    
    let baseQuery = `
      FROM courses c
      JOIN users u ON c.instructor_id = u.id
      LEFT JOIN course_categories cc ON c.category_id = cc.id
      LEFT JOIN products p ON c.product_id = p.id
      WHERE c.is_published = TRUE
    `;

    if (categoryId) {
      countQueryParams.push(categoryId);
      queryParams.push(categoryId);
      baseQuery += ` AND c.category_id = $${queryParams.length -2 + 1}`; // Adjust param index based on final queryParams length
    }
    if (instructorId) {
      countQueryParams.push(instructorId);
      queryParams.push(instructorId);
      baseQuery += ` AND c.instructor_id = $${queryParams.length -2 + 1}`;
    }
    
    // Adjust parameter indexing for the main query if categoryId/instructorId were added
    if (categoryId && instructorId) {
        baseQuery = baseQuery.replace('$3', '$3').replace('$4', '$4'); // Correct if both present
    } else if (categoryId || instructorId) {
        baseQuery = baseQuery.replace('$3', '$3'); // Correct if only one present
    }


    const coursesSelect = `
      SELECT 
        c.id, c.title, c.slug, c.description, c.level, c.duration_estimate, c.cover_image_url,
        u.first_name || ' ' || u.last_name as instructor_name, 
        u.id as instructor_id,
        cc.name as category_name,
        p.price as course_price -- Assuming product price is course price
    `;
    
    const coursesQuery = `${coursesSelect} ${baseQuery} ORDER BY c.created_at DESC LIMIT $1 OFFSET $2;`;
    const countQuery = `SELECT COUNT(c.id) ${baseQuery};`;

    try {
      // Re-adjust queryParams for the main query, ensuring limit and offset are first.
      const finalQueryParams = [limit, offset, ...queryParams.slice(2)];

      const coursesResult = await db.query(coursesQuery, finalQueryParams);
      const countResult = await db.query(countQuery, countQueryParams); // Count query uses only filter params
      
      const totalCourses = parseInt(countResult.rows[0].count, 10);
      const totalPages = Math.ceil(totalCourses / limit);

      return {
        courses: coursesResult.rows,
        pagination: { currentPage: parseInt(page, 10), totalPages, totalCourses, limit: parseInt(limit, 10) }
      };
    } catch (error) {
      console.error('Error fetching published courses:', error);
      throw { statusCode: 500, message: 'Failed to retrieve published courses.' };
    }
  }

  async getPublishedCourseBySlug(slug) {
    const courseQuery = `
      SELECT 
        c.id, c.title, c.slug, c.description, c.level, c.duration_estimate, c.cover_image_url, c.is_published,
        u.first_name || ' ' || u.last_name as instructor_name, 
        u.id as instructor_id,
        cc.name as category_name,
        p.price as course_price, p.id as product_id
      FROM courses c
      JOIN users u ON c.instructor_id = u.id
      LEFT JOIN course_categories cc ON c.category_id = cc.id
      LEFT JOIN products p ON c.product_id = p.id
      WHERE c.slug = $1 AND c.is_published = TRUE;
    `;
    const modulesQuery = `
      SELECT cm.id, cm.title, cm.description, cm.module_order
      FROM course_modules cm
      WHERE cm.course_id = $1
      ORDER BY cm.module_order ASC;
    `;
    // Only include lesson content if is_preview_allowed is true.
    // For non-previewable lessons, basic info is fine.
    const lessonsQuery = `
      SELECT 
        l.id, l.title, l.slug, l.lesson_type, l.duration_minutes, l.lesson_order, l.is_preview_allowed,
        CASE WHEN l.is_preview_allowed THEN l.content_url ELSE NULL END as content_url,
        CASE WHEN l.is_preview_allowed THEN l.text_content ELSE NULL END as text_content
      FROM lessons l
      JOIN course_modules cm ON l.module_id = cm.id
      WHERE cm.course_id = $1
      ORDER BY cm.module_order ASC, l.lesson_order ASC;
    `;

    const client = await db.pool.connect();
    try {
      const courseResult = await client.query(courseQuery, [slug]);
      if (courseResult.rows.length === 0) {
        throw { statusCode: 404, message: 'Published course not found.' };
      }
      const course = courseResult.rows[0];

      const modulesResult = await client.query(modulesQuery, [course.id]);
      const lessonsResult = await client.query(lessonsQuery, [course.id]);
      
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
      console.error('Error fetching published course by slug:', error);
      throw { statusCode: 500, message: 'Failed to retrieve course details.' };
    } finally {
      client.release();
    }
  }
}

module.exports = new CoursePublicService();
