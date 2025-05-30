// server/src/modules/discounts/controllers/user.coupon.controller.js
const CouponService = require('../services/coupon.service');
const logger = require('../../../config/logger');
const { validationResult } = require('express-validator');

const UserCouponController = {
  /**
   * Apply a coupon code to the user's current context (e.g., cart).
   */
  async applyCoupon(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user?.id;
      if (!userId) {
        logger.warn('User ID not found for applyCoupon.');
        return res.status(401).json({ message: 'Unauthorized: User ID not available.' });
      }

      const { coupon_code } = req.body;
      // Conceptual cartDetails - in a real app, this might be fetched from a CartService
      // For this task, we pass a minimal or empty object if not directly used by core validation.
      const cartDetails = req.body.cart_details || {
        // items: [], // Example: [{ courseId: 'uuid', categoryId: 'uuid', price: 50.00 }]
        // subtotal: 0 // Example: cart subtotal before discount
      };
      // If min_purchase_amount is critical, cart_details.subtotal should be provided.
      // The service function already has a check for cartDetails.subtotal.

      const validatedDiscountInfo = await CouponService.applyCouponToUserCart(coupon_code, userId, cartDetails);

      // The response now contains the validated discount information.
      // The client (frontend) would typically use this to update the cart display and subtotal.
      // No actual cart modification or CouponUsage record creation happens at this stage.
      // That occurs upon order confirmation/payment.
      res.status(200).json({
        message: 'Coupon applied successfully.',
        discount: validatedDiscountInfo
      });

    } catch (error) {
      logger.warn(`User applyCoupon error for user ${req.user?.id}, code ${req.body.coupon_code}: ${error.message}`);
      // Specific error messages from the service are intended to be user-friendly.
      if (error.message.includes('not found') ||
          error.message.includes('no longer active') ||
          error.message.includes('not yet valid') ||
          error.message.includes('expired') ||
          error.message.includes('usage limit') ||
          error.message.includes('already used') ||
          error.message.includes('minimum purchase') ||
          error.message.includes('not applicable') ||
          error.message.includes('not configured correctly')) {
        return res.status(400).json({ message: error.message });
      }
      next(error); // For other unexpected errors
    }
  },
};

module.exports = UserCouponController;
