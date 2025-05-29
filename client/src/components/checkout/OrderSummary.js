import React from 'react';
// import { useCart } from '../../context/CartContext'; // Assuming CartContext will provide cart details

const OrderSummary = ({ cart }) => { // Accept cart as a prop for now
  // const { state: cart } = useCart(); // Or use context directly if preferred for this component

  if (!cart || !cart.items || cart.items.length === 0) {
    return <div style={{padding: '15px', border: '1px solid #e0e0e0', borderRadius: '8px', backgroundColor: '#f9f9f9'}}>Your cart is empty.</div>;
  }

  // Use subtotal & total from cart object if they are pre-calculated by the context/backend
  // Otherwise, calculate them here if needed (though CartContext should ideally provide this)
  const subtotal = cart.subtotal !== undefined 
    ? cart.subtotal 
    : cart.items.reduce((sum, item) => sum + (parseFloat(item.price_at_addition || item.price || 0) * item.quantity), 0);
  
  const total = cart.total !== undefined ? cart.total : subtotal; // Placeholder for shipping/taxes

  const itemStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #eee'
  };
  const lastItemStyle = { ...itemStyle, borderBottom: 'none' };
  const textMuted = { color: '#6c757d', fontSize: '0.9em' };

  return (
    <div style={{ border: '1px solid #e0e0e0', padding: '20px', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
      <h3 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>Order Summary</h3>
      
      {cart.items.map((item, index) => (
        <div key={item.item_id || item.id} style={index === cart.items.length - 1 ? lastItemStyle : itemStyle}>
          <div>
            <span style={{fontWeight: 'bold'}}>{item.product_name || item.name}</span> <span style={textMuted}>x {item.quantity}</span>
          </div>
          <span>${(parseFloat(item.price_at_addition || item.price || 0) * item.quantity).toFixed(2)}</span>
        </div>
      ))}
      
      <div style={{ marginTop: '20px', paddingTop: '10px', borderTop: '2px solid #ccc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>Subtotal:</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#6c757d' }}>
          <span>Shipping:</span>
          <span>TBD</span> 
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', color: '#6c757d' }}>
          <span>Taxes:</span>
          <span>TBD</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.15em', paddingTop: '10px', borderTop: '1px solid #eee' }}>
          <span>Order Total:</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default OrderSummary;
