// server/src/modules/orders/order.routes.js
const express = require('express');
const { body, param, query } = require('express-validator');
const orderController = require('./order.controller');
const { protect, authorize } = require('../../middlewares/auth.middleware');
const { ensureCart } = require('../cart/cart.middleware'); // To get req.cart

const router = express.Router();

// @route   POST /api/orders/from-cart
// @desc    Create a new order from the user's current cart
// @access  Private (Authenticated User)
router.post(
  '/from-cart',
  protect, // Ensures req.user is populated
  ensureCart, // Ensures req.cart is populated (and handles guest/user cart logic)
  [
    // Validate address data. For MVP, assume simple structure.
    // In a real app, these would be more detailed (street, city, zip, country etc.)
    body('shippingAddress', 'Shipping address is required').notEmpty().isObject(),
    body('shippingAddress.street', 'Shipping street is required').optional().isString().trim().escape(), // Make specific fields optional or required as needed
    body('shippingAddress.city', 'Shipping city is required').optional().isString().trim().escape(),
    body('shippingAddress.postalCode', 'Shipping postal code is required').optional().isString().trim().escape(),
    body('shippingAddress.country', 'Shipping country is required').optional().isString().trim().escape(),
    
    body('billingAddress', 'Billing address is required').notEmpty().isObject(),
    body('billingAddress.street', 'Billing street is required').optional().isString().trim().escape(),
    body('billingAddress.city', 'Billing city is required').optional().isString().trim().escape(),
    body('billingAddress.postalCode', 'Billing postal code is required').optional().isString().trim().escape(),
    body('billingAddress.country', 'Billing country is required').optional().isString().trim().escape(),
  ],
  orderController.createOrderFromCart
);

// @route   POST /api/orders/:orderId/confirm-payment
// @desc    Simulate payment confirmation for an order
// @access  Private (Authenticated User who owns order or Admin)
router.post(
  '/:orderId/confirm-payment',
  protect,
  [param('orderId', 'Order ID must be a valid UUID').isUUID()],
  orderController.confirmPayment
);

// @route   GET /api/orders/:orderId
// @desc    Get a specific order by its ID
// @access  Private (Authenticated User who owns order or Admin)
router.get(
  '/:orderId',
  protect,
  [param('orderId', 'Order ID must be a valid UUID').isUUID()],
  orderController.getOrderById
);

// @route   GET /api/orders
// @desc    Get a list of orders for the authenticated user (paginated)
// @access  Private (Authenticated User)
router.get(
  '/',
  protect,
  [
    query('page', 'Page must be a positive integer').optional().isInt({ gt: 0 }).toInt(),
    query('limit', 'Limit must be a positive integer').optional().isInt({ gt: 0 }).toInt(),
  ],
  orderController.getMyOrders
);

// Example Admin route to get all orders (not part of this specific subtask's core requirements but for completeness)
// router.get(
//   '/admin/all',
//   protect,
//   authorize('admin'), // Assuming an authorize middleware exists
//   [
//     query('page', 'Page must be a positive integer').optional().isInt({ gt: 0 }).toInt(),
//     query('limit', 'Limit must be a positive integer').optional().isInt({ gt: 0 }).toInt(),
//     query('userId', 'User ID must be a valid UUID if provided').optional().isUUID(),
//     query('status', 'Status must be a valid order status string').optional().isString().trim().escape(),
//   ],
//   orderController.getAllOrdersAsAdmin // This controller method would need to be created
// );

module.exports = router;
