// server/src/modules/assessments/controllers/student.assessment.controller.js
const StudentAssessmentService = require('../services/student.assessment.service');
const logger = require('../../../config/logger');
const { validationResult } = require('express-validator');

const StudentAssessmentController = {
  /**
   * Get details of a specific assessment for a student.
   */
  async getAssessmentDetails(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { assessmentId } = req.params;
      const assessmentDetails = await StudentAssessmentService.getAssessmentDetailsForStudent(assessmentId);
      if (!assessmentDetails) {
        return res.status(404).json({ message: 'Assessment not found or not available.' });
      }
      res.status(200).json(assessmentDetails);
    } catch (error) {
      logger.error(`Student getAssessmentDetails error (id: ${req.params.assessmentId}): ${error.message}`, { stack: error.stack });
      next(error);
    }
  },

  /**
   * Start an assessment attempt for the logged-in student.
   */
  async startAssessment(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { assessmentId } = req.params;
      const studentId = req.user?.id; // Assuming populated by auth middleware

      if (!studentId) {
        logger.warn('User ID not found in request for startAssessment.');
        return res.status(401).json({ message: 'Unauthorized: User ID not available.' });
      }

      const submission = await StudentAssessmentService.startAssessmentAttempt(assessmentId, studentId);
      res.status(201).json({ 
        message: 'Assessment attempt started successfully.',
        submissionId: submission.id,
        attemptNumber: submission.attempt_number,
        startedAt: submission.started_at,
        // Client can now use submissionId to fetch questions.
      });
    } catch (error) {
      logger.error(`Student startAssessment error (assessmentId: ${req.params.assessmentId}): ${error.message}`, { stack: error.stack, userId: req.user?.id });
      if (error.message.startsWith('Maximum attempts') || error.message.startsWith('Assessment not found')) {
        return res.status(403).json({ message: error.message }); // Or 404 for not found
      }
      next(error);
    }
  },

  /**
   * Get questions for an active student submission.
   */
  async getSubmissionQuestions(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { submissionId } = req.params;
      const studentId = req.user?.id;

      if (!studentId) {
        logger.warn('User ID not found in request for getSubmissionQuestions.');
        return res.status(401).json({ message: 'Unauthorized: User ID not available.' });
      }

      const questions = await StudentAssessmentService.getQuestionsForSubmission(submissionId, studentId);
      res.status(200).json(questions);
    } catch (error) {
      logger.error(`Student getSubmissionQuestions error (submissionId: ${req.params.submissionId}): ${error.message}`, { stack: error.stack, userId: req.user?.id });
      if (error.message.startsWith('Submission not found') || error.message.startsWith('This assessment attempt is not currently in progress')) {
        return res.status(403).json({ message: error.message }); // Or 404 for not found
      }
      next(error);
    }
  },

  /**
   * Submit answers for an active student submission.
   */
  async submitAnswers(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { submissionId } = req.params;
      const studentId = req.user?.id;
      const answers = req.body.answers; // Expecting { "answers": [{...}, {...}] }

      if (!studentId) {
        logger.warn('User ID not found in request for submitAnswers.');
        return res.status(401).json({ message: 'Unauthorized: User ID not available.' });
      }
      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({ message: 'Request body must contain an array of answers.' });
      }

      const savedAnswers = await StudentAssessmentService.submitStudentAnswers(submissionId, studentId, answers);
      res.status(200).json({ message: 'Answers submitted successfully.', savedAnswers });
    } catch (error) {
      logger.error(`Student submitAnswers error (submissionId: ${req.params.submissionId}): ${error.message}`, { stack: error.stack, userId: req.user?.id, body: req.body });
      if (error.message.includes('not found') || error.message.includes('not owned') || error.message.includes('not currently in progress') || error.message.startsWith('Each answer must') || error.message.startsWith('Answers must be')) {
        return res.status(400).json({ message: error.message }); // Bad request for these types of errors
      }
      next(error);
    }
  },

  /**
   * Complete an assessment attempt for the logged-in student.
   */
  async completeAssessmentAttempt(req, res, next) {
    const errors = validationResult(req); // Though no specific body/param validation here usually
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { submissionId } = req.params;
      const studentId = req.user?.id;

      if (!studentId) {
        logger.warn('User ID not found in request for completeAssessmentAttempt.');
        return res.status(401).json({ message: 'Unauthorized: User ID not available.' });
      }

      const updatedSubmission = await StudentAssessmentService.completeStudentAssessmentAttempt(submissionId, studentId);
      res.status(200).json({ 
        message: 'Assessment attempt completed successfully.', 
        submission: updatedSubmission 
      });
    } catch (error) {
      logger.error(`Student completeAssessmentAttempt error (submissionId: ${req.params.submissionId}): ${error.message}`, { stack: error.stack, userId: req.user?.id });
      if (error.message.includes('not found') || error.message.includes('not owned') || error.message.includes('not currently in progress')) {
        return res.status(400).json({ message: error.message }); // Bad request or Forbidden (403) might be more apt
      }
      next(error);
    }
  },

  /**
   * List all submissions for the authenticated student.
   * Supports filtering via query parameters e.g. ?courseId=uuid&assessmentId=uuid
   */
  async listMySubmissions(req, res, next) {
    try {
      const studentId = req.user?.id;
      if (!studentId) {
        logger.warn('User ID not found in request for listMySubmissions.');
        return res.status(401).json({ message: 'Unauthorized: User ID not available.' });
      }
      
      const filters = req.query; // e.g., { course_id: '...', assessment_id: '...' }
      const submissions = await StudentAssessmentService.getMySubmissions(studentId, filters);
      res.status(200).json(submissions);
    } catch (error) {
      logger.error(`Student listMySubmissions error: ${error.message}`, { stack: error.stack, userId: req.user?.id, query: req.query });
      next(error);
    }
  },

  /**
   * Get detailed results for a specific, completed/graded submission owned by the student.
   */
  async getSubmissionResults(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { submissionId } = req.params;
      const studentId = req.user?.id;

      if (!studentId) {
        logger.warn('User ID not found in request for getSubmissionResults.');
        return res.status(401).json({ message: 'Unauthorized: User ID not available.' });
      }

      const results = await StudentAssessmentService.getStudentSubmissionResults(submissionId, studentId);
      res.status(200).json(results);
    } catch (error) {
      logger.error(`Student getSubmissionResults error (submissionId: ${req.params.submissionId}): ${error.message}`, { stack: error.stack, userId: req.user?.id });
      if (error.message.includes('not found') || error.message.includes('not have permission') || error.message.includes('not yet available')) {
        return res.status(403).json({ message: error.message }); // Or 404 for not found
      }
      next(error);
    }
  }
};

module.exports = StudentAssessmentController;
