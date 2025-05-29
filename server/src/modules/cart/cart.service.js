// server/src/modules/cart/cart.service.js
const db = require('../../config/database');

class CartService {
  async createCart(userId = null) {
    const query = 'INSERT INTO shopping_carts (user_id) VALUES ($1) RETURNING *;';
    const { rows } = await db.query(query, [userId]);
    return rows[0];
  }

  async getCartById(cartId) {
    const { rows } = await db.query('SELECT * FROM shopping_carts WHERE id = $1;', [cartId]);
    return rows[0]; // Returns undefined if not found
  }

  async getCartByUserId(userId) {
    // A user might have multiple carts if we don't manage them strictly (e.g. old guest carts assigned).
    // For now, assume "active" cart is the most recently updated one for that user.
    // A more robust system might add an 'is_active' or 'status' field to shopping_carts.
    const { rows } = await db.query(
      'SELECT * FROM shopping_carts WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1;',
      [userId]
    );
    return rows[0];
  }

  async assignCartToUser(cartId, userId) {
    const query = 'UPDATE shopping_carts SET user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;';
    const { rows } = await db.query(query, [userId, cartId]);
    if (rows.length === 0) {
        throw { statusCode: 404, message: "Cart not found for assignment." };
    }
    return rows[0];
  }

  async mergeCarts(guestCartId, userCartId) {
    // Move items from guestCart to userCart.
    // Handle conflicts: if item exists in both, sum quantities or use user's item quantity.
    // For MVP, let's sum quantities if product is same.
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const guestItemsResult = await client.query('SELECT * FROM cart_items WHERE cart_id = $1;', [guestCartId]);
      const guestItems = guestItemsResult.rows;

      for (const guestItem of guestItems) {
        // Check if this product already exists in the user's cart
        const userItemResult = await client.query(
          'SELECT * FROM cart_items WHERE cart_id = $1 AND product_id = $2;',
          [userCartId, guestItem.product_id]
        );
        const userItem = userItemResult.rows[0];

        if (userItem) {
          // Product exists, update quantity in user's cart
          const newQuantity = userItem.quantity + guestItem.quantity;
          await client.query(
            'UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;',
            [newQuantity, userItem.id]
          );
        } else {
          // Product does not exist, move item from guest cart to user cart
          await client.query(
            'UPDATE cart_items SET cart_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;',
            [userCartId, guestItem.id]
          );
        }
      }

      // Optionally, delete the guest cart after merging its items
      // For now, let's just mark it as updated (e.g. by user_id assignment if we change logic) or leave it.
      // A better approach for merged carts might be to set a 'status' like 'merged' or delete them.
      // For this merge, we are just moving items. The guest cart itself isn't deleted here.
      // To truly "delete" the guest cart after successful merge:
      await client.query('DELETE FROM shopping_carts WHERE id = $1;', [guestCartId]);
      console.log(`Guest cart ${guestCartId} items merged and cart deleted.`);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error merging carts:', error);
      throw { statusCode: 500, message: 'Error merging shopping carts.' };
    } finally {
      client.release();
    }
  }

  async getCartContents(cartId) {
    const query = `
      SELECT 
        ci.id as item_id, 
        ci.product_id, 
        p.name as product_name, 
        p.sku as product_sku,
        p.image_urls as product_image_urls, 
        ci.quantity, 
        ci.price_at_addition, 
        (ci.quantity * ci.price_at_addition) as line_item_total
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.cart_id = $1
      ORDER BY ci.added_at ASC;
    `;
    const { rows: items } = await db.query(query, [cartId]);

    const subtotal = items.reduce((sum, item) => sum + parseFloat(item.line_item_total), 0);
    // For MVP, taxes and shipping are not calculated.
    const total = subtotal;

    const cartDetails = await this.getCartById(cartId);


    return {
      id: cartId,
      user_id: cartDetails ? cartDetails.user_id : null,
      items,
      subtotal: parseFloat(subtotal.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      updated_at: cartDetails ? cartDetails.updated_at : null,
    };
  }

  async addItemToCart(cartId, productId, quantity) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get product details (price, check existence, stock for future)
      const productResult = await client.query('SELECT price, name FROM products WHERE id = $1 AND is_published = TRUE;', [productId]);
      if (productResult.rows.length === 0) {
        throw { statusCode: 404, message: 'Product not found or not available.' };
      }
      const productPrice = productResult.rows[0].price;
      // Future: Check stock here from product_inventory

      // 2. Check if item already exists in cart
      const existingItemResult = await client.query(
        'SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2;',
        [cartId, productId]
      );
      const existingItem = existingItemResult.rows[0];

      if (existingItem) {
        // Update quantity
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity <= 0) { // If quantity becomes 0 or less, remove item
            await client.query('DELETE FROM cart_items WHERE id = $1;', [existingItem.id]);
        } else {
            await client.query(
                'UPDATE cart_items SET quantity = $1, price_at_addition = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3;',
                [newQuantity, productPrice, existingItem.id] // Always update price_at_addition in case it changed
            );
        }
      } else if (quantity > 0) {
        // Add new item
        await client.query(
          'INSERT INTO cart_items (cart_id, product_id, quantity, price_at_addition) VALUES ($1, $2, $3, $4);',
          [cartId, productId, quantity, productPrice]
        );
      } else {
        // Trying to add 0 or negative quantity for a new item
        throw { statusCode: 400, message: "Quantity must be positive for new cart items."};
      }
      
      // Touch the parent cart's updated_at timestamp
      await client.query('UPDATE shopping_carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1;', [cartId]);

      await client.query('COMMIT');
      return this.getCartContents(cartId);
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.statusCode) throw error; // re-throw custom errors
      console.error('Error adding item to cart:', error);
      throw { statusCode: 500, message: 'Error adding item to cart.' };
    } finally {
      client.release();
    }
  }

  async updateCartItemQuantity(cartId, cartItemId, quantity) {
    if (quantity <= 0) { // If quantity is 0 or less, effectively remove it
      return this.removeCartItem(cartId, cartItemId);
    }

    // Fetch product price again to ensure it's current, or decide if price_at_addition should remain fixed.
    // For cart consistency, price_at_addition should remain fixed unless explicitly stated.
    // So, we only update quantity.
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const itemCheck = await client.query('SELECT product_id FROM cart_items WHERE id = $1 AND cart_id = $2;', [cartItemId, cartId]);
        if(itemCheck.rows.length === 0) {
            throw { statusCode: 404, message: "Cart item not found in the specified cart."};
        }

        // Fetch the original price_at_addition to maintain it, or fetch current product price if business rule is to update price
        // For now, assume we keep the price_at_addition fixed.
        // const productResult = await client.query('SELECT price FROM products WHERE id = $1;', [itemCheck.rows[0].product_id]);
        // const currentProductPrice = productResult.rows[0].price;

        await client.query(
            'UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND cart_id = $3;',
            [quantity, cartItemId, cartId]
        );
        // Touch the parent cart's updated_at timestamp
        await client.query('UPDATE shopping_carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1;', [cartId]);
        await client.query('COMMIT');
        return this.getCartContents(cartId);
    } catch (error) {
        await client.query('ROLLBACK');
        if(error.statusCode) throw error;
        console.error('Error updating cart item quantity:', error);
        throw { statusCode: 500, message: 'Error updating cart item quantity.' };
    } finally {
        client.release();
    }
  }

  async removeCartItem(cartId, cartItemId) {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const deleteResult = await client.query(
            'DELETE FROM cart_items WHERE id = $1 AND cart_id = $2 RETURNING id;',
            [cartItemId, cartId]
        );

        if (deleteResult.rowCount === 0) {
            throw { statusCode: 404, message: 'Cart item not found or does not belong to this cart.' };
        }
        // Touch the parent cart's updated_at timestamp
        await client.query('UPDATE shopping_carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1;', [cartId]);
        await client.query('COMMIT');
        return this.getCartContents(cartId);
    } catch(error) {
        await client.query('ROLLBACK');
        if(error.statusCode) throw error;
        console.error('Error removing cart item:', error);
        throw { statusCode: 500, message: 'Error removing cart item.' };
    } finally {
        client.release();
    }
  }

  async clearCart(cartId) {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM cart_items WHERE cart_id = $1;', [cartId]);
        // Touch the parent cart's updated_at timestamp
        await client.query('UPDATE shopping_carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1;', [cartId]);
        await client.query('COMMIT');
        return this.getCartContents(cartId); // Should be an empty cart
    } catch(error) {
        await client.query('ROLLBACK');
        console.error('Error clearing cart:', error);
        throw { statusCode: 500, message: 'Error clearing cart.' };
    } finally {
        client.release();
    }
  }
}

module.exports = new CartService();
