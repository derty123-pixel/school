// server/src/modules/cart/cart.controller.js
const cartService = require('./cart.service');
const { validationResult } = require('express-validator');

class CartController {
  // This controller relies on 'ensureCart' middleware to populate req.cart
  // and to send back 'X-Cart-ID' header.

  async getCart(req, res) {
    // req.cart should be populated by ensureCart middleware
    if (!req.cart || !req.cart.id) {
      return res.status(400).json({ message: "Cart not initialized for this session." });
    }
    try {
      const cartContents = await cartService.getCartContents(req.cart.id);
      res.status(200).json(cartContents);
    } catch (error) {
      console.error('Error getting cart:', error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to retrieve cart.' });
    }
  }

  async addItem(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (!req.cart || !req.cart.id) {
      return res.status(400).json({ message: "Cart not initialized for this session." });
    }

    const { productId, quantity } = req.body;

    try {
      const updatedCart = await cartService.addItemToCart(req.cart.id, productId, parseInt(quantity, 10));
      res.status(200).json({ message: 'Item added/updated in cart.', cart: updatedCart });
    } catch (error) {
      console.error('Error adding item to cart:', error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to add item to cart.' });
    }
  }

  async updateItemQuantity(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (!req.cart || !req.cart.id) {
      return res.status(400).json({ message: "Cart not initialized for this session." });
    }

    const { cartItemId } = req.params;
    const { quantity } = req.body;

    try {
      const updatedCart = await cartService.updateCartItemQuantity(req.cart.id, cartItemId, parseInt(quantity, 10));
      res.status(200).json({ message: 'Cart item quantity updated.', cart: updatedCart });
    } catch (error) {
      console.error('Error updating cart item quantity:', error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to update item quantity.' });
    }
  }

  async removeItem(req, res) {
    const errors = validationResult(req); // For param validation
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (!req.cart || !req.cart.id) {
      return res.status(400).json({ message: "Cart not initialized for this session." });
    }
    
    const { cartItemId } = req.params;

    try {
      const updatedCart = await cartService.removeCartItem(req.cart.id, cartItemId);
      res.status(200).json({ message: 'Item removed from cart.', cart: updatedCart });
    } catch (error) {
      console.error('Error removing item from cart:', error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to remove item from cart.' });
    }
  }

  async clearCart(req, res) {
    if (!req.cart || !req.cart.id) {
      return res.status(400).json({ message: "Cart not initialized for this session." });
    }

    try {
      const clearedCart = await cartService.clearCart(req.cart.id);
      res.status(200).json({ message: 'Cart cleared successfully.', cart: clearedCart });
    } catch (error) {
      console.error('Error clearing cart:', error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to clear cart.' });
    }
  }
}

module.exports = new CartController();
