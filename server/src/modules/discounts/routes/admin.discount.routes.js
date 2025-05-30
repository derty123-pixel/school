// server/src/modules/discounts/routes/admin.discount.routes.js
const express = require('express');
const { body, param, query } = require('express-validator');
const AdminDiscountController = require('../controllers/admin.discount.controller');
const { protect, authorize } = require('../../../middlewares/auth.middleware'); // Assuming auth middlewares

const router = express.Router();

// Middleware for all discount routes: ensure user is authenticated and authorized as admin/instructor
router.use(protect);
router.use(authorize(['admin', 'instructor'])); // Example roles, adjust as necessary

/**
 * Validation middleware for discount ID parameter.
 */
const validateDiscountIdParam = [
  param('discountId').isUUID().withMessage('Valid Discount ID is required in URL parameter.')
];

/**
 * Validation middleware for creating/updating discounts.
 */
const validateDiscountData = [
  body('name').trim().notEmpty().withMessage('Discount name is required.').isLength({ min: 3, max: 255 }),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 5000 }),
  body('discount_type').isIn(['percentage', 'fixed_amount']).withMessage('Invalid discount type.'),
  body('value').isDecimal({ decimal_digits: '0,2' }).toFloat().isFloat({ gt: 0 })
    .withMessage('Value must be a positive number.')
    .custom((value, { req }) => {
      if (req.body.discount_type === 'percentage' && (value <= 0 || value > 100)) {
        throw new Error('Percentage value must be between 0 (exclusive) and 100 (inclusive).');
      }
      return true;
    }),
  body('applicable_scope').isIn(['all_courses', 'specific_courses', 'specific_categories'])
    .withMessage('Invalid applicable scope.'),
  body('min_purchase_amount').optional({ checkFalsy: true }).isDecimal({ decimal_digits: '0,2' }).toFloat().isFloat({ min: 0 }),
  body('start_date').optional({ checkFalsy: true }).isISO8601().toDate().withMessage('Invalid start date format.'),
  body('end_date').optional({ checkFalsy: true }).isISO8601().toDate().withMessage('Invalid end date format.')
    .custom((value, { req }) => {
      if (req.body.start_date && value && new Date(value) < new Date(req.body.start_date)) {
        throw new Error('End date cannot be before start date.');
      }
      return true;
    }),
  body('max_uses_total').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Max uses total must be a positive integer.'),
  body('is_active').optional().isBoolean().withMessage('is_active must be true or false.'),

  // Validation for applicableEntities array
  body('applicableEntities').optional().isArray().withMessage('applicableEntities must be an array if provided.'),
  body('applicableEntities.*.entity_type').if(body('applicableEntities').exists()).isIn(['course', 'category'])
    .withMessage('Invalid entity_type in applicableEntities. Must be "course" or "category".'),
  body('applicableEntities.*.entity_id').if(body('applicableEntities').exists()).isUUID()
    .withMessage('Invalid entity_id in applicableEntities. Must be a valid UUID.'),
  // Custom validation to ensure applicableEntities are provided if scope requires them
  body().custom((value, { req }) => {
    const { applicable_scope, applicableEntities } = req.body;
    if ((applicable_scope === 'specific_courses' || applicable_scope === 'specific_categories') &&
        (!Array.isArray(applicableEntities) || applicableEntities.length === 0)) {
      // Allowing empty applicableEntities for an update that changes scope to 'all_courses' later,
      // or if the intention is a specific discount that applies to nothing (yet).
      // Service layer handles logic if scope is specific but entities are empty.
      // For stricter validation here, one could throw.
    }
    // Further validation: ensure entity_type matches applicable_scope
    if (applicableEntities && Array.isArray(applicableEntities)) {
        for (const entity of applicableEntities) {
            if (applicable_scope === 'specific_courses' && entity.entity_type !== 'course') {
                 throw new Error(`For 'specific_courses' scope, all entity_types in applicableEntities must be 'course'.`);
            }
            if (applicable_scope === 'specific_categories' && entity.entity_type !== 'category') {
                 throw new Error(`For 'specific_categories' scope, all entity_types in applicableEntities must be 'category'.`);
            }
        }
    }
    return true;
  })
];

const validateListDiscountsQuery = [
    query('is_active').optional().isBoolean().withMessage('is_active filter must be true or false.'),
    query('applicable_scope').optional().isIn(['all_courses', 'specific_courses', 'specific_categories'])
      .withMessage('Invalid applicable_scope filter.')
];


// --- Discount CRUD Routes ---

// POST /api/admin/discounts - Create a new discount
router.post(
  '/',
  validateDiscountData,
  AdminDiscountController.createDiscount
);

// GET /api/admin/discounts - List all discounts
router.get(
  '/',
  validateListDiscountsQuery,
  AdminDiscountController.getDiscounts
);

// GET /api/admin/discounts/:discountId - Get a specific discount
router.get(
  '/:discountId',
  validateDiscountIdParam,
  AdminDiscountController.getDiscountById
);

// PUT /api/admin/discounts/:discountId - Update a discount
router.put(
  '/:discountId',
  validateDiscountIdParam,
  validateDiscountData, // Reuse validation rules
  AdminDiscountController.updateDiscount
);

// DELETE /api/admin/discounts/:discountId - Soft delete (deactivate) a discount
router.delete(
  '/:discountId',
  validateDiscountIdParam,
  AdminDiscountController.deleteDiscount
);

module.exports = router;
