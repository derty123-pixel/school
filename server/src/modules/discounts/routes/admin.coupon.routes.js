// server/src/modules/discounts/routes/admin.coupon.routes.js
const express = require('express');
const { body, param, query } = require('express-validator');
const AdminCouponController = require('../controllers/admin.coupon.controller');
const { protect, authorize } = require('../../../middlewares/auth.middleware'); // Assuming auth middlewares

const router = express.Router();

// Middleware for all coupon routes: ensure user is authenticated and authorized as admin/instructor
router.use(protect);
router.use(authorize(['admin', 'instructor'])); // Example roles

/**
 * Validation middleware for coupon ID or Code parameter.
 */
const validateCouponIdOrCodeParam = [
  param('couponIdOrCode').trim().notEmpty().withMessage('Coupon ID or Code is required in URL parameter.')
    .isLength({ min: 1, max: 100 }) // Max length of coupon code or typical UUID length
];

/**
 * Validation middleware for creating coupons.
 */
const validateCreateCouponData = [
  body('discount_id').isUUID().withMessage('Valid Discount ID is required.'),
  body('coupon_code').optional().trim().isAlphanumeric().isLength({ min: 3, max: 100 }).toUpperCase()
    .withMessage('Coupon code must be alphanumeric, 3-100 characters.')
    .matches(/^[A-Z0-9_-]+$/).withMessage('Coupon code can only contain uppercase letters, numbers, underscores, and hyphens.'),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 5000 }),
  body('max_uses_per_user').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Max uses per user must be a positive integer.'),
  body('max_uses_total').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Max uses total must be a positive integer.'),
  body('start_date').optional({ checkFalsy: true }).isISO8601().toDate().withMessage('Invalid start date format.'),
  body('end_date').optional({ checkFalsy: true }).isISO8601().toDate().withMessage('Invalid end date format.')
    .custom((value, { req }) => {
      if (req.body.start_date && value && new Date(value) < new Date(req.body.start_date)) {
        throw new Error('End date cannot be before start date.');
      }
      return true;
    }),
  body('is_active').optional().isBoolean().withMessage('is_active must be true or false.'),
];

/**
 * Validation middleware for updating coupons (similar to create, but fields are optional).
 */
const validateUpdateCouponData = [
  body('discount_id').optional().isUUID().withMessage('Valid Discount ID is required if provided.'), // Usually not changed, but possible
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 5000 }),
  body('max_uses_per_user').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Max uses per user must be a positive integer or null.'),
  body('max_uses_total').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Max uses total must be a positive integer or null.'),
  body('start_date').optional({ nullable: true }).isISO8601().toDate().withMessage('Invalid start date format.'),
  body('end_date').optional({ nullable: true }).isISO8601().toDate().withMessage('Invalid end date format.')
    .custom((value, { req }) => {
      const startDate = req.body.start_date || (req.couponBeingUpdated ? req.couponBeingUpdated.start_date : null); // Need current start_date if not changing
      if (startDate && value && new Date(value) < new Date(startDate)) {
        throw new Error('End date cannot be before start date.');
      }
      return true;
    }),
  body('is_active').optional().isBoolean().withMessage('is_active must be true or false.'),
];


const validateListCouponsQuery = [
    query('discount_id').optional().isUUID().withMessage('discount_id filter must be a valid UUID.'),
    query('is_active').optional().isBoolean().withMessage('is_active filter must be true or false.'),
    query('coupon_code_search').optional().isString().trim().escape()
];


// --- Coupon CRUD Routes ---

// POST /api/admin/coupons - Create a new coupon
router.post(
  '/',
  validateCreateCouponData,
  AdminCouponController.createCoupon
);

// GET /api/admin/coupons - List all coupons
router.get(
  '/',
  validateListCouponsQuery,
  AdminCouponController.getCoupons
);

// GET /api/admin/coupons/:couponIdOrCode - Get a specific coupon
router.get(
  '/:couponIdOrCode',
  validateCouponIdOrCodeParam,
  AdminCouponController.getCouponByIdOrCode
);

// PUT /api/admin/coupons/:couponIdOrCode - Update a coupon
// Middleware to load existing coupon for date validation can be added if needed
// For example: (req, res, next) => { req.couponBeingUpdated = await CouponService.find...; next(); }
router.put(
  '/:couponIdOrCode',
  validateCouponIdOrCodeParam,
  validateUpdateCouponData,
  AdminCouponController.updateCoupon
);

// DELETE /api/admin/coupons/:couponIdOrCode - Soft delete (deactivate) a coupon
router.delete(
  '/:couponIdOrCode',
  validateCouponIdOrCodeParam,
  AdminCouponController.deleteCoupon
);

module.exports = router;
