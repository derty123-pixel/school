// server/src/modules/courses/routes/admin.lesson.routes.js
const express = require('express');
const { body, param } = require('express-validator');
const AdminLessonController = require('../controllers/admin.lesson.controller');
const { protect, authorize } = require('../../../middlewares/auth.middleware');

// If this router is to be nested under courses, use { mergeParams: true }
// e.g., /api/admin/courses/:courseId/lessons
// For this example, let's assume it might be mounted directly like /api/admin/lessons
// or the parent router handles courseId if needed.
const router = express.Router({ mergeParams: true }); // Enable mergeParams for potential nesting

// Middleware for all lesson routes: ensure user is authenticated and authorized
router.use(protect);
router.use(authorize(['admin', 'instructor'])); // Adjust roles as needed

/**
 * Validation middleware for lesson ID parameter.
 */
const validateLessonIdParam = [
  param('lessonId').isUUID().withMessage('Valid Lesson ID is required in URL parameter.')
];

/**
 * Validation middleware for updating lesson/video details.
 */
const validateUpdateLessonData = [
  body('title').optional().trim().notEmpty().isLength({ min: 3, max: 255 }),
  body('description').optional({nullable: true}).trim(),
  body('order_in_course').optional().isInt({ min: 0 }).withMessage('Order must be a non-negative integer.'),
  body('content_type')
    .optional()
    .isIn(['text', 'video', 'quiz_link', 'assignment', 'document'])
    .withMessage('Invalid content type.'),

  body('text_content').optional({nullable: true}).isString().trim(),

  // Video specific fields - optional at top level, but conditional based on content_type
  body('video_provider')
    .optional({ checkFalsy: true })
    .isIn(['vimeo', 'youtube', 'mux', 'aws_mediaservices', 'custom_s3', 'other'])
    .withMessage('Invalid video provider.'),
  body('external_video_id').optional({ checkFalsy: true }).isString().trim().isLength({ min: 1, max: 255 }),
  body('video_duration_seconds').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Video duration must be a non-negative integer.'),
  body('video_title_override').optional({nullable: true}).isString().trim().isLength({ max: 255 }),
  body('video_description_override').optional({nullable: true}).isString().trim(),
  body('thumbnail_url').optional({nullable: true}).isURL().withMessage('Invalid thumbnail URL format.'),
  body('is_preview_allowed').optional().isBoolean().withMessage('is_preview_allowed must be true or false.'),

  // Custom validation: if content_type is 'video', provider and external_id are required.
  body().custom((value, { req }) => {
    const { content_type, video_provider, external_video_id } = req.body;
    if (content_type === 'video') {
      if (!video_provider) {
        throw new Error('video_provider is required when content_type is "video".');
      }
      if (!external_video_id) {
        throw new Error('external_video_id is required when content_type is "video".');
      }
    }
    // Custom validation: if content_type is 'text', text_content is required.
    if (content_type === 'text' && (req.body.text_content === undefined || req.body.text_content === null)) {
      // Allow empty string for text_content, but not undefined/null if type is text.
      // This depends on how you want to handle clearing text content.
      // If an empty string is valid, this check might be too strict or need adjustment.
      // For now, let's assume if type is text, text_content should be present (even if empty string).
      // This rule is better handled in the service if empty string is allowed for "clearing".
      // For a PUT request, if 'text_content' is not provided, it means "don't update this field".
      // If 'text_content' is explicitly null, it means "set this field to null".
    }
    return true;
  })
];


// PUT /api/admin/lessons/:lessonId/video-details or just /:lessonId if router mounted on /lessons
// This route updates general lesson details, including video specific fields.
router.put(
  '/:lessonId', // Or '/:lessonId/video-details' if you prefer more specific nesting
  validateLessonIdParam,
  validateUpdateLessonData,
  AdminLessonController.updateLesson
);

// Placeholder for POST /api/admin/courses/:courseId/lessons (Create a new lesson for a course)
// router.post(
//   '/', // Assuming this router is mounted on /courses/:courseId/lessons
//   param('courseId').isUUID().withMessage('Valid Course ID is required.'),
//   validateUpdateLessonData, // Create would have its own specific validation, likely stricter on required fields
//   AdminLessonController.createLessonForCourse
// );


module.exports = router;
