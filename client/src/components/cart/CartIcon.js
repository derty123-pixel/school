import React from 'react';
import { Link } from 'react-router-dom'; // Assuming React Router for navigation
import { useCart } from '../../context/CartContext'; // Corrected path

// Simple placeholder for a cart icon (e.g., from a library or SVG)
const CartSvgIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A.996.996 0 0020.01 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.9 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
  </svg>
);


const CartIcon = () => {
  const { state } = useCart();
  const { itemCount, isLoading } = state;

  // Optionally, don't show count if loading, or show a spinner
  // For now, just show current itemCount

  return (
    <Link to="/cart" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', position: 'relative' }} aria-label={`View shopping cart with ${itemCount} items`}>
      <CartSvgIcon />
      {!isLoading && itemCount > 0 && (
        <span 
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: 'red',
            color: 'white',
            borderRadius: '50%',
            padding: '2px 6px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            minWidth: '18px',
            textAlign: 'center',
            lineHeight: '14px', // Ensure text is centered vertically
          }}
          aria-live="polite"
        >
          {itemCount}
        </span>
      )}
      {isLoading && (
         <span 
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: 'gray', // Indicate loading
            color: 'white',
            borderRadius: '50%',
            padding: '2px 6px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            minWidth: '18px',
            textAlign: 'center',
            lineHeight: '14px',
          }}
          aria-live="polite"
          aria-label="Loading cart item count"
        >
          ...
        </span>
      )}
      <span style={{ marginLeft: '5px', display: itemCount === 0 && !isLoading ? 'none' : 'inline' }}>Cart</span>
    </Link>
  );
};

export default CartIcon;
