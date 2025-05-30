// server/src/modules/orders/services/order.service.js
const db = require('../../../config/database');
const logger = require('../../../config/logger');

const OrderService = {
  /**
   * Creates a new order, applies discount if a validated coupon is provided,
   * and records coupon usage.
   * All operations are performed within a single database transaction.
   *
   * @param {string} userId - The ID of the user placing the order.
   * @param {object} orderData - Data for the new order.
   * @param {Array<object>} orderData.items - e.g., [{ course_id, quantity, price_at_purchase, title_at_purchase }]
   * @param {object} [orderData.shipping_address] - Shipping address details
   * @param {object} [orderData.billing_address] - Billing address details
   * @param {string} [orderData.payment_method] - e.g. 'stripe_cc'
   * @param {object} [validatedCouponDetails] - Optional. Details of a validated coupon from CouponService.applyCouponToUserCart.
   *        e.g., { couponId, couponCode, discountId, discountType, discountValue }
   * @returns {Promise<object>} The created order object.
   * @throws {Error} If order creation or coupon application fails.
   */
  async createOrder(userId, orderData, validatedCouponDetails = null) {
    const {
      items,
      shipping_address = {},
      billing_address = {},
      payment_method,
      notes,
    } = orderData;

    if (!items || items.length === 0) {
      throw new Error('Order must contain at least one item.');
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Calculate subtotal from items
      let subtotal = 0;
      for (const item of items) {
        if (typeof item.price_at_purchase !== 'number' || typeof item.quantity !== 'number' || item.price_at_purchase < 0 || item.quantity <= 0) {
          throw new Error('Invalid item price or quantity.');
        }
        subtotal += item.price_at_purchase * item.quantity;
      }
      subtotal = parseFloat(subtotal.toFixed(2));

      // 2. Calculate discount amount if a validated coupon is provided
      let discountAmountApplied = 0;
      let finalTotal = subtotal; // Start with subtotal
      let appliedCouponId = null;

      if (validatedCouponDetails && validatedCouponDetails.couponId) {
        appliedCouponId = validatedCouponDetails.couponId;
        const { discountType, discountValue } = validatedCouponDetails;

        if (discountType === 'percentage') {
          discountAmountApplied = (subtotal * (discountValue / 100));
        } else if (discountType === 'fixed_amount') {
          discountAmountApplied = discountValue;
        }

        // Ensure discount doesn't exceed subtotal (or relevant portion if discount is item/category specific - more complex)
        discountAmountApplied = Math.min(discountAmountApplied, subtotal);
        discountAmountApplied = parseFloat(discountAmountApplied.toFixed(2));

        finalTotal = subtotal - discountAmountApplied;
      }
      finalTotal = Math.max(0, finalTotal); // Ensure total is not negative

      // Conceptual: Add shipping_cost and tax_amount if applicable
      // For now, assume they are 0 or calculated elsewhere and part of finalTotal if needed.
      // finalTotal += (orderData.shipping_cost || 0) + (orderData.tax_amount || 0);
      // finalTotal = parseFloat(finalTotal.toFixed(2));


      // 3. Create the Order record
      const orderQuery = `
        INSERT INTO Orders
          (user_id, status, subtotal, discount_amount, final_total, coupon_id,
           shipping_address_line1, shipping_address_line2, shipping_city, shipping_state_province, shipping_postal_code, shipping_country_code,
           billing_address_line1, billing_address_line2, billing_city, billing_state_province, billing_postal_code, billing_country_code,
           payment_method, payment_status, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING *;
      `;
      const orderValues = [
        userId, 'pending', subtotal, discountAmountApplied, finalTotal, appliedCouponId,
        shipping_address.line1, shipping_address.line2, shipping_address.city, shipping_address.state_province, shipping_address.postal_code, shipping_address.country_code,
        billing_address.line1, billing_address.line2, billing_address.city, billing_address.state_province, billing_address.postal_code, billing_address.country_code,
        payment_method, 'pending', notes
      ];
      const { rows: orderRows } = await client.query(orderQuery, orderValues);
      const newOrder = orderRows[0];

      // 4. Create OrderItems records
      for (const item of items) {
        const orderItemQuery = `
          INSERT INTO OrderItems (order_id, course_id, quantity, price_at_purchase, title_at_purchase)
          VALUES ($1, $2, $3, $4, $5);
        `;
        await client.query(orderItemQuery, [newOrder.id, item.course_id, item.quantity, item.price_at_purchase, item.title_at_purchase]);
      }

      // 5. If coupon was applied, record usage and update counters
      if (appliedCouponId && discountAmountApplied >= 0) { // also check discountAmountApplied in case of $0 discount from coupon
        // Record in CouponUsage
        const couponUsageQuery = `
          INSERT INTO CouponUsage (coupon_id, user_id, order_id, discount_amount_applied, used_at)
          VALUES ($1, $2, $3, $4, NOW());
        `;
        await client.query(couponUsageQuery, [appliedCouponId, userId, newOrder.id, discountAmountApplied]);

        // Increment current_uses_total on Coupons table
        const updateCouponUsesQuery = `
          UPDATE Coupons
          SET current_uses_total = current_uses_total + 1, updated_at = NOW()
          WHERE id = $1;
        `;
        await client.query(updateCouponUsesQuery, [appliedCouponId]);

        // Increment current_uses_total on the parent Discounts table
        // (This assumes validatedCouponDetails includes discountId for the parent discount)
        if (validatedCouponDetails.discountId) {
          const updateDiscountUsesQuery = `
            UPDATE Discounts
            SET current_uses_total = current_uses_total + 1, updated_at = NOW()
            WHERE id = $1;
          `;
          await client.query(updateDiscountUsesQuery, [validatedCouponDetails.discountId]);
        }
      }

      await client.query('COMMIT');
      logger.info(`Order ${newOrder.id} created successfully for user ${userId}. Coupon applied: ${appliedCouponId || 'None'}`);
      // Fetch the full order details to return (optional, or newOrder is enough for now)
      return newOrder;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error creating order for user ${userId}: ${error.message}`, { stack: error.stack, orderData, validatedCouponDetails });
      throw error; // Re-throw to be handled by controller
    } finally {
      client.release();
    }
  },

  // Placeholder for other order service methods like findOrderById, updateOrderStatus etc.
  async findOrderById(orderId, userId) {
    // Add logic to fetch order, ensuring user owns it or is admin
    const query = "SELECT * FROM Orders WHERE id = $1 AND (user_id = $2 OR $2 IS NULL /* admin case */);";
    const { rows } = await db.pool.query(query, [orderId, userId]);
    return rows[0] || null;
  }
};

module.exports = OrderService;
