// server/src/modules/courses/module.admin.routes.js
const express = require('express');
const { body, param } = require('express-validator');
const moduleAdminController = require('./module.admin.controller');
const { protect, authorize } = require('../../middlewares/auth.middleware');

// This router will be mounted under /api/admin/courses/:courseId/modules
// So, :courseId is available in req.params for all routes here.
const router = express.Router({ mergeParams: true }); // Ensure mergeParams is true to access :courseId

const allowedRoles = ['admin', 'instructor'];

// @route   POST /api/admin/courses/:courseId/modules
// @desc    Create a new module for a course
// @access  Private (Admin, Instructor - owns course)
router.post(
  '/',
  protect,
  authorize(allowedRoles),
  [
    param('courseId', 'Course ID must be a valid UUID').isUUID(),
    body('title', 'Module title is required').notEmpty().trim(),
    body('description', 'Description should be text').optional().isString().trim(),
    body('module_order', 'Module order must be an integer if provided').optional({checkFalsy: false}).isInt().toInt(), // Allow 0, but service handles if null/undefined
  ],
  moduleAdminController.createModule
);

// @route   GET /api/admin/courses/:courseId/modules
// @desc    List all modules for a specific course
// @access  Private (Admin, Instructor - owns course)
router.get(
  '/',
  protect,
  authorize(allowedRoles),
  [param('courseId', 'Course ID must be a valid UUID').isUUID()],
  moduleAdminController.getModulesForCourse
);

// @route   GET /api/admin/courses/:courseId/modules/:moduleId
// @desc    Get details of a specific module
// @access  Private (Admin, Instructor - owns course)
router.get(
  '/:moduleId',
  protect,
  authorize(allowedRoles),
  [
    param('courseId', 'Course ID must be a valid UUID').isUUID(),
    param('moduleId', 'Module ID must be a valid UUID').isUUID(),
  ],
  moduleAdminController.getModuleById
);

// @route   PUT /api/admin/courses/:courseId/modules/:moduleId
// @desc    Update a module
// @access  Private (Admin, Instructor - owns course)
router.put(
  '/:moduleId',
  protect,
  authorize(allowedRoles),
  [
    param('courseId', 'Course ID must be a valid UUID').isUUID(),
    param('moduleId', 'Module ID must be a valid UUID').isUUID(),
    body('title', 'Module title must be a non-empty string if provided').optional().notEmpty().trim(),
    body('description', 'Description must be text if provided').optional({ checkFalsy: true }).isString().trim(),
    body('module_order', 'Module order must be an integer if provided').optional().isInt().toInt(),
  ],
  moduleAdminController.updateModule
);

// @route   DELETE /api/admin/courses/:courseId/modules/:moduleId
// @desc    Delete a module
// @access  Private (Admin, Instructor - owns course)
router.delete(
  '/:moduleId',
  protect,
  authorize(allowedRoles),
  [
    param('courseId', 'Course ID must be a valid UUID').isUUID(),
    param('moduleId', 'Module ID must be a valid UUID').isUUID(),
  ],
  moduleAdminController.deleteModule
);

// --- Nested Lesson Routes ---
// Import lesson routes and use them, ensuring courseId and moduleId are passed
const lessonAdminRoutes = require('./lesson.admin.routes');
router.use('/:moduleId/lessons', lessonAdminRoutes);


module.exports = router;
