// server/src/modules/orders/order.controller.js
const orderService = require('./order.service');
const { validationResult } = require('express-validator');

class OrderController {
  async createOrderFromCart(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required to create an order.' });
    }
    if (!req.cart || !req.cart.id || req.cart.items.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty or not found.' });
    }

    const { shippingAddress, billingAddress } = req.body; 

    try {
      const order = await orderService.createOrderFromCart(req.user.id, req.cart, shippingAddress, billingAddress);
      res.status(201).json({ message: 'Order created successfully, pending payment.', order });
    } catch (error) {
      console.error('Order creation controller error:', error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'An error occurred during order creation.' });
    }
  }

  // This endpoint is called by the client after client-side Stripe.js indicates success.
  // Its role is now to fetch the latest order status, as webhooks are the primary source of truth for payment confirmation.
  async handleClientPaymentSuccess(req, res) {
    const errors = validationResult(req); 
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { orderId } = req.params;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

    try {
      // The service method now just fetches the order. Webhook handles the actual confirmation.
      const order = await orderService.getOrderStatusAfterClientPayment(orderId, req.user.id, isAdmin);
      res.status(200).json({ 
        message: 'Client payment reported. Current order details retrieved.', 
        order: order 
      });
    } catch (error) {
      console.error(`Client payment success handling error (Order ID: ${orderId}):`, error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to retrieve order status after client payment report.' });
    }
  }

  async getOrderById(req, res) {
    const errors = validationResult(req); 
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { orderId } = req.params;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

    try {
      const order = await orderService.getOrderById(orderId, req.user.id, isAdmin);
      res.status(200).json(order);
    } catch (error) {
      console.error(`Get order by ID controller error (ID: ${orderId}):`, error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to retrieve order.' });
    }
  }

  async getMyOrders(req, res) {
    const errors = validationResult(req); 
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
     if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { page = 1, limit = 10 } = req.query;

    try {
      const result = await orderService.getOrdersByUserId(req.user.id, { 
        page: parseInt(page, 10), 
        limit: parseInt(limit, 10) 
      });
      res.status(200).json(result);
    } catch (error) {
      console.error('Get my orders controller error:', error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to retrieve your orders.' });
    }
  }
}

module.exports = new OrderController();
