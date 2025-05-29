// server/src/middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');
const environment = require('../config/environment');
const db = require('../config/database');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, environment.jwtSecret);

      // Attach user to request object
      // Fetch minimal user info, excluding password.
      // Also fetch roles.
      const userQuery = `
        SELECT u.id, u.first_name, u.last_name, u.email, u.profile_picture_url, u.is_active, u.last_login_at,
               ARRAY_AGG(r.role_name) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id;
      `;
      const { rows } = await db.query(userQuery, [decoded.userId]);

      if (rows.length === 0) {
        return res.status(401).json({ message: 'User not found.' });
      }

      req.user = rows[0]; // Add user object to request
      next();
    } catch (error) {
      console.error('Authentication error:', error.message);
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired. Please log in again.' });
      }
      return res.status(401).json({ message: 'Not authorized, token failed.' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
        return res.status(403).json({ message: 'User roles not available for authorization.' });
    }
    if (!roles.some(role => req.user.roles.includes(role))) {
      return res.status(403).json({ message: `User role ${req.user.roles.join(', ')} is not authorized to access this route. Required: ${roles.join(' or ')}.` });
    }
    next();
  };
};


module.exports = { protect, authorize };
