// server/src/modules/user_management/user.routes.js
const express = require('express');
const userController = require('./user.controller');
const { protect, authorize } = require('../../middlewares/auth.middleware');
const { body } = require('express-validator');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post(
  '/auth/register',
  [
    body('firstName', 'First name is required').notEmpty().trim().escape(),
    body('lastName', 'Last name is required').notEmpty().trim().escape(),
    body('email', 'Please include a valid email').isEmail().normalizeEmail(),
    body('password', 'Password must be 6 or more characters').isLength({ min: 6 }),
    // Add more password strength rules if desired for MVP, e.g.,
    // body('password').matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[0-9a-zA-Z]{8,}$/)
    // .withMessage('Password must be at least 8 characters long and include uppercase, lowercase, and numeric characters.'),
  ],
  userController.register
);

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
  '/auth/login',
  [
    body('email', 'Please include a valid email').isEmail().normalizeEmail(),
    body('password', 'Password is required').exists(),
  ],
  userController.login
);

// @route   GET /api/users/me
// @desc    Get current logged-in user's profile
// @access  Private

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Users]
 *     description: Retrieves the profile information for the currently authenticated user.
 *     security:
 *       - bearerAuth: [] # Indicates that this endpoint uses bearer token authentication
 *     responses:
 *       '200':
 *         description: Successfully retrieved user profile.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef'
 *                 firstName:
 *                   type: string
 *                   example: 'John'
 *                 lastName:
 *                   type: string
 *                   example: 'Doe'
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: 'john.doe@example.com'
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ['student', 'instructor']
 *                 # Add other relevant user fields here
 *       '401':
 *         description: Unauthorized - No token provided or token is invalid.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Not authorized, no token'
 *       '404':
 *         description: User not found (should not typically happen if token is valid and user exists).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'User not found' 
 */
router.get(
  '/users/me',
  protect, // This middleware verifies JWT and attaches user to req
  userController.getMyProfile
);

// Example of a role-protected route (optional for this subtask, but shows usage)
// router.get(
//   '/users/admin-only',
//   protect,
//   authorize('admin'), // Requires user to have 'admin' role
//   (req, res) => res.json({ message: 'Welcome Admin!' })
// );


module.exports = router;
