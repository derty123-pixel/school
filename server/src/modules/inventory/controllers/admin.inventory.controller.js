// server/src/modules/inventory/controllers/admin.inventory.controller.js
const InventoryService = require('../services/inventory.service');
const logger = require('../../../config/logger');
const { validationResult } = require('express-validator');

const AdminInventoryController = {
  /**
   * Set/Initialize stock for a product.
   */
  async setStock(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const adminUserId = req.user?.id; // Assuming auth middleware populates req.user
      if (!adminUserId) {
        logger.warn('Admin user ID not found for setStock.');
        return res.status(401).json({ message: 'Unauthorized: Admin user ID not available.' });
      }

      const { productId } = req.params; // product_id (course_id)
      const { quantity_available, low_stock_threshold } = req.body;

      const inventoryRecord = await InventoryService.setInitialStock(productId, quantity_available, low_stock_threshold, adminUserId);
      res.status(201).json(inventoryRecord);
    } catch (error) {
      logger.error(`Admin setStock error for product ${req.params.productId}: ${error.message}`, { stack: error.stack, body: req.body });
      if (error.message.includes('cannot be negative')) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  },

  /**
   * Update stock for a product (adjust quantity or set new quantity).
   */
  async updateStock(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        logger.warn('Admin user ID not found for updateStock.');
        return res.status(401).json({ message: 'Unauthorized: Admin user ID not available.' });
      }

      const { productId } = req.params;
      const { quantity_change, new_quantity_available, low_stock_threshold, version } = req.body;

      // Service expects an object for updates
      const updatePayload = {
          change: quantity_change,
          newQuantity: new_quantity_available,
          lowStockThresholdUpdate: low_stock_threshold
      };

      const updatedInventory = await InventoryService.updateStock(productId, updatePayload, version, adminUserId);
      res.status(200).json(updatedInventory);
    } catch (error) {
      logger.error(`Admin updateStock error for product ${req.params.productId}: ${error.message}`, { stack: error.stack, body: req.body });
      if (error.message.includes('not found') || error.message.includes('mismatch') || error.message.includes('negative') || error.message.includes('less than reserved')) {
        return res.status(400).json({ message: error.message }); // 409 for version mismatch might also be appropriate
      }
      next(error);
    }
  },

  /**
   * Get stock for a specific product.
   */
  async getStock(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { productId } = req.params;
      const inventory = await InventoryService.getStockByProductId(productId);
      if (!inventory) {
        return res.status(404).json({ message: 'Inventory record not found for this product.' });
      }
      res.status(200).json(inventory);
    } catch (error) {
      logger.error(`Admin getStock error for product ${req.params.productId}: ${error.message}`, { stack: error.stack });
      next(error);
    }
  },

  /**
   * List all product inventory records.
   */
  async listInventory(req, res, next) {
    const errors = validationResult(req); // For query param validation
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const filters = req.query; // { stock_status, page, limit }
      const result = await InventoryService.listAllInventory(filters);
      res.status(200).json(result);
    } catch (error) {
      logger.error('Admin listInventory error:', { stack: error.stack, query: req.query });
      next(error);
    }
  },
};

module.exports = AdminInventoryController;
