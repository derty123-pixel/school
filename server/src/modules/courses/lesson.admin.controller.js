// server/src/modules/courses/lesson.admin.controller.js
const lessonAdminService = require('./lesson.admin.service');
const { validationResult } = require('express-validator');

class LessonAdminController {
  async createLesson(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { courseId, moduleId } = req.params;
    // lessonData from req.body will be validated by express-validator in routes
    const lessonData = req.body; 
    try {
      const newLesson = await lessonAdminService.createLesson(courseId, moduleId, req.user, lessonData);
      res.status(201).json({ message: 'Lesson created successfully.', lesson: newLesson });
    } catch (error) {
      console.error(`Create lesson controller error (Course ID: ${courseId}, Module ID: ${moduleId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to create lesson.' });
    }
  }

  async getLessonsForModule(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { courseId, moduleId } = req.params;
    try {
      const lessons = await lessonAdminService.getLessonsForModule(courseId, moduleId, req.user);
      res.status(200).json(lessons);
    } catch (error) {
      console.error(`Get lessons for module controller error (Course ID: ${courseId}, Module ID: ${moduleId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to retrieve lessons.' });
    }
  }

  async getLessonById(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { courseId, moduleId, lessonId } = req.params;
    try {
      const lesson = await lessonAdminService.getLessonById(courseId, moduleId, lessonId, req.user);
      res.status(200).json(lesson);
    } catch (error) {
      console.error(`Get lesson by ID controller error (C: ${courseId}, M: ${moduleId}, L: ${lessonId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to retrieve lesson.' });
    }
  }

  async updateLesson(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { courseId, moduleId, lessonId } = req.params;
    const updateData = req.body;
    try {
      const updatedLesson = await lessonAdminService.updateLesson(courseId, moduleId, lessonId, req.user, updateData);
      res.status(200).json({ message: 'Lesson updated successfully.', lesson: updatedLesson });
    } catch (error) {
      console.error(`Update lesson controller error (C: ${courseId}, M: ${moduleId}, L: ${lessonId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to update lesson.' });
    }
  }

  async deleteLesson(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { courseId, moduleId, lessonId } = req.params;
    try {
      const result = await lessonAdminService.deleteLesson(courseId, moduleId, lessonId, req.user);
      res.status(200).json(result);
    } catch (error) {
      console.error(`Delete lesson controller error (C: ${courseId}, M: ${moduleId}, L: ${lessonId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to delete lesson.' });
    }
  }
}

module.exports = new LessonAdminController();
