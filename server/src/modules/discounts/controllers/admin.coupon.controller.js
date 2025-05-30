// server/src/modules/discounts/controllers/admin.coupon.controller.js
const CouponService = require('../services/coupon.service');
const logger = require('../../../config/logger');
const { validationResult } = require('express-validator');

const AdminCouponController = {
  /**
   * Create a new coupon.
   */
  async createCoupon(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        logger.warn('Admin user ID not found for createCoupon.');
        return res.status(401).json({ message: 'Unauthorized: Admin user ID not available.' });
      }

      const couponData = req.body;
      const newCoupon = await CouponService.createCoupon(couponData, adminUserId);
      res.status(201).json(newCoupon);
    } catch (error) {
      logger.error(`Admin createCoupon error: ${error.message}`, { stack: error.stack, body: req.body });
      if (error.message.includes('not found') || error.message.includes('already exists')) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  },

  /**
   * Get all coupons (with optional filters).
   */
  async getCoupons(req, res, next) {
    try {
      const filters = req.query; // e.g., /coupons?discount_id=uuid&is_active=true
      const coupons = await CouponService.findAllCoupons(filters);
      res.status(200).json(coupons);
    } catch (error) {
      logger.error(`Admin getCoupons error: ${error.message}`, { stack: error.stack, query: req.query });
      next(error);
    }
  },

  /**
   * Get a specific coupon by its ID or code.
   */
  async getCouponByIdOrCode(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { couponIdOrCode } = req.params;
      const coupon = await CouponService.findCouponByIdOrCode(couponIdOrCode);
      if (!coupon) {
        return res.status(404).json({ message: 'Coupon not found.' });
      }
      res.status(200).json(coupon);
    } catch (error) {
      logger.error(`Admin getCouponByIdOrCode error (identifier: ${req.params.couponIdOrCode}): ${error.message}`, { stack: error.stack });
      next(error);
    }
  },

  /**
   * Update a coupon.
   */
  async updateCoupon(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { couponIdOrCode } = req.params;
      const couponData = req.body;
      const adminUserId = req.user?.id;

      if (!adminUserId) {
        logger.warn('Admin user ID not found for updateCoupon.');
        return res.status(401).json({ message: 'Unauthorized: Admin user ID not available.' });
      }

      const updatedCoupon = await CouponService.updateCoupon(couponIdOrCode, couponData, adminUserId);
      if (!updatedCoupon) { // Should be handled by service if not found
        return res.status(404).json({ message: 'Coupon not found.' });
      }
      res.status(200).json(updatedCoupon);
    } catch (error) {
      logger.error(`Admin updateCoupon error (identifier: ${req.params.couponIdOrCode}): ${error.message}`, { stack: error.stack, body: req.body });
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  },

  /**
   * Soft delete (deactivate) a coupon.
   */
  async deleteCoupon(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { couponIdOrCode } = req.params;
      const adminUserId = req.user?.id;

      if (!adminUserId) {
        logger.warn('Admin user ID not found for deleteCoupon.');
        return res.status(401).json({ message: 'Unauthorized: Admin user ID not available.' });
      }

      const deactivatedCoupon = await CouponService.deleteCoupon(couponIdOrCode, adminUserId);
      if (!deactivatedCoupon) { // Should be handled by service if not found
        return res.status(404).json({ message: 'Coupon not found.' });
      }
      res.status(200).json({ message: 'Coupon deactivated successfully.', coupon: deactivatedCoupon });
    } catch (error) {
      logger.error(`Admin deleteCoupon error (identifier: ${req.params.couponIdOrCode}): ${error.message}`, { stack: error.stack });
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  },
};

module.exports = AdminCouponController;
