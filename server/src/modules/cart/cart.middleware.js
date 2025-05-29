// server/src/modules/cart/cart.middleware.js
const cartService = require('./cart.service');

// This middleware ensures that a cart exists for the session (guest or user)
// and attaches it to the request object as req.cart.
// It also handles merging guest cart to user cart on login.
const ensureCart = async (req, res, next) => {
  try {
    let cartIdFromClient = req.headers['x-cart-id']; // Client should send this for guest sessions
    let existingCart;

    if (req.user) { // User is logged in (req.user attached by 'protect' middleware)
      // 1. Check if user has an active cart
      existingCart = await cartService.getCartByUserId(req.user.id);

      // 2. If user has a cart AND there was a guest cart ID from client, try to merge
      if (existingCart && cartIdFromClient && cartIdFromClient !== existingCart.id) {
        const guestCart = await cartService.getCartById(cartIdFromClient);
        if (guestCart && guestCart.user_id === null) { // Ensure it's actually a guest cart
          // Merge guestCart into existingCart
          await cartService.mergeCarts(guestCart.id, existingCart.id);
          // The guest cart (cartIdFromClient) is now merged and can be considered dealt with.
          // Client should stop sending the old guest cart ID.
          // We can clear the X-Cart-ID header or inform client in response.
          // For now, we proceed with user's existingCart.
          // Future: might want to delete the guest cart after merge.
          console.log(`Guest cart ${guestCart.id} merged into user cart ${existingCart.id}`);
          res.setHeader('X-Cart-Merged-To', existingCart.id); // Inform client about merge
        }
      }
      
      // 3. If user has no cart, but there was a guest cart ID, associate it with user
      else if (!existingCart && cartIdFromClient) {
        const guestCart = await cartService.getCartById(cartIdFromClient);
        if (guestCart && guestCart.user_id === null) {
          existingCart = await cartService.assignCartToUser(guestCart.id, req.user.id);
          console.log(`Guest cart ${guestCart.id} assigned to user ${req.user.id}`);
        }
      }
      
      // 4. If user still has no cart (and no guest cart was converted), create one
      if (!existingCart) {
        existingCart = await cartService.createCart(req.user.id);
        console.log(`New cart ${existingCart.id} created for user ${req.user.id}`);
      }
      
      req.cart = existingCart;
      // Set cart ID in response header so client can update its stored guest cart ID if needed
      // (e.g., if a guest cart was just created for a user without one, or merged)
      res.setHeader('X-Cart-ID', req.cart.id); 
      return next();

    } else { // Guest user
      if (cartIdFromClient) {
        existingCart = await cartService.getCartById(cartIdFromClient);
        // Validate it's a guest cart or doesn't exist
        if (existingCart && existingCart.user_id !== null) {
          // This cartId belongs to a logged-in user, guest cannot use it.
          // This scenario should ideally not happen if client clears cartId on logout.
          existingCart = null; // Treat as if no valid cartId was provided
          cartIdFromClient = null; // Clear it so a new one is made
          console.warn(`Guest attempted to use a cart ID (${req.headers['x-cart-id']}) associated with a user.`);
        }
      }

      if (existingCart) {
        req.cart = existingCart;
      } else {
        // No valid cart_id from client or cart not found/invalid, create a new guest cart
        const newGuestCart = await cartService.createCart(null); // null for guest user_id
        req.cart = newGuestCart;
        console.log(`New guest cart ${newGuestCart.id} created.`);
      }
      // Send the cart ID back to the guest client for subsequent requests
      res.setHeader('X-Cart-ID', req.cart.id);
      return next();
    }
  } catch (error) {
    console.error('Error in ensureCart middleware:', error);
    // Decide if this error should prevent further actions or if defaults can be set
    // For now, let's send an error response as cart is crucial.
    return res.status(500).json({ message: 'Error managing shopping cart session.', error: error.message });
  }
};

module.exports = { ensureCart };
