// server/src/modules/courses/module.admin.service.js
const db = require('../../config/database');
const courseAdminService = require('./course.admin.service'); // For ownership checks

class ModuleAdminService {
  // Helper to check course ownership for non-admins
  async _ensureCourseOwnership(courseId, user) {
    if (user.roles && !user.roles.includes('admin')) {
      const course = await db.query('SELECT instructor_id FROM courses WHERE id = $1', [courseId]);
      if (course.rows.length === 0) {
        throw { statusCode: 404, message: 'Course not found.' };
      }
      if (course.rows[0].instructor_id !== user.id) {
        throw { statusCode: 403, message: 'You are not authorized to manage modules for this course.' };
      }
    }
    // Admin passes, or instructor owns the course
    // Also check if course exists, even for admin
     const courseExists = await db.query('SELECT id FROM courses WHERE id = $1', [courseId]);
     if (courseExists.rows.length === 0) {
        throw { statusCode: 404, message: `Course with ID ${courseId} not found.` };
     }
  }

  async createModule(courseId, user, { title, description, module_order }) {
    await this._ensureCourseOwnership(courseId, user);

    // If module_order is not provided, calculate the next order value
    let orderToUse = module_order;
    if (orderToUse === undefined || orderToUse === null) {
        const lastModuleResult = await db.query(
            'SELECT MAX(module_order) as max_order FROM course_modules WHERE course_id = $1',
            [courseId]
        );
        orderToUse = (lastModuleResult.rows[0]?.max_order || 0) + 1;
    }

    const query = `
      INSERT INTO course_modules (course_id, title, description, module_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [courseId, title, description, orderToUse];
    try {
      const { rows } = await db.query(query, values);
      return rows[0];
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'uq_course_module_order') {
        throw { statusCode: 409, message: `A module with order ${orderToUse} already exists for this course. Please specify a unique order.` };
      }
      console.error('Error creating module:', error);
      throw { statusCode: 500, message: 'Failed to create module.' };
    }
  }

  async getModulesForCourse(courseId, user) {
    await this._ensureCourseOwnership(courseId, user);
    const query = 'SELECT * FROM course_modules WHERE course_id = $1 ORDER BY module_order ASC;';
    try {
      const { rows } = await db.query(query, [courseId]);
      return rows;
    } catch (error) {
      console.error('Error fetching modules for course:', error);
      throw { statusCode: 500, message: 'Failed to retrieve modules.' };
    }
  }

  async getModuleById(courseId, moduleId, user) {
    await this._ensureCourseOwnership(courseId, user); // Ensures user can access parent course
    const query = 'SELECT * FROM course_modules WHERE id = $1 AND course_id = $2;';
    try {
      const { rows } = await db.query(query, [moduleId, courseId]);
      if (rows.length === 0) {
        throw { statusCode: 404, message: 'Module not found or does not belong to this course.' };
      }
      return rows[0];
    } catch (error) {
      if (error.statusCode === 404) throw error;
      console.error('Error fetching module by ID:', error);
      throw { statusCode: 500, message: 'Failed to retrieve module.' };
    }
  }

  async updateModule(courseId, moduleId, user, updateData) {
    await this._ensureCourseOwnership(courseId, user);
    
    const { title, description, module_order } = updateData;
    const setClauses = [];
    const values = [moduleId, courseId]; // $1 = moduleId, $2 = courseId for WHERE
    let paramCount = 3;

    if (title !== undefined) { setClauses.push(`title = $${paramCount++}`); values.push(title); }
    if (description !== undefined) { setClauses.push(`description = $${paramCount++}`); values.push(description); }
    if (module_order !== undefined) { setClauses.push(`module_order = $${paramCount++}`); values.push(module_order); }

    if (setClauses.length === 0) {
      // Fetch and return current module if no update data provided
      return this.getModuleById(courseId, moduleId, user);
    }
    setClauses.push('updated_at = CURRENT_TIMESTAMP');

    const updateQuery = `
      UPDATE course_modules 
      SET ${setClauses.join(', ')} 
      WHERE id = $1 AND course_id = $2
      RETURNING *;
    `;
    
    try {
      const { rows } = await db.query(updateQuery, values);
      if (rows.length === 0) {
        throw { statusCode: 404, message: 'Module not found or does not belong to this course for update.' };
      }
      return rows[0];
    } catch (error) {
      if (error.statusCode) throw error;
      if (error.code === '23505' && error.constraint === 'uq_course_module_order') {
        throw { statusCode: 409, message: `A module with order ${module_order} already exists for this course.` };
      }
      console.error('Error updating module:', error);
      throw { statusCode: 500, message: 'Failed to update module.' };
    }
  }

  async deleteModule(courseId, moduleId, user) {
    await this._ensureCourseOwnership(courseId, user);
    // ON DELETE CASCADE in schema handles lessons within this module.
    const query = 'DELETE FROM course_modules WHERE id = $1 AND course_id = $2 RETURNING id;';
    try {
      const { rows } = await db.query(query, [moduleId, courseId]);
      if (rows.length === 0) {
        throw { statusCode: 404, message: 'Module not found or does not belong to this course.' };
      }
      return { message: 'Module deleted successfully.' };
    } catch (error) {
      if (error.statusCode) throw error;
      console.error('Error deleting module:', error);
      throw { statusCode: 500, message: 'Failed to delete module.' };
    }
  }
}

module.exports = new ModuleAdminService();
