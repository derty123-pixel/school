// server/src/modules/progress/routes/student.progress.routes.js
const express = require('express');
const { body, param } = require('express-validator');
const StudentProgressController = require('../controllers/student.progress.controller');
const { protect } = require('../../../middlewares/auth.middleware'); // Assuming auth middleware

const router = express.Router();

// All routes in this file require an authenticated user
router.use(protect);

/**
 * Validation middleware for lesson ID parameter.
 */
const validateLessonIdParam = [
  param('lessonId').isUUID().withMessage('Valid Lesson ID is required in URL parameter.')
];

/**
 * Validation middleware for updating lesson progress.
 */
const validateUpdateProgressData = [
  body('status').optional().isIn(['not_started', 'in_progress', 'completed'])
    .withMessage("Invalid status. Must be one of: 'not_started', 'in_progress', 'completed'."),
  body('video_progress_seconds').optional({ checkFalsy: true, nullable: true }).isInt({ min: 0 })
    .withMessage('video_progress_seconds must be a non-negative integer.'),
  // Custom validation to ensure at least one field is present
  body().custom((value, { req }) => {
    if (req.body.status === undefined && req.body.video_progress_seconds === undefined) {
      throw new Error('At least one of status or video_progress_seconds must be provided to update progress.');
    }
    return true;
  })
];


// POST /api/student/progress/lessons/:lessonId/status - Update progress for a lesson
router.post(
  '/lessons/:lessonId/status',
  validateLessonIdParam,
  validateUpdateProgressData,
  StudentProgressController.updateLessonProgressStatus
);

// GET /api/student/progress/lessons/:lessonId/status - Get progress for a lesson
router.get(
  '/lessons/:lessonId/status',
  validateLessonIdParam,
  StudentProgressController.getLessonProgressStatus
);

// Future routes for course progress could be added here:
// GET /courses/:courseId - Get overall progress for a course
// GET /courses - List all courses with summary progress

module.exports = router;
