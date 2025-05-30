// server/src/modules/discounts/routes/user.coupon.routes.js
const express = require('express');
const { body } = require('express-validator');
const UserCouponController = require('../controllers/user.coupon.controller');
const { protect } = require('../../../middlewares/auth.middleware'); // Assuming auth middleware

const router = express.Router();

// All routes in this file require an authenticated user
router.use(protect);

/**
 * Validation middleware for applying a coupon.
 */
const validateApplyCoupon = [
  body('coupon_code').trim().notEmpty().withMessage('Coupon code is required.')
    .isString().isLength({ min: 1, max: 100 }).withMessage('Invalid coupon code format.')
    // .isAlphanumeric().withMessage('Coupon code must be alphanumeric.') // Too restrictive if we allow dashes/underscores
    .matches(/^[A-Z0-9_-]+$/i).withMessage('Coupon code contains invalid characters.') // Allow alphanumeric, underscore, hyphen, case-insensitive
    .toUpperCase(), // Convert to uppercase to match stored codes
  // Optional: basic validation for cart_details if it becomes more structured
  body('cart_details').optional().isObject(),
  body('cart_details.subtotal').optional().isNumeric().withMessage('Cart subtotal must be a number if provided.'),
];


// POST /api/user/coupons/apply (or similar mount point)
router.post(
  '/apply', // Route will be something like /api/user/coupons/apply
  validateApplyCoupon,
  UserCouponController.applyCoupon
);

module.exports = router;
