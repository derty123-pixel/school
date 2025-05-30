// server/src/modules/assessments/controllers/admin.assessment.controller.js
const AssessmentService = require('../services/assessment.service');
const logger = require('../../../config/logger');
const { validationResult } = require('express-validator');

const AdminAssessmentController = {
  /**
   * Create a new assessment.
   */
  async createAssessment(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Assuming req.user.id is populated by auth middleware
      const userId = req.user?.id;
      if (!userId) {
        // This should ideally be caught by auth middleware, but as a safeguard:
        logger.warn('User ID not found in request for createAssessment. Ensure auth middleware is active.');
        return res.status(401).json({ message: 'Unauthorized: User ID not available.' });
      }

      const assessmentData = req.body; // { course_id, title, description, ... }
      const assessment = await AssessmentService.create(assessmentData, userId);
      res.status(201).json(assessment);
    } catch (error) {
      logger.error(`Admin createAssessment error: ${error.message}`, { stack: error.stack, body: req.body });
      next(error); // Pass to global error handler
    }
  },

  /**
   * Get all assessments (with optional filters).
   */
  async getAssessments(req, res, next) {
    try {
      // Filters like course_id can be passed via query parameters
      const filters = req.query; // e.g., /assessments?course_id=uuid&status=published
      const assessments = await AssessmentService.findAll(filters);
      res.status(200).json(assessments);
    } catch (error) {
      logger.error(`Admin getAssessments error: ${error.message}`, { stack: error.stack, query: req.query });
      next(error);
    }
  },

  /**
   * Get a specific assessment by ID.
   */
  async getAssessmentById(req, res, next) {
    try {
      const { assessmentId } = req.params;
      const assessment = await AssessmentService.findById(assessmentId);
      if (!assessment) {
        return res.status(404).json({ message: 'Assessment not found.' });
      }
      res.status(200).json(assessment);
    } catch (error) {
      logger.error(`Admin getAssessmentById error (id: ${req.params.assessmentId}): ${error.message}`, { stack: error.stack });
      next(error);
    }
  },

  /**
   * Update an assessment.
   */
  async updateAssessment(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { assessmentId } = req.params;
      const updates = req.body;
      const userId = req.user?.id; // User performing the update

      if (!userId) {
        logger.warn('User ID not found in request for updateAssessment.');
        return res.status(401).json({ message: 'Unauthorized: User ID not available.' });
      }

      const updatedAssessment = await AssessmentService.update(assessmentId, updates, userId);
      if (!updatedAssessment) {
        return res.status(404).json({ message: 'Assessment not found or no changes made.' });
      }
      res.status(200).json(updatedAssessment);
    } catch (error) {
      logger.error(`Admin updateAssessment error (id: ${req.params.assessmentId}): ${error.message}`, { stack: error.stack, body: req.body });
      next(error);
    }
  },

  /**
   * Delete an assessment.
   */
  async deleteAssessment(req, res, next) {
    try {
      const { assessmentId } = req.params;
      const deletedAssessment = await AssessmentService.remove(assessmentId);
      if (!deletedAssessment) {
        return res.status(404).json({ message: 'Assessment not found.' });
      }
      // res.status(204).send(); // No content response for successful deletion
      res.status(200).json({ message: 'Assessment deleted successfully.', assessment: deletedAssessment });
    } catch (error) {
      logger.error(`Admin deleteAssessment error (id: ${req.params.assessmentId}): ${error.message}`, { stack: error.stack });
      next(error);
    }
  },

  // --- Submission Review & Grading Controllers ---

  /**
   * Get all student submissions for a specific assessment.
   */
  async getSubmissionsForAssessment(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { assessmentId } = req.params;
      // Optional: Further permission checks if needed (e.g., is user instructor of this course?)
      const submissions = await AssessmentService.getSubmissionsForAssessment(assessmentId);
      res.status(200).json(submissions);
    } catch (error) {
      logger.error(`Admin getSubmissionsForAssessment error (assessmentId: ${req.params.assessmentId}): ${error.message}`, { stack: error.stack });
      next(error);
    }
  },

  /**
   * Get detailed information for a single student submission.
   */
  async getDetailedSubmissionView(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { submissionId } = req.params;
      const detailedSubmission = await AssessmentService.getDetailedSubmission(submissionId);
      if (!detailedSubmission) {
        return res.status(404).json({ message: 'Submission not found.' });
      }
      res.status(200).json(detailedSubmission);
    } catch (error) {
      logger.error(`Admin getDetailedSubmissionView error (submissionId: ${req.params.submissionId}): ${error.message}`, { stack: error.stack });
      next(error);
    }
  },

  /**
   * Grade or update a specific student's answer.
   */
  async gradeAnswer(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { submissionId, answerId } = req.params; // submissionId might be useful for context/auth
      const { awarded_points, grader_feedback } = req.body;
      const adminUserId = req.user?.id;

      if (!adminUserId) {
        logger.warn('User ID not found in request for gradeAnswer.');
        return res.status(401).json({ message: 'Unauthorized: User ID not available.' });
      }
      if (awarded_points === undefined) {
        return res.status(400).json({ message: 'awarded_points is required.' });
      }

      // Optional: Verify submissionId context if needed, though answerId should be globally unique.
      // e.g., ensure answerId belongs to a submission of an assessment this admin can manage.

      const updatedSubmission = await AssessmentService.gradeStudentAnswer(answerId, awarded_points, grader_feedback, adminUserId);
      res.status(200).json({ message: 'Answer graded successfully.', submission: updatedSubmission });
    } catch (error) {
      logger.error(`Admin gradeAnswer error (answerId: ${req.params.answerId}): ${error.message}`, { stack: error.stack, body: req.body, userId: req.user?.id });
      if (error.message === 'Student answer not found.' || error.message.startsWith('Could not retrieve assessment')) {
          return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  },

  /**
   * Add overall feedback to a submission. (Stretch Goal)
   */
  async addSubmissionFeedback(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { submissionId } = req.params;
      const { feedback } = req.body;
      const adminUserId = req.user?.id;

      if (!adminUserId) {
        logger.warn('User ID not found in request for addSubmissionFeedback.');
        return res.status(401).json({ message: 'Unauthorized: User ID not available.' });
      }
      if (!feedback) {
        return res.status(400).json({ message: 'Feedback text is required.' });
      }

      // Ensure 'overall_feedback' column exists in StudentSubmissions table via a migration
      // For now, this will fail if the column doesn't exist.
      const updatedSubmission = await AssessmentService.addOverallSubmissionFeedback(submissionId, feedback, adminUserId);
      res.status(200).json({ message: 'Overall feedback added successfully.', submission: updatedSubmission });
    } catch (error) {
      logger.error(`Admin addSubmissionFeedback error (submissionId: ${req.params.submissionId}): ${error.message}`, { stack: error.stack, body: req.body, userId: req.user?.id });
      if (error.message === 'Submission not found.') {
          return res.status(404).json({ message: error.message });
      }
      if (error.message.includes("column \"overall_feedback\" of relation \"studentsubmissions\" does not exist")) {
        logger.error("DB Schema missing 'overall_feedback' column in StudentSubmissions table.");
        return res.status(500).json({ message: "Server configuration error: feedback feature not fully enabled."});
      }
      next(error);
    }
  }
};

module.exports = AdminAssessmentController;
