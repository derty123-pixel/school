// server/src/modules/assessments/routes/admin.assessment.routes.js
const express = require('express');
const { body, param } = require('express-validator');
const AdminAssessmentController = require('../controllers/admin.assessment.controller');
const { protect, authorize } = require('../../../middlewares/auth.middleware'); // Assuming auth middlewares

const router = express.Router();

// Middleware to ensure user is authenticated and is an admin/instructor for all routes in this file
// Adjust roles as per your application's authorization scheme (e.g., ['admin', 'instructor'])
router.use(protect); 
// router.use(authorize(['admin', 'instructor'])); // Uncomment and adjust if you have role-based authorization

/**
 * Validation middleware for creating/updating assessments.
 */
const validateAssessment = [
  body('course_id').isUUID().withMessage('Valid Course ID is required.'),
  body('title').trim().notEmpty().withMessage('Title is required.').isLength({ min: 3, max: 255 }).withMessage('Title must be between 3 and 255 characters.'),
  body('description').optional().trim().isLength({ max: 5000 }).withMessage('Description cannot exceed 5000 characters.'),
  body('time_limit_minutes').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Time limit must be a positive integer.'),
  body('passing_score_percentage').optional({ checkFalsy: true }).isDecimal({ decimal_digits: '0,2' }).toFloat().isFloat({ min: 0, max: 100 }).withMessage('Passing score must be a number between 0 and 100.'),
  body('status').optional().isIn(['draft', 'published', 'archived']).withMessage('Invalid status value.'),
  body('settings').optional().isJSON().withMessage('Settings must be a valid JSON object string if provided.') // Or .isObject() if parsing before validation
    // Example for validating specific fields within settings if it's an object:
    // body('settings.shuffle_questions').optional().isBoolean().withMessage('shuffle_questions must be true or false.'),
    // body('settings.max_attempts').optional().isInt({ min: 0 }).withMessage('max_attempts must be a non-negative integer.'),
];

const validateAssessmentId = [
  param('assessmentId').isUUID().withMessage('Valid Assessment ID is required in URL parameter.')
];


// --- Assessment CRUD Routes ---

// POST /api/admin/assessments - Create a new assessment
router.post(
  '/',
  authorize(['admin', 'instructor']), // Example role protection
  validateAssessment, 
  AdminAssessmentController.createAssessment
);

// GET /api/admin/assessments - List all assessments (filters via query params)
router.get(
  '/',
  authorize(['admin', 'instructor']),
  AdminAssessmentController.getAssessments
);

// GET /api/admin/assessments/:assessmentId - Get a specific assessment
router.get(
  '/:assessmentId',
  authorize(['admin', 'instructor']),
  validateAssessmentId,
  AdminAssessmentController.getAssessmentById
);

// PUT /api/admin/assessments/:assessmentId - Update an assessment
router.put(
  '/:assessmentId',
  authorize(['admin', 'instructor']),
  validateAssessmentId, 
  validateAssessment, // Reuse validation rules for updatable fields
  AdminAssessmentController.updateAssessment
);

// DELETE /api/admin/assessments/:assessmentId - Delete an assessment
router.delete(
  '/:assessmentId',
  authorize(['admin', 'instructor']),
  validateAssessmentId,
  AdminAssessmentController.deleteAssessment
);

// --- Nested Question Routes ---
// Import question routes and use them, passing assessmentId via mergeParams
const adminQuestionRoutes = require('./admin.question.routes');
router.use('/:assessmentId/questions', adminQuestionRoutes);

// --- Admin Submission Review & Grading Routes ---

// GET /api/admin/assessments/:assessmentId/submissions - List all student submissions for an assessment
router.get(
  '/:assessmentId/submissions',
  authorize(['admin', 'instructor']),
  param('assessmentId').isUUID().withMessage('Valid Assessment ID is required.'),
  AdminAssessmentController.getSubmissionsForAssessment
);

// GET /api/admin/assessments/submissions/:submissionId - Get detailed view of a single submission
// Note: This route is top-level for submissions for simplicity, but could be nested if preferred.
// If nested, ensure assessmentId context is handled or not strictly required if submissionId is globally unique.
router.get(
  '/submissions/:submissionId', // Changed from /:assessmentId/submissions/:submissionId to avoid ambiguity if needed elsewhere
  authorize(['admin', 'instructor']),
  param('submissionId').isUUID().withMessage('Valid Submission ID is required.'),
  AdminAssessmentController.getDetailedSubmissionView
);

// PUT /api/admin/assessments/submissions/:submissionId/answers/:answerId/grade - Grade a specific answer
router.put(
  '/submissions/:submissionId/answers/:answerId/grade',
  authorize(['admin', 'instructor']),
  param('submissionId').isUUID().withMessage('Valid Submission ID is required.'),
  param('answerId').isUUID().withMessage('Valid Answer ID is required.'),
  body('awarded_points').isDecimal().toFloat().withMessage('Awarded points must be a number.'),
  body('grader_feedback').optional({nullable: true}).isString().trim().isLength({max: 2000}).withMessage('Feedback cannot exceed 2000 characters.'),
  AdminAssessmentController.gradeAnswer
);

// POST /api/admin/assessments/submissions/:submissionId/feedback - Add overall feedback (Stretch Goal)
router.post(
  '/submissions/:submissionId/feedback',
  authorize(['admin', 'instructor']),
  param('submissionId').isUUID().withMessage('Valid Submission ID is required.'),
  body('feedback').notEmpty().withMessage('Feedback text is required.').isString().trim().isLength({max: 5000}).withMessage('Overall feedback cannot exceed 5000 characters.'),
  AdminAssessmentController.addSubmissionFeedback
);

module.exports = router;
