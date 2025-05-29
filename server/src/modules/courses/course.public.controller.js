// server/src/modules/courses/course.public.controller.js
const coursePublicService = require('./course.public.service');
const { validationResult } = require('express-validator');

class CoursePublicController {
  async getPublishedCourses(req, res) {
    const errors = validationResult(req); // For query param validation
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { page = 1, limit = 10, categoryId = null, instructorId = null } = req.query;
    try {
      const result = await coursePublicService.getPublishedCourses({ 
        page: parseInt(page, 10), 
        limit: parseInt(limit, 10),
        categoryId,
        instructorId 
      });
      res.status(200).json(result);
    } catch (error) {
      console.error('Get published courses controller error:', error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to retrieve published courses.' });
    }
  }

  async getPublishedCourseBySlug(req, res) {
    const errors = validationResult(req); // For param validation
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { slug } = req.params;
    try {
      const course = await coursePublicService.getPublishedCourseBySlug(slug);
      res.status(200).json(course);
    } catch (error)
    {
      console.error(`Get published course by slug controller error (Slug: ${slug}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to retrieve course details.' });
    }
  }
}

module.exports = new CoursePublicController();
