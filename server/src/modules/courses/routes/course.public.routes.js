// server/src/modules/courses/routes/course.public.routes.js
const express = require('express');
const { query } = require('express-validator');
const CoursePublicController = require('../controllers/course.public.controller');

const router = express.Router();

// Validation rules for query parameters (optional, but good practice)
const listPublicCoursesValidationRules = [
  query('searchTerm').optional().isString().trim().escape(),
  query('categoryId').optional().isUUID().withMessage('Category ID must be a valid UUID.'),
  query('minPrice').optional().isFloat({ min: 0 }).toFloat().withMessage('Minimum price must be a non-negative number.'),
  query('maxPrice').optional().isFloat({ min: 0 }).toFloat().withMessage('Maximum price must be a non-negative number.')
    .custom((value, { req }) => {
      if (req.query.minPrice && parseFloat(value) < parseFloat(req.query.minPrice)) {
        throw new Error('Maximum price cannot be less than minimum price.');
      }
      return true;
    }),
  query('sortBy').optional().isString().isIn([
    'relevance', 'price_asc', 'price_desc', 'title_asc', 'title_desc', 'created_at_desc'
  ]).withMessage('Invalid sortBy value.'),
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be an integer between 1 and 100.'),
];

// GET /api/courses (or wherever this router is mounted, e.g. /api/catalog/courses)
// This endpoint will handle listing, searching, filtering, sorting, and pagination of public courses.
router.get(
  '/', // Assuming this router is mounted at something like /api/courses
  listPublicCoursesValidationRules,
  CoursePublicController.listPublicCourses
);

// GET /api/courses/:identifier (for specific course by ID or slug)
// This is a placeholder route matching the controller, not the primary focus of this task.
// router.get(
//   '/:identifier',
//   param('identifier').isString().notEmpty().withMessage('Course identifier (ID or slug) is required.'),
//   CoursePublicController.getPublicCourseBySlugOrId
// );


module.exports = router;
