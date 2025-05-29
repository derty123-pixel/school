import React from 'react';
import CartItem from '../components/cart/CartItem';
import { useCart } from '../context/CartContext'; // Corrected path
// import { Link } from 'react-router-dom'; // For "Proceed to Checkout" button

const CartPage = () => {
  const { state, clearCartItems, clearCartError } = useCart();
  const { items, cartTotal, subtotal, isLoading, error, cartId } = state; // Assuming subtotal is now part of state from backend

  const handleProceedToCheckout = () => {
    console.log('Proceeding to Checkout with cart ID:', cartId, 'Items:', items);
    alert('Proceed to Checkout clicked! (Functionality TBD)');
  };
  
  const handleClearCart = async () => {
    if(window.confirm("Are you sure you want to clear all items from your cart?")) {
        try {
            await clearCartItems();
        } catch (e) {
            // Error is already set in context, alert for immediate feedback if needed
            // alert(`Failed to clear cart: ${e.message}`);
        }
    }
  }

  if (isLoading && items.length === 0 && !error) { // Initial load
    return <div style={{ padding: '20px', textAlign: 'center' }}><h2>Loading Your Cart...</h2></div>;
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => clearCartError()}>Dismiss</button>
        {/* Optionally, offer to reload cart or go to homepage */}
      </div>
    );
  }

  if (!isLoading && items.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Your Shopping Cart is Empty</h2>
        <p>Looks like you haven't added anything to your cart yet.</p>
        <button onClick={() => window.location.href = '/'}>Continue Shopping</button>
      </div>
    );
  }

  // Use subtotal from state if provided by backend, otherwise calculate for display consistency
  const displaySubtotal = subtotal !== undefined ? subtotal : items.reduce((sum, item) => sum + (parseFloat(item.price_at_addition || 0) * item.quantity), 0);
  const displayTotal = cartTotal !== undefined ? cartTotal : displaySubtotal; // Assuming total is same as subtotal for MVP

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Your Shopping Cart</h1>
      
      {isLoading && <p style={{textAlign: 'center', fontSize: '1.2em'}}>Updating cart...</p>}
      {error && <p style={{textAlign: 'center', color: 'red', background: '#ffe0e0', padding: '10px'}}>Error: {error} <button onClick={clearCartError} style={{marginLeft: '10px'}}>X</button></p>}


      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc' }}>
            <th style={{ textAlign: 'left', padding: '10px' }}>Product</th>
            <th style={{ textAlign: 'right', padding: '10px' }}>Price</th>
            <th style={{ textAlign: 'center', padding: '10px' }}>Quantity</th>
            <th style={{ textAlign: 'right', padding: '10px' }}>Total</th>
            <th style={{ textAlign: 'center', padding: '10px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            // Ensure item has a unique key. item.item_id is from backend cart_items.id
            // item.id might be product.id if mapped differently in context.
            // Assuming item.item_id is the unique cart item identifier.
            <CartItem
              key={item.item_id || item.id} 
              item={item}
              // onUpdateQuantity and onRemoveItem are now handled by CartItem using useCart hook directly
            />
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '20px' }}>
        <div>
          <button 
            onClick={handleClearCart}
            disabled={isLoading || items.length === 0}
            style={{
              padding: '10px 15px', 
              backgroundColor: (isLoading || items.length === 0) ? '#ccc' : '#dc3545', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px', 
              cursor: (isLoading || items.length === 0) ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? 'Clearing...' : 'Clear Cart'}
          </button>
        </div>

        <div style={{ width: '300px', border: '1px solid #ccc', padding: '20px', borderRadius: '5px' }}>
          <h3 style={{ marginTop: '0' }}>Cart Summary</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span>Subtotal:</span>
            <span>${parseFloat(displaySubtotal).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span>Taxes:</span>
            <span>TBD</span> 
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span>Shipping:</span>
            <span>TBD</span>
          </div>
          <hr />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2em', marginTop: '10px' }}>
            <span>Grand Total:</span>
            <span>${parseFloat(displayTotal).toFixed(2)}</span>
          </div>
          <button 
            onClick={handleProceedToCheckout}
            disabled={isLoading || items.length === 0}
            style={{
              width: '100%', 
              padding: '12px', 
              marginTop: '20px', 
              backgroundColor: (isLoading || items.length === 0) ? '#ccc' : '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px', 
              fontSize: '1.1em',
              cursor: (isLoading || items.length === 0) ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? 'Processing...' : 'Proceed to Checkout'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
