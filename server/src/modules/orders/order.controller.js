// server/src/modules/orders/order.controller.js
const orderService = require('./order.service');
const { validationResult } = require('express-validator');

class OrderController {
  async createOrderFromCart(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // req.user should be populated by 'protect' middleware
    // req.cart should be populated by 'ensureCart' middleware
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required to create an order.' });
    }
    if (!req.cart || !req.cart.id || req.cart.items.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty or not found.' });
    }

    const { shippingAddress, billingAddress } = req.body; // Assume these are validated by express-validator in routes

    try {
      const order = await orderService.createOrderFromCart(req.user.id, req.cart, shippingAddress, billingAddress);
      // The cart ID used for this order should ideally not be used for future cart operations by client.
      // Client should clear its stored X-Cart-ID or backend ensureCart should handle this.
      // The UNIQUE constraint on orders.cart_id prevents reuse.
      res.status(201).json({ message: 'Order created successfully.', order });
    } catch (error) {
      console.error('Order creation controller error:', error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'An error occurred during order creation.' });
    }
  }

  async confirmPayment(req, res) {
    const errors = validationResult(req); // For param validation
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { orderId } = req.params;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

    try {
      const updatedOrder = await orderService.confirmPayment(orderId, req.user.id, isAdmin);
      res.status(200).json({ message: 'Payment confirmed successfully.', order: updatedOrder });
    } catch (error) {
      console.error(`Confirm payment controller error (Order ID: ${orderId}):`, error.message);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to confirm payment.' });
    }
  }

  async getOrderById(req, res) {
    const errors = validationResult(req); // For param validation
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
    const errors = validationResult(req); // For query validation
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
