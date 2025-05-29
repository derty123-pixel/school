// server/src/modules/payments/payment.controller.js
const paymentService = require('./payment.service');
const { validationResult } = require('express-validator');

class PaymentController {
  async createPaymentIntent(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { orderId } = req.body;
    const userId = req.user.id;

    try {
      const result = await paymentService.createOrRetrievePaymentIntent(orderId, userId);
      res.status(200).json({
        message: result.existing 
            ? 'Existing PaymentIntent retrieved.' 
            : 'New PaymentIntent created.',
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
      });
    } catch (error) {
      console.error(`Create PaymentIntent controller error (Order ID: ${orderId}):`, error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to process payment intent.' });
    }
  }

  async handleWebhookEvent(req, res) {
    // req.body is the raw buffer due to express.raw() middleware for this route
    // req.headers['stripe-signature'] is the signature from Stripe
    const sig = req.headers['stripe-signature'];
    
    if (!sig) {
        return res.status(400).send('Webhook Error: Missing Stripe signature.');
    }
    if (!req.body) {
        return res.status(400).send('Webhook Error: Missing request body.');
    }

    try {
      const result = await paymentService.handleStripeWebhook(req.body, sig);
      res.status(200).json(result); // Should be { received: true }
    } catch (error) {
      console.error('Stripe webhook controller error:', error.message);
      // error.statusCode should be set by the service for specific Stripe errors (like 400 for signature fail)
      // or 500 for internal issues.
      res.status(error.statusCode || 500).json({ message: error.message || 'Webhook processing error.' });
    }
  }
}

module.exports = new PaymentController();
