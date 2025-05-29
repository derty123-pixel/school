// server/src/modules/courses/course.admin.controller.js
const courseAdminService = require('./course.admin.service');
const { validationResult } = require('express-validator');

class CourseAdminController {
  async createCourse(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
        title, description, category_id, product_id, 
        level, duration_estimate, cover_image_url, is_published 
    } = req.body;
    
    // instructor_id: if admin is creating, they might specify it.
    // If an instructor is creating, it should be their own ID.
    let instructor_id = req.body.instructor_id;
    if (req.user.roles.includes('instructor') && !req.user.roles.includes('admin')) {
        instructor_id = req.user.id; // Force instructor to be themselves
    } else if (!instructor_id && req.user.roles.includes('admin')) {
        // Admin can create a course and assign to themselves if no instructor_id given
        instructor_id = req.user.id; 
    } else if (!instructor_id) {
         return res.status(400).json({ message: 'Instructor ID is required if not creating for oneself as admin/instructor.' });
    }


    try {
      const course = await courseAdminService.createCourse({
        title, description, instructor_id, category_id, product_id,
        level, duration_estimate, cover_image_url, is_published
      });
      res.status(201).json({ message: 'Course created successfully.', course });
    } catch (error) {
      console.error('Create course controller error:', error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to create course.' });
    }
  }

  async getAllCourses(req, res) {
    // req.user is populated by 'protect' middleware
    const { page = 1, limit = 10 } = req.query;
    try {
      const result = await courseAdminService.getAllCoursesForAdmin(req.user, { 
          page: parseInt(page, 10), 
          limit: parseInt(limit, 10) 
      });
      res.status(200).json(result);
    } catch (error) {
      console.error('Get all courses admin controller error:', error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to retrieve courses.' });
    }
  }

  async getCourseDetails(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { courseId } = req.params;
    try {
      const course = await courseAdminService.getCourseDetailsForAdmin(courseId, req.user);
      res.status(200).json(course);
    } catch (error) {
      console.error(`Get course details admin controller error (ID: ${courseId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to retrieve course details.' });
    }
  }

  async updateCourse(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { courseId } = req.params;
    const updateData = req.body;

    try {
      const updatedCourse = await courseAdminService.updateCourse(courseId, req.user, updateData);
      res.status(200).json({ message: 'Course updated successfully.', course: updatedCourse });
    } catch (error) {
      console.error(`Update course admin controller error (ID: ${courseId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to update course.' });
    }
  }

  async deleteCourse(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { courseId } = req.params;
    try {
      const result = await courseAdminService.deleteCourse(courseId, req.user);
      res.status(200).json(result);
    } catch (error) {
      console.error(`Delete course admin controller error (ID: ${courseId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to delete course.' });
    }
  }
}

module.exports = new CourseAdminController();
