// server/src/modules/assessments/routes/admin.question.routes.js
const express = require('express');
const { body, param } = require('express-validator');
const AdminQuestionController = require('../controllers/admin.question.controller');
const { protect, authorize } = require('../../../middlewares/auth.middleware'); // Assuming auth middlewares

// Create a new router instance.
// Important: Set mergeParams: true to access :assessmentId from the parent router
const router = express.Router({ mergeParams: true }); 

// Middleware for all question routes: ensure user is authenticated and authorized
// This can be more specific if needed (e.g. different roles for different actions)
router.use(protect);
router.use(authorize(['admin', 'instructor'])); // Example roles

/**
 * Validation middleware for question ID parameter.
 */
const validateQuestionId = [
  param('questionId').isUUID().withMessage('Valid Question ID is required in URL parameter.')
];

/**
 * Validation middleware for assessment ID parameter (already validated by parent router usually, but good for direct use).
 */
const validateAssessmentIdParam = [
    param('assessmentId').isUUID().withMessage('Valid Assessment ID is required in URL parameter.')
];


/**
 * Validation middleware for creating/updating questions.
 */
const validateQuestionData = [
  body('question_text').trim().notEmpty().withMessage('Question text is required.'),
  body('question_type').isIn(['multiple-choice-single', 'multiple-choice-multiple', 'true-false', 'short-answer', 'essay']).withMessage('Invalid question type.'),
  body('points').optional().isDecimal({ decimal_digits: '0,2' }).toFloat().isFloat({ min: 0 }).withMessage('Points must be a non-negative number.'),
  body('order_in_assessment').optional().isInt({ min: 0 }).withMessage('Order must be a non-negative integer.'),
  body('feedback_general').optional({nullable: true}).isString().trim(),
  body('feedback_correct').optional({nullable: true}).isString().trim(),
  body('feedback_incorrect').optional({nullable: true}).isString().trim(),
  // Validation for options array (if provided)
  body('options').optional().isArray().withMessage('Options must be an array.'),
  body('options.*.option_text').if(body('options').exists()).notEmpty().withMessage('Option text is required.'),
  body('options.*.is_correct').if(body('options').exists()).isBoolean().withMessage('is_correct must be true or false.'),
  body('options.*.order_in_question').optional().isInt({ min: 0 }).withMessage('Option order must be a non-negative integer.'),
  body('options.*.feedback').optional({nullable: true}).isString().trim(),
];


// --- Question CRUD Routes (nested under /api/admin/assessments/:assessmentId/questions) ---

// POST / - Add a new question to an assessment
router.post(
  '/',
  validateAssessmentIdParam, // Ensure assessmentId from param is valid
  validateQuestionData,
  AdminQuestionController.addQuestion
);

// GET / - List all questions for a specific assessment
router.get(
  '/',
  validateAssessmentIdParam,
  AdminQuestionController.getQuestionsForAssessment
);

// GET /:questionId - Get a specific question
router.get(
  '/:questionId',
  validateAssessmentIdParam, // Though assessmentId might not be strictly needed by service if questionId is global UUID
  validateQuestionId,
  AdminQuestionController.getQuestionById
);

// PUT /:questionId - Update a question
router.put(
  '/:questionId',
  validateAssessmentIdParam, // For context and permission checks
  validateQuestionId,
  validateQuestionData, // Reuse validation rules for updatable fields
  AdminQuestionController.updateQuestion
);

// DELETE /:questionId - Delete a question
router.delete(
  '/:questionId',
  validateAssessmentIdParam, // For context and permission checks
  validateQuestionId,
  AdminQuestionController.deleteQuestion
);

module.exports = router;
