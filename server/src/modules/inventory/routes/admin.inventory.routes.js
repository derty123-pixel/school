// server/src/modules/inventory/routes/admin.inventory.routes.js
const express = require('express');
const { body, param, query } = require('express-validator');
const AdminInventoryController = require('../controllers/admin.inventory.controller');
const { protect, authorize } = require('../../../middlewares/auth.middleware'); // Assuming auth middlewares

const router = express.Router();

// Middleware for all inventory routes: ensure user is authenticated and authorized
router.use(protect);
router.use(authorize(['admin', 'instructor'])); // Or just 'admin' if instructors shouldn't manage inventory

/**
 * Validation middleware for product ID (course_id) parameter.
 */
const validateProductIdParam = [
  param('productId').isUUID().withMessage('Valid Product ID (Course ID) is required in URL parameter.')
];

/**
 * Validation middleware for setting initial stock.
 */
const validateSetStockData = [
  body('quantity_available').isInt({ min: 0 }).withMessage('Quantity available must be a non-negative integer.').toInt(),
  body('low_stock_threshold').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Low stock threshold must be a non-negative integer.').toInt()
];

/**
 * Validation middleware for updating stock.
 */
const validateUpdateStockData = [
  // Ensure at least one way of updating quantity is provided, or low_stock_threshold
  body().custom((value, { req }) => {
    if (req.body.quantity_change === undefined && req.body.new_quantity_available === undefined && req.body.low_stock_threshold === undefined) {
      throw new Error('Must provide quantity_change, new_quantity_available, or low_stock_threshold to update stock.');
    }
    return true;
  }),
  body('quantity_change').optional().isInt().withMessage('Quantity change must be an integer.').toInt(),
  body('new_quantity_available').optional().isInt({ min: 0 }).withMessage('New quantity available must be a non-negative integer.').toInt(),
  body('low_stock_threshold').optional({ checkFalsy: true, nullable: true }).isInt({ min: 0 }).withMessage('Low stock threshold must be a non-negative integer or null.').toInt(),
  body('version').optional().isInt({ min: 1 }).withMessage('Version must be a positive integer if provided.').toInt()
];

const validateListInventoryQuery = [
    query('stock_status').optional().isIn(['in_stock', 'out_of_stock', 'low_stock', 'discontinued'])
      .withMessage('Invalid stock_status filter.'),
    query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer.'),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be an integer between 1 and 100.')
];

// --- Inventory Management Routes ---

// POST /api/admin/inventory/products/:productId/stock - Set/Initialize stock for a product
router.post(
  '/products/:productId/stock',
  validateProductIdParam,
  validateSetStockData,
  AdminInventoryController.setStock
);

// PUT /api/admin/inventory/products/:productId/stock - Update stock for a product
router.put(
  '/products/:productId/stock',
  validateProductIdParam,
  validateUpdateStockData,
  AdminInventoryController.updateStock
);

// GET /api/admin/inventory/products/:productId/stock - Get stock for a product
router.get(
  '/products/:productId/stock',
  validateProductIdParam,
  AdminInventoryController.getStock
);

// GET /api/admin/inventory - List all product inventory records
router.get(
  '/',
  validateListInventoryQuery,
  AdminInventoryController.listInventory
);

module.exports = router;
