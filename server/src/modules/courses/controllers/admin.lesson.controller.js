// server/src/modules/courses/controllers/admin.lesson.controller.js
const LessonService = require('../services/lesson.service');
const logger = require('../../../config/logger');
const { validationResult } = require('express-validator');

const AdminLessonController = {
  /**
   * Update lesson details, including associating video information.
   */
  async updateLesson(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { lessonId } = req.params;
      const lessonData = req.body;
      const adminUserId = req.user?.id; // Assuming auth middleware populates req.user

      if (!adminUserId) {
        logger.warn('Admin user ID not found for updateLesson.');
        return res.status(401).json({ message: 'Unauthorized: Admin user ID not available.' });
      }

      // Ensure content_type is present if attempting to set video details
      if (lessonData.video_provider || lessonData.external_video_id) {
        if (!lessonData.content_type) {
          // If video fields are present, imply content_type should be 'video' or ensure it's set.
          // For this example, if they set video_provider, we'll assume they mean it's a video.
          // The service/DB constraint will enforce consistency.
          // A stricter controller might:
          // if (lessonData.content_type !== 'video') {
          //   return res.status(400).json({ message: "content_type must be 'video' when providing video details." });
          // }
        } else if (lessonData.content_type !== 'video') {
             return res.status(400).json({ message: `Cannot set video details when content_type is '${lessonData.content_type}'. Set content_type to 'video'.` });
        }
      }


      const updatedLesson = await LessonService.updateLessonDetails(lessonId, lessonData, adminUserId);

      if (!updatedLesson) {
        return res.status(404).json({ message: 'Lesson not found.' });
      }
      res.status(200).json(updatedLesson);
    } catch (error) {
      logger.error(`Admin updateLesson error (lessonId: ${req.params.lessonId}): ${error.message}`, { stack: error.stack, body: req.body });
       if (error.message.includes('Failed to update lesson due to constraint')) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  },

  // Placeholder for createLesson controller method
  async createLessonForCourse(req, res, next) {
    // const errors = validationResult(req);
    // if (!errors.isEmpty()) {
    //   return res.status(400).json({ errors: errors.array() });
    // }
    // try {
    //   const { courseId } = req.params; // Assuming route like /courses/:courseId/lessons
    //   const lessonData = req.body;
    //   const adminUserId = req.user.id;
    //   const newLesson = await LessonService.createLesson(courseId, lessonData, adminUserId);
    //   res.status(201).json(newLesson);
    // } catch (error) {
    //   logger.error(`Admin createLessonForCourse error: ${error.message}`, { stack: error.stack, body: req.body });
    //   next(error);
    // }
    res.status(501).json({ message: 'Create lesson not implemented in this step.' });
  }
  // Other lesson management controller methods (getLessonById, deleteLesson, listLessonsForCourse) would go here.
};

module.exports = AdminLessonController;
