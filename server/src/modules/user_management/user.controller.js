// server/src/modules/user_management/user.controller.js
const userService = require('./user.service');
const { validationResult } = require('express-validator');

class UserController {
  async register(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, email, password } = req.body;

    try {
      const user = await userService.registerUser({ firstName, lastName, email, password });
      // Exclude password from response, service should already do this
      res.status(201).json({
        message: 'User registered successfully.',
        user: {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            roles: user.roles, // Roles should be added by the service
            isActive: user.is_active,
            createdAt: user.created_at
        }
      });
    } catch (error) {
      console.error('Registration error:', error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'An error occurred during registration.' });
    }
  }

  async login(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const result = await userService.loginUser({ email, password });
      res.status(200).json({
        message: 'Login successful.',
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      console.error('Login error:', error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'An error occurred during login.' });
    }
  }

  async getMyProfile(req, res) {
    // req.user is attached by the 'protect' middleware
    if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Not authorized, user data not found in request.' });
    }
    try {
      // The protect middleware already fetches user data, including roles.
      // If more data is needed or specific formatting, call service:
      // const userProfile = await userService.getUserProfile(req.user.id);
      // For now, the data from protect middleware is sufficient.
      const userProfile = req.user; 
      
      res.status(200).json({
        message: 'Profile fetched successfully.',
        user: userProfile, // user object from protect middleware
      });
    } catch (error) {
      console.error('Get profile error:', error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'An error occurred while fetching the profile.' });
    }
  }
}

module.exports = new UserController();
