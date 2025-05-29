// server/src/app.js
const express = require('express');
const cors = require('cors');
const environment = require('./config/environment');

// Import routes
const userRoutes = require('./modules/user_management/user.routes');
const productCatalogRoutes = require('./modules/product_catalog/product_catalog.routes');
// Future modules will be imported here:
// const courseRoutes = require('./modules/course_management/course.routes');
// const orderRoutes = require('./modules/order_management/order.routes');

// Initialize Express app
const app = express();

// Middlewares
app.use(cors()); // Enable CORS for all routes and origins by default
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies

// Basic request logging middleware (optional)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Mount Routers
// All user management related routes will be prefixed with /api (or nothing, depending on preference)
// For this example, user.routes.js already includes /auth and /users prefixes.
// So if we mount it at /api, routes will be /api/auth/register, /api/users/me etc.
app.use('/api', userRoutes);
app.use('/api/catalog', productCatalogRoutes); // Mount product catalog routes under /api/catalog
// app.use('/api', courseRoutes);
// app.use('/api', orderRoutes);


// Global Error Handler (basic example)
// This should be defined after all other app.use() and routes calls
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err.stack || err);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Something went wrong on the server.';
  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    // stack: environment.nodeEnv === 'development' ? err.stack : undefined, // Optional: show stack in dev
  });
});

// Handle 404 for routes not found
app.use((req, res, next) => {
  res.status(404).json({ message: 'Resource not found.' });
});

module.exports = app;
