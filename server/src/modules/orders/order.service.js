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
      const orderStatus = 'pending_payment'; // Initial status

      // Calculate totals from cart items (using price_at_addition)
      const subtotal = cart.items.reduce((sum, item) => sum + (parseFloat(item.price_at_addition) * item.quantity), 0);
      // For MVP, shipping, taxes, discounts are placeholders or 0
      const shippingCost = 0.00;
      const taxesTotal = 0.00;
      const discountTotal = 0.00;
      const orderTotal = subtotal + shippingCost + taxesTotal - discountTotal;

      const orderQuery = `
        INSERT INTO orders (
          order_number, user_id, cart_id, order_total, subtotal, shipping_cost, taxes_total, discount_total,
          shipping_address, billing_address, order_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, order_number, order_status, created_at, order_total;
      `;
      const orderValues = [
        orderNumber, userId, cart.id, orderTotal, subtotal, shippingCost, taxesTotal, discountTotal,
        shippingAddress, billingAddress, orderStatus
      ];
      const orderResult = await client.query(orderQuery, orderValues);
      const newOrder = orderResult.rows[0];

      // Create order items from cart items
      for (const item of cart.items) {
        // Fetch current product name and SKU for historical record
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
      
      // Optional: Update shopping_cart status to 'converted_to_order' or similar
      // For now, the UNIQUE constraint on orders.cart_id prevents reuse.
      // await client.query("UPDATE shopping_carts SET status = 'converted' WHERE id = $1", [cart.id]);


      await client.query('COMMIT');
      
      // Return the full order details after successful creation
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

  async confirmPayment(orderId, userId, isAdmin = false) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const orderResult = await client.query('SELECT * FROM orders WHERE id = $1;', [orderId]);
      if (orderResult.rows.length === 0) {
        throw { statusCode: 404, message: 'Order not found.' };
      }
      const order = orderResult.rows[0];

      if (!isAdmin && order.user_id !== userId) {
        throw { statusCode: 403, message: 'You are not authorized to update this order.' };
      }

      if (order.order_status !== 'pending_payment') {
        throw { statusCode: 400, message: `Order status is '${order.order_status}', cannot confirm payment.` };
      }

      // Simulate payment success
      const newStatus = 'confirmed'; // Or 'processing'
      const updatedOrderResult = await client.query(
        'UPDATE orders SET order_status = $1, payment_status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *;',
        [newStatus, 'succeeded', orderId] // Example payment_status
      );
      
      // Future: Deduct inventory here
      // Future: Trigger notifications (email, etc.)

      await client.query('COMMIT');
      // Fetch full order details after payment confirmation
      return this.getOrderById(updatedOrderResult.rows[0].id, userId, isAdmin);

    } catch (error) {
      await client.query('ROLLBACK');
      if (error.statusCode) throw error;
      console.error('Error confirming payment:', error);
      throw { statusCode: 500, message: 'Failed to confirm payment.' };
    } finally {
      client.release();
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
