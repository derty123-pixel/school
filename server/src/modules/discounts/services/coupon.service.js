// server/src/modules/discounts/services/coupon.service.js
const db = require('../../../config/database');
const logger = require('../../../config/logger');
const { v4: uuidv4 } = require('uuid'); // For generating coupon codes if needed

const CouponService = {
  /**
   * Create a new coupon.
   * @param {object} couponData - Data for the new coupon.
   * @param {string} couponData.discount_id - ID of the parent discount.
   * @param {string} [couponData.coupon_code] - Coupon code (auto-generated if not provided).
   * @param {string} [couponData.description]
   * @param {number} [couponData.max_uses_per_user]
   * @param {number} [couponData.max_uses_total]
   * @param {Date} [couponData.start_date]
   * @param {Date} [couponData.end_date]
   * @param {boolean} [couponData.is_active=true]
   * @param {string} adminUserId - ID of the admin user.
   * @returns {Promise<object>} The created coupon object.
   */
  async createCoupon(couponData, adminUserId) {
    const {
      discount_id,
      description,
      max_uses_per_user,
      max_uses_total,
      start_date,
      end_date,
      is_active = true,
    } = couponData;

    let { coupon_code } = couponData;

    // Auto-generate coupon code if not provided (example: 8-char uppercase alphanumeric)
    if (!coupon_code) {
      coupon_code = uuidv4().split('-')[0].toUpperCase(); // Simple auto-generation
    } else {
      coupon_code = coupon_code.toUpperCase(); // Standardize to uppercase
    }

    // Verify discount_id exists
    const discountCheck = await db.pool.query('SELECT id FROM Discounts WHERE id = $1', [discount_id]);
    if (discountCheck.rows.length === 0) {
      throw new Error('Parent Discount ID not found.');
    }

    const query = `
      INSERT INTO Coupons
        (coupon_code, discount_id, description, max_uses_per_user, max_uses_total,
         start_date, end_date, is_active, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const values = [
      coupon_code, discount_id, description, max_uses_per_user, max_uses_total,
      start_date, end_date, is_active, adminUserId, adminUserId,
    ];

    try {
      const { rows } = await db.pool.query(query, values);
      logger.info(`Coupon ${rows[0].coupon_code} (ID: ${rows[0].id}) created by user ${adminUserId}.`);
      return rows[0];
    } catch (error) {
      logger.error(`Error creating coupon by user ${adminUserId}: ${error.message}`, { stack: error.stack, couponData });
      if (error.constraint === 'coupons_coupon_code_key') { // Handle unique violation for coupon_code
        throw new Error(`Coupon code '${coupon_code}' already exists.`);
      }
      throw error;
    }
  },

  /**
   * Find all coupons with optional filters.
   * @param {object} [filters={}] - e.g., { discount_id: 'uuid', is_active: true }
   * @returns {Promise<Array>} An array of coupon objects, potentially with discount name.
   */
  async findAllCoupons(filters = {}) {
    let query = `
      SELECT c.*, d.name as discount_name
      FROM Coupons c
      JOIN Discounts d ON c.discount_id = d.id
    `;
    const values = [];
    const conditions = [];
    let paramCount = 0;

    if (filters.discount_id) {
      paramCount++;
      conditions.push(`c.discount_id = $${paramCount}`);
      values.push(filters.discount_id);
    }
    if (filters.is_active !== undefined) {
      paramCount++;
      conditions.push(`c.is_active = $${paramCount}`);
      values.push(filters.is_active);
    }
    if (filters.coupon_code_search) { // Search by part of a coupon code
        paramCount++;
        conditions.push(`c.coupon_code ILIKE $${paramCount}`);
        values.push(`%${filters.coupon_code_search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY c.created_at DESC;';

    try {
      const { rows } = await db.pool.query(query, values);
      return rows;
    } catch (error) {
      logger.error('Error finding all coupons:', { stack: error.stack, filters });
      throw error;
    }
  },

  /**
   * Find a coupon by its ID or unique coupon_code.
   * @param {string} identifier - The ID or coupon_code of the coupon.
   * @returns {Promise<object|null>} The coupon object or null if not found.
   */
  async findCouponByIdOrCode(identifier) {
    // Check if identifier is UUID (for ID) or string (for code)
    const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(identifier);

    let query = `
        SELECT c.*, d.name as discount_name
        FROM Coupons c
        JOIN Discounts d ON c.discount_id = d.id
    `;

    if (isUUID) {
      query += ' WHERE c.id = $1;';
    } else {
      query += ' WHERE c.coupon_code = $1;';
    }

    try {
      const { rows } = await db.pool.query(query, [identifier]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`Error finding coupon by identifier ${identifier}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },

  /**
   * Update an existing coupon.
   * @param {string} identifier - The ID or coupon_code of the coupon to update.
   * @param {object} couponData - Data to update.
   * @param {string} adminUserId - ID of the admin user.
   * @returns {Promise<object|null>} The updated coupon object or null if not found.
   */
  async updateCoupon(identifier, couponData, adminUserId) {
    const {
      description, max_uses_per_user, max_uses_total,
      start_date, end_date, is_active, discount_id // discount_id typically not changed, but can be allowed
    } = couponData;

    // Fetch current coupon to get its ID if identifier is a code
    const currentCoupon = await this.findCouponByIdOrCode(identifier);
    if (!currentCoupon) {
      throw new Error('Coupon not found.');
    }
    const couponId = currentCoupon.id;

    if (discount_id) {
        // Verify new discount_id exists if being changed
        const discountCheck = await db.pool.query('SELECT id FROM Discounts WHERE id = $1', [discount_id]);
        if (discountCheck.rows.length === 0) {
          throw new Error('New Parent Discount ID not found.');
        }
    }

    const fields = [];
    const values = [];
    let paramCount = 1;

    if (description !== undefined) { fields.push(`description = $${paramCount++}`); values.push(description); }
    if (max_uses_per_user !== undefined) { fields.push(`max_uses_per_user = $${paramCount++}`); values.push(max_uses_per_user); }
    if (max_uses_total !== undefined) { fields.push(`max_uses_total = $${paramCount++}`); values.push(max_uses_total); }
    // current_uses_total is not directly updatable here by admin.
    if (start_date !== undefined) { fields.push(`start_date = $${paramCount++}`); values.push(start_date); }
    if (end_date !== undefined) { fields.push(`end_date = $${paramCount++}`); values.push(end_date); }
    if (is_active !== undefined) { fields.push(`is_active = $${paramCount++}`); values.push(is_active); }
    if (discount_id !== undefined) { fields.push(`discount_id = $${paramCount++}`); values.push(discount_id); }


    if (fields.length === 0) {
      logger.warn(`No fields to update for coupon ${identifier}.`);
      return currentCoupon;
    }

    fields.push(`updated_by = $${paramCount++}`);
    values.push(adminUserId);
    values.push(couponId); // For WHERE clause

    const query = `
      UPDATE Coupons
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *;
    `;

    try {
      const { rows } = await db.pool.query(query, values);
      logger.info(`Coupon ${identifier} (ID: ${couponId}) updated by user ${adminUserId}.`);
      // Need to return with discount_name as well for consistency
      return this.findCouponByIdOrCode(couponId);
    } catch (error) {
      logger.error(`Error updating coupon ${identifier} by user ${adminUserId}: ${error.message}`, { stack: error.stack, couponData });
      throw error;
    }
  },

  /**
   * Soft delete a coupon (sets is_active = false).
   * @param {string} identifier - The ID or coupon_code of the coupon.
   * @param {string} adminUserId - ID of the admin user.
   * @returns {Promise<object|null>} The soft-deleted coupon object or null if not found.
   */
  async deleteCoupon(identifier, adminUserId) {
    const currentCoupon = await this.findCouponByIdOrCode(identifier);
    if (!currentCoupon) {
      throw new Error('Coupon not found.');
    }
    const couponId = currentCoupon.id;

    const query = `
      UPDATE Coupons
      SET is_active = false, updated_by = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;
    try {
      const { rows } = await db.pool.query(query, [adminUserId, couponId]);
      logger.info(`Coupon ${identifier} (ID: ${couponId}) soft deleted by user ${adminUserId}.`);
      // Need to return with discount_name as well for consistency
      return this.findCouponByIdOrCode(couponId);
    } catch (error) {
      logger.error(`Error soft deleting coupon ${identifier} by user ${adminUserId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  },

  /**
   * Validates a coupon code for a user and (conceptually) applies it.
   * Checks coupon existence, activity, date range, usage limits, and parent discount status.
   * Actual application to a cart (price adjustment) is conceptual for this step.
   * @param {string} couponCode - The coupon code entered by the user.
   * @param {string} userId - The ID of the user applying the coupon.
   * @param {object} [cartDetails={}] - Conceptual details of the user's cart (e.g., subtotal, items).
   *        For this task, primarily used to illustrate min_purchase_amount and applicability checks.
   * @returns {Promise<object>} Details of the valid coupon and its discount.
   * @throws {Error} If the coupon is invalid, expired, not applicable, or usage limits reached.
   */
  async applyCouponToUserCart(couponCode, userId, cartDetails = {}) {
    const normalizedCouponCode = couponCode.toUpperCase();

    // 1. Fetch the coupon and its parent discount details
    const couponQuery = `
      SELECT
        c.id AS coupon_id, c.coupon_code, c.discount_id, c.max_uses_per_user, c.max_uses_total AS coupon_max_uses_total,
        c.current_uses_total AS coupon_current_uses_total, c.start_date AS coupon_start_date, c.end_date AS coupon_end_date,
        c.is_active AS coupon_is_active,
        d.name AS discount_name, d.discount_type, d.value AS discount_value, d.applicable_scope,
        d.min_purchase_amount, d.start_date AS discount_start_date, d.end_date AS discount_end_date,
        d.max_uses_total AS discount_max_uses_total, d.current_uses_total AS discount_current_uses_total,
        d.is_active AS discount_is_active
      FROM Coupons c
      JOIN Discounts d ON c.discount_id = d.id
      WHERE c.coupon_code = $1;
    `;
    const { rows: couponRows } = await db.pool.query(couponQuery, [normalizedCouponCode]);

    if (couponRows.length === 0) {
      throw new Error('Coupon code not found.');
    }
    const couponDetails = couponRows[0];

    // 2. Validate coupon and parent discount activity status
    if (!couponDetails.coupon_is_active) {
      throw new Error('This coupon is no longer active.');
    }
    if (!couponDetails.discount_is_active) {
      throw new Error('The discount associated with this coupon is no longer active.');
    }

    // 3. Validate date ranges (coupon dates override discount dates if present)
    const now = new Date();
    const couponStartDate = couponDetails.coupon_start_date ? new Date(couponDetails.coupon_start_date) : null;
    const couponEndDate = couponDetails.coupon_end_date ? new Date(couponDetails.coupon_end_date) : null;
    const discountStartDate = couponDetails.discount_start_date ? new Date(couponDetails.discount_start_date) : null;
    const discountEndDate = couponDetails.discount_end_date ? new Date(couponDetails.discount_end_date) : null;

    const effectiveStartDate = couponStartDate || discountStartDate;
    const effectiveEndDate = couponEndDate || discountEndDate;

    if (effectiveStartDate && now < effectiveStartDate) {
      throw new Error('This coupon is not yet valid.');
    }
    if (effectiveEndDate && now > effectiveEndDate) {
      throw new Error('This coupon has expired.');
    }

    // 4. Check overall usage limits for the specific coupon code
    if (couponDetails.coupon_max_uses_total !== null && couponDetails.coupon_current_uses_total >= couponDetails.coupon_max_uses_total) {
      throw new Error('This coupon has reached its maximum usage limit.');
    }

    // 5. Check overall usage limits for the parent discount campaign (if applicable)
    // This might be double-counting if coupon_current_uses_total also increments discount_current_uses_total.
    // Assuming discount_current_uses_total is a separate broader limit.
    if (couponDetails.discount_max_uses_total !== null && couponDetails.discount_current_uses_total >= couponDetails.discount_max_uses_total) {
      throw new Error('The discount campaign for this coupon has reached its maximum usage limit.');
    }

    // 6. Check per-user usage limit for this specific coupon code
    if (couponDetails.max_uses_per_user !== null) {
      const usageQuery = 'SELECT COUNT(*) FROM CouponUsage WHERE coupon_id = $1 AND user_id = $2;';
      const { rows: usageRows } = await db.pool.query(usageQuery, [couponDetails.coupon_id, userId]);
      const userUsageCount = parseInt(usageRows[0].count, 10);
      if (userUsageCount >= couponDetails.max_uses_per_user) {
        throw new Error('You have already used this coupon the maximum number of times allowed.');
      }
    }

    // 7. Conceptual: Check min_purchase_amount (requires cartDetails.subtotal)
    if (couponDetails.min_purchase_amount !== null) {
      if (!cartDetails.subtotal || cartDetails.subtotal < parseFloat(couponDetails.min_purchase_amount)) {
        throw new Error(`A minimum purchase of $${couponDetails.min_purchase_amount} is required to use this coupon.`);
      }
      logger.info(`Min purchase amount check: Cart subtotal ${cartDetails.subtotal} vs min ${couponDetails.min_purchase_amount}`);
    }

    // 8. Conceptual: Check applicability to cart items (requires cartDetails.items and DiscountApplicability table)
    // This is a simplified outline. A full implementation would be more complex.
    if (couponDetails.applicable_scope !== 'all_courses') { // Assuming 'all_courses' is like 'all_products' for now
      // Fetch DiscountApplicability rules for couponDetails.discount_id
      // const applicabilityQuery = 'SELECT entity_type, entity_id FROM DiscountApplicability WHERE discount_id = $1;';
      // const { rows: applicableTo } = await db.pool.query(applicabilityQuery, [couponDetails.discount_id]);
      //
      // if (applicableTo.length > 0) {
      //   let isApplicable = false;
      //   for (const cartItem of (cartDetails.items || [])) {
      //     // Example: if cartItem has courseId and categoryId
      //     if (couponDetails.applicable_scope === 'specific_courses') {
      //       if (applicableTo.some(rule => rule.entity_type === 'course' && rule.entity_id === cartItem.courseId)) {
      //         isApplicable = true; break;
      //       }
      //     } else if (couponDetails.applicable_scope === 'specific_categories') {
      //       if (applicableTo.some(rule => rule.entity_type === 'category' && rule.entity_id === cartItem.categoryId)) {
      //         isApplicable = true; break;
      //       }
      //     }
      //   }
      //   if (!isApplicable) {
      //     throw new Error('This coupon is not applicable to any items in your cart.');
      //   }
      // } else {
      //   // Scope is specific, but no rules found (applies to nothing). This case might be an admin error.
      //   throw new Error('This coupon is not configured correctly for application (no specific items defined).');
      // }
      logger.info(`Coupon applicability check for scope '${couponDetails.applicable_scope}' would be performed here with cart items.`);
    }

    // If all checks pass:
    logger.info(`Coupon ${normalizedCouponCode} validated successfully for user ${userId}.`);

    // For this subtask, we don't modify CouponUsage or current_uses_total.
    // That happens when the order is placed / payment is confirmed.
    // We return the validated discount details for the cart to use.
    return {
      couponId: couponDetails.coupon_id,
      couponCode: couponDetails.coupon_code,
      discountId: couponDetails.discount_id,
      discountName: couponDetails.discount_name,
      discountType: couponDetails.discount_type,
      discountValue: parseFloat(couponDetails.discount_value), // Ensure it's a number
      applicableScope: couponDetails.applicable_scope,
      // Potentially also return min_purchase_amount if client needs to re-verify or display
    };
  }
};

module.exports = CouponService;
