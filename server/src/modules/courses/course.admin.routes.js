// server/src/modules/courses/course.admin.routes.js
const express = require('express');
const { body, param, query } = require('express-validator');
const courseAdminController = require('./course.admin.controller');
const { protect, authorize } = require('../../middlewares/auth.middleware'); // Ensure authorize middleware is correctly imported

const router = express.Router();

const allowedRoles = ['admin', 'instructor']; // Roles allowed to access course admin functionalities

// @route   POST /api/admin/courses
// @desc    Create a new course
// @access  Private (Admin, Instructor)
router.post(
  '/',
  protect,
  authorize(allowedRoles),
  [
    body('title', 'Course title is required').notEmpty().trim(),
    body('description', 'Description should be text').optional().isString().trim(),
    body('instructor_id', 'Instructor ID must be a UUID if provided by admin').optional().isUUID(), // Admin can specify, instructor defaults to self
    body('category_id', 'Category ID must be a UUID').optional({ checkFalsy: true }).isUUID(), // Optional, can be null
    body('product_id', 'Product ID must be a UUID if provided').optional({ checkFalsy: true }).isUUID(), // Optional
    body('level', 'Level should be text').optional().isString().trim(),
    body('duration_estimate', 'Duration estimate should be text').optional().isString().trim(),
    body('cover_image_url', 'Cover image URL should be a valid URL').optional({ checkFalsy: true }).isURL(),
    body('is_published', 'is_published must be a boolean').optional().isBoolean(),
  ],
  courseAdminController.createCourse
);

// @route   GET /api/admin/courses
// @desc    List all courses (admin) or instructor's courses
// @access  Private (Admin, Instructor)
router.get(
  '/',
  protect,
  authorize(allowedRoles),
  [
    query('page', 'Page must be a positive integer').optional().isInt({ gt: 0 }).toInt(),
    query('limit', 'Limit must be a positive integer').optional().isInt({ gt: 0 }).toInt(),
  ],
  courseAdminController.getAllCourses
);

// @route   GET /api/admin/courses/:courseId
// @desc    Get full details of a specific course (admin view)
// @access  Private (Admin, Instructor - owns course)
router.get(
  '/:courseId',
  protect,
  authorize(allowedRoles),
  [param('courseId', 'Course ID must be a valid UUID').isUUID()],
  courseAdminController.getCourseDetails
);

// @route   PUT /api/admin/courses/:courseId
// @desc    Update a course
// @access  Private (Admin, Instructor - owns course)
router.put(
  '/:courseId',
  protect,
  authorize(allowedRoles),
  [
    param('courseId', 'Course ID must be a valid UUID').isUUID(),
    body('title', 'Course title must be a non-empty string if provided').optional().notEmpty().trim(),
    body('description', 'Description must be text if provided').optional({ checkFalsy: true }).isString().trim(), // allow empty string for clearing
    body('instructor_id', 'Instructor ID must be a UUID if provided by admin').optional().isUUID(),
    body('category_id', 'Category ID must be a UUID or null').optional({ checkFalsy: true }).isUUID().bail().custom((value) => value === null || typeof value === 'string'),
    body('product_id', 'Product ID must be a UUID or null').optional({ checkFalsy: true }).isUUID().bail().custom((value) => value === null || typeof value === 'string'),
    body('level', 'Level must be text if provided').optional({ checkFalsy: true }).isString().trim(),
    body('duration_estimate', 'Duration estimate must be text if provided').optional({ checkFalsy: true }).isString().trim(),
    body('cover_image_url', 'Cover image URL must be a valid URL or empty').optional({ checkFalsy: true }).isURL().bail().custom((value) => value === '' || typeof value === 'string'),
    body('is_published', 'is_published must be a boolean if provided').optional().isBoolean(),
  ],
  courseAdminController.updateCourse
);

// @route   DELETE /api/admin/courses/:courseId
// @desc    Delete a course
// @access  Private (Admin, Instructor - owns course)
router.delete(
  '/:courseId',
  protect,
  authorize(allowedRoles), // Further ownership check is in service layer
  [param('courseId', 'Course ID must be a valid UUID').isUUID()],
  courseAdminController.deleteCourse
);

// --- Nested Module Routes ---
// Import module routes and use them, ensuring courseId is passed correctly
const moduleAdminRoutes = require('./module.admin.routes');
router.use('/:courseId/modules', moduleAdminRoutes);


module.exports = router;
