// server/src/modules/payments/payment.routes.js
const express = require('express'); // Import express
const { body } = require('express-validator');
const paymentController = require('./payment.controller');
const { protect } = require('../../middlewares/auth.middleware'); 

const router = express.Router();

// @route   POST /api/payments/create-payment-intent
// @desc    Create or retrieve a Stripe PaymentIntent for an order
// @access  Private (Authenticated User)
router.post(
  '/create-payment-intent',
  protect, // Ensures req.user is populated
  [
    body('orderId', 'Order ID is required and must be a valid UUID').isUUID(),
  ],
  paymentController.createPaymentIntent
);


// @route   POST /api/payments/stripe-webhooks
// @desc    Handle incoming webhook events from Stripe
// @access  Public (but verified by Stripe signature)
// IMPORTANT: This route needs the raw request body for signature verification.
// So, express.raw() middleware is applied here, BEFORE this route is hit by the global express.json() in app.js.
router.post(
  '/stripe-webhooks',
  express.raw({ type: 'application/json' }), // Stripe requires the raw body
  paymentController.handleWebhookEvent
);

module.exports = router;
