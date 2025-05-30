// server/src/modules/courses/controllers/course.public.controller.js
const CoursePublicService = require('../services/course.public.service');
const logger = require('../../../config/logger');
const { validationResult } = require('express-validator'); // For optional validation

const CoursePublicController = {
  /**
   * List and filter public courses.
   * Handles query parameters for search, filter, sort, and pagination.
   */
  async listPublicCourses(req, res, next) {
    const errors = validationResult(req); // Check for validation errors if any are defined in routes
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        searchTerm,
        categoryId,
        minPrice,
        maxPrice,
        sortBy,
        page,
        limit,
      } = req.query;

      // Prepare options for the service, parsing and providing defaults
      const options = {
        searchTerm: searchTerm ? String(searchTerm) : undefined,
        categoryId: categoryId ? String(categoryId) : undefined, // Assuming categoryId is UUID string
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        sortBy: sortBy ? String(sortBy) : 'created_at_desc', // Default sort
        page: page ? parseInt(page, 10) : 1, // Default page 1
        limit: limit ? parseInt(limit, 10) : 10, // Default limit 10
      };

      // Basic validation for page and limit to ensure they are positive integers
      if (options.page <= 0) options.page = 1;
      if (options.limit <= 0) options.limit = 10;
      // Max limit can also be enforced if desired
      if (options.limit > 100) options.limit = 100;


      const result = await CoursePublicService.searchAndFilterPublicCourses(options);

      res.status(200).json(result);
    } catch (error) {
      logger.error('Error in listPublicCourses controller:', { stack: error.stack, query: req.query });
      next(error); // Pass to global error handler
    }
  },

  /**
   * Get a single public course by its ID or slug.
   * (Assuming this might exist or be added later - for now, focus is on listPublicCourses)
   */
  async getPublicCourseBySlugOrId(req, res, next) {
    // This is a placeholder for a typical "get course details" endpoint.
    // The main task is about the listing/searching endpoint.
    // If CoursePublicService has a method like findBySlugOrIdPublished, it would be called here.
    try {
      const { identifier } = req.params; // Could be ID or slug
      // const course = await CoursePublicService.findBySlugOrIdPublished(identifier);
      // if (!course) {
      //   return res.status(404).json({ message: 'Course not found or not published.' });
      // }
      // res.status(200).json(course);
      res.status(501).json({ message: 'Get single course details not implemented in this step.'});
    } catch (error) {
        logger.error(`Error in getPublicCourseBySlugOrId controller (identifier: ${req.params.identifier}):`, { stack: error.stack });
        next(error);
    }
  }
  // Other public course-related controller methods (e.g., listCategories) could go here.
};

module.exports = CoursePublicController;
