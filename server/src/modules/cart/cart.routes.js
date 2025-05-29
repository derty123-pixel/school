// server/src/modules/cart/cart.routes.js
const express = require('express');
const { body, param } = require('express-validator');
const cartController = require('./cart.controller');
const { protect } = require('../../middlewares/auth.middleware'); // Optional: To identify logged-in users
const { ensureCart } = require('./cart.middleware'); // Ensures req.cart is available

const router = express.Router();

// Apply 'protect' middleware to all cart routes to make req.user available if token is sent.
// It won't reject if no token, but req.user will be undefined.
// Then apply 'ensureCart' to initialize or load the cart based on user or guest session.
router.use(protect); // Makes req.user available if authenticated
router.use(ensureCart); // Makes req.cart available, handles guest/user cart logic

// @route   GET /api/cart
// @desc    Get the current user's or guest's shopping cart
// @access  Public (cart context managed by middleware)
router.get('/', cartController.getCart);

// @route   POST /api/cart/items
// @desc    Add an item to the cart or update quantity if item exists
// @access  Public (cart context managed by middleware)
router.post(
  '/items',
  [
    body('productId', 'Product ID is required and must be a valid UUID').isUUID(),
    body('quantity', 'Quantity is required and must be an integer greater than 0').isInt({ gt: 0 }).toInt(),
  ],
  cartController.addItem
);

// @route   PUT /api/cart/items/:cartItemId
// @desc    Update the quantity of a specific item in the cart
// @access  Public (cart context managed by middleware)
router.put(
  '/items/:cartItemId',
  [
    param('cartItemId', 'Cart Item ID must be a valid UUID').isUUID(),
    body('quantity', 'Quantity is required and must be an integer (0 to remove, >0 to update)').isInt({ gt: -1 }).toInt(),
    // If quantity is 0, service layer should handle as delete.
  ],
  cartController.updateItemQuantity
);

// @route   DELETE /api/cart/items/:cartItemId
// @desc    Remove a specific item from the cart
// @access  Public (cart context managed by middleware)
router.delete(
  '/items/:cartItemId',
  [param('cartItemId', 'Cart Item ID must be a valid UUID').isUUID()],
  cartController.removeItem
);

// @route   DELETE /api/cart
// @desc    Clear all items from the current cart
// @access  Public (cart context managed by middleware)
router.delete('/', cartController.clearCart);

module.exports = router;
