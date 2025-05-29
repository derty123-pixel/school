import React from 'react';
import { useLocation, Link } from 'react-router-dom';

const OrderConfirmationPage = () => {
  const location = useLocation();
  const { orderDetails } = location.state || {}; // Safely access state

  if (!orderDetails) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        <h1>Order Confirmation</h1>
        <p>No order details found. This might happen if you navigated here directly.</p>
        <p>If you recently placed an order, please check your email or account page for confirmation.</p>
        <Link to="/">Go to Homepage</Link>
      </div>
    );
  }

  // Assuming orderDetails contains items, total, shippingAddress, etc.
  // For a real app, orderDetails would be fetched or passed carefully.
  // For this simulation, it comes from CheckoutPage's state.

  const { 
    order_number, 
    items, 
    order_total, 
    shipping_address, 
    billing_address 
  } = orderDetails;

  const addressStyle = {
    border: '1px solid #eee',
    padding: '10px',
    margin: '10px 0',
    borderRadius: '5px',
    backgroundColor: '#f9f9f9'
  };
  const itemStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '5px 0',
    borderBottom: '1px dotted #eee'
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '20px auto', fontFamily: 'Arial, sans-serif', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#28a745' }}>Thank You For Your Order!</h1>
        <p style={{ fontSize: '1.1em' }}>Your order has been placed successfully.</p>
        {order_number && <p>Your Order Number is: <strong style={{fontSize: '1.2em'}}>{order_number}</strong></p>}
        <p>A confirmation email (simulated) will be sent to you shortly.</p>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '5px' }}>Order Summary</h3>
        {items && items.map(item => (
          <div key={item.item_id || item.id} style={itemStyle}>
            <span>{item.product_name || item.name} (x{item.quantity})</span>
            <span>${(parseFloat(item.price_at_addition || item.price || 0) * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        {order_total !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2em', paddingTop: '10px', marginTop: '10px', borderTop: '2px solid #333' }}>
            <span>Total Paid:</span>
            <span>${parseFloat(order_total).toFixed(2)}</span>
          </div>
        )}
      </div>

      {shipping_address && (
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{borderBottom: '1px solid #eee', paddingBottom: '5px'}}>Shipping Address</h4>
          <div style={addressStyle}>
            <p>{shipping_address.fullName || ''}</p>
            <p>{shipping_address.street || ''}{shipping_address.apartment ? `, ${shipping_address.apartment}` : ''}</p>
            <p>{shipping_address.city || ''}, {shipping_address.state || ''} {shipping_address.postalCode || ''}</p>
            <p>{shipping_address.country || ''}</p>
            {shipping_address.phoneNumber && <p>Phone: {shipping_address.phoneNumber}</p>}
          </div>
        </div>
      )}
      
      {/* Optional: Display Billing Address if different and available 
      {billing_address && JSON.stringify(billing_address) !== JSON.stringify(shipping_address) && (
         <div style={{ marginBottom: '20px' }}>
          <h4 style={{borderBottom: '1px solid #eee', paddingBottom: '5px'}}>Billing Address</h4>
          <div style={addressStyle}>
            <p>{billing_address.fullName || ''}</p>
            <p>{billing_address.street || ''}{billing_address.apartment ? `, ${billing_address.apartment}` : ''}</p>
            <p>{billing_address.city || ''}, {billing_address.state || ''} {billing_address.postalCode || ''}</p>
            <p>{billing_address.country || ''}</p>
            {billing_address.phoneNumber && <p>Phone: {billing_address.phoneNumber}</p>}
          </div>
        </div>
      )}
      */}


      <div style={{ textAlign: 'center', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
        <Link to="/" style={{ marginRight: '15px', padding: '10px 15px', textDecoration: 'none', backgroundColor: '#007bff', color: 'white', borderRadius: '5px' }}>
          Continue Shopping
        </Link>
        {/* <Link to="/my-orders" style={{padding: '10px 15px', textDecoration: 'none', backgroundColor: '#6c757d', color: 'white', borderRadius: '5px' }}>
          View Order History 
        </Link> */}
      </div>
    </div>
  );
};

export default OrderConfirmationPage;
