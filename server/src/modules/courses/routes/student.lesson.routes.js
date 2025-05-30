// server/src/modules/courses/routes/student.lesson.routes.js
const express = require('express');
const { param } = require('express-validator');
const StudentLessonController = require('../controllers/student.lesson.controller');
const { protect } = require('../../../middlewares/auth.middleware'); // Assuming auth middleware

// If this router is to be nested under courses, use { mergeParams: true }
// e.g., /api/courses/:courseId/lessons/:lessonId/video-playback
// For this example, we'll make it a top-level student route for lessons for simplicity,
// assuming lessonId is globally unique and authorization is handled in service.
// A more RESTful approach would be to nest it under a course-specific student route.
const router = express.Router({ mergeParams: true }); // mergeParams for potential future nesting under /courses/:courseId/

// Middleware for all student lesson routes: ensure user is authenticated
router.use(protect);

/**
 * Validation middleware for lesson ID parameter.
 */
const validateLessonIdParam = [
  param('lessonId').isUUID().withMessage('Valid Lesson ID is required in URL parameter.')
];


// GET /api/student/lessons/:lessonId/video-playback - Get secure video playback details
router.get(
  '/:lessonId/video-playback', // Route will be like /api/student/lessons/:lessonId/video-playback
  validateLessonIdParam,
  StudentLessonController.getLessonPlaybackInfo
);

// Placeholder for other student lesson routes
// GET /:lessonId - Get lesson text content, etc.
// POST /:lessonId/complete - Mark lesson as complete

module.exports = router;
