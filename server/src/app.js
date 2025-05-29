// server/src/app.js
const express = require('express');
const cors = require('cors');
const environment = require('./config/environment');

// Import routes
const userRoutes = require('./modules/user_management/user.routes');
const productCatalogRoutes = require('./modules/product_catalog/product_catalog.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const orderRoutes = require('./modules/orders/order.routes');
const paymentRoutes = require('./modules/payments/payment.routes');
const courseAdminRoutes = require('./modules/courses/course.admin.routes');
const coursePublicRoutes = require('./modules/courses/course.public.routes');
const courseStudentRoutes = require('./modules/courses/course.student.routes');
// Future modules will be imported here:

// Initialize Express app
const app = express();

// Middlewares
app.use(cors()); // Enable CORS for all routes and origins by default

// Stripe webhook route needs raw body, so it's defined BEFORE express.json()
// We'll import controller and define route here, or ensure paymentRoutes is mounted first without express.json()
// For simplicity with current tools, let's assume paymentRoutes will handle its own raw body parsing for the webhook endpoint if mounted later.
// If we were to define it here:
// const paymentControllerForWebhook = require('./modules/payments/payment.controller'); // Adjust path if needed
// app.post('/api/payments/stripe-webhooks', express.raw({type: 'application/json'}), paymentControllerForWebhook.handleWebhookEvent);

app.use(express.json()); // Parse JSON request bodies for other routes
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
// Stripe webhook route will be part of paymentRoutes, but needs special handling for raw body.
// The paymentRoutes file itself will need to ensure express.raw() is used for that specific route.
app.use('/api', userRoutes);
app.use('/api/catalog', productCatalogRoutes); // Mount product catalog routes under /api/catalog
app.use('/api/cart', cartRoutes); // Mount cart routes under /api/cart
app.use('/api/orders', orderRoutes); // Mount order routes under /api/orders
app.use('/api/payments', paymentRoutes); // Mount payment routes under /api/payments
app.use('/api/admin/courses', courseAdminRoutes); // Mount course admin routes
app.use('/api/courses', coursePublicRoutes); // Mount public course routes
app.use('/api/courses', courseStudentRoutes); // Mount student course routes (paths like /enrolled, /:courseId/enroll make them distinct)


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
