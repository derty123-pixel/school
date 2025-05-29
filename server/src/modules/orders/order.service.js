// server/src/modules/orders/order.service.js
const db = require('../../config/database');
const { v4: uuidv4 } = require('uuid'); // For testing, actual order_number generation is different

// Simple order number generator (can be more sophisticated)
const generateOrderNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `ORD-${year}${month}${day}-${randomSuffix}`;
};

class OrderService {
  async createOrderFromCart(userId, cart, shippingAddress, billingAddress) {
    if (!cart || !cart.items || cart.items.length === 0) {
      throw { statusCode: 400, message: 'Cart is empty or invalid.' };
    }
    if (!shippingAddress || !billingAddress) {
        throw { statusCode: 400, message: 'Shipping and billing addresses are required.' };
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const orderNumber = generateOrderNumber();
      // Initial status is 'pending_payment' until webhook confirms Stripe payment.
      const orderStatus = 'pending_payment'; 

      const subtotal = cart.items.reduce((sum, item) => sum + (parseFloat(item.price_at_addition) * item.quantity), 0);
      const shippingCost = 0.00; // Placeholder for MVP
      const taxesTotal = 0.00;   // Placeholder for MVP
      const discountTotal = 0.00; // Placeholder for MVP
      const orderTotal = subtotal + shippingCost + taxesTotal - discountTotal;

      const orderQuery = `
        INSERT INTO orders (
          order_number, user_id, cart_id, order_total, subtotal, shipping_cost, taxes_total, discount_total,
          shipping_address, billing_address, order_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, order_number, order_status, created_at, order_total; 
      `; // Return minimal needed fields initially
      const orderValues = [
        orderNumber, userId, cart.id, orderTotal, subtotal, shippingCost, taxesTotal, discountTotal,
        shippingAddress, billingAddress, orderStatus
      ];
      const orderResult = await client.query(orderQuery, orderValues);
      const newOrder = orderResult.rows[0];

      for (const item of cart.items) {
        const productDetailsResult = await client.query('SELECT name, sku FROM products WHERE id = $1', [item.product_id]);
        const productNameAtOrder = productDetailsResult.rows[0]?.name || 'Unknown Product';
        const productSkuAtOrder = productDetailsResult.rows[0]?.sku || 'N/A';

        const orderItemQuery = `
          INSERT INTO order_items (
            order_id, product_id, quantity, price_paid_per_unit, 
            product_name_at_order, product_sku_at_order
          )
          VALUES ($1, $2, $3, $4, $5, $6);
        `;
        await client.query(orderItemQuery, [
          newOrder.id, item.product_id, item.quantity, parseFloat(item.price_at_addition),
          productNameAtOrder, productSkuAtOrder
        ]);
      }
      
      await client.query('COMMIT');
      // After successful creation, fetch the full order details to return
      // This ensures consistency, especially if any triggers or defaults modified the order.
      return this.getOrderById(newOrder.id, userId, true); // true to bypass ownership check for this internal call

    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505' && error.constraint === 'orders_cart_id_key') {
        throw { statusCode: 409, message: 'This cart has already been processed into an order.' };
      }
      if (error.code === '23503' && error.constraint === 'orders_user_id_fkey') {
        throw { statusCode: 400, message: 'Invalid user.' };
      }
      console.error('Error creating order from cart:', error);
      throw { statusCode: 500, message: 'Failed to create order.' };
    } finally {
      client.release();
    }
  }

  // Refactored: This method is now primarily for client to poll/get latest status after client-side payment success.
  // It does NOT change order status itself. Webhook is the source of truth for payment-related status changes.
  async getOrderStatusAfterClientPayment(orderId, userId, isAdmin = false) {
    const client = await db.pool.connect(); // Use a client for consistent read if needed, or direct pool query
    try {
      // We are just fetching the order. The webhook will have updated its status if payment succeeded.
      const order = await this.getOrderById(orderId, userId, isAdmin); // Uses existing getOrderById
      
      // Log client-side payment success indication (optional)
      console.log(`Client reported successful payment interaction for order ${orderId}. Current status from DB: ${order.order_status}`);
      
      // No status update here. Just return the order as is.
      return order;

    } catch (error) {
      // getOrderById already throws if not found or not authorized
      if (error.statusCode) throw error;
      console.error('Error in getOrderStatusAfterClientPayment:', error);
      throw { statusCode: 500, message: 'Failed to retrieve order status after client payment.' };
    } finally {
        if (client) client.release();
    }
  }


  async getOrderById(orderId, userId, isAdmin = false) {
    const query = `
      SELECT 
        o.*, 
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'quantity', oi.quantity,
            'price_paid_per_unit', oi.price_paid_per_unit,
            'product_name_at_order', oi.product_name_at_order,
            'product_sku_at_order', oi.product_sku_at_order,
            'created_at', oi.created_at
          )
        ) FILTER (WHERE oi.id IS NOT NULL) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1
      GROUP BY o.id;
    `;
    // db.query can be used if not part of a larger transaction managed by a client
    const { rows } = await db.query(query, [orderId]); 
    if (rows.length === 0) {
      throw { statusCode: 404, message: 'Order not found.' };
    }
    const order = rows[0];
    if (!isAdmin && order.user_id !== userId) {
      throw { statusCode: 403, message: 'You are not authorized to view this order.' };
    }
    return order;
  }

  async getOrdersByUserId(userId, { page = 1, limit = 10 }) {
    const offset = (page - 1) * limit;
    const ordersQuery = `
      SELECT 
        o.id, o.order_number, o.order_total, o.order_status, o.created_at,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count 
      FROM orders o
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const countQuery = 'SELECT COUNT(*) FROM orders WHERE user_id = $1;';

    try {
      const ordersResult = await db.query(ordersQuery, [userId, limit, offset]);
      const countResult = await db.query(countQuery, [userId]);
      
      const totalOrders = parseInt(countResult.rows[0].count, 10);
      const totalPages = Math.ceil(totalOrders / limit);

      return {
        orders: ordersResult.rows,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages,
          totalOrders,
          limit: parseInt(limit, 10),
        }
      };
    } catch (error) {
      console.error('Error fetching orders by user ID:', error);
      throw { statusCode: 500, message: 'Failed to retrieve orders.' };
    }
  }
}

module.exports = new OrderService();
