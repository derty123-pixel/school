// server/src/modules/courses/course.public.routes.js
const express = require('express');
const { param, query } = require('express-validator');
const coursePublicController = require('./course.public.controller');

const router = express.Router();

// @route   GET /api/courses/published
// @desc    List all published courses with pagination and filtering
// @access  Public
router.get(
  '/published',
  [
    query('page', 'Page must be a positive integer').optional().isInt({ gt: 0 }).toInt(),
    query('limit', 'Limit must be a positive integer').optional().isInt({ gt: 0 }).toInt(),
    query('categoryId', 'Category ID must be a valid UUID if provided').optional().isUUID(),
    query('instructorId', 'Instructor ID must be a valid UUID if provided').optional().isUUID(),
  ],
  coursePublicController.getPublishedCourses
);

// @route   GET /api/courses/published/:slug
// @desc    Get details of a single published course by its slug, including modules and previewable lessons
// @access  Public
router.get(
  '/published/:slug',
  [
    param('slug', 'Course slug must be a non-empty string').notEmpty().isString().trim().escape(),
    // Add more specific slug validation if needed (e.g., regex for format)
  ],
  coursePublicController.getPublishedCourseBySlug
);

module.exports = router;
