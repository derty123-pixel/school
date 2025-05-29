// server/src/modules/courses/course.student.controller.js
const courseStudentService = require('./course.student.service');
const { validationResult } = require('express-validator');

class CourseStudentController {
  async enrollInCourse(req, res) {
    const errors = validationResult(req); // For param validation
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (!req.user || !req.user.id) { // Should be caught by 'protect' middleware
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { courseId } = req.params;
    const userId = req.user.id;

    try {
      const enrollment = await courseStudentService.enrollInCourse(userId, courseId);
      res.status(201).json({ message: 'Successfully enrolled in course.', enrollment });
    } catch (error) {
      console.error(`Enroll in course controller error (Course ID: ${courseId}, User ID: ${userId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to enroll in course.' });
    }
  }

  async getEnrolledCourses(req, res) {
    const errors = validationResult(req); // For query param validation
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
     if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.id;

    try {
      const result = await courseStudentService.getEnrolledCourses(userId, { 
        page: parseInt(page, 10), 
        limit: parseInt(limit, 10) 
      });
      res.status(200).json(result);
    } catch (error) {
      console.error(`Get enrolled courses controller error (User ID: ${userId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to retrieve enrolled courses.' });
    }
  }

  async getEnrolledCourseContent(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    
    const { courseId } = req.params;
    const userId = req.user.id;

    try {
      const courseContent = await courseStudentService.getEnrolledCourseContent(userId, courseId);
      res.status(200).json(courseContent);
    } catch (error) {
      console.error(`Get enrolled course content controller error (Course ID: ${courseId}, User ID: ${userId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to retrieve course content.' });
    }
  }

  async getEnrolledLessonDetails(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { courseId, lessonId } = req.params;
    const userId = req.user.id;

    try {
      const lessonDetails = await courseStudentService.getEnrolledLessonDetails(userId, courseId, lessonId);
      res.status(200).json(lessonDetails);
    } catch (error) {
      console.error(`Get enrolled lesson details controller error (C: ${courseId}, L: ${lessonId}, U: ${userId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to retrieve lesson details.' });
    }
  }

  async markLessonAsComplete(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { courseId, lessonId } = req.params;
    const userId = req.user.id;

    try {
      const result = await courseStudentService.markLessonAsComplete(userId, courseId, lessonId);
      res.status(200).json(result);
    } catch (error) {
      console.error(`Mark lesson complete controller error (C: ${courseId}, L: ${lessonId}, U: ${userId}):`, error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to mark lesson as complete.' });
    }
  }
}

module.exports = new CourseStudentController();
