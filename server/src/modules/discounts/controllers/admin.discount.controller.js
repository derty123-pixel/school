// server/src/modules/discounts/controllers/admin.discount.controller.js
const DiscountService = require('../services/discount.service');
const logger = require('../../../config/logger');
const { validationResult } = require('express-validator');

const AdminDiscountController = {
  /**
   * Create a new discount.
   */
  async createDiscount(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        logger.warn('Admin user ID not found in request for createDiscount.');
        return res.status(401).json({ message: 'Unauthorized: Admin user ID not available.' });
      }

      const { applicableEntities, ...discountData } = req.body;
      const newDiscount = await DiscountService.createDiscount(discountData, applicableEntities, adminUserId);
      res.status(201).json(newDiscount);
    } catch (error) {
      logger.error(`Admin createDiscount error: ${error.message}`, { stack: error.stack, body: req.body });
      if (error.message.includes('Invalid entity_type') || error.message.includes('Each applicable entity must have')) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  },

  /**
   * Get all discounts (with optional filters).
   */
  async getDiscounts(req, res, next) {
    try {
      const filters = req.query; // e.g., /discounts?is_active=true
      const discounts = await DiscountService.findAllDiscounts(filters);
      res.status(200).json(discounts);
    } catch (error) {
      logger.error(`Admin getDiscounts error: ${error.message}`, { stack: error.stack, query: req.query });
      next(error);
    }
  },

  /**
   * Get a specific discount by ID.
   */
  async getDiscountById(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { discountId } = req.params;
      const discount = await DiscountService.findDiscountById(discountId);
      if (!discount) {
        return res.status(404).json({ message: 'Discount not found.' });
      }
      res.status(200).json(discount);
    } catch (error) {
      logger.error(`Admin getDiscountById error (id: ${req.params.discountId}): ${error.message}`, { stack: error.stack });
      next(error);
    }
  },

  /**
   * Update a discount.
   */
  async updateDiscount(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { discountId } = req.params;
      const { applicableEntities, ...discountData } = req.body;
      const adminUserId = req.user?.id;

      if (!adminUserId) {
        logger.warn('Admin user ID not found in request for updateDiscount.');
        return res.status(401).json({ message: 'Unauthorized: Admin user ID not available.' });
      }

      const updatedDiscount = await DiscountService.updateDiscount(discountId, discountData, applicableEntities, adminUserId);
      if (!updatedDiscount) {
        return res.status(404).json({ message: 'Discount not found.' });
      }
      res.status(200).json(updatedDiscount);
    } catch (error) {
      logger.error(`Admin updateDiscount error (id: ${req.params.discountId}): ${error.message}`, { stack: error.stack, body: req.body });
      if (error.message.includes('Invalid entity_type') || error.message.includes('Each applicable entity must have')) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  },

  /**
   * Soft delete (deactivate) a discount.
   */
  async deleteDiscount(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { discountId } = req.params;
      const adminUserId = req.user?.id;

      if (!adminUserId) {
        logger.warn('Admin user ID not found in request for deleteDiscount.');
        return res.status(401).json({ message: 'Unauthorized: Admin user ID not available.' });
      }

      const deactivatedDiscount = await DiscountService.deleteDiscount(discountId, adminUserId);
      if (!deactivatedDiscount) {
        return res.status(404).json({ message: 'Discount not found.' });
      }
      res.status(200).json({ message: 'Discount deactivated successfully.', discount: deactivatedDiscount });
    } catch (error) {
      logger.error(`Admin deleteDiscount error (id: ${req.params.discountId}): ${error.message}`, { stack: error.stack });
      next(error);
    }
  },
};

module.exports = AdminDiscountController;
