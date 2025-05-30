// server/src/app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const Sentry = require('@sentry/node'); // Import Sentry
const logger = require('./config/logger');
// const environment = require('./config/environment'); // environment is async, loaded in server.js
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger'); // Import swaggerSpec

// Import routes
const userRoutes = require('./modules/user_management/user.routes');
const productCatalogRoutes = require('./modules/product_catalog/product_catalog.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const orderRoutes = require('./modules/orders/order.routes');
const paymentRoutes = require('./modules/payments/payment.routes');
const courseAdminRoutes = require('./modules/courses/course.admin.routes');
const coursePublicRoutes = require('./modules/courses/course.public.routes');
const courseStudentRoutes = require('./modules/courses/course.student.routes');
// Assessment module routes
const adminAssessmentRoutes = require('./modules/assessments/routes/admin.assessment.routes.js');
const studentAssessmentRoutes = require('./modules/assessments/routes/student.assessment.routes.js');
// Discount module routes
const adminDiscountRoutes = require('./modules/discounts/routes/admin.discount.routes.js');
const adminCouponRoutes = require('./modules/discounts/routes/admin.coupon.routes.js');
const userCouponRoutes = require('./modules/discounts/routes/user.coupon.routes.js');
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

// Setup request logging with Morgan and Winston
// Morgan will format the log string and pass it to Winston's stream
app.use(morgan('combined', { stream: logger.stream }));

// Sample application log
logger.info('Express application starting up');

// Sentry: The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());

// Sentry: TracingHandler creates a trace for every incoming request (must come after requestHandler)
app.use(Sentry.Handlers.tracingHandler());

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

// Mount assessment admin routes
app.use('/api/admin/assessments', adminAssessmentRoutes);
// Mount assessment student routes
app.use('/api/student/assessments', studentAssessmentRoutes);
// Mount discount admin routes
app.use('/api/admin/discounts', adminDiscountRoutes);
// Mount coupon admin routes
app.use('/api/admin/coupons', adminCouponRoutes);
// Mount coupon user routes
app.use('/api/user/coupons', userCouponRoutes);


// Global Error Handler (basic example)
// This should be defined after all other app.use() and routes calls

// Sentry: The error handler must be before any other error middleware and after all controllers
// Sentry.Handlers.errorHandler must be placed before any other error handling middleware.
app.use(Sentry.Handlers.errorHandler());

// Global Error Handler (basic example)
// This should be defined after all other app.use() and routes calls
app.use((err, req, res, next) => {
  logger.error(`Global Error Handler: ${err.message}`, {
    stack: err.stack,
    status: err.status,
    statusCode: err.statusCode,
    sentryId: res.sentry // Capture Sentry event ID if available
  });
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Something went wrong on the server.';

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    sentryId: res.sentry, // Include Sentry event ID in the error response
    // stack: environment.nodeEnv === 'development' ? err.stack : undefined, // Optional: show stack in dev
  });
});

// Handle 404 for routes not found - this should be after Sentry error handler
// but before the final global error handler if you want Sentry to see 404s as errors.
// Or, if 404s are not errors, place it after Sentry. For now, let's keep it simple.
app.use((req, res, next) => {
  res.status(404).json({ message: 'Resource not found.' });
});

// --- Swagger UI Setup ---
// Serve Swagger UI at /api-docs
// It's important that this comes *before* module.exports = app;
// and typically after your routes and error handlers, or at least not interfering with them.
// However, for visibility, placing it before the final 404 or global error handler can be fine.
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
logger.info('Swagger UI available at /api-docs');


module.exports = app;
