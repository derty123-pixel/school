// server/src/modules/courses/course.student.routes.js
const express = require('express');
const { param, query } = require('express-validator');
const courseStudentController = require('./course.student.controller');
const { protect } = require('../../middlewares/auth.middleware'); // Authentication middleware

const router = express.Router();

// Note: All routes in this file will be mounted under a prefix like /api/courses (or similar)

// @route   POST /api/courses/:courseId/enroll
// @desc    Enroll the authenticated user in a course
// @access  Private (Authenticated User)
router.post(
  '/:courseId/enroll', // Path relative to where this router is mounted
  protect,
  [param('courseId', 'Course ID must be a valid UUID').isUUID()],
  courseStudentController.enrollInCourse
);

// @route   GET /api/courses/enrolled
// @desc    List all courses the authenticated user is enrolled in
// @access  Private (Authenticated User)
router.get(
  '/enrolled', // This path needs to be distinct or mounted carefully, e.g. /api/student/courses/enrolled
  protect,
  [
    query('page', 'Page must be a positive integer').optional().isInt({ gt: 0 }).toInt(),
    query('limit', 'Limit must be a positive integer').optional().isInt({ gt: 0 }).toInt(),
  ],
  courseStudentController.getEnrolledCourses
);

// @route   GET /api/courses/enrolled/:courseId
// @desc    Get full content for an enrolled course
// @access  Private (Authenticated User, must be enrolled)
router.get(
  '/enrolled/:courseId', // Differentiates from public /:slug or /:courseId if that exists
  protect,
  [param('courseId', 'Course ID must be a valid UUID').isUUID()],
  courseStudentController.getEnrolledCourseContent
);

// @route   GET /api/courses/enrolled/:courseId/lessons/:lessonId
// @desc    Get a specific lesson's content for an enrolled student
// @access  Private (Authenticated User, must be enrolled)
router.get(
  '/enrolled/:courseId/lessons/:lessonId',
  protect,
  [
    param('courseId', 'Course ID must be a valid UUID').isUUID(),
    param('lessonId', 'Lesson ID must be a valid UUID').isUUID(),
  ],
  courseStudentController.getEnrolledLessonDetails
);

// @route   POST /api/courses/enrolled/:courseId/lessons/:lessonId/complete
// @desc    Mark a lesson as complete for the authenticated user
// @access  Private (Authenticated User, must be enrolled)
router.post(
  '/enrolled/:courseId/lessons/:lessonId/complete',
  protect,
  [
    param('courseId', 'Course ID must be a valid UUID').isUUID(),
    param('lessonId', 'Lesson ID must be a valid UUID').isUUID(),
  ],
  courseStudentController.markLessonAsComplete
);

module.exports = router;
