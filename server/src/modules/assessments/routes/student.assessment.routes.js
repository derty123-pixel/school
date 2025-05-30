// server/src/modules/assessments/routes/student.assessment.routes.js
const express = require('express');
const { param } = require('express-validator');
const StudentAssessmentController = require('../controllers/student.assessment.controller');
const { protect } = require('../../../middlewares/auth.middleware'); // Assuming a general 'protect' middleware for authenticated users

const router = express.Router();

// All routes in this file require an authenticated user
router.use(protect);

/**
 * Validation middleware for assessment ID parameter.
 */
const validateAssessmentIdParam = [
  param('assessmentId').isUUID().withMessage('Valid Assessment ID is required in URL parameter.')
];

/**
 * Validation middleware for submission ID parameter.
 */
const validateSubmissionIdParam = [
  param('submissionId').isUUID().withMessage('Valid Submission ID is required in URL parameter.')
];


// --- Student Assessment Routes ---

// GET /api/student/assessments/:assessmentId/details - View details of a specific assessment
router.get(
  '/:assessmentId/details',
  validateAssessmentIdParam,
  StudentAssessmentController.getAssessmentDetails
);

// POST /api/student/assessments/:assessmentId/start - Start an assessment attempt
router.post(
  '/:assessmentId/start',
  validateAssessmentIdParam,
  StudentAssessmentController.startAssessment
);

// GET /api/student/assessments/submissions/:submissionId/questions - Get questions for an active submission
router.get(
  '/submissions/:submissionId/questions',
  // Note: Path changed slightly to avoid conflict if we had /:assessmentId/submissions/:submissionId later
  // This makes submissionId the primary resource identifier here.
  validateSubmissionIdParam,
  StudentAssessmentController.getSubmissionQuestions
);

// POST /api/student/assessments/submissions/:submissionId/answers - Submit answers for an assessment attempt
router.post(
  '/submissions/:submissionId/answers',
  validateSubmissionIdParam,
  // Validation for the 'answers' array in the body
  body('answers').isArray({ min: 1 }).withMessage('Answers array must not be empty.'),
  body('answers.*.questionId').isUUID().withMessage('Each answer must have a valid questionId.'),
  body('answers.*.chosenOptionId').optional({ checkFalsy: true }).isUUID().withMessage('chosenOptionId must be a valid UUID if provided.'),
  body('answers.*.answerText').optional({ checkFalsy: true }).isString().trim().isLength({ max: 10000 }).withMessage('Answer text cannot exceed 10000 characters.'),
  StudentAssessmentController.submitAnswers
);

// POST /api/student/assessments/submissions/:submissionId/complete - Finalize and complete an assessment attempt
router.post(
  '/submissions/:submissionId/complete',
  validateSubmissionIdParam,
  StudentAssessmentController.completeAssessmentAttempt
);

// GET /api/student/assessments/submissions - List all of authenticated student's submissions
// Supports query params like ?courseId=uuid or ?assessmentId=uuid
router.get(
  '/submissions', // Changed from just '/' to avoid conflict if this router was mounted at '/submissions' directly
  StudentAssessmentController.listMySubmissions
);

// GET /api/student/assessments/submissions/:submissionId/results - View detailed results for a specific submission
router.get(
  '/submissions/:submissionId/results',
  validateSubmissionIdParam, // Already defined: param('submissionId').isUUID()
  StudentAssessmentController.getSubmissionResults
);

module.exports = router;
