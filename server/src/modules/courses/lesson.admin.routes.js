// server/src/modules/courses/lesson.admin.routes.js
const express = require('express');
const { body, param } = require('express-validator');
const lessonAdminController = require('./lesson.admin.controller');
const { protect, authorize } = require('../../middlewares/auth.middleware');
const { lesson_type_enum_values } = require('../../utils/enumUtils'); // Assuming you create this util

// Helper to get enum values if not directly imported or hardcoded
// const lessonTypes = ['video', 'text', 'quiz', 'document']; // From lesson_type_enum

const router = express.Router({ mergeParams: true }); // mergeParams to access :courseId and :moduleId

const allowedRoles = ['admin', 'instructor'];

// Validation for lesson_type
const isValidLessonType = (value) => {
    // In a real app, fetch these from DB or a shared constant based on the ENUM
    const validTypes = ['video', 'text', 'quiz', 'document']; 
    if (!validTypes.includes(value)) {
        throw new Error(`Invalid lesson type. Must be one of: ${validTypes.join(', ')}`);
    }
    return true;
};


// @route   POST /api/admin/courses/:courseId/modules/:moduleId/lessons
// @desc    Create a new lesson for a module
// @access  Private (Admin, Instructor - owns course)
router.post(
  '/',
  protect,
  authorize(allowedRoles),
  [
    param('courseId', 'Course ID must be a valid UUID').isUUID(),
    param('moduleId', 'Module ID must be a valid UUID').isUUID(),
    body('title', 'Lesson title is required').notEmpty().trim(),
    body('lesson_type', 'Lesson type is required').notEmpty().custom(isValidLessonType),
    body('content_url', 'Content URL must be a valid URL if provided for video/document types')
        .optional({ checkFalsy: true })
        .isURL()
        .custom((value, { req }) => {
            if ((req.body.lesson_type === 'video' || req.body.lesson_type === 'document') && !value) {
                // throw new Error('Content URL is required for video or document lessons.');
                // Making it optional for now, service might handle defaults or further validation
            }
            return true;
        }),
    body('text_content', 'Text content must be a string if provided for text type')
        .optional({ checkFalsy: true })
        .isString()
        .custom((value, { req }) => {
            if (req.body.lesson_type === 'text' && (value === undefined || value === null || value.trim() === '') ) {
                 // throw new Error('Text content is required for text lessons.');
                 // Making it optional for now
            }
            return true;
        }),
    body('duration_minutes', 'Duration must be a non-negative integer if provided').optional({ checkFalsy: true }).isInt({ gt: -1 }).toInt(),
    body('lesson_order', 'Lesson order must be an integer if provided').optional({checkFalsy: false}).isInt().toInt(),
    body('is_preview_allowed', 'Is preview allowed must be a boolean').optional().isBoolean(),
  ],
  lessonAdminController.createLesson
);

// @route   GET /api/admin/courses/:courseId/modules/:moduleId/lessons
// @desc    List all lessons for a specific module
// @access  Private (Admin, Instructor - owns course)
router.get(
  '/',
  protect,
  authorize(allowedRoles),
  [
    param('courseId', 'Course ID must be a valid UUID').isUUID(),
    param('moduleId', 'Module ID must be a valid UUID').isUUID(),
  ],
  lessonAdminController.getLessonsForModule
);

// @route   GET /api/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId
// @desc    Get details of a specific lesson
// @access  Private (Admin, Instructor - owns course)
router.get(
  '/:lessonId',
  protect,
  authorize(allowedRoles),
  [
    param('courseId', 'Course ID must be a valid UUID').isUUID(),
    param('moduleId', 'Module ID must be a valid UUID').isUUID(),
    param('lessonId', 'Lesson ID must be a valid UUID').isUUID(),
  ],
  lessonAdminController.getLessonById
);

// @route   PUT /api/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId
// @desc    Update a lesson
// @access  Private (Admin, Instructor - owns course)
router.put(
  '/:lessonId',
  protect,
  authorize(allowedRoles),
  [
    param('courseId', 'Course ID must be a valid UUID').isUUID(),
    param('moduleId', 'Module ID must be a valid UUID').isUUID(),
    param('lessonId', 'Lesson ID must be a valid UUID').isUUID(),
    body('title', 'Lesson title must be a non-empty string if provided').optional().notEmpty().trim(),
    body('lesson_type', 'Invalid lesson type').optional().custom(isValidLessonType),
    body('content_url', 'Content URL must be a valid URL or empty').optional({ checkFalsy: true }).isURL().bail().custom((value) => value === '' || typeof value === 'string'),
    body('text_content', 'Text content must be a string or empty').optional({ checkFalsy: true }).isString(),
    body('duration_minutes', 'Duration must be a non-negative integer if provided').optional({ checkFalsy: true }).isInt({ gt: -1 }).toInt(),
    body('lesson_order', 'Lesson order must be an integer if provided').optional().isInt().toInt(),
    body('is_preview_allowed', 'Is preview allowed must be a boolean if provided').optional().isBoolean(),
  ],
  lessonAdminController.updateLesson
);

// @route   DELETE /api/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId
// @desc    Delete a lesson
// @access  Private (Admin, Instructor - owns course)
router.delete(
  '/:lessonId',
  protect,
  authorize(allowedRoles),
  [
    param('courseId', 'Course ID must be a valid UUID').isUUID(),
    param('moduleId', 'Module ID must be a valid UUID').isUUID(),
    param('lessonId', 'Lesson ID must be a valid UUID').isUUID(),
  ],
  lessonAdminController.deleteLesson
);

module.exports = router;
