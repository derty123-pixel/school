// server/src/modules/courses/controllers/student.lesson.controller.js
const LessonService = require('../services/lesson.service');
const logger = require('../../../config/logger');
const { validationResult } = require('express-validator');

const StudentLessonController = {
  /**
   * Get secure video playback details for a specific lesson.
   */
  async getLessonPlaybackInfo(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { lessonId } = req.params;
      const studentId = req.user?.id; // Assuming auth middleware populates req.user

      if (!studentId) {
        // This should ideally be caught by `protect` middleware, but as a safeguard:
        logger.warn('Student user ID not found in request for getLessonPlaybackInfo.');
        return res.status(401).json({ message: 'Unauthorized: User ID not available.' });
      }

      const playbackDetails = await LessonService.getLessonVideoPlaybackDetails(lessonId, studentId);

      if (!playbackDetails) {
        // This case should ideally be handled by service throwing specific errors
        return res.status(404).json({ message: 'Lesson video details not found or access denied.' });
      }

      res.status(200).json(playbackDetails);
    } catch (error) {
      logger.warn(`Student getLessonPlaybackInfo error for lesson ${req.params.lessonId}, student ${req.user?.id}: ${error.message}`);
      // Service throws specific errors that can be user-facing
      if (error.message === 'Lesson not found.' ||
          error.message === 'This lesson does not have associated video content or is misconfigured.') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'You are not authorized to view this video lesson.') {
        return res.status(403).json({ message: error.message });
      }
      if (error.message.includes('unsupported provider')) {
        return res.status(501).json({ message: error.message }); // Not Implemented for this provider
      }
      next(error); // For other unexpected errors
    }
  }
  // Other student-facing lesson interactions could go here,
  // e.g., marking lesson as complete, getting lesson text content.
};

module.exports = StudentLessonController;
