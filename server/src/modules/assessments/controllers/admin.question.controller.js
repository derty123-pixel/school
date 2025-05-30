// server/src/modules/assessments/controllers/admin.question.controller.js
const QuestionService = require('../services/question.service');
const AssessmentService = require('../services/assessment.service'); // To check if assessment exists
const logger = require('../../../config/logger');
const { validationResult } = require('express-validator');

const AdminQuestionController = {
  /**
   * Add a new question to an assessment.
   */
  async addQuestion(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { assessmentId } = req.params;
      const questionData = req.body; // { question_text, question_type, points, options: [...] }

      // Optional: Check if assessment exists and user has permission (if not handled by a preceding middleware)
      const assessment = await AssessmentService.findById(assessmentId);
      if (!assessment) {
        return res.status(404).json({ message: 'Assessment not found.' });
      }
      // TODO: Add permission check: Does req.user.id have rights to modify this assessment?

      const newQuestion = await QuestionService.addQuestionToAssessment(assessmentId, questionData);
      res.status(201).json(newQuestion);
    } catch (error) {
      logger.error(`Admin addQuestion error (assessmentId: ${req.params.assessmentId}): ${error.message}`, { stack: error.stack, body: req.body });
      next(error);
    }
  },

  /**
   * Get all questions for a specific assessment.
   */
  async getQuestionsForAssessment(req, res, next) {
    try {
      const { assessmentId } = req.params;

      // Optional: Check if assessment exists
      const assessment = await AssessmentService.findById(assessmentId);
      if (!assessment) {
        return res.status(404).json({ message: 'Assessment not found.' });
      }
      // TODO: Add permission check for viewing questions of this assessment

      const questions = await QuestionService.findQuestionsByAssessmentId(assessmentId);
      res.status(200).json(questions);
    } catch (error) {
      logger.error(`Admin getQuestionsForAssessment error (assessmentId: ${req.params.assessmentId}): ${error.message}`, { stack: error.stack });
      next(error);
    }
  },

  /**
   * Get a specific question by ID.
   */
  async getQuestionById(req, res, next) {
    try {
      // assessmentId in params might be used for auth/context, questionId for lookup
      const { questionId } = req.params;
      const question = await QuestionService.findQuestionById(questionId);
      if (!question) {
        return res.status(404).json({ message: 'Question not found.' });
      }
      // TODO: Add permission check: ensure question belongs to an assessment the user can access.
      res.status(200).json(question);
    } catch (error) {
      logger.error(`Admin getQuestionById error (id: ${req.params.questionId}): ${error.message}`, { stack: error.stack });
      next(error);
    }
  },

  /**
   * Update a question.
   */
  async updateQuestion(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { questionId } = req.params;
      const updates = req.body;

      // Optional: Check if question exists and user has permission
      const existingQuestion = await QuestionService.findQuestionById(questionId);
      if (!existingQuestion) {
        return res.status(404).json({ message: 'Question not found.' });
      }
      // TODO: Add permission check for updating this question (e.g., based on its assessment)

      const updatedQuestion = await QuestionService.updateQuestion(questionId, updates);
      if (!updatedQuestion) { // Should not happen if existingQuestion check passed, but as safeguard
        return res.status(404).json({ message: 'Question not found or update failed.' });
      }
      res.status(200).json(updatedQuestion);
    } catch (error) {
      logger.error(`Admin updateQuestion error (id: ${req.params.questionId}): ${error.message}`, { stack: error.stack, body: req.body });
      next(error);
    }
  },

  /**
   * Delete a question.
   */
  async deleteQuestion(req, res, next) {
    try {
      const { questionId } = req.params;

      // Optional: Check if question exists and user has permission
      const existingQuestion = await QuestionService.findQuestionById(questionId);
      if (!existingQuestion) {
        return res.status(404).json({ message: 'Question not found.' });
      }
      // TODO: Add permission check for deleting this question

      const deletedQuestion = await QuestionService.removeQuestion(questionId);
      if (!deletedQuestion) { // Should not happen if existingQuestion check passed
        return res.status(404).json({ message: 'Question not found.' });
      }
      res.status(200).json({ message: 'Question deleted successfully.', question: deletedQuestion });
      // Or res.status(204).send();
    } catch (error) {
      logger.error(`Admin deleteQuestion error (id: ${req.params.questionId}): ${error.message}`, { stack: error.stack });
      next(error);
    }
  },
};

module.exports = AdminQuestionController;
