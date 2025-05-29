// server/src/modules/product_catalog/product_catalog.routes.js
const express = require('express');
const { body, query, param } = require('express-validator');
const categoryController = require('./category.controller');
const productController = require('./product.controller');
const { protect, authorize } = require('../../middlewares/auth.middleware'); // Assuming authorize checks for roles like 'admin'

const router = express.Router();

// --- Category Routes ---

// @route   POST /api/catalog/categories
// @desc    Create a new product category
// @access  Private (Admin only)
router.post(
  '/categories',
  protect,
  authorize('admin'), // Ensure user has 'admin' role
  [
    body('name', 'Category name is required').notEmpty().trim().escape(),
    body('description', 'Description should be a string').optional().isString().trim().escape(),
    body('parent_category_id', 'Parent category ID must be a valid UUID if provided').optional({ checkFalsy: true }).isUUID(),
  ],
  categoryController.createCategory
);

// @route   GET /api/catalog/categories
// @desc    Get all product categories
// @access  Public
router.get('/categories', categoryController.getAllCategories);

// @route   GET /api/catalog/categories/:categoryId
// @desc    Get a single category by ID
// @access  Public
router.get(
    '/categories/:categoryId',
    [param('categoryId', 'Category ID must be a valid UUID').isUUID()],
    categoryController.getCategoryById
);


// --- Product Routes ---

// @route   POST /api/catalog/products
// @desc    Create a new product
// @access  Private (Admin only)
router.post(
  '/products',
  protect,
  authorize('admin'),
  [
    body('name', 'Product name is required').notEmpty().trim().escape(),
    body('sku', 'SKU is required and should be a string').notEmpty().trim().escape(),
    body('description', 'Description should be a string').optional().isString().trim().escape(),
    body('price', 'Price is required and must be a non-negative number').isFloat({ gt: -0.00001 }),
    body('category_id', 'Category ID must be a valid UUID').isUUID(),
    body('image_urls', 'Image URLs should be an array if provided').optional({ checkFalsy: true }).isJSON(), // Assuming JSON array of strings or objects
    body('initial_quantity', 'Initial quantity must be a non-negative integer')
      .optional()
      .isInt({ gt: -1 })
      .toInt(),
  ],
  productController.createProduct
);

// @route   GET /api/catalog/products
// @desc    Get all products with pagination and filtering
// @access  Public
router.get(
  '/products',
  [
    query('page', 'Page must be a positive integer').optional().isInt({ gt: 0 }).toInt(),
    query('limit', 'Limit must be a positive integer').optional().isInt({ gt: 0 }).toInt(),
    query('category_id', 'Category ID must be a valid UUID if provided').optional().isUUID(),
  ],
  productController.getAllProducts
);

// @route   GET /api/catalog/products/:productId
// @desc    Get a single product by ID
// @access  Public (Service layer handles published status for public, admin sees all)
router.get(
  '/products/:productId',
  [param('productId', 'Product ID must be a valid UUID').isUUID()],
  // The 'protect' middleware is not strictly needed for public access here,
  // but if it's present, the controller can use req.user to determine if the user is admin
  // For a truly public route that behaves differently for admin, this optional auth is useful.
  // Let's make it public and controller decides if user is admin by checking req.user populated by an optional global auth middleware or if we make this 'protect' optional.
  // For now, controller logic checks req.user itself if 'protect' is applied at app level or not.
  // Or, have two different endpoints or a flag.
  // For MVP, the service handles visibility (published products for public, all for admin if identified)
  // The `protect` middleware IS needed if controller needs to know `req.user` to pass `isAdmin` flag to service.
  protect, // Optional: if we want to know if the requester is an admin to show unpublished products.
           // If not protected, controller cannot determine if user is admin.
           // For now, let's assume a client might send a token, and if it's an admin, they see more.
  productController.getProductById
);

// @route   PUT /api/catalog/products/:productId
// @desc    Update a product
// @access  Private (Admin only)
router.put(
  '/products/:productId',
  protect,
  authorize('admin'),
  [
    param('productId', 'Product ID must be a valid UUID').isUUID(),
    body('name', 'Product name must be a non-empty string if provided').optional().notEmpty().trim().escape(),
    body('sku', 'SKU must be a non-empty string if provided').optional().notEmpty().trim().escape(),
    body('description', 'Description must be a string if provided').optional().isString().trim().escape(),
    body('price', 'Price must be a non-negative number if provided').optional().isFloat({ gt: -0.00001 }),
    body('category_id', 'Category ID must be a valid UUID if provided').optional().isUUID(),
    body('image_urls', 'Image URLs must be a JSON string or array if provided').optional({ checkFalsy: true }).isJSON(),
    body('is_published', 'is_published must be a boolean if provided').optional().isBoolean(),
  ],
  productController.updateProduct
);

// @route   DELETE /api/catalog/products/:productId
// @desc    Delete a product
// @access  Private (Admin only)
router.delete(
  '/products/:productId',
  protect,
  authorize('admin'),
  [param('productId', 'Product ID must be a valid UUID').isUUID()],
  productController.deleteProduct
);

// --- Inventory Routes ---

// @route   PUT /api/catalog/products/:productId/inventory
// @desc    Update product inventory
// @access  Private (Admin only)
router.put(
  '/products/:productId/inventory',
  protect,
  authorize('admin'),
  [
    param('productId', 'Product ID must be a valid UUID').isUUID(),
    body('quantity_available', 'Quantity available must be a non-negative integer if provided')
        .optional()
        .isInt({ gt: -1 })
        .toInt(),
    body('low_stock_threshold', 'Low stock threshold must be a non-negative integer if provided')
        .optional()
        .isInt({ gt: -1 })
        .toInt(),
    // Ensure at least one field is provided for update
    body().custom((value, { req }) => {
        if (req.body.quantity_available === undefined && req.body.low_stock_threshold === undefined) {
            throw new Error('At least one field (quantity_available or low_stock_threshold) must be provided for inventory update.');
        }
        return true;
    })
  ],
  productController.updateInventory
);

module.exports = router;
