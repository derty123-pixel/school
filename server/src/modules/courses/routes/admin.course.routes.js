// server/src/modules/courses/routes/admin.course.routes.js
const express = require('express');
const { protect, authorize } = require('../../../middlewares/auth.middleware');
const adminLessonRoutes = require('./admin.lesson.routes'); // Import lesson routes

const router = express.Router();

// Middleware for all admin course routes: ensure user is authenticated and authorized
router.use(protect);
router.use(authorize(['admin', 'instructor'])); // Example roles

// --- Placeholder for Course Admin CRUD ---
// GET /api/admin/courses - List all courses (admin view)
router.get('/', (req, res) => res.status(501).json({ message: 'List courses admin view not implemented yet.' }));
// POST /api/admin/courses - Create a new course
router.post('/', (req, res) => res.status(501).json({ message: 'Create course not implemented yet.' }));
// GET /api/admin/courses/:courseId - Get a specific course (admin view)
router.get('/:courseId', (req, res) => res.status(501).json({ message: `Get course ${req.params.courseId} admin view not implemented yet.` }));
// PUT /api/admin/courses/:courseId - Update a course
router.put('/:courseId', (req, res) => res.status(501).json({ message: `Update course ${req.params.courseId} not implemented yet.` }));
// DELETE /api/admin/courses/:courseId - Delete a course
router.delete('/:courseId', (req, res) => res.status(501).json({ message: `Delete course ${req.params.courseId} not implemented yet.` }));


// --- Nested Lesson Routes ---
// Mount lesson routes under /:courseId/lessons
// This means that lesson routes will have access to req.params.courseId if mergeParams is true in admin.lesson.routes.js
router.use('/:courseId/lessons', adminLessonRoutes);


module.exports = router;
