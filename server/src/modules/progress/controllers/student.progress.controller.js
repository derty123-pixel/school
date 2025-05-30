// server/src/modules/progress/controllers/student.progress.controller.js
const StudentProgressService = require('../services/student.progress.service');
const logger = require('../../../config/logger');
const { validationResult } = require('express-validator');

const StudentProgressController = {
  /**
   * Update (or create) progress for a specific lesson for the authenticated student.
   */
  async updateLessonProgressStatus(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const studentId = req.user?.id;
      if (!studentId) {
        logger.warn('Student user ID not found for updateLessonProgressStatus.');
        return res.status(401).json({ message: 'Unauthorized: Student user ID not available.' });
      }

      const { lessonId } = req.params;
      const { status, video_progress_seconds } = req.body;

      if (status === undefined && video_progress_seconds === undefined) {
        return res.status(400).json({ message: 'Must provide at least status or video_progress_seconds to update.' });
      }

      const progressData = { status, video_progress_seconds };
      const updatedProgress = await StudentProgressService.updateLessonProgress(studentId, lessonId, progressData);

      res.status(200).json(updatedProgress);
    } catch (error) {
      logger.error(`Student updateLessonProgressStatus error for lesson ${req.params.lessonId}, student ${req.user?.id}: ${error.message}`, { stack: error.stack, body: req.body });
      if (error.message === 'Lesson not found.') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.includes('cannot be negative') || error.message.includes('Invalid status value')) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  },

  /**
   * Get current progress status for a specific lesson for the authenticated student.
   */
  async getLessonProgressStatus(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const studentId = req.user?.id;
      if (!studentId) {
        logger.warn('Student user ID not found for getLessonProgressStatus.');
        return res.status(401).json({ message: 'Unauthorized: Student user ID not available.' });
      }

      const { lessonId } = req.params;
      const progress = await StudentProgressService.getLessonProgress(studentId, lessonId);

      // Service returns a default object if not found, or throws if lesson itself doesn't exist
      res.status(200).json(progress);
    } catch (error) {
      logger.error(`Student getLessonProgressStatus error for lesson ${req.params.lessonId}, student ${req.user?.id}: ${error.message}`, { stack: error.stack });
      if (error.message === 'Lesson not found when trying to get default progress.') {
        return res.status(404).json({ message: 'Lesson not found.' });
      }
      next(error);
    }
  },
};

module.exports = StudentProgressController;
